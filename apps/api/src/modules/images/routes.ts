import { randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { PrismaClient } from '@showroom/database';
import type { Logger } from 'pino';
import { requireOwner } from '../../auth.js';
import { ApiError } from '../../errors.js';
import { id } from '../catalogue/validation.js';
import { audit } from '../catalogue/service.js';
import { cloudinaryStorage, type ImageStorage } from './cloudinary.js';
import { Images } from './service.js';
import { imageLimits, validateImage } from './validation.js';

export function imageRoutes(db: PrismaClient, logger: Logger, storage: ImageStorage = cloudinaryStorage()) {
  const router = Router(); const limits = imageLimits();
  const service = new Images(db, storage, logger, limits.PRODUCT_MAX_IMAGES);
  router.use(requireOwner(db));
  const uploadLimit = rateLimit({ windowMs: 60000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many image requests.' } } });
  const binary = express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: limits.IMAGE_MAX_BYTES });
  const base = '/products/:productId/images';
  router.get(base, async (req, res) => res.json({ data: await service.list(id.parse(req.params.productId)) }));
  for (const replace of [false, true]) {
    router.post(replace ? `${base}/:imageId/replace` : base, uploadLimit, binary, async (req, res) => {
      const query = z.object({ alt: z.string().trim().max(500).default('') }).strict().parse(req.query);
      const file = await validateImage(req.body, req.get('content-type')?.split(';')[0] ?? '', limits.IMAGE_MAX_BYTES);
      const data = await service.upload(id.parse(req.params.productId), res.locals.ownerId, file, query.alt, replace ? id.parse(req.params.imageId) : undefined);
      res.status(replace ? 200 : 201).json({ data, ...(replace ? { cleanup: 'queued' } : {}) });
    });
  }
  router.patch(`${base}/order`, async (req, res) => {
    const { imageIds } = z.object({ imageIds: z.array(id).max(10) }).strict().parse(req.body);
    res.json({ data: await service.reorder(id.parse(req.params.productId), res.locals.ownerId, imageIds) });
  });
  router.patch(`${base}/:imageId/primary`, async (req, res) => {
    z.object({}).strict().parse(req.body ?? {});
    res.json({ data: await service.reorder(id.parse(req.params.productId), res.locals.ownerId, [id.parse(req.params.imageId)], true) });
  });
  router.delete(`${base}/:imageId`, async (req, res) => {
    z.object({ confirm: z.literal(true) }).strict().parse(req.body);
    await service.remove(id.parse(req.params.productId), id.parse(req.params.imageId), res.locals.ownerId);
    res.status(202).json({ data: { detached: true, cleanup: 'queued' } });
  });
  router.post('/images/cleanup', uploadLimit, async (req, res) => {
    z.object({}).strict().parse(req.body ?? {});
    res.json({ data: await service.cleanup() });
  });

  const categoryBase = '/categories/:categoryId/image';
  router.post(['/categories/image', categoryBase], uploadLimit, binary, async (req, res) => {
    storage.ready();
    const categoryId = req.params.categoryId;
    const isNew = !categoryId || categoryId === 'new';
    let existingCategory: { id: string; imagePublicId: string | null } | null = null;
    if (!isNew) {
      existingCategory = await db.category.findUnique({ where: { id: id.parse(categoryId) }, select: { id: true, imagePublicId: true } });
      if (!existingCategory) throw new ApiError(404, 'NOT_FOUND', 'Category not found.');
    }
    const file = await validateImage(req.body, req.get('content-type')?.split(';')[0] ?? '', limits.IMAGE_MAX_BYTES);
    const publicId = `showroom/categories/${isNew ? 'draft' : existingCategory!.id}/${randomUUID()}`;
    const remote = await storage.upload(publicId, file.buffer);
    if (existingCategory) {
      const oldPublicId = existingCategory.imagePublicId;
      try {
        await db.$transaction(async tx => {
          await tx.category.update({
            where: { id: existingCategory!.id },
            data: { imageUrl: remote.url, imagePublicId: publicId }
          });
          await audit(tx, res.locals.ownerId, oldPublicId ? 'IMAGE_REPLACE' : 'IMAGE_UPLOAD', 'Category', existingCategory!.id);
        });
      } catch (err) {
        try { await storage.destroy(publicId); } catch (e) { logger.warn({ publicId, err: e }, 'Failed to rollback uploaded category image after DB error'); }
        throw err;
      }
      if (oldPublicId) {
        try { await storage.destroy(oldPublicId); } catch { logger.warn({ oldPublicId }, 'Failed to destroy replaced category image'); }
      }
    }
    res.status(201).json({ data: { url: remote.url, publicId, width: file.width, height: file.height, format: file.format, bytes: file.bytes } });
  });

  router.delete(categoryBase, uploadLimit, async (req, res) => {
    storage.ready();
    const categoryId = id.parse(req.params.categoryId);
    const existing = await db.category.findUnique({ where: { id: categoryId }, select: { id: true, imagePublicId: true } });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Category not found.');
    if (existing.imagePublicId) {
      try { await storage.destroy(existing.imagePublicId); } catch { logger.warn({ publicId: existing.imagePublicId }, 'Failed to destroy category image'); }
    }
    await db.$transaction(async tx => {
      await tx.category.update({ where: { id: categoryId }, data: { imageUrl: null, imagePublicId: null } });
      await audit(tx, res.locals.ownerId, 'IMAGE_DELETE', 'Category', categoryId);
    });
    res.json({ data: { detached: true } });
  });

  router.post('/categories/image/destroy', uploadLimit, async (req, res) => {
    storage.ready();
    const { publicId } = z.object({ publicId: z.string().min(1).max(300) }).strict().parse(req.body);
    if (!publicId.startsWith('showroom/categories/')) {
      throw new ApiError(422, 'INVALID_ASSET', 'Only category assets can be removed through this endpoint.');
    }
    try { await storage.destroy(publicId); } catch { logger.warn({ publicId }, 'Failed to destroy category asset'); }
    res.json({ data: { destroyed: true } });
  });

  router.post('/cms/image', uploadLimit, binary, async (req, res) => {
    storage.ready();
    const slot = z.enum(['sections', 'banners', 'collections', 'general']).default('general').parse(req.query.slot ?? 'general');
    const file = await validateImage(req.body, req.get('content-type')?.split(';')[0] ?? '', limits.IMAGE_MAX_BYTES);
    const publicId = `showroom/cms/${slot}/${randomUUID()}`;
    const remote = await storage.upload(publicId, file.buffer);
    res.status(201).json({ data: { url: remote.url, publicId, width: file.width, height: file.height, format: file.format, bytes: file.bytes } });
  });

  router.post('/cms/image/destroy', uploadLimit, async (req, res) => {
    storage.ready();
    const { publicId } = z.object({ publicId: z.string().min(1).max(300) }).strict().parse(req.body);
    if (!publicId.startsWith('showroom/cms/')) {
      throw new ApiError(422, 'INVALID_ASSET', 'Only CMS assets can be removed through this endpoint.');
    }
    try { await storage.destroy(publicId); } catch { logger.warn({ publicId }, 'Failed to destroy CMS asset'); }
    res.json({ data: { destroyed: true } });
  });

  return router;
}
