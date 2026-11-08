import { Prisma, type PrismaClient } from '@showroom/database';
import { ApiError } from '../../errors.js';
import { validateState } from './validation.js';

export const publicSelect = {
  id: true, name: true, sku: true, slug: true, description: true, metal: true, purity: true,
  grossWeight: true, netWeight: true, stoneWeight: true, stoneDetails: true, diamondDetails: true, gemstoneDetails: true,
  hallmark: true, huid: true, enquiryOnly: true, publicPrice: true, publicMakingCharge: true,
  availability: true, featured: true, exclusive: true, arrivalDate: true, newUntil: true, seoTitle: true, seoDescription: true,
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { position: 'asc' }, select: { url: true, alt: true, position: true, width: true, height: true } },
} satisfies Prisma.ProductSelect;
export type PublicProduct = Prisma.ProductGetPayload<{ select: typeof publicSelect }>;
export function publicDto(p: PublicProduct) {
  const now = new Date();
  const validPrice = !p.enquiryOnly && p.publicPrice != null && Number(p.publicPrice) > 0 ? p.publicPrice : null;
  const validMakingCharge = !p.enquiryOnly && p.publicMakingCharge != null && Number(p.publicMakingCharge) >= 0 ? p.publicMakingCharge : null;
  return {
    ...p,
    images: p.images.map((image, index) => ({ ...image, isPrimary: index === 0 })),
    publicPrice: validPrice,
    publicMakingCharge: validMakingCharge,
    newArrival: Boolean(p.arrivalDate && p.arrivalDate <= now && p.newUntil && p.newUntil > now),
  };
}
export const publicWhere: Prisma.ProductWhereInput = { deletedAt: null, publication: 'PUBLISHED', availability: { not: 'ARCHIVED' }, category: { visible: true } };
export function checkState(p: Parameters<typeof validateState>[0]) {
  try { validateState(p); } catch (e) { throw new ApiError(422, 'VALIDATION_ERROR', (e as Error).message); }
}
export function audit(tx: Prisma.TransactionClient, actorId: string, action: string, entity: string, entityId: string) {
  return tx.auditLog.create({ data: { actorId, action, entity, entityId } });
}
export async function lockedProduct(tx: Prisma.TransactionClient, productId: string) {
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
  const existing = await tx.product.findUnique({ where: { id: productId } });
  if (!existing || existing.deletedAt) throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
  return existing;
}
export async function updateProduct(db: PrismaClient, productId: string, actorId: string, data: Prisma.ProductUncheckedUpdateInput, reason?: string, remove = false) {
  return db.$transaction(async tx => {
    const old = await lockedProduct(tx, productId);
    // Callers pass only validated scalar values, never Prisma update operators.
    checkState({ ...old, ...data } as Parameters<typeof validateState>[0]);
    const updated = await tx.product.update({ where: { id: productId }, data: { ...data, ...(remove ? { deletedAt: new Date() } : {}) } });
    if (old.availability !== updated.availability) {
      await tx.inventoryHistory.create({ data: { productId, actorId, previous: old.availability, next: updated.availability, reason } });
    }
    await audit(tx, actorId, remove ? 'SOFT_DELETE' : 'UPDATE', 'Product', productId);
    return updated;
  });
}
