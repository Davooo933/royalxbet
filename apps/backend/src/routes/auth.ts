import { Router } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const router = Router();
const prisma = new PrismaClient();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  referralCode: z.string().optional()
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, referralCode } = parsed.data;

  const passwordHash = await bcrypt.hash(password, 10);
  const referredBy = referralCode ? await prisma.user.findFirst({ where: { referralCode } }) : null;

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: UserRole.USER,
        referralCode: email.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || crypto.randomUUID().slice(0, 12),
        referredById: referredBy?.id
      }
    });
    const token = jwt.sign({ sub: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET || 'changeme', { expiresIn: '7d' });
    return res.json({ token });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already exists' });
    return res.status(500).json({ error: 'Registration failed' });
  }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ sub: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET || 'changeme', { expiresIn: '7d' });
  return res.json({ token });
});