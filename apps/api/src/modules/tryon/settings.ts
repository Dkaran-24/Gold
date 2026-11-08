import { z } from 'zod';
import type { Prisma, PrismaClient } from '@showroom/database';
import { id } from '../catalogue/validation.js';
import { publicWhere } from '../catalogue/service.js';
import { ApiError } from '../../errors.js';

export const consentVersion = 'tryon-photo-v1';
export const settingsInput = z.object({
  photoEnabled: z.boolean(), arEnabled: z.boolean(),
  eligibleCategoryIds: z.array(id).max(500).refine(ids => new Set(ids).size === ids.length),
  maxUploadMb: z.number().int().min(1).max(20),
  retentionHours: z.number().int().min(1).max(72),
  dailyLimit: z.number().int().min(1).max(10000),
}).strict();
export const assetInput = z.object({
  enabled: z.boolean(), kind: z.enum(['EARRINGS', 'NECKLACE']),
  overlayImageId: id.nullable(), scale: z.number().min(0.1).max(3),
  offsetX: z.number().min(-1).max(1), offsetY: z.number().min(-1).max(1),
  rotation: z.number().min(-180).max(180),
}).strict();
export const defaultAsset = {
  enabled: false, kind: 'EARRINGS' as const, overlayImageId: null,
  scale: 1, offsetX: 0, offsetY: 0, rotation: 0,
};
export async function settings(db: Prisma.TransactionClient | PrismaClient) {
  const row = await db.tryOnConfiguration.findUnique({
    where: { id: 1 }, include: { eligibleCategories: { select: { id: true } } },
  });
  if (row) {
    const { id: _id, updatedAt: _updated, eligibleCategories, ...values } = row;
    return { ...values, eligibleCategoryIds: eligibleCategories.map(c => c.id) };
  }
  return settingsInput.parse({
    photoEnabled: process.env.TRYON_PHOTO_ENABLED === 'true',
    arEnabled: process.env.TRYON_AR_ENABLED === 'true',
    maxUploadMb: Number(process.env.TRYON_MAX_UPLOAD_MB ?? 10),
    retentionHours: Number(process.env.TRYON_RESULT_RETENTION_HOURS ?? 24),
    dailyLimit: 30, eligibleCategoryIds: [],
  });
}
export async function productConfig(db: Prisma.TransactionClient | PrismaClient, productId: string) {
  const [p, config] = await Promise.all([
    db.product.findFirst({
      where: { ...publicWhere, id: productId },
      select: { sku: true, categoryId: true, tryOnAsset: {include: {dedicatedOverlay: true}},
        images: {orderBy: {position: 'asc'}, take: 1, select: {url: true}} },
    }), settings(db),
  ]);
  if (!p) throw new ApiError(404, 'NOT_FOUND', 'Product is unavailable.');
  const asset = p.tryOnAsset;
  const allowed = Boolean(asset?.enabled && config.eligibleCategoryIds.includes(p.categoryId));
  const image = asset?.dedicatedOverlay;
  const overlay = allowed && asset && image?.productId === productId && image.kind===asset.kind && image.format==='png'
    ? {url: image.url, scale: asset.scale, offsetX: asset.offsetX, offsetY: asset.offsetY, rotation: asset.rotation}
    : null;
  const referenceUrl = p.images[0]?.url;
  const photoEnabled = allowed && config.photoEnabled && Boolean(referenceUrl);
  const arEnabled = Boolean(overlay && config.arEnabled);
  return {
    public: { eligible: photoEnabled || arEnabled, photoEnabled, arEnabled, kind: asset?.kind ?? null,
      overlay: arEnabled ? overlay : null, maxUploadMb: config.maxUploadMb, retentionHours: config.retentionHours, consentVersion },
    referenceUrl, sku: p.sku, dailyLimit: config.dailyLimit,
  };
}
