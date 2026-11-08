import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { pino } from 'pino';
import sharp from 'sharp';
import type { PrismaClient } from '@showroom/database';
import { errorHandler } from '../../errors.js';
import { cloudinaryStorage, signature, type ImageStorage } from './cloudinary.js';
import { imageRoutes } from './routes.js';
import { validateImage, imageLimits } from './validation.js';

export const fixture = (format: 'jpeg' | 'png' | 'webp') => sharp({ create: { width: 8, height: 8, channels: 3, background: '#aa8855' } }).toFormat(format).toBuffer();
describe('Image validation and Cloudinary transport', () => {
  for (const format of ['jpeg', 'png', 'webp'] as const) it(`decodes valid ${format}`, async () => {
    expect(await validateImage(await fixture(format), `image/${format}`, 5242880)).toMatchObject({ format, width: 8, height: 8 });
  });
  it('rejects SVG, executable and mismatched/truncated content', async () => {
    for (const data of [Buffer.from('<svg/>'), Buffer.from('MZexe'), (await fixture('png')).subarray(0, 20)]) await expect(validateImage(data, 'image/png', 5242880)).rejects.toMatchObject({ status: 422 });
    await expect(validateImage(await fixture('png'), 'image/jpeg', 5242880)).rejects.toMatchObject({ status: 422 });
  });
  it('enforces size and configuration limits', async () => {
    await expect(validateImage(await fixture('png'), 'image/png', 5)).rejects.toMatchObject({ status: 413 });
    expect(() => imageLimits({ PRODUCT_MAX_IMAGES: '11' })).toThrow();
    expect(() => cloudinaryStorage({}).ready()).toThrow('Configure');
  });
  it('signs requests, validates response identity and never returns provider errors', async () => {
    const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({ public_id: 'trusted', secure_url: 'https://res.cloudinary.com/example/image/upload/trusted.png' })));
    const storage = cloudinaryStorage({ CLOUDINARY_CLOUD_NAME: 'example', CLOUDINARY_API_KEY: 'test-only', CLOUDINARY_API_SECRET: 'test-only-secret' }, transport);
    expect((await storage.upload('trusted', Buffer.from('fixture'))).url).toContain('https:');
    const form = transport.mock.calls[0]![1].body as FormData;
    expect(form.get('signature')).toBe(signature({ public_id: 'trusted', overwrite: 'false', timestamp: String(form.get('timestamp')) }, 'test-only-secret'));
    transport.mockResolvedValue(new Response('secret provider diagnostic', { status: 500 }));
    await expect(storage.upload('trusted', Buffer.from('fixture'))).rejects.toMatchObject({ code: 'IMAGE_STORAGE_ERROR', message: 'Image storage could not complete the operation.' });

    // Missing permissions (403)
    transport.mockResolvedValue(new Response(JSON.stringify({ error: { message: '[prodenv:123] Request forbidden due to missing permissions (actions=["create"])' } }), { status: 403 }));
    await expect(storage.upload('trusted', Buffer.from('fixture'))).rejects.toMatchObject({
      code: 'IMAGE_STORAGE_ERROR',
      message: expect.stringContaining('missing required permissions for action(s) ["create"]'),
    });

    // Invalid API key (401)
    transport.mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Invalid api_key 12345' } }), { status: 401 }));
    await expect(storage.upload('trusted', Buffer.from('fixture'))).rejects.toMatchObject({
      code: 'IMAGE_STORAGE_ERROR',
      message: expect.stringContaining('Invalid or unknown API key'),
    });

    // Invalid signature (401)
    transport.mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Invalid Signature abcdef. String to sign - foo' } }), { status: 401 }));
    await expect(storage.upload('trusted', Buffer.from('fixture'))).rejects.toMatchObject({
      code: 'IMAGE_STORAGE_ERROR',
      message: expect.stringContaining('Invalid signature'),
    });

    // Stale timestamp (400)
    transport.mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Stale request - reported time is more than 1 hour ago' } }), { status: 400 }));
    await expect(storage.upload('trusted', Buffer.from('fixture'))).rejects.toMatchObject({
      code: 'IMAGE_STORAGE_ERROR',
      message: expect.stringContaining('Stale request or invalid timestamp'),
    });

    transport.mockResolvedValue(new Response(JSON.stringify({ result: 'not found' })));
    await expect(storage.destroy('trusted')).resolves.toBeUndefined();
  });
});

