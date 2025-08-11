import { Router } from 'express';
import { PrismaClient, BetStatus } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
export const router = Router();
const prisma = new PrismaClient();
const ALL_GAME_KEYS = [
    'COINFLIP', 'DICE', 'CRASH', 'PLINKO', 'ROULETTE', 'SLOTS',
    'BLACKJACK', 'DOUBLE', 'HILO', 'BINS', 'WHEEL',
    'SLOTS_GATES_OF_OLYMPUS', 'SLOTS_LUCKY_LADYS_CHARM', 'SLOTS_BOOK_OF_RA', 'SLOTS_THE_MONEY_GAME', 'SLOTS_3_COINS_EGYPT', 'SLOTS_GONZOS_QUEST', 'SLOTS_FRUIT_COCKTAIL', 'SLOTS_GHOST_PIRATES'
];
const betSchema = z.object({
    gameKey: z.enum(ALL_GAME_KEYS),
    wagerCents: z.number().int().positive().max(100000000),
    selection: z.any(),
    clientSeed: z.string().min(1)
});
function hmacSeed(serverSeed, clientSeed, nonce) {
    const h = crypto.createHmac('sha256', serverSeed);
    h.update(`${clientSeed}:${nonce}`);
    return h.digest();
}
async function getOrCreateServerSeed() {
    const seed = process.env.SERVER_SEED || (process.env.SERVER_SEED = crypto.randomBytes(32).toString('hex'));
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    return { seed, hash };
}
async function applyRtpController(gameId, intendedPayout) {
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game)
        return true;
    const windowRounds = await prisma.round.findMany({ where: { gameId }, orderBy: { createdAt: 'desc' }, take: 200 });
    const totals = windowRounds.reduce((acc, r) => { acc.wager += r.totalWagerCents; acc.payout += r.totalPayoutCents; return acc; }, { wager: 0, payout: 0 });
    const currentRtpBp = totals.wager > 0 ? Math.floor((totals.payout * 10000) / totals.wager) : 0;
    const targetBp = game.rtpTargetBp; // default 3000 (30%)
    const deviation = targetBp - currentRtpBp;
    const gate = Math.max(0.1, Math.min(0.9, 0.5 + deviation / 10000));
    const roll = Math.random();
    if (intendedPayout <= 0)
        return false;
    return roll < gate;
}
function bytesToFloat01(bytes, offset = 0) {
    const v = bytes.readUInt32BE(offset % (bytes.length - 4));
    return v / 0xffffffff;
}
router.post('/bet', async (req, res) => {
    const parsed = betSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { gameKey, wagerCents, selection, clientSeed } = parsed.data;
    const userId = req.user.id;
    const game = await prisma.game.findUnique({ where: { key: gameKey } });
    if (!game || !game.isEnabled)
        return res.status(400).json({ error: 'Game unavailable' });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    if (user.balanceCents < wagerCents)
        return res.status(400).json({ error: 'Insufficient balance' });
    const { seed: serverSeed, hash: serverSeedHash } = await getOrCreateServerSeed();
    const nonce = Math.floor(Date.now() / 1000);
    let payoutMultiplier = 0;
    let resultPayload = {};
    const randInt = (min, max, bytes, off = 0) => {
        const num = bytes.readUInt32BE(off % (bytes.length - 4)) / 0xffffffff;
        return Math.floor(min + num * (max - min + 1));
    };
    const bytes = hmacSeed(serverSeed, clientSeed, nonce);
    const slotLike = (theme) => {
        const baseSymbols = ['A', 'K', 'Q', 'J', '10', '9', 'W'];
        const themedSymbols = theme ? baseSymbols.map(s => `${s}`) : baseSymbols;
        const grid = Array.from({ length: 3 }, (_, r) => Array.from({ length: 5 }, (__, c) => themedSymbols[(bytes[(r * 5 + c) % bytes.length] % themedSymbols.length)]));
        let line = grid[1];
        let mult = 0;
        const counts = {};
        for (const s of line)
            counts[s] = (counts[s] || 0) + 1;
        const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        if (best) {
            const [sym, cnt] = best;
            if (cnt >= 3)
                mult = (sym.endsWith('W') || sym === 'W' ? 3 : 2) * (cnt - 2);
        }
        payoutMultiplier = mult * 0.95;
        resultPayload = { grid, theme: theme || 'classic' };
    };
    switch (gameKey) {
        case 'COINFLIP': {
            const sides = ['HEADS', 'TAILS'];
            const outcome = sides[randInt(0, 1, bytes)];
            const win = selection?.side === outcome;
            payoutMultiplier = win ? 1.9 : 0;
            resultPayload = { outcome };
            break;
        }
        case 'DICE': {
            const roll = (bytes.readUInt16BE(0) % 10000) / 100;
            const under = Math.max(2, Math.min(98, Number(selection?.under || 50)));
            const win = roll < under;
            const fairMultiplier = 100 / under;
            payoutMultiplier = win ? (fairMultiplier * 0.95) : 0;
            resultPayload = { roll, under };
            break;
        }
        case 'CRASH': {
            const crashPoint = Math.max(1.0, Math.floor((1 / ((bytes[0] / 255) * 0.99 + 0.01)) * 100) / 100);
            const cashout = Number(selection?.cashout || 1.5);
            const win = cashout <= crashPoint;
            payoutMultiplier = win ? cashout * 0.98 : 0;
            resultPayload = { crashPoint };
            break;
        }
        case 'PLINKO': {
            const rows = Math.max(8, Math.min(16, Number(selection?.rows || 12)));
            const peg = randInt(0, rows, bytes);
            const multipliers = Array.from({ length: rows + 1 }, (_, i) => 0.2 + (i === Math.floor((rows + 1) / 2) ? 2.0 : i % 2 === 0 ? 0.5 : 0.8));
            payoutMultiplier = multipliers[peg] * 0.95;
            resultPayload = { row: peg, rows };
            break;
        }
        case 'ROULETTE': {
            const number = randInt(0, 36, bytes);
            const betType = selection?.type || 'RED';
            let win = false;
            let mult = 0;
            if (betType === 'STRAIGHT') {
                win = Number(selection?.number) === number;
                mult = 35;
            }
            else if (betType === 'RED' || betType === 'BLACK') {
                const redSet = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
                const isRed = redSet.has(number);
                win = number !== 0 && ((betType === 'RED' && isRed) || (betType === 'BLACK' && !isRed));
                mult = 1;
            }
            else if (betType === 'EVEN' || betType === 'ODD') {
                win = number !== 0 && (number % 2 === (betType === 'EVEN' ? 0 : 1));
                mult = 1;
            }
            payoutMultiplier = win ? mult * 0.97 : 0;
            resultPayload = { number };
            break;
        }
        case 'SLOTS': {
            slotLike(undefined);
            break;
        }
        case 'BLACKJACK': {
            // one-hand blackjack, dealer hits to 17, no splits/doubles; blackjack 3:2
            const shoe = Array.from({ length: 52 }, (_, i) => i);
            // simple deterministic draws
            const draw = (i) => shoe[i % shoe.length];
            const cardValue = (c) => {
                const r = (c % 13) + 1; // 1..13
                if (r >= 10)
                    return 10;
                if (r === 1)
                    return 11; // ace as 11 initially
                return r;
            };
            const handValue = (cards) => {
                let total = 0;
                let aces = 0;
                for (const c of cards) {
                    const v = cardValue(c);
                    total += v;
                    if (v === 11)
                        aces++;
                }
                while (total > 21 && aces > 0) {
                    total -= 10;
                    aces--;
                }
                return total;
            };
            const player = [draw(bytes[0]), draw(bytes[1])];
            const dealer = [draw(bytes[2]), draw(bytes[3])];
            // player auto: hit until >= 12 + selection.risk(0-9)
            const risk = Math.max(0, Math.min(9, Number(selection?.risk ?? 3)));
            let idx = 4;
            while (handValue(player) < 12 + risk) {
                player.push(draw(bytes[idx++]));
                if (player.length > 8)
                    break;
            }
            // dealer hits to 17
            while (handValue(dealer) < 17) {
                dealer.push(draw(bytes[idx++]));
                if (dealer.length > 8)
                    break;
            }
            const pv = handValue(player);
            const dv = handValue(dealer);
            let outcome = 'LOSE';
            let mult = 0;
            const isBJ = player.length === 2 && pv === 21;
            const dealerBJ = dealer.length === 2 && dv === 21;
            if (pv > 21)
                outcome = 'LOSE';
            else if (dv > 21) {
                outcome = 'WIN';
                mult = 2.0;
            }
            else if (isBJ && !dealerBJ) {
                outcome = 'WIN';
                mult = 2.5;
            }
            else if (pv > dv) {
                outcome = 'WIN';
                mult = 2.0;
            }
            else if (pv === dv) {
                outcome = 'PUSH';
                mult = 1.0;
            }
            else
                outcome = 'LOSE';
            payoutMultiplier = mult - 1.0 > 0 ? (mult - 1.0) + 1.0 - 1.0 + (mult === 1.0 ? 1.0 : (mult - 1.0)) : (mult === 1.0 ? 1.0 : (mult - 1.0));
            // simplify: payout = wager * (mult - 1) + (push -> wager)
            payoutMultiplier = mult === 1.0 ? 1.0 : (mult - 1.0);
            resultPayload = { player, dealer, pv, dv, outcome };
            break;
        }
        case 'DOUBLE': {
            // pick color: RED/BLACK/GREEN with multipliers 2x/2x/14x
            const wheel = ['RED', 'BLACK', 'RED', 'BLACK', 'RED', 'BLACK', 'RED', 'BLACK', 'RED', 'BLACK', 'GREEN', 'RED', 'BLACK', 'RED', 'BLACK'];
            const outcome = wheel[randInt(0, wheel.length - 1, bytes)];
            const pick = String(selection?.color || 'RED').toUpperCase();
            const mult = outcome === 'GREEN' ? 14 : 2;
            payoutMultiplier = pick === outcome ? (mult * 0.98) : 0;
            resultPayload = { outcome };
            break;
        }
        case 'HILO': {
            // reveal current card; guess next higher or lower
            const current = randInt(0, 51, bytes);
            const next = randInt(0, 51, bytes, 4);
            const rank = (c) => (c % 13) + 1;
            const pick = (selection?.pick || 'HIGH').toUpperCase();
            const win = (pick === 'HIGH' && rank(next) > rank(current)) || (pick === 'LOW' && rank(next) < rank(current));
            payoutMultiplier = win ? 1.9 : 0;
            resultPayload = { current, next };
            break;
        }
        case 'BINS': {
            // 10 bins with different multipliers
            const bins = [1.2, 1.5, 1.8, 2.0, 2.2, 3.0, 4.0, 6.0, 10.0, 20.0];
            const outcome = randInt(0, 9, bytes);
            const pick = Math.max(0, Math.min(9, Number(selection?.bin ?? 0)));
            payoutMultiplier = pick === outcome ? bins[outcome] * 0.95 : 0;
            resultPayload = { outcome };
            break;
        }
        case 'WHEEL': {
            // fortune wheel segments
            const segments = [1.5, 2, 3, 5, 10, 20, 50];
            const weights = [30, 25, 20, 12, 8, 4, 1];
            const total = weights.reduce((a, b) => a + b, 0);
            const r = Math.floor(bytesToFloat01(bytes) * total);
            let acc = 0;
            let idx = 0;
            for (let i = 0; i < weights.length; i++) {
                acc += weights[i];
                if (r < acc) {
                    idx = i;
                    break;
                }
            }
            const outcome = idx;
            const pick = Math.max(0, Math.min(segments.length - 1, Number(selection?.segment ?? 0)));
            payoutMultiplier = pick === outcome ? segments[outcome] * 0.97 : 0;
            resultPayload = { outcome, multiplier: segments[outcome] };
            break;
        }
        case 'SLOTS_GATES_OF_OLYMPUS':
        case 'SLOTS_LUCKY_LADYS_CHARM':
        case 'SLOTS_BOOK_OF_RA':
        case 'SLOTS_THE_MONEY_GAME':
        case 'SLOTS_3_COINS_EGYPT':
        case 'SLOTS_GONZOS_QUEST':
        case 'SLOTS_FRUIT_COCKTAIL':
        case 'SLOTS_GHOST_PIRATES': {
            slotLike(gameKey);
            break;
        }
    }
    const intendedPayout = Math.floor(wagerCents * payoutMultiplier);
    const allowWin = await applyRtpController(game.id, intendedPayout);
    const finalPayout = allowWin ? intendedPayout : 0;
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
