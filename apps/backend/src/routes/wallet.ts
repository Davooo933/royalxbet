import { Router } from 'express';
import { PrismaClient, TxType, TxStatus } from '@prisma/client';
import { z } from 'zod';
// @ts-ignore
import TronWeb from 'tronweb';
import { AuthedRequest } from '../middleware/authz.js';

export const router = Router();
const prisma = new PrismaClient();

const tronWeb = new TronWeb({
  fullHost: process.env.TRON_NETWORK === 'shasta' ? 'https://api.shasta.trongrid.io' : 'https://api.trongrid.io',
  headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' },
  privateKey: process.env.TRON_PRIVATE_KEY || ''
});

router.get('/deposit-address', async (req: AuthedRequest, res) => {
  // For a production setup, generate unique memo/tag or unique derived address per user.
  // Here we reuse the hot wallet address and track by memo (user id).
  const address = tronWeb.address.fromPrivateKey(process.env.TRON_PRIVATE_KEY || '');
  res.json({ address, memo: req.user!.id });
});

const withdrawSchema = z.object({ amountCents: z.number().int().positive(), toAddress: z.string().min(26) });
router.post('/withdraw', async (req: AuthedRequest, res) => {
  const parsed = withdrawSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { amountCents, toAddress } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.balanceCents < amountCents) return res.status(400).json({ error: 'Insufficient balance' });

  // Create withdrawal tx record; actual chain send should be performed by a background worker with approvals and limits
  const tx = await prisma.transaction.create({ data: { userId: user.id, amountCents: -amountCents, currency: 'USDT', type: TxType.WITHDRAWAL, status: TxStatus.PENDING, address: toAddress } });
  await prisma.user.update({ where: { id: user.id }, data: { balanceCents: { decrement: amountCents } } });
  res.json({ ok: true, txId: tx.id });
});