import { it, expect, vi } from 'vitest';
import sharp from 'sharp';
import request from 'supertest';
import type { PrismaClient } from '@showroom/database';
import { pino } from 'pino';
import { createApp } from '../../app.js';
import type { Config } from '../../config.js';
import { Images } from './service.js';
import { validateImage } from './validation.js';

export function imageIntegrationCases(context: () => { db: PrismaClient; config: Config; cookie: string; ownerId: string; create: (suffix: string, extra?: object) => Promise<{ id: string }> }) {
  const storage = { ready: vi.fn(), upload: vi.fn(async (publicId: string) => ({ url: `https://res.cloudinary.com/test/image/upload/${publicId}.png` })), destroy: vi.fn(async (_publicId: string) => {}) };
  const fixture = () => sharp({ create: { width: 4, height: 4, channels: 3, background: '#bb9955' } }).png().toBuffer();
  function setup() {
    const c = context(); const app = createApp(c.db, c.config, pino({ enabled: false }), storage);
    const api = (method: 'post' | 'get' | 'patch' | 'delete', path: string) => request(app)[method](path).set('Origin', c.config.WEB_ORIGIN).set('Cookie', c.cookie);
    return { ...c, app, api, service: new Images(c.db, storage, pino({ enabled: false }), 10) };
  }
  it('uploads, lists, reorders and selects one primary image', async () => {
    const c = setup(); const p = await c.create('image-gallery'); const path = `/api/admin/products/${p.id}/images`;
    const images = [];
    for (let i = 0; i < 3; i++) { const r = await c.api('post', path).query({ alt: 'Jewellery' }).set('Content-Type', 'image/png').send(await fixture()); expect(r.status).toBe(201); images.push(r.body.data.id); }
    expect((await c.api('get', path)).body.data.map((i: { isPrimary: boolean }) => i.isPrimary)).toEqual([true, false, false]);
    expect((await c.api('patch', `${path}/order`).send({ imageIds: [...images].reverse() })).body.data[0].id).toBe(images[2]);
    expect((await c.api('patch', `${path}/${images[1]}/primary`).send({})).body.data[0].id).toBe(images[1]);
    expect((await c.api('patch', `${path}/${images[0]}/primary`).send({})).body.data.filter((i: { isPrimary: boolean }) => i.isPrimary)).toHaveLength(1);
    const old = (await c.api('get', path)).body.data;
    for (const ids of [[images[0], images[0], images[2]], ['foreign'], images.slice(1)]) expect((await c.api('patch', `${path}/order`).send({ imageIds: ids })).status).toBe(422);
    expect((await c.api('get', path)).body.data).toEqual(old);
  });
  it('rejects unauthenticated, missing, archived, oversized and arbitrary-identity uploads', async () => {
    const c = setup(); const p = await c.create('image-security'); const path = `/api/admin/products/${p.id}/images`;
    expect((await request(c.app).post(path).set('Origin', c.config.WEB_ORIGIN).set('Content-Type', 'image/png').send(await fixture())).status).toBe(401);
    expect((await c.api('post', path).set('Content-Type', 'image/png').send(Buffer.alloc(5242881))).status).toBe(413);
    expect((await c.api('post', path).query({ publicId: 'other/asset' }).set('Content-Type', 'image/png').send(await fixture())).status).toBe(422);
    expect((await c.api('post', '/api/admin/products/missing/images').set('Content-Type', 'image/png').send(await fixture())).status).toBe(404);
    await c.db.product.update({ where: { id: p.id }, data: { availability: 'ARCHIVED' } });
    expect((await c.api('post', path).set('Content-Type', 'image/png').send(await fixture())).status).toBe(409);
  });
  it('enforces capacity and product isolation', async () => {
    const c = setup(); const p = await c.create('image-cap'); const other = await c.create('image-other');
    const file = await validateImage(await fixture(), 'image/png', 5242880);
    const small = new Images(c.db, storage, pino({ enabled: false }), 1);
    const image = await small.upload(p.id, c.ownerId, file, '');
    await expect(small.upload(p.id, c.ownerId, file, '')).rejects.toMatchObject({ code: 'IMAGE_LIMIT' });
    await expect(c.service.reorder(other.id, c.ownerId, [image.id])).rejects.toMatchObject({ status: 422 });
    await expect(c.service.upload(other.id, c.ownerId, file, '', image.id)).rejects.toMatchObject({ status: 404 });
    await c.service.remove(other.id, image.id, c.ownerId);
    expect(await c.db.productImage.findUnique({ where: { id: image.id } })).not.toBeNull();
  });
  it('replaces preserving identity/position, detaches primary and retries cleanup failures', async () => {
    const c = setup(); const p = await c.create('image-replace'); const file = await validateImage(await fixture(), 'image/png', 5242880);
    const a = await c.service.upload(p.id, c.ownerId, file, 'a'); const b = await c.service.upload(p.id, c.ownerId, file, 'b');
    const replaced = await c.service.upload(p.id, c.ownerId, file, 'new', a.id);
    expect(replaced).toMatchObject({ id: a.id, position: 0 }); expect(replaced.publicId).not.toBe(a.publicId);
    expect(await c.db.imageCleanup.findUnique({ where: { publicId: a.publicId } })).not.toBeNull();
    storage.destroy.mockRejectedValueOnce(new Error('Provider secret must not escape'));
    expect((await c.service.cleanup()).pending).toBeGreaterThan(0);
    await c.db.imageCleanup.update({ where: { publicId: a.publicId }, data: { notBefore: new Date(0) } });
    expect((await c.service.cleanup()).completed).toBeGreaterThan(0);
    await c.service.remove(p.id, a.id, c.ownerId); await c.service.remove(p.id, a.id, c.ownerId);
    expect(await c.service.list(p.id)).toMatchObject([{ id: b.id, isPrimary: true, position: 0 }]);
    await c.service.remove(p.id, b.id, c.ownerId); expect(await c.service.list(p.id)).toEqual([]);
    await c.service.cleanup();
  });
  it('retains durable upload intents on provider/DB failures and preserves replaced records', async () => {
    const c = setup(); const p = await c.create('image-failures'); const file = await validateImage(await fixture(), 'image/png', 5242880);
    const image = await c.service.upload(p.id, c.ownerId, file, 'original');
    storage.upload.mockRejectedValueOnce(new Error('Simulated timeout'));
    await expect(c.service.upload(p.id, c.ownerId, file, '', image.id)).rejects.toThrow();
    await expect(c.service.upload(p.id, c.ownerId, { ...file, format: 'invalid' }, '', image.id)).rejects.toThrow();
    expect((await c.db.productImage.findUniqueOrThrow({ where: { id: image.id } })).publicId).toBe(image.publicId);
    expect(await c.db.imageCleanup.count({ where: { productId: p.id } })).toBe(2);
    await c.db.imageCleanup.updateMany({ where: { productId: p.id }, data: { notBefore: new Date(0) } });
    await c.service.cleanup();
    expect(await c.db.imageCleanup.count({ where: { productId: p.id } })).toBe(0);
  });
  it('rolls back gallery order on database failure', async () => {
    const c = setup(); const p = await c.create('image-rollback'); const file = await validateImage(await fixture(), 'image/png', 5242880);
    const a = await c.service.upload(p.id, c.ownerId, file, 'a'); const b = await c.service.upload(p.id, c.ownerId, file, 'b');
    // Invalid audit actor causes a real FK failure after position updates inside the transaction.
    await expect(c.service.reorder(p.id, 'nonexistent-owner', [b.id, a.id])).rejects.toThrow();
    expect((await c.service.list(p.id)).map(i => i.id)).toEqual([a.id, b.id]);
  });
  it('enforces capacity across concurrent uploads and recovers the losing asset', async () => {
    const c = setup(); const p = await c.create('image-concurrent'); const file = await validateImage(await fixture(), 'image/png', 5242880);
    const small = new Images(c.db, storage, pino({ enabled: false }), 1);
    const results = await Promise.allSettled([small.upload(p.id, c.ownerId, file, 'a'), small.upload(p.id, c.ownerId, file, 'b')]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await c.db.productImage.count({ where: { productId: p.id } })).toBe(1);
    await c.service.cleanup();
  });
  it('reports missing configuration safely and acknowledges deferred deletion', async () => {
    const c = setup(); const p = await c.create('image-config'); const path = `/api/admin/products/${p.id}/images`;
    // Validate production missing-config behavior using the real adapter, without contacting Cloudinary.
    const { cloudinaryStorage } = await import('./cloudinary.js');
    const missing = createApp(c.db, c.config, pino({ enabled: false }), cloudinaryStorage({}));
    const result = await request(missing).post(path).set('Origin', c.config.WEB_ORIGIN).set('Cookie', c.cookie).set('Content-Type', 'image/png').send(await fixture());
    expect(result.status).toBe(503); expect(result.body.error.code).toBe('IMAGE_STORAGE_NOT_CONFIGURED');
    const uploaded = await c.api('post', path).set('Content-Type', 'image/png').send(await fixture());
    const deleted = await c.api('delete', `${path}/${uploaded.body.data.id}`).send({ confirm: true });
    expect(deleted.status).toBe(202); expect(deleted.body.data.cleanup).toBe('queued');
    expect((await c.api('post', '/api/admin/images/cleanup').send({ publicId: 'untrusted' })).status).toBe(422);
  });
}
