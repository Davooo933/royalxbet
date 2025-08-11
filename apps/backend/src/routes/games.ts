import { Router } from 'express';
import { PrismaClient, BetStatus } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';

export const router = Router();
const prisma = new PrismaClient();

const betSchema = z.object({
  gameKey: z.enum(['COINFLIP','DICE','CRASH','PLINKO','ROULETTE','SLOTS']),
  wagerCents: z.number().int().positive().max(1_000_000_00),
  selection: z.any(),
  clientSeed: z.string().min(1)
});

function hmacSeed(serverSeed: string, clientSeed: string, nonce: number): Buffer {
  const h = crypto.createHmac('sha256', serverSeed);
  h.update(`${clientSeed}:${nonce}`);
  return h.digest();
}

async function getOrCreateServerSeed(): Promise<{ seed: string; hash: string }> {
  // In production, rotate seeds periodically and store securely
  const seed = process.env.SERVER_SEED || (process.env.SERVER_SEED = crypto.randomBytes(32).toString('hex'));
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return { seed, hash };
}

async function applyRtpController(gameId: string, intendedPayout: number): Promise<boolean> {
  // Smart RTP: target 30% RTP (configurable per game). Allow win only if rolling RTP is below target or randomness allows.
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) return true;
  const windowRounds = await prisma.round.findMany({ where: { gameId }, orderBy: { createdAt: 'desc' }, take: 200 });
  const totals = windowRounds.reduce((acc, r) => { acc.wager += r.totalWagerCents; acc.payout += r.totalPayoutCents; return acc; }, { wager: 0, payout: 0 });
  const currentRtpBp = totals.wager > 0 ? Math.floor((totals.payout * 10000) / totals.wager) : 0;
  const targetBp = game.rtpTargetBp; // e.g., 3000 = 30%

  // If current RTP below target, allow more wins; if above, throttle wins.
  // Probability gate between 10% and 90% biased by deviation
  const deviation = targetBp - currentRtpBp; // positive means we can allow more wins
  const gate = Math.max(0.1, Math.min(0.9, 0.5 + deviation / 10000));
  const roll = Math.random();
  if (intendedPayout <= 0) return false;
  return roll < gate;
}

router.post('/bet', async (req: any, res) => {
  const parsed = betSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { gameKey, wagerCents, selection, clientSeed } = parsed.data as { gameKey: any; wagerCents: number; selection: any; clientSeed: string };
  const userId = req.user!.id as string;

  const game = await prisma.game.findUnique({ where: { key: gameKey } });
  if (!game || !game.isEnabled) return res.status(400).json({ error: 'Game unavailable' });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.balanceCents < wagerCents) return res.status(400).json({ error: 'Insufficient balance' });

  const { seed: serverSeed, hash: serverSeedHash } = await getOrCreateServerSeed();
  const nonce = Math.floor(Date.now() / 1000);

  // Game math
  let payoutMultiplier = 0;
  let resultPayload: any = {};

  const rand = (min: number, max: number, bytes: Buffer) => {
    const num = bytes.readUInt32BE(0) / 0xffffffff;
    return Math.floor(min + num * (max - min + 1));
  };

  const bytes = hmacSeed(serverSeed, clientSeed, nonce);

  switch (gameKey) {
    case 'COINFLIP': {
      // selection: { side: 'HEADS'|'TAILS' }
      const sides = ['HEADS','TAILS'] as const;
      const outcome = sides[rand(0, 1, bytes)];
      const win = selection?.side === outcome;
      payoutMultiplier = win ? 1.9 : 0; // house edge
      resultPayload = { outcome };
      break;
    }
    case 'DICE': {
      // selection: { under: 2..98 }
      const roll = (bytes.readUInt16BE(0) % 10000) / 100; // 0.00 - 99.99
      const under = Math.max(2, Math.min(98, Number(selection?.under || 50)));
      const win = roll < under;
      const fairMultiplier = 100 / under;
      payoutMultiplier = win ? (fairMultiplier * 0.95) : 0; // 5% edge
      resultPayload = { roll, under };
      break;
    }
    case 'CRASH': {
      // simple crash using hash walk
      const crashPoint = Math.max(1.0, Math.floor( (1 / ((bytes[0] / 255) * 0.99 + 0.01)) * 100 ) / 100);
      const cashout = Number(selection?.cashout || 1.5);
      const win = cashout <= crashPoint;
      payoutMultiplier = win ? cashout * 0.98 : 0;
      resultPayload = { crashPoint };
      break;
    }
    case 'PLINKO': {
      const rows = Math.max(8, Math.min(16, Number(selection?.rows || 12)));
      const peg = rand(0, rows, bytes);
      // simple pyramid payouts
      const multipliers = Array.from({ length: rows + 1 }, (_, i) => 0.2 + (i === Math.floor((rows+1)/2) ? 2.0 : i % 2 === 0 ? 0.5 : 0.8));
      payoutMultiplier = multipliers[peg] * 0.95;
      resultPayload = { row: peg, rows };
      break;
    }
    case 'ROULETTE': {
      // European 0-36
      const number = rand(0, 36, bytes);
      const betType = selection?.type || 'RED';
      let win = false;
      let mult = 0;
      if (betType === 'STRAIGHT') {
        win = Number(selection?.number) === number;
        mult = 35;
      } else if (betType === 'RED' || betType === 'BLACK') {
        const redSet = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
        const isRed = redSet.has(number);
        win = number !== 0 && ((betType === 'RED' && isRed) || (betType === 'BLACK' && !isRed));
        mult = 1;
      } else if (betType === 'EVEN' || betType === 'ODD') {
        win = number !== 0 && (number % 2 === (betType === 'EVEN' ? 0 : 1));
        mult = 1;
      }
      payoutMultiplier = win ? mult * 0.97 : 0; // 3% edge
      resultPayload = { number };
      break;
    }
    case 'SLOTS': {
      // 5x3 simple slots with uniform reels
      const symbols = ['A','K','Q','J','10','9','W'];
      const grid = Array.from({ length: 3 }, (_, r) => Array.from({ length: 5 }, (__ , c) => symbols[(bytes[(r*5+c)%bytes.length] % symbols.length)]));
      // Count wins on middle line; W wild
      let line = grid[1];
      let mult = 0;
      const counts: Record<string, number> = {};
      for (const s of line) counts[s] = (counts[s] || 0) + 1;
      const best = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
      if (best) {
        const [sym, cnt] = best;
        if (cnt >= 3) mult = (sym === 'W' ? 3 : 2) * (cnt - 2);
      }
      payoutMultiplier = mult * 0.95;
      resultPayload = { grid };
      break;
    }
  }

  const intendedPayout = Math.floor(wagerCents * payoutMultiplier);
  const allowWin = await applyRtpController(game.id, intendedPayout);
  const finalPayout = allowWin ? intendedPayout : 0;

  // Create round aggregations per bet for simplicity
  const round = await prisma.round.create({ data: { gameId: game.id, resultPayload, totalWagerCents: wagerCents, totalPayoutCents: finalPayout } });

  await prisma.$transaction([
    prisma.bet.create({ data: {
      userId,
      gameId: game.id,
      roundId: round.id,
      wagerCents,
      payoutCents: finalPayout,
      status: finalPayout > 0 ? BetStatus.WON : BetStatus.LOST,
      clientSeed,
      serverSeedHash,
      nonce,
      selection
    } }),
    prisma.user.update({ where: { id: userId }, data: { balanceCents: { decrement: wagerCents - finalPayout } } })
  ]);

  res.json({ roundId: round.id, payoutCents: finalPayout, result: resultPayload, serverSeedHash, nonce });
});