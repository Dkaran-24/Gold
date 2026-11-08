import { z } from 'zod';

export const id = z.string().min(1).max(100);
const slug = z.string().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const text = (max: number) => z.string().trim().max(max);
export const availability = z.enum(['AVAILABLE', 'RESERVED', 'SOLD', 'ARCHIVED']);
const weight = z.number().finite().min(0).max(9999999.999).multipleOf(0.001);
const money = z.number().finite().min(0).max(999999999999.99).multipleOf(0.01);
const date = z.iso.datetime({ offset: true }).transform(v => new Date(v)).nullable();
export const product = z.object({
  name: text(200).min(1), sku: text(100).min(1), slug,
  description: text(10000).default(''), categoryId: id,
  metal: z.enum(['GOLD', 'SILVER', 'PLATINUM', 'MIXED']), purity: text(50).min(1),
  grossWeight: weight.positive(), netWeight: weight, stoneWeight: weight.nullable().optional(),
  stoneDetails: text(2000).nullable().optional(), diamondDetails: text(2000).nullable().optional(),
  gemstoneDetails: text(2000).nullable().optional(), hallmark: text(200).nullable().optional(), huid: text(100).nullable().optional(),
  enquiryOnly: z.boolean().default(true), publicPrice: money.nullable().optional(), publicMakingCharge: money.nullable().optional(),
  availability: availability.default('AVAILABLE'), publication: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  featured: z.boolean().default(false), exclusive: z.boolean().default(false),
  arrivalDate: date.optional(), newUntil: date.optional(),
  seoTitle: text(200).nullable().optional(), seoDescription: text(500).nullable().optional(),
}).strict();
export const productPatch = product.partial().extend({
  description: product.shape.description.unwrap().optional(),
  enquiryOnly: product.shape.enquiryOnly.unwrap().optional(),
  availability: product.shape.availability.unwrap().optional(),
  publication: product.shape.publication.unwrap().optional(),
  featured: product.shape.featured.unwrap().optional(), exclusive: product.shape.exclusive.unwrap().optional(),
}).refine(v => Object.keys(v).length > 0, 'At least one field is required');
export function validateState(p: { netWeight: unknown; grossWeight: unknown; enquiryOnly: boolean; publicPrice?: unknown; arrivalDate?: Date | null; newUntil?: Date | null; availability: string; publication: string }) {
  if (Number(p.netWeight) > Number(p.grossWeight)) throw new Error('Net weight cannot exceed gross weight.');
  if (!p.enquiryOnly && (p.publicPrice == null || Number(p.publicPrice) <= 0)) throw new Error('A public price greater than zero is required when price visibility is enabled.');
  if (p.newUntil && (!p.arrivalDate || p.newUntil <= p.arrivalDate)) throw new Error('New arrival expiry must follow its arrival date.');
  if (p.availability === 'ARCHIVED' && p.publication === 'PUBLISHED') throw new Error('Archived products cannot be published.');
}
export const category = z.object({
  name: text(100).min(1), slug, description: text(5000).default(''),
  imageUrl: z.url().max(2048).refine(v => new URL(v).protocol === 'https:', 'Image URL must use HTTPS').nullable().optional(),
  imagePublicId: text(200).nullable().optional(),
  visible: z.boolean().default(true), sortOrder: z.number().int().min(0).max(100000).default(0),
}).strict();
export const categoryPatch = category.partial().extend({
  description: category.shape.description.unwrap().optional(), visible: category.shape.visible.unwrap().optional(),
  sortOrder: category.shape.sortOrder.unwrap().optional(),
}).refine(v => Object.keys(v).length > 0, 'At least one field is required');
const bool = z.enum(['true', 'false']).transform(v => v === 'true');
export const pageQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).default(24) });
export const listQuery = pageQuery.extend({
  search: text(200).optional(), categoryId: id.optional(), category: id.optional(), metal: product.shape.metal.optional(), purity: text(50).optional(),
  availability: availability.optional(), publication: product.shape.publication.unwrap().optional(),
  featured: bool.optional(), newArrival: bool.optional(),
  minPrice: z.coerce.number().finite().min(0).optional(), maxPrice: z.coerce.number().finite().min(0).optional(),
  minWeight: z.coerce.number().finite().min(0).optional(), maxWeight: z.coerce.number().finite().min(0).optional(),
  sort: z.enum(['latest', 'oldest', 'name', 'price-asc', 'price-desc']).default('latest'),
}).strict().refine(v => (v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice) && (v.minWeight === undefined || v.maxWeight === undefined || v.minWeight <= v.maxWeight), 'Invalid range');
