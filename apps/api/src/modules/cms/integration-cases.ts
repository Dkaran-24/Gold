import { it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { pino } from 'pino';
import type { PrismaClient } from '@showroom/database';
import { createApp } from '../../app.js';
import type { Config } from '../../config.js';
import { publish } from './service.js';

export function cmsIntegrationCases(context: () => { db: PrismaClient; config: Config; cookie: string; ownerId: string; create: (suffix: string, extra?: object) => Promise<{ id: string }> }) {
  const collections: string[] = [], sections: string[] = [], banners: string[] = [], versions: number[] = [];
  function setup() { const c = context(); const app = createApp(c.db, c.config, pino({ enabled: false })); const api = (method: 'get' | 'post' | 'patch' | 'delete', path: string) => request(app)[method](path).set('Origin', c.config.WEB_ORIGIN).set('Cookie', c.cookie); return { ...c, app, api }; }
  afterAll(async () => { const { db } = context(); await db.homepageVersion.deleteMany({ where: { id: { in: versions } } }); await db.homepageSection.deleteMany({ where: { key: { in: sections } } }); await db.banner.deleteMany({ where: { id: { in: banners } } }); await db.collection.deleteMany({ where: { id: { in: collections } } }); });
  async function section(c: ReturnType<typeof setup>, extra = {}) { const r = await c.api('post', '/api/admin/homepage/sections').send({ type: 'EDITORIAL', internalName: 'Test editorial', heading: 'Draft heading', description: 'Test copy', enabled: true, ...extra }); expect(r.status).toBe(201); sections.push(r.body.data.key); return r.body.data; }
  async function image(c: ReturnType<typeof setup>, suffix: string) { const p = await c.create(suffix, { publication: 'PUBLISHED' }); return c.db.productImage.create({ data: { productId: p.id, publicId: `cms-test-${p.id}`, url: 'https://res.cloudinary.com/test/image/upload/test.png', alt: 'Test', position: 0 } }); }
  it('creates collections, rejects duplicate slugs, updates slugs and manages ordered membership', async () => {
    const c = setup(); const p = await c.create('cms-member', { publication: 'PUBLISHED' }); const hidden = await c.create('cms-hidden');
    const r = await c.api('post', '/api/admin/collections').send({ name: 'Test collection', slug: `cms-${p.id}` }); expect(r.status).toBe(201); const collection = r.body.data; collections.push(collection.id);
    expect((await c.api('post', '/api/admin/collections').send({ name: 'Duplicate', slug: collection.slug })).status).toBe(409);
    const path = `/api/admin/collections/${collection.id}`;
    for (const productId of [p.id, hidden.id]) expect((await c.api('post', `${path}/products`).send({ productId })).status).toBe(201);
    expect((await c.api('post', `${path}/products`).send({ productId: p.id })).status).toBe(409);
    expect((await c.api('post', `${path}/products`).send({ productId: 'missing' })).status).toBe(422);
    expect((await c.api('patch', `${path}/products/order`).send({ ids: [hidden.id, p.id] })).status).toBe(200);
    expect((await c.api('patch', `${path}/products/order`).send({ ids: [p.id] })).status).toBe(422);
    expect((await request(c.app).get(`/api/collections/${collection.slug}`)).status).toBe(404);
    expect((await c.api('patch', path).send({ publication: 'PUBLISHED', slug: `${collection.slug}-new` })).status).toBe(200);
    const publicResult = await request(c.app).get(`/api/collections/${collection.slug}-new`); expect(publicResult.status).toBe(200); expect(publicResult.body.data.products).toHaveLength(1); expect(publicResult.text).not.toContain('privateDetails');
    expect((await c.api('delete', `${path}/products/${hidden.id}`).send({})).status).toBe(204);
    expect((await c.api('post', '/api/admin/collections/order').send({ ids: collections })).status).toBe(200);
    expect((await c.api('delete', path).send({ confirm: true })).status).toBe(204);
    expect((await request(c.app).get(`/api/collections/${collection.slug}-new`)).status).toBe(404);
    expect(await c.db.product.findUnique({ where: { id: p.id } })).not.toBeNull();
  });
  it('validates section references, order, activation and managed images', async () => {
    const c = setup(); const a = await section(c); const b = await section(c, { heading: 'Second' });
    expect((await c.api('post', '/api/admin/homepage/sections').send({ type: 'HERO', heading: 'Bad', internalName: 'Bad' })).status).toBe(422);
    expect((await c.api('post', '/api/admin/homepage/sections').send({ type: 'FEATURED_PRODUCTS', heading: 'Bad', internalName: 'Bad', productId: 'missing' })).status).toBe(422);
    const unpublished = await c.create('cms-unpublished-reference');
    expect((await c.api('post', '/api/admin/homepage/sections').send({ type: 'FEATURED_PRODUCTS', heading: 'Bad', internalName: 'Bad', productId: unpublished.id })).status).toBe(422);
    expect((await c.api('post', '/api/admin/homepage/sections').send({ type: 'BRIDAL', heading: 'Bad', internalName: 'Bad', collectionId: 'missing' })).status).toBe(422);
    expect((await c.api('post', '/api/admin/homepage/sections/order').send({ ids: [b.key, a.key] })).status).toBe(200);
    expect((await c.api('post', '/api/admin/homepage/sections/order').send({ ids: [a.key, a.key] })).status).toBe(422);
    expect((await c.api('patch', `/api/admin/homepage/sections/${b.key}`).send({ enabled: false })).status).toBe(200);
    const preview = await c.api('get', '/api/admin/homepage/preview'); expect(preview.body.data.sections.map((s: { id: string }) => s.id)).not.toContain(b.key);
    const img = await image(c, 'cms-section-image'); await section(c, { type: 'HERO', desktopImageId: img.id, mobileImageId: img.id });
    await expect(c.db.productImage.delete({ where: { id: img.id } })).rejects.toThrow();
  });
  it('isolates drafts, publishes atomically and preserves previous version after failed validation/audit', async () => {
    const c = setup(); const before = await request(c.app).get('/api/homepage'); expect(before.body.data.version).toBeNull();
    const result = await c.api('post', '/api/admin/homepage/publish').send({}); expect(result.status).toBe(200); versions.push(result.body.data.version);
    const old = (await request(c.app).get('/api/homepage')).body.data;
    await c.api('patch', `/api/admin/homepage/sections/${sections[0]}`).send({ heading: 'Unpublished change' });
    expect((await request(c.app).get('/api/homepage')).body.data).toEqual(old);
    expect((await c.api('get', '/api/admin/homepage/preview')).text).toContain('Unpublished change');
    await expect(publish(c.db, 'invalid-audit-owner')).rejects.toThrow();
    expect((await request(c.app).get('/api/homepage')).body.data).toEqual(old);
    const saved = await c.db.homepageSection.findUniqueOrThrow({ where: { key: sections[0] } });
    await c.db.homepageSection.update({ where: { key: saved.key }, data: { type: 'HERO', desktopImageId: null } });
    expect((await c.api('post', '/api/admin/homepage/publish').send({})).status).toBe(422);
    expect((await request(c.app).get('/api/homepage')).body.data).toEqual(old);
    await c.db.homepageSection.update({ where: { key: saved.key }, data: { type: saved.type } });
  });
  it('schedules banners with desktop/mobile images and snapshot isolation', async () => {
    const c = setup(); const img = await image(c, 'cms-banner'); const now = Date.now();
    const base = { internalName: 'Test campaign', heading: 'Campaign', desktopImageId: img.id, mobileImageId: img.id, imageAlt: 'Campaign image', ctaLabel: 'Browse', ctaPath: '/products', active: true, publication: 'PUBLISHED' };
    expect((await c.api('post', '/api/admin/homepage/banners').send({ ...base, startsAt: new Date(now).toISOString(), endsAt: new Date(now - 1000).toISOString() })).status).toBe(422);
    for (const extra of [{}, { startsAt: new Date(now + 3600000).toISOString() }, { endsAt: new Date(now - 1000).toISOString() }, { active: false }, { publication: 'DRAFT' }]) { const r = await c.api('post', '/api/admin/homepage/banners').send({ ...base, ...extra }); expect(r.status).toBe(201); banners.push(r.body.data.id); }
    expect((await c.api('post', '/api/admin/homepage/banners/order').send({ ids: [...banners].reverse() })).status).toBe(200);
    const r = await c.api('post', '/api/admin/homepage/publish').send({}); expect(r.status).toBe(200); versions.push(r.body.data.version);
    const visible = await request(c.app).get('/api/banners'); expect(visible.body.data).toHaveLength(1); expect(visible.body.data[0].desktopImage.id).toBe(img.id); expect(visible.body.data[0].mobileImage.id).toBe(img.id);
    await c.api('patch', `/api/admin/homepage/banners/${banners[0]}`).send({ active: false }); expect((await request(c.app).get('/api/banners')).body.data).toHaveLength(1);
    const updated = await c.api('post', '/api/admin/homepage/publish').send({}); versions.push(updated.body.data.version); expect((await request(c.app).get('/api/banners')).body.data).toHaveLength(0);
    const list = await c.api('get', '/api/admin/homepage/banners'); expect(list.text).toContain('FUTURE'); expect(list.text).toContain('EXPIRED');
  });
  it('protects draft and CMS administration from unauthenticated and invalid sessions', async () => {
    const c = setup();
    for (const path of ['/api/admin/homepage/draft', '/api/admin/homepage/preview', '/api/admin/homepage/sections', '/api/admin/homepage/banners', '/api/admin/collections']) {
      expect((await request(c.app).get(path)).status).toBe(401);
      expect((await request(c.app).get(path).set('Cookie', `showroom_session=${'d'.repeat(64)}`)).status).toBe(401);
    }
    expect((await request(c.app).post('/api/admin/homepage/publish').set('Origin', c.config.WEB_ORIGIN).send({})).status).toBe(401);
    expect((await request(c.app).get('/api/homepage')).text).not.toMatch(/internalName|imagePublicId|content/);
  });
}
