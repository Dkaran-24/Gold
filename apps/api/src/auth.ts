import { createHash, randomBytes } from 'node:crypto';
import { compare } from 'bcryptjs';
import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { PrismaClient } from '@showroom/database';
import type { Config } from './config.js';
import { ApiError } from './errors.js';

export const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const credentials = z.object({
  email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  password: z.string().min(1).max(72).refine(v => Buffer.byteLength(v) <= 72),
}).strict();

export function sessionCookie(config: Config) {
  return { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 8 * 60 * 60 * 1000 };
}

export function requireOwner(db: PrismaClient): RequestHandler {
  return async (req, res, next) => {
    const token: unknown = req.cookies?.showroom_session;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in.');
    const session = await db.session.findUnique({ where: { tokenHash: digest(token) }, include: { user: true } });
    if (!session || session.expiresAt <= new Date() || session.user.ownerSlot !== 1) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has expired. Please sign in.');
    }
    res.locals.ownerId = session.userId;
    res.locals.sessionId = session.id;
    next();
  };
}

export function authRoutes(db: PrismaClient, config: Config) {
  const router = Router();
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again later.' } } });
  router.post('/login', limiter, async (req, res) => {
    const input = credentials.parse(req.body);
    const user = await db.user.findUnique({ where: { email: input.email } });
    // Perform the same work for unknown accounts to reduce account enumeration through timing.
    const fallback = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
    const valid = await compare(input.password, user?.passwordHash ?? fallback);
    if (!user || !valid || user.ownerSlot !== 1) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    const token = randomBytes(32).toString('hex');
    await db.$transaction(async tx => {
      // Revoke an existing browser session on successful login; never reuse a supplied token.
      const previous: unknown = req.cookies?.showroom_session;
      if (typeof previous === 'string') await tx.session.deleteMany({ where: { tokenHash: digest(previous) } });
      await tx.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
      await tx.session.create({ data: { tokenHash: digest(token), userId: user.id, expiresAt: new Date(Date.now() + sessionCookie(config).maxAge) } });
      await tx.auditLog.create({ data: { actorId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id } });
    });
    res.cookie('showroom_session', token, sessionCookie(config));
    // Retire the pre-dashboard cookie so it cannot shadow the root-path session.
    const { maxAge: _legacyAge, ...legacyOptions } = sessionCookie(config);
    res.clearCookie('showroom_session', { ...legacyOptions, path: '/api' });
    res.json({ data: { id: user.id, email: user.email, name: user.name } });
  });
  router.get('/me', requireOwner(db), async (_req, res) => {
    const user = await db.user.findUnique({ where: { id: res.locals.ownerId }, select: { id: true, email: true, name: true } });
    res.json({ data: user });
  });
  router.post('/logout', requireOwner(db), async (_req, res) => {
    await db.session.deleteMany({ where: { id: res.locals.sessionId } });
    const { maxAge: _maxAge, ...options } = sessionCookie(config);
    res.clearCookie('showroom_session', options);
    res.clearCookie('showroom_session', { ...options, path: '/api' });
    res.status(204).end();
  });
  return router;
}