describe('Category image management routes', () => {
  function setup() {
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    const storage: ImageStorage = {
      ready: vi.fn(),
      upload: vi.fn().mockImplementation(async (publicId: string) => ({ url: `https://res.cloudinary.com/example/image/upload/${publicId}.png` })),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    const db = {
      session: { findUnique: vi.fn().mockResolvedValue({ expiresAt: new Date(Date.now() + 60000), userId: 'owner1', user: { ownerSlot: 1 } }) },
      category: {
        findUnique: vi.fn().mockResolvedValue({ id: 'cat1', imagePublicId: 'showroom/categories/cat1/old' }),
        update: vi.fn().mockResolvedValue({ id: 'cat1' }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'log1' }) },
      $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
    };
    app.use('/api/admin', imageRoutes(db as unknown as PrismaClient, pino({ enabled: false }), storage));
    app.use(errorHandler(pino({ enabled: false })));
    return { app, storage, db };
  }

  it('uploads a category image for a new category', async () => {
    const { app, storage } = setup();
    const bytes = await fixture('png');
    const res = await request(app)
      .post('/api/admin/categories/image')
      .set('Cookie', `showroom_session=${'a'.repeat(64)}`)
      .set('Content-Type', 'image/png')
      .send(bytes);

    expect(res.status).toBe(201);
    expect(res.body.data.url).toContain('https://res.cloudinary.com');
    expect(res.body.data.publicId).toMatch(/^showroom\/categories\/draft\//);
    expect(storage.upload).toHaveBeenCalledTimes(1);
  });

  it('uploads and replaces image for an existing category, destroying the old asset', async () => {
    const { app, storage, db } = setup();
    const bytes = await fixture('jpeg');
    const res = await request(app)
      .post('/api/admin/categories/cat1/image')
      .set('Cookie', `showroom_session=${'a'.repeat(64)}`)
      .set('Content-Type', 'image/jpeg')
      .send(bytes);

    expect(res.status).toBe(201);
    expect(res.body.data.url).toContain('https://res.cloudinary.com');
    expect(res.body.data.publicId).toMatch(/^showroom\/categories\/cat1\//);
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(storage.destroy).toHaveBeenCalledWith('showroom/categories/cat1/old');
    expect(db.category.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'cat1' },
      data: expect.objectContaining({ imageUrl: expect.any(String), imagePublicId: expect.any(String) }),
    }));
  });

  it('rolls back uploaded Cloudinary asset if database update fails', async () => {
    const { app, storage, db } = setup();
    db.$transaction = vi.fn().mockRejectedValue(new Error('DB failure'));
    const bytes = await fixture('jpeg');
    const res = await request(app)
      .post('/api/admin/categories/cat1/image')
      .set('Cookie', `showroom_session=${'a'.repeat(64)}`)
      .set('Content-Type', 'image/jpeg')
      .send(bytes);

    expect(res.status).toBe(500);
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(storage.destroy).toHaveBeenCalledTimes(1);
    expect(storage.destroy).toHaveBeenCalledWith(expect.stringMatching(/^showroom\/categories\/cat1\//));
    expect(storage.destroy).not.toHaveBeenCalledWith('showroom/categories/cat1/old');
  });

  it('deletes an existing category image and destroys Cloudinary asset', async () => {
    const { app, storage, db } = setup();
    const res = await request(app)
      .delete('/api/admin/categories/cat1/image')
      .set('Cookie', `showroom_session=${'a'.repeat(64)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.detached).toBe(true);
    expect(storage.destroy).toHaveBeenCalledWith('showroom/categories/cat1/old');
    expect(db.category.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'cat1' },
      data: { imageUrl: null, imagePublicId: null },
    }));
  });

  it('destroys a draft category image safely', async () => {
    const { app, storage } = setup();
    const res = await request(app)
      .post('/api/admin/categories/image/destroy')
      .set('Cookie', `showroom_session=${'a'.repeat(64)}`)
      .send({ publicId: 'showroom/categories/draft/abc-123' });

    expect(res.status).toBe(200);
    expect(res.body.data.destroyed).toBe(true);
    expect(storage.destroy).toHaveBeenCalledWith('showroom/categories/draft/abc-123');
  });

  it('refuses to destroy non-category assets', async () => {
    const { app, storage } = setup();
    const res = await request(app)
      .post('/api/admin/categories/image/destroy')
      .set('Cookie', `showroom_session=${'a'.repeat(64)}`)
      .send({ publicId: 'showroom/products/prod1/secret' });

    expect(res.status).toBe(422);
    expect(storage.destroy).not.toHaveBeenCalled();
  });
});

describe('CMS image management routes', () => {
  function setup() {
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    const storage: ImageStorage = {
      ready: vi.fn(),
      upload: vi.fn().mockImplementation(async (publicId: string) => ({ url: `https://res.cloudinary.com/example/image/upload/${publicId}.png` })),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    const db = {
      session: { findUnique: vi.fn().mockResolvedValue({ expiresAt: new Date(Date.now() + 60000), userId: 'owner1', user: { ownerSlot: 1 } }) },
    };
    app.use('/api/admin', imageRoutes(db as unknown as PrismaClient, pino({ enabled: false }), storage));
    app.use(errorHandler(pino({ enabled: false })));
    return { app, storage };
  }

  it('uploads a CMS image to Cloudinary and returns details', async () => {
    const { app, storage } = setup();
    const bytes = await fixture('png');
    const res = await request(app)
      .post('/api/admin/cms/image?slot=sections')
      .set('Cookie', `showroom_session=${'a'.repeat(64)}`)
      .set('Content-Type', 'image/png')
      .send(bytes);

    expect(res.status).toBe(201);
    expect(res.body.data.url).toContain('https://res.cloudinary.com');
    expect(res.body.data.publicId).toMatch(/^showroom\/cms\/sections\//);
    expect(storage.upload).toHaveBeenCalledTimes(1);
  });

  it('destroys a CMS image safely', async () => {
    const { app, storage } = setup();
    const res = await request(app)
      .post('/api/admin/cms/image/destroy')
      .set('Cookie', `showroom_session=${'a'.repeat(64)}`)
      .send({ publicId: 'showroom/cms/sections/test-123' });

    expect(res.status).toBe(200);
    expect(res.body.data.destroyed).toBe(true);
    expect(storage.destroy).toHaveBeenCalledWith('showroom/cms/sections/test-123');
  });

  it('refuses to destroy non-CMS assets from CMS destroy endpoint', async () => {
    const { app, storage } = setup();
    const res = await request(app)
      .post('/api/admin/cms/image/destroy')
      .set('Cookie', `showroom_session=${'a'.repeat(64)}`)
      .send({ publicId: 'showroom/products/prod1/secret' });

    expect(res.status).toBe(422);
    expect(storage.destroy).not.toHaveBeenCalled();
  });
});
