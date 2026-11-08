import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pino } from 'pino';
import { createDatabase } from '@showroom/database';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { digest } from './auth.js';
import { imageIntegrationCases } from './modules/images/integration-cases.js';
import { cmsIntegrationCases } from './modules/cms/integration-cases.js';
import { crmIntegrationCases } from './modules/crm/integration-cases.js';
import { tryOnIntegrationCases } from './modules/tryon/integration-cases.js';

const connection = process.env.SHOWROOM_TEST_DATABASE_URL;
// Integration tests only accept the isolated, loopback test port; never use DATABASE_URL implicitly.
if (connection) {
  const parsed = new URL(connection);
  if (parsed.hostname !== '127.0.0.1' || parsed.port !== '55432' || parsed.username !== 'showroom_test') {
    throw new Error('Integration tests require the isolated showroom_test cluster at 127.0.0.1:55432.');
  }
}

describe.skipIf(!connection)('PostgreSQL integration', () => {
  const db = connection ? createDatabase(connection) : null!;
  const password = randomBytes(24).toString('base64url');
  const unique = randomBytes(8).toString('hex');
  const email = `owner-${unique}@example.test`;
  const config = readConfig({ NODE_ENV: 'test', DATABASE_URL: connection ?? 'postgresql://unused@localhost/unused' });
  const app = createApp(db, config, pino({ enabled: false }));
  let ownerId: string | undefined;
  let categoryId: string | undefined;
  let productId: string | undefined;
  let cookie: string;
  const catalogueProducts: string[] = [];
  const catalogueCategories: string[] = [];
  const admin = (method: 'post' | 'patch' | 'delete' | 'get', path: string) => request(app)[method](path).set('Origin', config.WEB_ORIGIN).set('Cookie', cookie);
  const input = (suffix: string) => ({ name: `Jewellery ${suffix}`, sku: `${unique}-${suffix}`, slug: `jewel-${unique}-${suffix}`, categoryId: categoryId!, metal: 'GOLD', purity: '22K', grossWeight: 10, netWeight: 8 });
  async function create(suffix: string, extra = {}) {
    const response = await admin('post', '/api/admin/products').send({ ...input(suffix), ...extra });
    expect(response.status).toBe(201);
    catalogueProducts.push(response.body.data.id);
    return response.body.data;
  }

  beforeAll(async () => {
    if (await db.user.count()) throw new Error('Test cluster already has an owner. Refusing to modify existing owner data.');
    execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../../../packages/database/scripts/create-owner.ts', import.meta.url))], {
      env: { ...process.env, DATABASE_URL: connection!, OWNER_EMAIL: email, OWNER_PASSWORD: password },
      stdio: 'pipe',
    });
    const owner = await db.user.findUniqueOrThrow({ where: { email } });
    ownerId = owner.id;
    const category = await db.category.create({ data: { name: 'Integration category', slug: `test-${unique}` } });
    categoryId = category.id;
    const login = await request(app).post('/api/auth/login').set('Origin', config.WEB_ORIGIN).send({ email, password });
    expect(login.status).toBe(200);
    cookie = login.headers['set-cookie'][0].split(';')[0];
  });

  afterAll(async () => {
    await db.imageCleanup.deleteMany({ where: { productId: { in: catalogueProducts } } });
    if (ownerId) await db.inventoryHistory.deleteMany({ where: { actorId: ownerId } });
    await db.product.deleteMany({ where: { id: { in: catalogueProducts } } });
    await db.category.deleteMany({ where: { id: { in: catalogueCategories } } });
    if (productId) await db.product.delete({ where: { id: productId } });
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    if (ownerId) {
      await db.auditLog.deleteMany({ where: { actorId: ownerId } });
      await db.user.delete({ where: { id: ownerId } });
    }
    await db.$disconnect();
  });

  imageIntegrationCases(() => ({ db, config, cookie, ownerId: ownerId!, create }));
  cmsIntegrationCases(() => ({ db, config, cookie, ownerId: ownerId!, create }));
  crmIntegrationCases(() => ({ db, config, cookie, ownerId: ownerId!, create }));
  tryOnIntegrationCases(() => ({ db, config, cookie, categoryId: categoryId!, create }));

  it('reports database and applied schema readiness', async () => {
    expect((await request(app).get('/api/health/ready')).status).toBe(200);
  });

  it('supports login, hashed persistent sessions, protected reads and logout', async () => {
    const bad = await request(app).post('/api/auth/login').set('Origin', config.WEB_ORIGIN).send({ email, password: 'incorrect' });
    expect(bad.status).toBe(401);
    const login = await request(app).post('/api/auth/login').set('Origin', config.WEB_ORIGIN).send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.data.email).toBe(email);
    expect(login.headers['set-cookie'][0]).toContain('Path=/;');
    expect(login.headers['set-cookie'][1]).toContain('Path=/api;');
    expect(login.headers['set-cookie'][1]).toContain('Expires=Thu, 01 Jan 1970');
    expect(login.text).not.toContain('passwordHash');
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const rawToken = cookie.split('=')[1];
    const session = await db.session.findFirstOrThrow({ where: { userId: ownerId, tokenHash: digest(rawToken) } });
    expect(session.tokenHash).not.toBe(rawToken);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).get('/api/admin/setup-status').set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).post('/api/auth/logout').set('Origin', config.WEB_ORIGIN).set('Cookie', cookie)).status).toBe(204);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
    expect(await db.session.count({ where: { userId: ownerId, tokenHash: session.tokenHash } })).toBe(0);
  });

  it('creates products, rejects duplicate SKUs and records initial inventory', async () => {
    const p = await create('create');
    expect(p.publication).toBe('DRAFT');
    expect((await admin('post', '/api/admin/products').send({ ...input('create'), slug: `other-${unique}` })).status).toBe(409);
    const history = await admin('get', `/api/admin/products/${p.id}/inventory-history`);
    expect(history.body.data[0]).toMatchObject({ previous: null, next: 'AVAILABLE', actorId: ownerId });
    expect(history.body.data[0].createdAt).toBeTruthy();
  });

  it('validates create and merged update state, rejecting mass assignment', async () => {
    for (const extra of [{ netWeight: 11 }, { grossWeight: -1 }, { enquiryOnly: false }, { privateDetails: { costPrice: 1 } }, { newUntil: '2027-01-01T00:00:00Z' }, { categoryId: 'missing' }]) {
      const result = await admin('post', '/api/admin/products').send({ ...input('invalid'), ...extra });
      expect([409, 422]).toContain(result.status);
    }
    const p = await create('update');
    expect((await admin('patch', `/api/admin/products/${p.id}`).send({ grossWeight: 7 })).status).toBe(422);
    expect((await admin('patch', `/api/admin/products/${p.id}`).send({})).status).toBe(422);
    expect((await admin('patch', `/api/admin/products/${p.id}`).send({ name: 'Updated piece', featured: true })).status).toBe(200);
    expect((await admin('get', `/api/admin/products/${p.id}`)).body.data.name).toBe('Updated piece');
    expect((await admin('patch', '/api/admin/products/missing').send({ name: 'Missing' })).status).toBe(404);
  });

  it('protects every admin product and category route', async () => {
    for (const [method, path] of [['get', '/products'], ['post', '/products'], ['get', '/products/missing'], ['patch', '/products/missing'], ['delete', '/products/missing'], ['patch', '/products/missing/publication'], ['patch', '/products/missing/inventory'], ['get', '/products/missing/inventory-history'], ['get', '/categories'], ['post', '/categories'], ['patch', '/categories/missing'], ['delete', '/categories/missing']] as const) {
      expect((await request(app)[method](`/api/admin${path}`).set('Origin', config.WEB_ORIGIN).send({ confirm: true })).status).toBe(401);
    }
  });

  it('publishes and unpublishes while keeping private data and hidden prices out of public responses', async () => {
    const p = await create('public', { publicPrice: 12345, publicMakingCharge: 150 });
    await db.productPrivate.create({ data: { productId: p.id, costPrice: 8765, internalNotes: 'PRIVATE_MARKER' } });
    expect((await request(app).get(`/api/products/${p.slug}`)).status).toBe(404);
    expect((await admin('patch', `/api/admin/products/${p.id}/publication`).send({ publication: 'PUBLISHED' })).status).toBe(200);
    const response = await request(app).get(`/api/products/${p.slug}`);
    expect(response.status).toBe(200);
    expect(response.body.data.publicPrice).toBeNull();
    expect(response.body.data.publicMakingCharge).toBeNull();
    expect(response.text).not.toMatch(/PRIVATE_MARKER|privateDetails|costPrice|deletedAt|publication/);
    expect((await admin('get', `/api/admin/products/${p.id}`)).body.data.privateDetails.internalNotes).toBe('PRIVATE_MARKER');
    expect((await request(app).get('/api/products').query({ minPrice: 1, search: unique })).body.data).toHaveLength(0);
    await admin('patch', `/api/admin/products/${p.id}`).send({ enquiryOnly: false });
    expect((await request(app).get(`/api/products/${p.slug}`)).body.data.publicPrice).toBe('12345');
    await admin('patch', `/api/admin/products/${p.id}/publication`).send({ publication: 'DRAFT' });
    expect((await request(app).get(`/api/products/${p.slug}`)).status).toBe(404);
  });

  it('records all inventory transitions and serializes concurrent updates', async () => {
    const p = await create('inventory');
    for (const next of ['RESERVED', 'SOLD', 'ARCHIVED', 'AVAILABLE']) {
      expect((await admin('patch', `/api/admin/products/${p.id}/inventory`).send({ availability: next, reason: 'Test transition' })).status).toBe(200);
    }
    await admin('patch', `/api/admin/products/${p.id}/inventory`).send({ availability: 'AVAILABLE' });
    expect(await db.inventoryHistory.count({ where: { productId: p.id } })).toBe(5);
    const concurrent = await Promise.all(['RESERVED', 'SOLD'].map(availability => admin('patch', `/api/admin/products/${p.id}/inventory`).send({ availability })));
    expect(concurrent.map(r => r.status)).toEqual([200, 200]);
    const history = await db.inventoryHistory.findMany({ where: { productId: p.id }, orderBy: { createdAt: 'asc' } });
    expect(history).toHaveLength(7);
    for (let i = 1; i < history.length; i++) expect(history[i]!.previous).toBe(history[i - 1]!.next);
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).availability).toBe(history[6]!.next);
  });

  it('archives, prevents archived publishing, and soft deletes without losing history', async () => {
    const p = await create('delete', { publication: 'PUBLISHED' });
    await admin('patch', `/api/admin/products/${p.id}`).send({ availability: 'ARCHIVED' });
    expect((await request(app).get(`/api/products/${p.slug}`)).status).toBe(404);
    expect((await admin('patch', `/api/admin/products/${p.id}/publication`).send({ publication: 'PUBLISHED' })).status).toBe(422);
    expect((await admin('delete', `/api/admin/products/${p.id}`).send({})).status).toBe(422);
    expect((await admin('delete', `/api/admin/products/${p.id}`).send({ confirm: true })).status).toBe(204);
    expect((await admin('get', `/api/admin/products/${p.id}`)).status).toBe(404);
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).deletedAt).not.toBeNull();
    expect((await admin('get', `/api/admin/products/${p.id}/inventory-history`)).body.pagination.total).toBe(2);
  });

  it('manages categories with safe deletion, HTTPS images, ordering and visibility', async () => {
    const response = await admin('post', '/api/admin/categories').send({ name: 'Category API test', slug: `cat-${unique}`, imageUrl: 'https://example.test/category.jpg', sortOrder: 2 });
    expect(response.status).toBe(201);
    const cid = response.body.data.id; catalogueCategories.push(cid);
    expect((await admin('patch', `/api/admin/categories/${cid}`).send({ imageUrl: 'javascript:alert(1)' })).status).toBe(422);
    const p = await create('category', { categoryId: cid, publication: 'PUBLISHED' });
    expect((await admin('delete', `/api/admin/categories/${cid}`).send({ confirm: true })).status).toBe(409);
    await admin('patch', `/api/admin/categories/${cid}`).send({ visible: false, description: 'Edited', sortOrder: 1 });
    expect((await request(app).get(`/api/products/${p.slug}`)).status).toBe(404);
    expect((await request(app).get('/api/categories').query({ search: 'Category API test' })).body.data).toHaveLength(0);
    expect((await admin('get', '/api/admin/categories').query({ search: 'Category API test' })).body.data[0]).toMatchObject({ description: 'Edited', sortOrder: 1 });
    await admin('patch', `/api/admin/products/${p.id}`).send({ categoryId });
    expect((await admin('delete', `/api/admin/categories/${cid}`).send({ confirm: true })).status).toBe(204);
    expect((await admin('delete', `/api/admin/categories/${cid}`).send({ confirm: true })).status).toBe(404);
  });

  it('searches, filters, paginates, sorts and expires new arrivals dynamically', async () => {
    const now = Date.now();
    await create('filter-a', { publication: 'PUBLISHED', enquiryOnly: false, publicPrice: 200, featured: true, arrivalDate: new Date(now - 60000).toISOString(), newUntil: new Date(now + 60000).toISOString() });
    await create('filter-b', { publication: 'PUBLISHED', enquiryOnly: false, publicPrice: 100, featured: true, arrivalDate: new Date(now - 120000).toISOString(), newUntil: new Date(now - 60000).toISOString() });
    const query = { search: `${unique}-filter`, metal: 'GOLD', purity: '22K', categoryId, sort: 'price-asc', limit: 1 };
    const first = await request(app).get('/api/products').query(query);
    expect(first.body.pagination).toMatchObject({ total: 2, pages: 2 });
    expect(first.body.data[0].publicPrice).toBe('100');
    expect((await request(app).get('/api/products').query({ ...query, page: 2 })).body.data[0].publicPrice).toBe('200');
    const fresh = await request(app).get('/api/products').query({ search: `${unique}-filter`, newArrival: 'true', featured: 'true', minWeight: 9, maxWeight: 11 });
    expect(fresh.body.data).toHaveLength(1); expect(fresh.body.data[0].newArrival).toBe(true);
    for (const invalid of [{ limit: 101 }, { page: 0 }, { sort: 'internalCost' }, { minPrice: 20, maxPrice: 10 }, { featured: 'yes' }, { publication: 'DRAFT' }]) expect((await request(app).get('/api/products').query(invalid)).status).toBe(422);
  });

  it('enforces a single owner at the database layer', async () => {
    await expect(db.user.create({ data: { email: `second-${unique}@example.test`, passwordHash: 'unused' } })).rejects.toThrow();
    await expect(db.user.create({ data: { email: `second-${unique}@example.test`, ownerSlot: 2, passwordHash: 'unused' } })).rejects.toThrow();
  });

  it('enforces weights, SKU uniqueness and category reference integrity', async () => {
    const data = { name: 'Test piece', sku: `TEST-${unique}`, slug: `test-piece-${unique}`, categoryId: categoryId!, metal: 'GOLD' as const, purity: '22K', grossWeight: 10, netWeight: 9 };
    await expect(db.product.create({ data: { ...data, netWeight: 11 } })).rejects.toThrow();
    const product = await db.product.create({ data });
    productId = product.id;
    await expect(db.product.create({ data: { ...data, slug: `duplicate-${unique}` } })).rejects.toThrow();
    await expect(db.category.delete({ where: { id: categoryId } })).rejects.toThrow();
    await expect(db.productImage.create({ data: { productId, publicId: `test-${unique}`, url: 'https://example.test/image.jpg', alt: 'Test', position: 10 } })).rejects.toThrow();
  });
});
