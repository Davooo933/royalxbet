import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export function ensureAuthed(req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
        req.user = { id: payload.sub, role: payload.role, email: payload.email };
        next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
export function ensureAdmin(req, res, next) {
    if (req.user?.role !== 'ADMIN')
        return res.status(403).json({ error: 'Forbidden' });
    next();
}
