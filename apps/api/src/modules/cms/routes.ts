import { Router } from 'express';
import { z } from 'zod';
import { Prisma, type PrismaClient } from '@showroom/database';
import { requireOwner } from '../../auth.js';
import { ApiError } from '../../errors.js';
import { id, pageQuery } from '../catalogue/validation.js';
import { audit, publicWhere, publicSelect, publicDto } from '../catalogue/service.js';
import { collectionInput, sectionInput, bannerInput, orderInput, sectionRules, schedule } from './validation.js';
import { mutate, refs, permutation, draft, render, publish, published, publicCollection, visibleCollection, type Tx } from './service.js';

const missing = () => new ApiError(404, 'NOT_FOUND', 'CMS record not found.');
const page = (total: number, q: { page: number; limit: number }) => ({ ...q, total, pages: Math.ceil(total / q.limit) });
const query = pageQuery.strict();
const empty = z.object({}).strict();
const fields = (schema: { shape: Record<string, unknown> }, value: object) => Object.fromEntries(Object.keys(schema.shape).map(k => [k, (JSON.parse(JSON.stringify(value)) as Record<string, unknown>)[k]]));
async function collectionExists(tx: Tx, collectionId: string) { const c = await tx.collection.findUnique({ where: { id: collectionId } }); if (!c || c.archivedAt) throw missing(); return c; }
function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'collection';
}

