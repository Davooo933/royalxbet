import { Router } from 'express';
import { PrismaClient, TxType, TxStatus } from '@prisma/client';
import { z } from 'zod';
export const router = Router();
const prisma = new PrismaClient();
router.get('/stats', async (_req, res) => {
    const [users, bets, txs] = await Promise.all([
        prisma.user.count(),
        prisma.bet.count(),
        prisma.transaction.count()
    ]);
    const profitAgg = await prisma.bet.aggregate({ _sum: { wagerCents: true, payoutCents: true } });
    const grossWager = profitAgg._sum.wagerCents || 0;
    const grossPayout = profitAgg._sum.payoutCents || 0;
    const profit = grossWager - grossPayout;
    res.json({ users, bets, transactions: txs, grossWager, grossPayout, profit });
});
router.get('/games', async (_req, res) => {
    const games = await prisma.game.findMany({ orderBy: { key: 'asc' } });
    res.json(games);
});
const updateGameSchema = z.object({
    isEnabled: z.boolean().optional(),
    rtpTargetBp: z.number().int().min(0).max(10000).optional()
});
router.patch('/games/:key', async (req, res) => {
    const parsed = updateGameSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { key } = req.params;
    try {
        const updated = await prisma.game.update({ where: { key }, data: parsed.data });
        return res.json(updated);
    }
    catch (e) {
        return res.status(404).json({ error: 'Game not found' });
    }
});
const bonusSchema = z.object({ email: z.string().email(), amountCents: z.number().int().positive() });
router.post('/bonus', async (req, res) => {
    const parsed = bonusSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { email, amountCents } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { balanceCents: { increment: amountCents } } }),
        prisma.transaction.create({ data: { userId: user.id, amountCents, currency: 'USDT', type: TxType.BONUS, status: TxStatus.CONFIRMED } })
    ]);
    res.json({ ok: true });
});
