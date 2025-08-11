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
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.depositAddress || !user.depositPrivKey) {
    // Derive a new random keypair (hot). In production, use an HD wallet or custody service.
    const pk = TronWeb.utils.accounts.generateRandom();
    const address = pk.address.base58;
    await prisma.user.update({ where: { id: user.id }, data: { depositAddress: address, depositPrivKey: pk.privateKey } });
    return res.json({ address, memo: null });
  }
  return res.json({ address: user.depositAddress, memo: null });
});

const withdrawSchema = z.object({ amountCents: z.number().int().positive(), toAddress: z.string().min(26) });
router.post('/withdraw', async (req: AuthedRequest, res) => {
  const parsed = withdrawSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { amountCents, toAddress } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.balanceCents < amountCents) return res.status(400).json({ error: 'Insufficient balance' });

  const tx = await prisma.transaction.create({ data: { userId: user.id, amountCents: -amountCents, currency: 'USDT', type: TxType.WITHDRAWAL, status: TxStatus.PENDING, address: toAddress } });
  await prisma.user.update({ where: { id: user.id }, data: { balanceCents: { decrement: amountCents } } });
  res.json({ ok: true, txId: tx.id });
});

// Endpoint to trigger a manual deposit scan (placeholder)
router.post('/scan-deposits', async (_req, res) => {
  // In production, implement a scheduled job to scan TRC-20 USDT transfers to user deposit addresses,
  // then credit user balances and mark Transaction records as CONFIRMED.
  res.json({ ok: true });
});