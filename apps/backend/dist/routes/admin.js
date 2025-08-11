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
