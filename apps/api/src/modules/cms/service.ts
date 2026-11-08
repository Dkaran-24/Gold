import { Prisma, type PrismaClient } from '@showroom/database';
import { ApiError } from '../../errors.js';
import { audit, publicWhere, publicSelect, publicDto } from '../catalogue/service.js';
import { sectionInput, sectionRules, bannerInput, schedule, eligible } from './validation.js';

export type Tx = Prisma.TransactionClient;
export const visibleCollection = { publication: 'PUBLISHED' as const, archivedAt: null, visible: true };
export const imageSelect = { id: true, url: true, alt: true, width: true, height: true };
export function mutate<T>(db: PrismaClient, work: (tx: Tx) => Promise<T>) {
  return db.$transaction(async tx => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(409444)`; return work(tx); }, { timeout: 15000 });
}
export async function refs(tx: Tx, v: { type?: string; productId?: string | null; collectionId?: string | null; desktopImageId?: string | null; mobileImageId?: string | null; coverImageId?: string | null; bannerImageId?: string | null }) {
  if (v.productId && !await tx.product.findFirst({ where: { id: v.productId, ...publicWhere } })) throw new ApiError(422, 'INVALID_REFERENCE', 'Product must be publicly available.');
  if (v.collectionId && !await tx.collection.findFirst({ where: { id: v.collectionId, ...visibleCollection } })) throw new ApiError(422, 'INVALID_REFERENCE', 'Collection must be published and visible.');
  if (v.type === 'BRIDAL' && v.collectionId && !await tx.collection.findFirst({ where: { id: v.collectionId, bridal: true } })) throw new ApiError(422, 'INVALID_REFERENCE', 'Bridal section requires a bridal collection.');
  for (const imageId of [v.desktopImageId, v.mobileImageId, v.coverImageId, v.bannerImageId]) {
    if (imageId && !await tx.productImage.findFirst({ where: { id: imageId, product: publicWhere } })) throw new ApiError(422, 'INVALID_REFERENCE', 'Use an existing image on a publicly available product.');
  }
}
export function permutation(ids: string[], existing: string[]) {
  if (new Set(ids).size !== ids.length || ids.length !== existing.length || ids.some(id => !existing.includes(id))) throw new ApiError(422, 'INVALID_ORDER', 'Supply every current ID exactly once.');
}
export async function draft(tx: Tx) {
  const [sections, banners] = await Promise.all([
    tx.homepageSection.findMany({ orderBy: { position: 'asc' } }),
    tx.banner.findMany({ orderBy: [{ position: 'asc' }, { id: 'asc' }] }),
  ]);
  const mappedSections = sections.map(s => {
    const c = (typeof s.content === 'object' && s.content !== null ? s.content : {}) as Record<string, unknown>;
    return {
      ...s,
      desktopImageUrl: (c.desktopImageUrl as string | null) ?? null,
      desktopImagePublicId: (c.desktopImagePublicId as string | null) ?? null,
      mobileImageUrl: (c.mobileImageUrl as string | null) ?? null,
      mobileImagePublicId: (c.mobileImagePublicId as string | null) ?? null,
    };
  });
  return { sections: mappedSections, banners };
}
export type Draft = Awaited<ReturnType<typeof draft>>;
export const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export async function validateDraft(tx: Tx, value: Draft) {
  for (const s of value.sections) {
    const source = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    const c = (typeof s.content === 'object' && s.content !== null ? s.content : {}) as Record<string, unknown>;
    const parsed = sectionInput.parse({ ...Object.fromEntries(Object.keys(sectionInput.shape).map(k => [k, source[k]])), ...c });
    sectionRules(parsed); await refs(tx, parsed);
    if (s.type === 'BRIDAL' && !await tx.collection.findFirst({ where: { id: s.collectionId!, bridal: true } })) throw new ApiError(422, 'INVALID_REFERENCE', 'Bridal section requires a bridal collection.');
  }
  for (const b of value.banners) {
    const source = JSON.parse(JSON.stringify(b)); const parsed = bannerInput.parse(Object.fromEntries(Object.keys(bannerInput.shape).map(k => [k, source[k]])));
    schedule(parsed); if (!parsed.desktopImageId && !parsed.imageUrl) throw new ApiError(422, 'INVALID_REFERENCE', 'Banner requires a desktop image.'); await refs(tx, parsed);
  }
}
export async function publicCollection(tx: Tx, collectionId: string) {
  const c = await tx.collection.findFirst({
    where: { id: collectionId, ...visibleCollection },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
      bridal: true,
      sortOrder: true,
      coverImageId: true,
      bannerImageId: true,
      imageUrl: true,
      imagePublicId: true,
    },
  });
  if (!c) return null;
  const { coverImageId, bannerImageId, imageUrl, imagePublicId, ...data } = c;
  const coverProductImage = await image(tx, coverImageId);
  const bannerProductImage = await image(tx, bannerImageId);

  let customCover: { id: string; url: string; alt: string; width: null; height: null } | null = null;
  let customBanner: { id: string; url: string; alt: string; width: null; height: null } | null = null;
  if (imageUrl) {
    if (imageUrl.startsWith('{')) {
      try {
        const parsed = JSON.parse(imageUrl);
        if (parsed.coverUrl) customCover = { id: `${c.id}-cover`, url: parsed.coverUrl, alt: `${c.name} cover`, width: null, height: null };
        if (parsed.bannerUrl) customBanner = { id: `${c.id}-banner`, url: parsed.bannerUrl, alt: `${c.name} banner`, width: null, height: null };
      } catch {}
    } else {
      customCover = { id: `${c.id}-cover`, url: imageUrl, alt: `${c.name} cover`, width: null, height: null };
    }
  }

  return {
    ...data,
    coverImage: coverProductImage || customCover,
    bannerImage: bannerProductImage || customBanner,
    imageUrl,
    imagePublicId,
  };
}
async function image(tx: Tx, imageId: string | null) { return imageId ? tx.productImage.findFirst({ where: { id: imageId, product: publicWhere }, select: imageSelect }) : null; }
export async function render(tx: Tx, value: Draft, now = new Date()) {
  const banners = [];
  for (const b of value.banners) {
    if (!b.active || b.publication !== 'PUBLISHED' || !eligible(b, now)) continue;
    let customDesktop: { id: string; url: string; alt: string; width: null; height: null } | null = null;
    let customMobile: { id: string; url: string; alt: string; width: null; height: null } | null = null;
    if (b.imageUrl) {
      if (b.imageUrl.startsWith('{')) {
        try {
          const parsed = JSON.parse(b.imageUrl);
          if (parsed.desktopUrl) customDesktop = { id: `${b.id}-desktop`, url: parsed.desktopUrl, alt: b.imageAlt, width: null, height: null };
          if (parsed.mobileUrl) customMobile = { id: `${b.id}-mobile`, url: parsed.mobileUrl, alt: b.imageAlt, width: null, height: null };
        } catch {}
      } else {
        customDesktop = { id: `${b.id}-desktop`, url: b.imageUrl, alt: b.imageAlt, width: null, height: null };
      }
    }
    const desktopImage = (await image(tx, b.desktopImageId)) || customDesktop;
    if (!desktopImage) continue;
    const mobileImage = (await image(tx, b.mobileImageId)) || customMobile;
    banners.push({ id: b.id, heading: b.heading, subtitle: b.subtitle, ctaLabel: b.ctaLabel, ctaPath: b.ctaPath, imageAlt: b.imageAlt, position: b.position, desktopImage, mobileImage });
  }
  const sections = [];
  for (const s of value.sections) {
    if (!s.enabled || !eligible(s, now)) continue;
    const c = (typeof s.content === 'object' && s.content !== null ? s.content : {}) as Record<string, unknown>;
    const customDesktop = c.desktopImageUrl ? { id: `${s.key}-desktop`, url: c.desktopImageUrl as string, alt: s.heading, width: null, height: null } : null;
    const customMobile = c.mobileImageUrl ? { id: `${s.key}-mobile`, url: c.mobileImageUrl as string, alt: s.heading, width: null, height: null } : null;
    const desktopImage = (await image(tx, s.desktopImageId)) || customDesktop;
    if (['HERO', 'PROMOTIONAL'].includes(s.type) && !desktopImage) continue;
    const mobileImage = (await image(tx, s.mobileImageId)) || customMobile;
    const collection = s.collectionId ? await publicCollection(tx, s.collectionId) : null;
    if (s.collectionId && !collection) continue;
    const product = s.productId ? await tx.product.findFirst({ where: { id: s.productId, ...publicWhere }, select: publicSelect }) : null;
    if (s.productId && !product) continue;
    const products = product ? [publicDto(product)] : ['FEATURED_PRODUCTS', 'NEW_ARRIVALS'].includes(s.type) ? (await tx.product.findMany({ where: { ...publicWhere, ...(s.type === 'NEW_ARRIVALS' ? { arrivalDate: { lte: now }, newUntil: { gt: now } } : { featured: true }) }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 12, select: publicSelect })).map(publicDto) : [];
    const collections = collection ? [collection] : s.type === 'FEATURED_COLLECTIONS' ? (await Promise.all((await tx.collection.findMany({ where: visibleCollection, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], take: 12 })).map(c => publicCollection(tx, c.id)))).filter(Boolean) : [];
    sections.push({ id: s.key, type: s.type, heading: s.heading, subtitle: s.subtitle, description: s.description, ctaLabel: s.ctaLabel, ctaPath: s.ctaPath, position: s.position, desktopImage, mobileImage, products, collections });
  }
  return { sections, banners };
}
export async function publish(db: PrismaClient, ownerId: string) {
  return mutate(db, async tx => { const value = await draft(tx); await validateDraft(tx, value); const version = await tx.homepageVersion.create({ data: { payload: json(value) } }); await audit(tx, ownerId, 'HOMEPAGE_PUBLISH', 'HomepageVersion', String(version.id)); return { version: version.id, publishedAt: version.createdAt }; });
}
export async function published(tx: Tx) {
  const version = await tx.homepageVersion.findFirst({ orderBy: { id: 'desc' } });
  return { version: version?.id ?? null, publishedAt: version?.createdAt ?? null, ...(version ? await render(tx, version.payload as unknown as Draft) : { sections: [], banners: [] }) };
}
