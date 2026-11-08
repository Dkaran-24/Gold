import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@showroom/database';
import type { Logger } from 'pino';
import { ApiError } from '../../errors.js';
import { overlayPrefix } from '../tryon/overlay.js';
import { audit, lockedProduct } from '../catalogue/service.js';
import type { ImageStorage } from './cloudinary.js';
import type { validateImage } from './validation.js';

export const imageDto = <T extends { position: number }>(image: T) => ({ ...image, isPrimary: image.position === 0 });
const prefix = (productId: string) => `showroom/products/${productId}/`;
async function queue(tx: Prisma.TransactionClient, productId: string, publicId: string) {
  await tx.imageCleanup.upsert({ where: { publicId }, create: { productId, publicId, notBefore: new Date() }, update: { notBefore: new Date() } });
}
export class Images {
  constructor(private db: PrismaClient, private storage: ImageStorage, private logger: Logger, private maximum: number) {}
  async list(productId: string) {
    if (!await this.db.product.findUnique({ where: { id: productId } })) throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
    return (await this.db.productImage.findMany({ where: { productId }, orderBy: { position: 'asc' } })).map((image, index) => ({ ...image, isPrimary: index === 0 }));
  }
  private async editable(tx: Prisma.TransactionClient, productId: string) {
    const p = await lockedProduct(tx, productId);
    if (p.availability === 'ARCHIVED') throw new ApiError(409, 'PRODUCT_ARCHIVED', 'Archived products cannot receive image changes.');
    // Preserve legacy galleries with sparse positions; compact in their existing order before editing.
    const images = await tx.productImage.findMany({ where: { productId }, orderBy: { position: 'asc' } });
    for (const [position, image] of images.entries()) if (image.position !== position) await tx.productImage.update({ where: { id: image.id }, data: { position } });
  }
  async upload(productId: string, actorId: string, file: Awaited<ReturnType<typeof validateImage>>, alt: string, replaceId?: string) {
    this.storage.ready();
    const publicId = prefix(productId) + randomUUID();
    await this.db.$transaction(async tx => {
      await this.editable(tx, productId);
      if (replaceId) {
        if (!await tx.productImage.findFirst({ where: { id: replaceId, productId } })) throw new ApiError(404, 'NOT_FOUND', 'Image not found.');
      } else if (await tx.productImage.count({ where: { productId } }) >= this.maximum) throw new ApiError(409, 'IMAGE_LIMIT', 'Product image limit reached.');
      // Persist intent BEFORE sending bytes; a process crash cannot lose the cleanup identity.
      await tx.imageCleanup.create({ data: { publicId, productId, notBefore: new Date(Date.now() + 86400000) } });
    });
    let remote;
    try { remote = await this.storage.upload(publicId, file.buffer); }
    catch (e) { this.logger.warn({ productId }, 'Upload failed; durable cleanup remains scheduled'); throw e; }
    try {
      const result = await this.db.$transaction(async tx => {
        await this.editable(tx, productId);
        // Claim intent; if cleanup already consumed it, never attach a potentially deleted asset.
        await tx.imageCleanup.delete({ where: { publicId } });
        const old = replaceId ? await tx.productImage.findFirst({ where: { id: replaceId, productId } }) : null;
        if (replaceId && !old) throw new ApiError(404, 'NOT_FOUND', 'Image not found.');
        const count = await tx.productImage.count({ where: { productId } });
        if (!old && count >= this.maximum) throw new ApiError(409, 'IMAGE_LIMIT', 'Product image limit reached.');
        const data = { publicId, url: remote.url, alt, format: file.format, width: file.width, height: file.height, bytes: file.bytes };
        const image = old ? await tx.productImage.update({ where: { id: old.id }, data }) : await tx.productImage.create({ data: { ...data, productId, position: count } });
        if (old) await queue(tx, productId, old.publicId);
        await audit(tx, actorId, old ? 'IMAGE_REPLACE' : 'IMAGE_UPLOAD', 'Product', productId);
        return imageDto(image);
      });
      return result;
    } catch (e) {
      // An uncertain commit is safe: cleanup checks for an attached image before destroying anything.
      await this.db.imageCleanup.updateMany({ where: { publicId }, data: { notBefore: new Date() } }).catch(() => this.logger.warn({ productId }, 'Cleanup scheduling deferred; original durable intent retained'));
      throw e;
    }
  }
  async reorder(productId: string, actorId: string, ids: string[], primary = false) {
    return this.db.$transaction(async tx => {
      await this.editable(tx, productId);
      const current = await tx.productImage.findMany({ where: { productId }, orderBy: { position: 'asc' } });
      const order = primary ? [...ids, ...current.map(i => i.id).filter(i => i !== ids[0])] : ids;
      if (new Set(order).size !== order.length || order.length !== current.length || order.some(i => !current.some(c => c.id === i))) throw new ApiError(422, 'INVALID_IMAGE_ORDER', 'Supply every image ID for this product exactly once.');
      for (const [position, imageId] of order.entries()) await tx.productImage.update({ where: { id: imageId }, data: { position } });
      await audit(tx, actorId, 'IMAGE_REORDER', 'Product', productId);
      return (await tx.productImage.findMany({ where: { productId }, orderBy: { position: 'asc' } })).map(imageDto);
    });
  }
  async remove(productId: string, imageId: string, actorId: string) {
    await this.db.$transaction(async tx => {
      // Allow removal from archived/soft-deleted products for explicit owner cleanup.
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
      if (!await tx.product.findUnique({ where: { id: productId } })) throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
      const old = await tx.productImage.findFirst({ where: { id: imageId, productId } });
      if (!old) return; // Scoped idempotent delete; never touches another product's image.
      await queue(tx, productId, old.publicId);
      await tx.productImage.delete({ where: { id: imageId } });
      const remaining = await tx.productImage.findMany({ where: { productId }, orderBy: { position: 'asc' } });
      for (const [position, image] of remaining.entries()) await tx.productImage.update({ where: { id: image.id }, data: { position } });
      await audit(tx, actorId, 'IMAGE_DELETE', 'Product', productId);
    });
  }
  async cleanup() {
    this.storage.ready();
    const candidates = await this.db.imageCleanup.findMany({ where: { notBefore: { lte: new Date() } }, orderBy: { notBefore: 'asc' }, take: 20 });
    let completed = 0; let pending = 0;
    for (const job of candidates) {
      try {
        const destroyed = await this.db.$transaction(async tx => {
          const locked = await tx.$queryRaw<unknown[]>`SELECT "publicId" FROM "ImageCleanup" WHERE "publicId" = ${job.publicId} AND "notBefore" <= NOW() FOR UPDATE SKIP LOCKED`;
          if (!locked.length) return;
          if (await tx.productImage.findUnique({ where: { publicId: job.publicId } })) { await tx.imageCleanup.delete({ where: { publicId: job.publicId } }); return; }
          const isOverlay=job.publicId.startsWith(overlayPrefix(job.productId));
          const managedPrefix=isOverlay?overlayPrefix(job.productId):prefix(job.productId);
          if (!job.publicId.startsWith(managedPrefix) || !/^[a-zA-Z0-9_-]+$/.test(job.productId) || !/^[a-f0-9-]{36}$/.test(job.publicId.slice(managedPrefix.length))) throw new Error('Unmanaged asset');
          if(isOverlay && await tx.tryOnOverlay.findUnique({where:{publicId:job.publicId}})) {
            await tx.imageCleanup.delete({where:{publicId:job.publicId}});return;
          }
          await this.storage.destroy(job.publicId);
          await tx.imageCleanup.delete({ where: { publicId: job.publicId } });
          return true;
        }, { timeout: 40000 });
        if (destroyed) completed++;
      } catch {
        pending++;
        this.logger.warn({ productId: job.productId }, 'Image cleanup failed; retry retained');
        await this.db.imageCleanup.updateMany({ where: { publicId: job.publicId }, data: { attempts: { increment: 1 }, notBefore: new Date(Date.now() + Math.min(86400000, 60000 * 2 ** Math.min(job.attempts, 10))) } });
      }
    }
    return { completed, pending };
  }
}
