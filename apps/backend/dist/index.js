import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient, UserRole } from '@prisma/client';
import { router as authRouter } from './routes/auth.js';
import { router as adminRouter } from './routes/admin.js';
import { router as gamesRouter } from './routes/games.js';
import { router as walletRouter } from './routes/wallet.js';
import { ensureAdmin, ensureAuthed } from './middleware/authz.js';
const prisma = new PrismaClient();
const app = express();
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(rateLimit({ windowMs: 60000, limit: 300 }));
app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'casino-backend' });
});
app.use('/auth', authRouter);
app.use('/wallet', ensureAuthed, walletRouter);
app.use('/games', ensureAuthed, gamesRouter);
app.use('/admin', ensureAuthed, ensureAdmin, adminRouter);
const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, async () => {
    // Ensure default games and admins exist
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean);
    for (const email of adminEmails) {
        await prisma.user.upsert({
            where: { email },
            update: { role: UserRole.ADMIN },
            create: { email, passwordHash: '$2a$10$3fYf1tEw8g5dZ3x.2J6vxe3gqOIfuB1uOY2f7oN9Qq6QkZlA14rjK', role: UserRole.ADMIN, referralCode: email.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'admin' }
        });
    }
    // Seed essential games
    const defaultGames = [
        { key: 'COINFLIP', name: 'Coinflip' },
        { key: 'DICE', name: 'Dice' },
        { key: 'CRASH', name: 'Crash' },
        { key: 'PLINKO', name: 'Plinko' },
        { key: 'ROULETTE', name: 'Roulette' },
        { key: 'SLOTS', name: 'Slots' },
        { key: 'BLACKJACK', name: 'Blackjack' },
        { key: 'DOUBLE', name: 'Double' },
        { key: 'HILO', name: 'HiLo' },
        { key: 'BINS', name: 'Bins' },
        { key: 'WHEEL', name: 'Wheel' },
        { key: 'SLOTS_GATES_OF_OLYMPUS', name: 'Slots - Gates of Olympus (theme)' },
        { key: 'SLOTS_LUCKY_LADYS_CHARM', name: 'Slots - Lucky Lady’s Charm (theme)' },
        { key: 'SLOTS_BOOK_OF_RA', name: 'Slots - Book Of Ra (theme)' },
        { key: 'SLOTS_THE_MONEY_GAME', name: 'Slots - The Money Game (theme)' },
        { key: 'SLOTS_3_COINS_EGYPT', name: 'Slots - 3 Coins Egypt (theme)' },
        { key: 'SLOTS_GONZOS_QUEST', name: 'Slots - Gonzo’s Quest (theme)' },
        { key: 'SLOTS_FRUIT_COCKTAIL', name: 'Slots - Fruit Cocktail (theme)' },
        { key: 'SLOTS_GHOST_PIRATES', name: 'Slots - Ghost Pirates (theme)' }
    ];
    for (const g of defaultGames) {
        await prisma.game.upsert({
            where: { key: g.key },
            update: {},
            create: { key: g.key, name: g.name }
        });
    }
    console.log(`Casino backend listening on :${PORT}`);
});
