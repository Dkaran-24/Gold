import { z } from 'zod';
import { ApiError } from '../../errors.js';
const text = (n: number) => z.string().trim().max(n);
const ref = z.string().min(1).max(100).nullable();
const date = z.iso.datetime({ offset: true }).nullable();
export const cta = z.string().max(500).refine(v => !v || /^\/(?!\/)[a-zA-Z0-9/_?=&%#.-]*$/.test(v) && !/%(?:2f|5c|0[ad])/i.test(v), 'CTA must be a safe relative website path');
export const collectionInput = z.object({
  name: text(200).min(1),
  slug: text(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: text(10000).optional(),
  imageUrl: z.string().max(2000).nullable().optional(),
  imagePublicId: text(500).nullable().optional(),
  coverImageId: ref.optional(),
  bannerImageId: ref.optional(),
  seoTitle: text(200).nullable().optional(),
  seoDescription: text(500).nullable().optional(),
  bridal: z.boolean().optional(),
  visible: z.boolean().optional(),
  publication: z.enum(['DRAFT', 'PUBLISHED']).optional(),
}).strict();
export const sectionInput = z.object({
  type: z.enum(['HERO', 'FEATURED_COLLECTIONS', 'NEW_ARRIVALS', 'FEATURED_PRODUCTS', 'BRIDAL', 'PROMOTIONAL', 'CUSTOM_JEWELLERY', 'APPOINTMENT', 'EDITORIAL']),
  internalName: text(200).min(1), heading: text(300).min(1), subtitle: text(1000).optional(), description: text(10000).optional(),
  ctaLabel: text(100).optional(), ctaPath: cta.optional(), productId: ref.optional(), collectionId: ref.optional(), desktopImageId: ref.optional(), mobileImageId: ref.optional(),
  desktopImageUrl: z.string().url().max(1000).nullable().optional(),
  desktopImagePublicId: text(300).nullable().optional(),
  mobileImageUrl: z.string().url().max(1000).nullable().optional(),
  mobileImagePublicId: text(300).nullable().optional(),
  enabled: z.boolean().optional(), startsAt: date.optional(), endsAt: date.optional(),
}).strict();
export const bannerInput = z.object({
  internalName: text(200).min(1), heading: text(300).min(1), subtitle: text(1000).optional(),
  desktopImageId: ref.optional(), mobileImageId: ref.optional(),
  imageUrl: z.string().max(2000).optional(), imagePublicId: text(500).nullable().optional(),
  imageAlt: text(500).min(1), ctaLabel: text(100).min(1), ctaPath: cta.refine(v => v.length > 0, 'CTA destination is required'),
  active: z.boolean().optional(), publication: z.enum(['DRAFT', 'PUBLISHED']).optional(), startsAt: date.optional(), endsAt: date.optional()
}).strict();
export const orderInput = z.object({ ids: z.array(z.string().min(1).max(100)).max(500) }).strict();
export function schedule(v: { startsAt?: Date | string | null; endsAt?: Date | string | null }) {
  if (v.startsAt && v.endsAt && new Date(v.endsAt) <= new Date(v.startsAt)) throw new ApiError(422, 'INVALID_SCHEDULE', 'End must be later than start.');
}
export function eligible(v: { startsAt?: Date | string | null; endsAt?: Date | string | null }, now = new Date()) {
  return (!v.startsAt || new Date(v.startsAt) <= now) && (!v.endsAt || new Date(v.endsAt) > now);
}
export function sectionRules(v: z.infer<typeof sectionInput>) {
  schedule(v);
  const hasDesktop = Boolean(v.desktopImageId || v.desktopImageUrl);
  if (['HERO', 'PROMOTIONAL'].includes(v.type) && !hasDesktop) throw new ApiError(422, 'INVALID_SECTION', 'This section requires a desktop image.');
  if (v.type === 'BRIDAL' && !v.collectionId) throw new ApiError(422, 'INVALID_SECTION', 'Bridal section requires a collection.');
  if (v.type === 'EDITORIAL' && !v.description) throw new ApiError(422, 'INVALID_SECTION', 'Editorial section requires description.');
  if (['CUSTOM_JEWELLERY', 'APPOINTMENT'].includes(v.type) && (!v.ctaPath || !v.ctaLabel)) throw new ApiError(422, 'INVALID_SECTION', 'Promotion requires CTA text and destination.');
  if (Boolean(v.ctaPath) !== Boolean(v.ctaLabel)) throw new ApiError(422, 'INVALID_CTA', 'Provide both CTA text and destination.');
  if (v.productId && v.type !== 'FEATURED_PRODUCTS') throw new ApiError(422, 'INVALID_SECTION', 'Product reference is only supported for featured products.');
  if (v.collectionId && !['BRIDAL', 'FEATURED_COLLECTIONS'].includes(v.type)) throw new ApiError(422, 'INVALID_SECTION', 'Collection reference is not supported for this section.');
}
