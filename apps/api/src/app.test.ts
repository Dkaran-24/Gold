import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { pino } from 'pino';
import type { PrismaClient } from '@showroom/database';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { digest, sessionCookie } from './auth.js';

const config = readConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@localhost:5432/test' });
const logger = pino({ enabled: false });
function fixture() {
  const database = {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $transaction: vi.fn().mockResolvedValue({ sections: [], banners: [] }),
    showroomAvailability: { findUnique: vi.fn().mockResolvedValue(null) },
    websiteSetting: { count: vi.fn().mockResolvedValue(0) },
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    session: { findUnique: vi.fn().mockResolvedValue(null), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  return { database, app: createApp(database as unknown as PrismaClient, config, logger) };
}

describe('API security boundary (isolated middleware tests)', () => {
  beforeEach(() => vi.clearAllMocks());
  it('keeps liveness independent of database readiness', async () => {
    const { app, database } = fixture();
    database.$queryRaw.mockRejectedValue(new Error('private database connection string'));
    expect((await request(app).get('/api/health/live')).status).toBe(200);
    const response = await request(app).get('/api/health/ready');
    expect(response.status).toBe(503);
    expect(response.text).not.toContain('private');
  });
  it('does not report ready before migrations exist', async () => {
    const { app, database } = fixture();
    database.websiteSetting.count.mockRejectedValue(new Error('table missing'));
    expect((await request(app).get('/api/health/ready')).status).toBe(503);
  });
  it('rejects cross-origin and origin-less mutations before reading credentials', async () => {
    const { app, database } = fixture();
    for (const origin of [undefined, 'https://attacker.example']) {
      const pending = request(app).post('/api/auth/login');
      if (origin) pending.set('Origin', origin);
      const response = await pending.send({ email: 'owner@example.com', password: 'password' });
      expect(response.status).toBe(403);
    }
    expect(database.user.findUnique).not.toHaveBeenCalled();
  });
  it('validates login bodies on the server', async () => {
    const { app, database } = fixture();
    const response = await request(app).post('/api/auth/login').set('Origin', config.WEB_ORIGIN).send({ email: 'broken', password: '' });
    expect(response.status).toBe(422);
    expect(database.user.findUnique).not.toHaveBeenCalled();
  });
  it('returns structured errors for invalid JSON', async () => {
    const { app } = fixture();
    const response = await request(app).post('/api/auth/login').set('Origin', config.WEB_ORIGIN).set('Content-Type', 'application/json').send('{');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });
  it('protects owner routes with server-side session lookup', async () => {
    const { app, database } = fixture();
    expect((await request(app).get('/api/admin/setup-status')).status).toBe(401);
    expect(database.session.findUnique).not.toHaveBeenCalled();
    const token = 'a'.repeat(64);
    expect((await request(app).get('/api/auth/me').set('Cookie', `showroom_session=${token}`)).status).toBe(401);
    expect(database.session.findUnique).toHaveBeenCalledWith({ where: { tokenHash: digest(token) }, include: { user: true } });
  });
  it('rejects oversized payloads with a safe structured response', async () => {
    const { app } = fixture();
    const response = await request(app).post('/api/auth/login').set('Origin', config.WEB_ORIGIN).send({ password: 'x'.repeat(110000) });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
  it('rejects expired sessions even if the browser sends a cookie', async () => {
    const { app, database } = fixture();
    database.session.findUnique.mockResolvedValue({ expiresAt: new Date(0), user: { ownerSlot: 1 } });
    expect((await request(app).get('/api/auth/me').set('Cookie', `showroom_session=${'b'.repeat(64)}`)).status).toBe(401);
  });
  it('revokes logout sessions and clears the cookie', async () => {
    const { app, database } = fixture();
    database.session.findUnique.mockResolvedValue({ id: 'session1', userId: 'owner1', expiresAt: new Date(Date.now() + 10000), user: { ownerSlot: 1 } });
    const response = await request(app).post('/api/auth/logout').set('Origin', config.WEB_ORIGIN).set('Cookie', `showroom_session=${'c'.repeat(64)}`);
    expect(response.status).toBe(204);
    expect(database.session.deleteMany).toHaveBeenCalledWith({ where: { id: 'session1' } });
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('Path=/;');
    expect(response.headers['set-cookie'][1]).toContain('Path=/api;');
    expect(response.headers['set-cookie'][1]).toContain('Expires=Thu, 01 Jan 1970');
  });
  it('uses secure cookies and refuses HTTP origin in production', () => {
    expect(sessionCookie({ ...config, NODE_ENV: 'production' })).toMatchObject({ secure: true, httpOnly: true, sameSite: 'lax', path: '/' });
    expect(() => readConfig({ ...process.env, NODE_ENV: 'production', DATABASE_URL: config.DATABASE_URL, WEB_ORIGIN: 'http://example.com' })).toThrow('HTTPS');
  });
  it('does not expose a public registration endpoint', async () => {
    const { app } = fixture();
    const response = await request(app).post('/api/auth/register').set('Origin', config.WEB_ORIGIN).send({});
    expect(response.status).toBe(404);
  });
  it('marks successful owner responses private across authentication, CMS and CRM routes', async () => {
    const { app, database } = fixture();
    database.session.findUnique.mockResolvedValue({ expiresAt: new Date(Date.now() + 60000), userId: 'owner', user: { ownerSlot: 1 } });
    database.user.findUnique.mockResolvedValue({ id: 'owner', name: 'Test owner' });
    for (const path of ['/api/auth/me', '/api/admin/homepage/draft', '/api/admin/availability']) {
      await request(app).get(path).set('Cookie', `showroom_session=${'d'.repeat(64)}`).expect(200).expect('Cache-Control', 'private, no-store');
    }
    await request(app).get('/api/contact-options').expect(200).expect('Cache-Control', 'no-store');
  });
  it('protects denied, invalid and failed owner responses from caching', async () => {
    const { app, database } = fixture();
    await request(app).get('/api/admin/products').expect(401).expect('Cache-Control', 'private, no-store');
    await request(app).post('/api/auth/login').expect(403).expect('Cache-Control', 'private, no-store');
    await request(app).post('/api/auth/login').set('Origin', config.WEB_ORIGIN).set('Content-Type', 'application/json').send('{').expect(400).expect('Cache-Control', 'private, no-store');
    database.session.findUnique.mockRejectedValue(new Error('test-only failure'));
    await request(app).get('/api/auth/me').set('Cookie', `showroom_session=${'e'.repeat(64)}`).expect(500).expect('Cache-Control', 'private, no-store');
  });
});
