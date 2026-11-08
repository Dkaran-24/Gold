import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PrismaClient } from '@showroom/database';
import { pino } from 'pino';
import request from 'supertest';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import type { Config } from '../../config.js';
import { ApiError } from '../../errors.js';
import type { TryOnProvider } from './provider.js';
import { createTryOnRuntime } from './runtime.js';

interface Fixture {
  db: PrismaClient;
  config: Config;
  cookie: string;
  categoryId: string;
  create: (suffix: string, extra?: object) => Promise<{ id: string }>;
}

export function tryOnIntegrationCases(context: () => Fixture) {
  describe('virtual try-on', () => {
    let dir: string;
    let app: ReturnType<typeof createApp>;
    let runtime: ReturnType<typeof createTryOnRuntime>;
    let productId: string;
    let overlayImageId: string;
    let guest: string;
    let photo: Buffer;
    let settingsCreated = false;
    const jobIds = new Set<string>();
    const generate = vi.fn<TryOnProvider['generate']>();
    const provider: TryOnProvider = { name: 'test-only', model: 'test-image', configured: true, generate };
    const configuration = () => ({
      photoEnabled: true, arEnabled: true, eligibleCategoryIds: [context().categoryId],
      maxUploadMb: 1, retentionHours: 1, dailyLimit: 100,
    });
    const asset = () => ({ enabled:true, kind:'EARRINGS', overlayImageId, scale:1, offsetX:0, offsetY:0, rotation:0 });
    const owner = (verb: 'get' | 'patch', url: string) =>
      request(app)[verb](url).set('Origin', context().config.WEB_ORIGIN).set('Cookie', context().cookie);
    const configUrl = () => '/api/try-on/products/' + productId + '/config';
    const assetUrl = () => '/api/admin/products/' + productId + '/try-on';
    const settingsUrl = '/api/admin/try-on/settings';
    const analyticsUrl = '/api/admin/try-on/analytics';
    const jobUrl = (id: string) => '/api/try-on/jobs/' + id;
    const consent = () => ({productId, consent:'true', consentVersion:'tryon-photo-v1'});
    const upload = (key = randomUUID(), options = consent(), mime = 'image/png', body = photo) =>
      request(app).post('/api/try-on/photo').query(options).set('Origin', context().config.WEB_ORIGIN)
        .set('Cookie', guest).set('Idempotency-Key', key).set('Content-Type', mime).send(body);
    async function queue() {
      const result = await upload();
      expect(result.status, JSON.stringify(result.body)).toBe(202);
      jobIds.add(result.body.data.id);
      return result.body.data.id as string;
    }
    async function read(id: string) {
      return request(app).get(jobUrl(id)).set('Cookie', guest);
    }
    const mutation = (method: 'post' | 'delete', url: string, cookie = guest) =>
      request(app)[method](url).set('Cookie', cookie).set('Origin', context().config.WEB_ORIGIN);

    beforeAll(async () => {
      const { db, config, create } = context();
      if (await db.tryOnConfiguration.count() || await db.tryOnJob.count() || await db.tryOnUsage.count() || await db.tryOnOverlay.count()) {
        throw new Error('Try-on tests require clean try-on tables in the guarded isolated test cluster.');
      }
      dir = await mkdtemp(join(tmpdir(), 'showroom-tryon-test-'));
      runtime = createTryOnRuntime(db, provider, dir);
      app = createApp(db, config, pino({enabled:false}), undefined, runtime);
      productId = (await create('tryon-fixture', {publication:'PUBLISHED'})).id;
      const image = await db.productImage.create({data:{
        productId, position:0, alt:'try-on test image', format:'png', width:48, height:48,
        publicId:'test-only/' + randomUUID(), url:'https://res.cloudinary.com/test/image/upload/showroom/products/qa/asset.png',
      }});
      overlayImageId = image.id;
      const result = await owner('patch',settingsUrl).send(configuration());
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      settingsCreated = true;
      expect((await owner('patch',assetUrl()).send(asset())).status).toBe(200);
      // Requires the reviewed TryOnOverlay migration on the isolated test DB.
      // This suite is deliberately left skipped while that migration is unapplied.
      await db.tryOnOverlay.create({data:{productId,kind:'EARRINGS',publicId:'test-overlay/'+randomUUID(),
        url:'https://res.cloudinary.com/test/image/upload/overlay.png',format:'png',width:64,height:64,bytes:100,validatedAt:new Date()}});
      const start = await request(app).get(configUrl());
      expect(start.status).toBe(200);
      guest = start.headers['set-cookie'][0].split(';')[0];
      photo = await sharp({create:{width:48,height:48,channels:4,background:'#98764488'}}).png().toBuffer();
      generate.mockResolvedValue({bytes:photo,mime:'image/png'});
    });
    afterAll(async () => {
      const db = context().db;
      if (productId) {
        await db.tryOnOverlay.deleteMany({where:{productId}});
        for (const job of await db.tryOnJob.findMany({where:{productId},select:{id:true}})) jobIds.add(job.id);
        await db.tryOnUsage.deleteMany({where:{jobId:{in:[...jobIds]}}});
        await db.tryOnJob.deleteMany({where:{productId}});
      }
      if (settingsCreated) await db.tryOnConfiguration.delete({where:{id:1}});
      if (dir) {
        for (const file of await readdir(dir)) await unlink(join(dir,file));
        await rmdir(dir);
      }
    });

    it('refreshes guest lifetime without replacing existing job ownership', async () => {
      const response = await request(app).get(configUrl()).set('Cookie',guest);
      const refreshed = response.headers['set-cookie'][0];
      expect(refreshed.split(';')[0]).toBe(guest);
      expect(refreshed).toContain('Max-Age=259200');
      expect(refreshed).toContain('HttpOnly');
      expect(refreshed).toContain('SameSite=Strict');
    });
    it('authenticates every management endpoint and denies wrong-origin writes', async () => {
      for (const url of [settingsUrl,analyticsUrl,assetUrl()]) expect((await request(app).get(url)).status).toBe(401);
      for (const url of [settingsUrl,assetUrl()]) {
        expect((await request(app).patch(url).set('Origin',context().config.WEB_ORIGIN).send({})).status).toBe(401);
      }
      const denied = await request(app).patch(settingsUrl).set('Cookie',context().cookie).set('Origin','https://example.invalid').send(configuration());
      expect(denied.status).toBe(403);
    });
    it('applies explicit category/product eligibility and rejects invalid calibrations', async () => {
      expect((await request(app).get(configUrl())).body.data).toMatchObject({eligible:true,arEnabled:true,photoEnabled:true,kind:'EARRINGS'});
      expect((await owner('patch',assetUrl()).send({...asset(),scale:-1})).status).toBe(422);
      expect((await owner('patch',assetUrl()).send({...asset(),kind:'RING'})).status).toBe(422);
      expect((await owner('patch',settingsUrl).send({...configuration(),eligibleCategoryIds:[]})).status).toBe(200);
      expect((await request(app).get(configUrl())).body.data.eligible).toBe(false);
      expect((await upload()).status).toBeGreaterThanOrEqual(400);
      expect((await owner('patch',settingsUrl).send(configuration())).status).toBe(200);
      expect((await owner('patch',assetUrl()).send({...asset(),enabled:false})).status).toBe(200);
      expect((await request(app).get(configUrl())).body.data.eligible).toBe(false);
      expect((await owner('patch',assetUrl()).send(asset())).status).toBe(200);
    });
    it('requires explicit current consent and validates actual image type and size', async () => {
      for (const consentChange of [{consent:'false'},{consentVersion:'expired'}]) {
        expect((await upload(randomUUID(),{...consent(),...consentChange})).status).toBe(422);
      }
      expect((await upload(randomUUID(),consent(),'image/png',Buffer.from('not an image'))).status).toBe(422);
      expect((await upload(randomUUID(),consent(),'image/jpeg')).status).toBe(422);
      expect([415,422]).toContain((await upload(randomUUID(),consent(),'image/svg+xml',Buffer.from('<svg/>'))).status);
      expect((await upload(randomUUID(),consent(),'image/png',Buffer.alloc(1024*1024+1))).status).toBe(413);
      expect(await context().db.tryOnJob.count({where:{productId}})).toBe(0);
    });
    it('refuses to create jobs when the provider is missing', async () => {
      const unavailable = createTryOnRuntime(context().db,{...provider,configured:false},dir);
      const other = createApp(context().db,context().config,pino({enabled:false}),undefined,unavailable);
      const result = await request(other).post('/api/try-on/photo').query(consent()).set('Origin',context().config.WEB_ORIGIN)
        .set('Cookie',guest).set('Content-Type','image/png').set('Idempotency-Key',randomUUID()).send(photo);
      expect(result.status).toBe(503);
      expect(await context().db.tryOnJob.count({where:{productId}})).toBe(0);
    });
    it('queues an idempotent job and delivers a private result exclusively to its owner', async () => {
      const key = randomUUID();
      const created = await upload(key);
      expect(created.status).toBe(202);
      const id = created.body.data.id;
      jobIds.add(id);
      const repeat = await upload(key);
      expect([200,202]).toContain(repeat.status);
      expect(repeat.body.data.id).toBe(id);
      expect(await context().db.tryOnUsage.count({where:{jobId:id}})).toBe(1);
      const stranger = (await request(app).get(configUrl())).headers['set-cookie'][0].split(';')[0];
      expect((await request(app).get(jobUrl(id)).set('Cookie',stranger)).status).toBe(404);
      expect((await mutation('post',jobUrl(id)+'/retry',stranger)).status).toBe(404);
      expect((await mutation('delete',jobUrl(id),stranger)).status).toBe(404);
      let release!: () => void;
      const held = new Promise<void>(r => {release=r;});
      let started!: () => void;
      const entered = new Promise<void>(r => {started=r;});
      generate.mockImplementationOnce(async () => {started();await held;return {bytes:photo,mime:'image/png'};});
      const completion = runtime.tick();
      try {
        await Promise.race([entered,completion]);
        expect((await read(id)).body.data.status).toBe('PROCESSING');
      } finally {release();await completion;}
      const result = (await read(id)).body.data;
      expect(result.status).toBe('COMPLETED');
      expect(result.resultUrl).toMatch(/^\/api\/try-on\//);
      const forged = new URL(result.resultUrl, 'http://localhost');
      forged.searchParams.set('signature', '0'.repeat(64));
      expect((await request(app).get(forged.pathname + forged.search).set('Cookie',guest)).status).toBe(404);
      expect((await request(app).get(result.resultUrl).set('Cookie',stranger)).status).toBe(404);
      const media = await request(app).get(result.resultUrl).set('Cookie',guest);
      expect(media.status).toBe(200);
      expect(media.headers['cache-control']).toContain('no-store');
      expect((await sharp(media.body).metadata()).width).toBe(48);
      const stats = await owner('get',analyticsUrl);
      expect(stats.body.data.succeeded).toBeGreaterThanOrEqual(1);
      expect(JSON.stringify(stats.body)).not.toContain(id);
      expect((await mutation('delete',jobUrl(id))).status).toBe(204);
      expect((await read(id)).status).toBe(404);
      expect((await request(app).get(result.resultUrl).set('Cookie',guest)).status).toBe(404);
      expect((await readdir(dir)).filter(file=>file.startsWith(id))).toEqual([]);
    });
    it('records failures and enforces the retry limit', async () => {
      const id = await queue();
      let attempts = 0;
      let job;
      do {
        generate.mockRejectedValueOnce(new ApiError(503,'PROVIDER_UNAVAILABLE','private upstream detail'));
        await runtime.tick();
        const status = await read(id);
        expect(status.text).not.toContain('private upstream detail');
        job = status.body.data;
        expect(job.status).toBe('FAILED');
        attempts++;
        if (!job.canRetry) break;
        expect(attempts).toBeLessThan(4);
        expect((await mutation('post',jobUrl(id)+'/retry')).status).toBe(202);
      } while (true);
      expect(attempts).toBeGreaterThan(1);
      expect((await mutation('post',jobUrl(id)+'/retry')).status).toBeGreaterThanOrEqual(400);
      expect(await context().db.tryOnUsage.count({where:{jobId:id,status:'FAILED'}})).toBe(attempts);
      expect((await mutation('delete',jobUrl(id))).status).toBe(204);
    });
    it('expires access before removing temporary media and job metadata', async () => {
      const id = await queue();
      await runtime.tick();
      const url = (await read(id)).body.data.resultUrl;
      await context().db.tryOnJob.update({where:{id},data:{createdAt:new Date(0),expiresAt:new Date(1000)}});
      expect((await read(id)).status).toBe(404);
      expect((await request(app).get(url).set('Cookie',guest)).status).toBe(404);
      await runtime.tick();
      expect(await context().db.tryOnJob.findUnique({where:{id}})).toBeNull();
      expect((await readdir(dir)).filter(file=>file.startsWith(id))).toEqual([]);
      expect(await context().db.tryOnUsage.count({where:{jobId:id}})).toBe(1);
    });
    it('does not deliver a job withdrawn from public eligibility before dispatch', async () => {
      const id = await queue();
      const before = generate.mock.calls.length;
      await context().db.product.update({where:{id:productId},data:{publication:'DRAFT'}});
      try {
        await runtime.tick();
        expect(generate.mock.calls.length).toBe(before);
        expect((await read(id)).body.data.status).toBe('FAILED');
      } finally {
        await context().db.product.update({where:{id:productId},data:{publication:'PUBLISHED'}});
        await mutation('delete',jobUrl(id));
      }
    });
    it('cannot resurrect a preview deleted during a provider call', async () => {
      const id = await queue();
      let release!: () => void;
      let entered!: () => void;
      const pending = new Promise<void>(done => { release = done; });
      const start = new Promise<void>(done => { entered = done; });
      generate.mockImplementationOnce(async () => {
        entered();
        await pending;
        return {bytes:photo,mime:'image/png'};
      });
      const work = runtime.tick();
      try {
        await Promise.race([start,work]);
        expect((await mutation('delete',jobUrl(id))).status).toBe(204);
      } finally { release(); await work; }
      expect((await read(id)).status).toBe(404);
      expect((await readdir(dir)).filter(file=>file.startsWith(id))).toEqual([]);
    });
    it('enforces the daily limit across separate guest cookies', async () => {
      // Admission is global. A fresh anonymous session cannot reset the budget.
      expect((await owner('patch',settingsUrl).send({...configuration(),dailyLimit:1})).status).toBe(200);
      const other = (await request(app).get(configUrl())).headers['set-cookie'][0].split(';')[0];
      const result = await request(app).post('/api/try-on/photo').query(consent()).set('Cookie',other)
        .set('Origin',context().config.WEB_ORIGIN).set('Idempotency-Key',randomUUID()).set('Content-Type','image/png').send(photo);
      expect(result.status).toBe(429);
    });
  });
}