export function cmsRoutes(db: PrismaClient) {
  const router = Router(); router.use('/admin', requireOwner(db));
  router.use((_req, res, next) => {
    if (!res.hasHeader('Cache-Control')) res.set('Cache-Control', 'no-store');
    next();
  });
  for (const admin of [false, true]) {
    router.get(`${admin ? '/admin' : ''}/collections`, async (req, res) => {
      const q = query.parse(req.query); const where = admin ? {} : visibleCollection;
      const result = await db.$transaction(async tx => {
        const all = await tx.collection.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], skip: (q.page - 1) * q.limit, take: q.limit });
        return { data: admin ? all : await Promise.all(all.map(c => publicCollection(tx, c.id))), pagination: page(await tx.collection.count({ where }), q) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }); res.json(result);
    });
    router.get(`${admin ? '/admin' : ''}/collections/:id`, async (req, res) => {
      const q = query.parse(req.query); const key = id.parse(req.params.id);
      const result = await db.$transaction(async tx => {
        const c = await tx.collection.findFirst({ where: admin ? { id: key } : { slug: key, ...visibleCollection } }); if (!c) throw missing();
        const where = { collectionId: c.id, ...(!admin ? { product: publicWhere } : {}) };
        const links = await tx.collectionProduct.findMany({ where, orderBy: [{ position: 'asc' }, { productId: 'asc' }], skip: (q.page - 1) * q.limit, take: q.limit, select: { position: true, product: { select: publicSelect } } });
        return { data: { ...(admin ? c : await publicCollection(tx, c.id)), products: links.map(l => ({ ...publicDto(l.product), collectionPosition: l.position })) }, pagination: page(await tx.collectionProduct.count({ where }), q) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }); res.json(result);
    });
  }
  router.post('/admin/collections', async (req, res) => {
    const input = collectionInput.parse(req.body);
    const data = await mutate(db, async tx => {
      let slug = input.slug;
      if (!slug) {
        const base = slugify(input.name);
        slug = base;
        let counter = 2;
        while (await tx.collection.findUnique({ where: { slug } })) {
          slug = `${base}-${counter}`;
          counter++;
        }
      }
      await refs(tx, input);
      const last = await tx.collection.aggregate({ _max: { sortOrder: true } });
      const c = await tx.collection.create({ data: { ...input, slug, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
      await audit(tx, res.locals.ownerId, 'COLLECTION_CREATE', 'Collection', c.id);
      return c;
    });
    res.status(201).json({ data });
  });
  router.patch('/admin/collections/:id', async (req, res) => {
    const input = collectionInput.partial().refine(v => Object.keys(v).length > 0).parse(req.body);
    const collectionId = id.parse(req.params.id);
    const data = await mutate(db, async tx => {
      const old = await collectionExists(tx, collectionId);
      await refs(tx, { ...old, ...input });
      const safeData = { ...input };
      // Preserve existing published collection slug unless explicitly provided
      if (old.publication === 'PUBLISHED' && !input.slug) {
        safeData.slug = old.slug;
      }
      const c = await tx.collection.update({ where: { id: collectionId }, data: safeData });
      await audit(tx, res.locals.ownerId, 'COLLECTION_UPDATE', 'Collection', c.id);
      return c;
    });
    res.json({ data });
  });
  router.delete('/admin/collections/:id', async (req, res) => {
    z.object({ confirm: z.literal(true) }).strict().parse(req.body); const collectionId = id.parse(req.params.id);
    await mutate(db, async tx => { await collectionExists(tx, collectionId); await tx.collection.update({ where: { id: collectionId }, data: { archivedAt: new Date(), publication: 'DRAFT', visible: false } }); await audit(tx, res.locals.ownerId, 'COLLECTION_ARCHIVE', 'Collection', collectionId); }); res.status(204).end();
  });
  router.post('/admin/collections/:id/products', async (req, res) => {
    const { productId } = z.object({ productId: id }).strict().parse(req.body); const collectionId = id.parse(req.params.id);
    const data = await mutate(db, async tx => { await collectionExists(tx, collectionId); const p = await tx.product.findFirst({ where: { id: productId, deletedAt: null, availability: { not: 'ARCHIVED' } } }); if (!p) throw new ApiError(422, 'INVALID_REFERENCE', 'Product does not exist or is archived.'); const max = await tx.collectionProduct.aggregate({ where: { collectionId }, _max: { position: true } }); return tx.collectionProduct.create({ data: { collectionId, productId, position: (max._max.position ?? -1) + 1 } }); }); res.status(201).json({ data });
  });
  router.delete('/admin/collections/:id/products/:productId', async (req, res) => {
    empty.parse(req.body ?? {}); const collectionId = id.parse(req.params.id); const productId = id.parse(req.params.productId);
    await mutate(db, async tx => { await collectionExists(tx, collectionId); await tx.collectionProduct.deleteMany({ where: { collectionId, productId } }); }); res.status(204).end();
  });
  router.patch('/admin/collections/:id/products/order', async (req, res) => {
    const { ids } = orderInput.parse(req.body); const collectionId = id.parse(req.params.id);
    await mutate(db, async tx => { await collectionExists(tx, collectionId); permutation(ids, (await tx.collectionProduct.findMany({ where: { collectionId } })).map(p => p.productId)); for (const [position, productId] of ids.entries()) await tx.collectionProduct.update({ where: { collectionId_productId: { collectionId, productId } }, data: { position } }); }); res.json({ data: { ids } });
  });
  // Exact paths precede the parameterized PATCH handlers below for each resource.
  router.post('/admin/collections/order', async (req, res) => {
    const { ids } = orderInput.parse(req.body); await mutate(db, async tx => { permutation(ids, (await tx.collection.findMany({ where: { archivedAt: null } })).map(c => c.id)); for (const [sortOrder, collectionId] of ids.entries()) await tx.collection.update({ where: { id: collectionId }, data: { sortOrder } }); }); res.json({ data: { ids } });
  });
  for (const kind of ['sections', 'banners'] as const) {
    const section = kind === 'sections'; const path = `/admin/homepage/${kind}`;
    router.get(path, async (req, res) => {
      const q = query.parse(req.query);
      const values = await db.$transaction(async tx => section ? (await draft(tx)).sections : (await draft(tx)).banners);
      res.json({ data: values.slice((q.page - 1) * q.limit, q.page * q.limit).map(v => ({ ...v, scheduleState: v.startsAt && v.startsAt > new Date() ? 'FUTURE' : v.endsAt && v.endsAt <= new Date() ? 'EXPIRED' : 'CURRENT' })), pagination: page(values.length, q) });
    });
    router.post(path, async (req, res) => {
      const data = await mutate(db, async tx => {
        if (section) {
          const input = sectionInput.parse(req.body);
          sectionRules(input);
          await refs(tx, input);
          const max = await tx.homepageSection.aggregate({ _max: { position: true } });
          const { desktopImageUrl, desktopImagePublicId, mobileImageUrl, mobileImagePublicId, ...rest } = input;
          const content = {
            ...(desktopImageUrl ? { desktopImageUrl, desktopImagePublicId: desktopImagePublicId ?? null } : {}),
            ...(mobileImageUrl ? { mobileImageUrl, mobileImagePublicId: mobileImagePublicId ?? null } : {}),
          };
          const created = await tx.homepageSection.create({ data: { ...rest, content, position: (max._max.position ?? -1) + 1 } });
          return {
            ...created,
            desktopImageUrl: desktopImageUrl ?? null,
            desktopImagePublicId: desktopImagePublicId ?? null,
            mobileImageUrl: mobileImageUrl ?? null,
            mobileImagePublicId: mobileImagePublicId ?? null,
          };
        }
        const input = bannerInput.parse(req.body);
        schedule(input);
        if (!input.desktopImageId && !input.imageUrl) throw new ApiError(422, 'INVALID_REFERENCE', 'Desktop image required.');
        await refs(tx, input);
        const max = await tx.banner.aggregate({ _max: { position: true } });
        return tx.banner.create({ data: { ...input, imageUrl: input.imageUrl ?? '', position: (max._max.position ?? -1) + 1 } });
      });
      res.status(201).json({ data });
    });
    router.post(`${path}/order`, async (req, res) => {
      const { ids } = orderInput.parse(req.body);
      await mutate(db, async tx => { const existing = section ? (await tx.homepageSection.findMany()).map(s => s.key) : (await tx.banner.findMany()).map(b => b.id); permutation(ids, existing); for (const [position, key] of ids.entries()) { if (section) await tx.homepageSection.update({ where: { key }, data: { position } }); else await tx.banner.update({ where: { id: key }, data: { position } }); } }); res.json({ data: { ids } });
    });
    router.patch(`${path}/:id`, async (req, res) => {
      const key = id.parse(req.params.id);
      const data = await mutate(db, async tx => {
        if (section) {
          const old = await tx.homepageSection.findUnique({ where: { key } });
          if (!old) throw missing();
          const patch = sectionInput.partial().refine(v => Object.keys(v).length > 0).parse(req.body);
          const oldContent = (typeof old.content === 'object' && old.content !== null ? old.content : {}) as Record<string, unknown>;
          const oldFull = {
            ...fields(sectionInput, old),
            desktopImageUrl: (oldContent.desktopImageUrl as string | null) ?? null,
            desktopImagePublicId: (oldContent.desktopImagePublicId as string | null) ?? null,
            mobileImageUrl: (oldContent.mobileImageUrl as string | null) ?? null,
            mobileImagePublicId: (oldContent.mobileImagePublicId as string | null) ?? null,
          };
          const input = sectionInput.parse({ ...oldFull, ...patch });
          sectionRules(input);
          await refs(tx, input);
          const { desktopImageUrl, desktopImagePublicId, mobileImageUrl, mobileImagePublicId, ...rest } = input;
          const content = {
            ...oldContent,
            ...(desktopImageUrl !== undefined ? { desktopImageUrl: desktopImageUrl || null, desktopImagePublicId: desktopImagePublicId || null } : {}),
            ...(mobileImageUrl !== undefined ? { mobileImageUrl: mobileImageUrl || null, mobileImagePublicId: mobileImagePublicId || null } : {}),
          };
          const updated = await tx.homepageSection.update({ where: { key }, data: { ...rest, content } });
          return {
            ...updated,
            desktopImageUrl: (content.desktopImageUrl as string | null) ?? null,
            desktopImagePublicId: (content.desktopImagePublicId as string | null) ?? null,
            mobileImageUrl: (content.mobileImageUrl as string | null) ?? null,
            mobileImagePublicId: (content.mobileImagePublicId as string | null) ?? null,
          };
        }
        const old = await tx.banner.findUnique({ where: { id: key } });
        if (!old) throw missing();
        const patch = bannerInput.partial().refine(v => Object.keys(v).length > 0).parse(req.body);
        const input = bannerInput.parse({ ...fields(bannerInput, old), ...patch });
        schedule(input);
        if (!input.desktopImageId && !input.imageUrl) throw new ApiError(422, 'INVALID_REFERENCE', 'Desktop image required.');
        await refs(tx, input);
        return tx.banner.update({ where: { id: key }, data: input });
      });
      res.json({ data });
    });
    router.delete(`${path}/:id`, async (req, res) => {
      z.object({ confirm: z.literal(true) }).strict().parse(req.body); const key = id.parse(req.params.id);
      await mutate(db, async tx => { if (section) await tx.homepageSection.delete({ where: { key } }); else await tx.banner.delete({ where: { id: key } }); }); res.status(204).end();
    });
  }
  router.get('/admin/homepage/draft', async (_req, res) => res.json({ data: await db.$transaction(draft, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }) }));
  router.get('/admin/homepage/preview', async (_req, res) => res.json({ data: await db.$transaction(async tx => render(tx, await draft(tx)), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }) }));
  router.post('/admin/homepage/publish', async (req, res) => { empty.parse(req.body ?? {}); res.json({ data: await publish(db, res.locals.ownerId) }); });
  router.get('/homepage', async (_req, res) => res.json({ data: await db.$transaction(published, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }) }));
  router.get('/banners', async (req, res) => { const q = query.parse(req.query); const home = await db.$transaction(published, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }); res.json({ data: home.banners.slice((q.page - 1) * q.limit, q.page * q.limit), pagination: page(home.banners.length, q) }); });
  return router;
}
