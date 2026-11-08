import { Router } from 'express';
import { z } from 'zod';
import { Prisma, type PrismaClient } from '@showroom/database';
import { requireOwner } from '../../auth.js';
import { ApiError } from '../../errors.js';
import { availability, category, categoryPatch, id, listQuery, pageQuery, product, productPatch } from './validation.js';
import { audit, checkState, publicDto, publicSelect, publicWhere, updateProduct } from './service.js';

export function catalogueRoutes(db: PrismaClient) {
  const router = Router();
  router.use('/admin', requireOwner(db));
  for (const admin of [false, true]) {
    const prefix = admin ? '/admin' : '';
    router.get(`${prefix}/products`, async (req, res) => {
      const q = listQuery.parse(req.query);
      if (!admin && q.publication) throw new ApiError(422, 'VALIDATION_ERROR', 'Publication is an admin-only filter.');
      const targetCategory = q.categoryId || q.category;
      const categoryFilter: Prisma.ProductWhereInput = targetCategory
        ? {
            OR: [
              { categoryId: targetCategory },
              { category: { slug: targetCategory } },
            ],
          }
        : {};
      const filters: Prisma.ProductWhereInput = {
        deletedAt: null,
        ...categoryFilter,
        metal: q.metal,
        purity: q.purity,
        availability: q.availability,
        publication: q.publication,
        featured: q.featured,
        ...(q.search
          ? {
              OR: [
                { name: { contains: q.search, mode: 'insensitive' } },
                { sku: { contains: q.search, mode: 'insensitive' } },
                { description: { contains: q.search, mode: 'insensitive' } },
                { category: { name: { contains: q.search, mode: 'insensitive' } } },
                { category: { slug: { contains: q.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
        ...(q.minWeight !== undefined || q.maxWeight !== undefined ? { grossWeight: { gte: q.minWeight, lte: q.maxWeight } } : {}),
      };
      const and: Prisma.ProductWhereInput[] = [filters, ...(!admin ? [publicWhere] : [])];
      if (q.minPrice !== undefined || q.maxPrice !== undefined || q.sort.startsWith('price')) and.push({ enquiryOnly: false, publicPrice: { not: null, gte: q.minPrice, lte: q.maxPrice } });
      const now = new Date();
      const fresh = { arrivalDate: { lte: now }, newUntil: { gt: now } };
      if (q.newArrival === true) and.push(fresh);
      if (q.newArrival === false) and.push({ OR: [{ arrivalDate: null }, { arrivalDate: { gt: now } }, { newUntil: null }, { newUntil: { lte: now } }] });
      const order: Prisma.ProductOrderByWithRelationInput = q.sort === 'name' ? { name: 'asc' } : q.sort === 'price-asc' ? { publicPrice: 'asc' } : q.sort === 'price-desc' ? { publicPrice: 'desc' } : { createdAt: q.sort === 'oldest' ? 'asc' : 'desc' };
      const where = { AND: and };
      const result = await db.$transaction(async tx => {
        const total = await tx.product.count({ where });
        const args = { where, orderBy: [order, { id: 'asc' as const }], skip: (q.page - 1) * q.limit, take: q.limit };
        const data = admin ? await tx.product.findMany(args) : (await tx.product.findMany({ ...args, select: publicSelect })).map(publicDto);
        return { data, pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) } };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
      res.json(result);
    });
    router.get(`${prefix}/categories`, async (req, res) => {
      const q = pageQuery.extend({ search: z.string().max(100).optional() }).strict().parse(req.query);
      const where = { ...(admin ? {} : { visible: true }), ...(q.search ? { name: { contains: q.search, mode: 'insensitive' as const } } : {}) };
      const [total, data] = await db.$transaction([
        db.category.count({ where }), db.category.findMany({ where, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { id: true, name: true, slug: true, description: true, imageUrl: true, imagePublicId: true, visible: true, sortOrder: true } }),
      ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
      res.json({ data, pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) } });
    });
  }
  router.get('/products/:slug', async (req, res) => {
    const data = await db.product.findFirst({ where: { ...publicWhere, slug: id.parse(req.params.slug) }, select: publicSelect });
    if (!data) throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
    res.json({ data: publicDto(data) });
  });
  router.get('/admin/products/by-slug/:slug', async (req, res) => {
    const data = await db.product.findFirst({
      where: { slug: id.parse(req.params.slug), deletedAt: null },
      select: { ...publicSelect, publication: true },
    });
    if (!data) throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
    res.json({ data: { ...publicDto(data), publication: data.publication } });
  });
  router.get('/admin/products/:id', async (req, res) => {
    const data = await db.product.findFirst({
      where: { id: id.parse(req.params.id), deletedAt: null },
      include: {
        privateDetails: true,
        category: { select: { id: true, name: true, slug: true, visible: true } },
        images: { orderBy: { position: 'asc' } },
      },
    });
    if (!data) throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
    res.json({ data });
  });
  router.post('/admin/products', async (req, res) => {
    const input = product.parse(req.body);
    if (input.enquiryOnly) {
      input.publicPrice = null;
      input.publicMakingCharge = null;
    }
    checkState(input);
    const data = await db.$transaction(async tx => {
      const created = await tx.product.create({ data: input });
      await tx.inventoryHistory.create({ data: { productId: created.id, actorId: res.locals.ownerId, next: created.availability, reason: 'Initial inventory' } });
      await audit(tx, res.locals.ownerId, 'CREATE', 'Product', created.id);
      return created;
    });
    res.status(201).json({ data });
  });
  router.patch('/admin/products/:id', async (req, res) => {
    const input = productPatch.parse(req.body);
    if (input.enquiryOnly === true) {
      input.publicPrice = null;
      input.publicMakingCharge = null;
    }
    if (input.availability === 'ARCHIVED') input.publication = 'DRAFT';
    res.json({ data: await updateProduct(db, id.parse(req.params.id), res.locals.ownerId, input) });
  });
  router.patch('/admin/products/:id/publication', async (req, res) => {
    const input = z.object({ publication: z.enum(['DRAFT', 'PUBLISHED']) }).strict().parse(req.body);
    res.json({ data: await updateProduct(db, id.parse(req.params.id), res.locals.ownerId, input) });
  });
  router.patch('/admin/products/:id/inventory', async (req, res) => {
    const { reason, ...input } = z.object({ availability, reason: z.string().trim().max(1000).optional() }).strict().parse(req.body);
    res.json({ data: await updateProduct(db, id.parse(req.params.id), res.locals.ownerId, { ...input, ...(input.availability === 'ARCHIVED' ? { publication: 'DRAFT' } : {}) }, reason) });
  });
  router.delete('/admin/products/:id', async (req, res) => {
    z.object({ confirm: z.literal(true) }).strict().parse(req.body);
    await updateProduct(db, id.parse(req.params.id), res.locals.ownerId, { availability: 'ARCHIVED', publication: 'DRAFT' }, 'Deleted by owner', true);
    res.status(204).end();
  });
  router.get('/admin/products/:id/inventory-history', async (req, res) => {
    const productId = id.parse(req.params.id); const q = pageQuery.strict().parse(req.query);
    if (!await db.product.findUnique({ where: { id: productId } })) throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
    const [total, data] = await db.$transaction([db.inventoryHistory.count({ where: { productId } }), db.inventoryHistory.findMany({ where: { productId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (q.page - 1) * q.limit, take: q.limit })]);
    res.json({ data, pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) } });
  });
  router.post('/admin/categories', async (req, res) => {
    const input = category.parse(req.body);
    const data = await db.$transaction(async tx => { const created = await tx.category.create({ data: input }); await audit(tx, res.locals.ownerId, 'CREATE', 'Category', created.id); return created; });
    res.status(201).json({ data });
  });
  router.patch('/admin/categories/:id', async (req, res) => {
    const categoryId = id.parse(req.params.id); const input = categoryPatch.parse(req.body);
    const data = await db.$transaction(async tx => { const updated = await tx.category.update({ where: { id: categoryId }, data: input }); await audit(tx, res.locals.ownerId, 'UPDATE', 'Category', categoryId); return updated; });
    res.json({ data });
  });
  router.delete('/admin/categories/:id', async (req, res) => {
    z.object({ confirm: z.literal(true) }).strict().parse(req.body);
    const categoryId = id.parse(req.params.id);
    // The existing FK protects all products, including archived and soft-deleted records, atomically.
    await db.$transaction(async tx => { await tx.category.delete({ where: { id: categoryId } }); await audit(tx, res.locals.ownerId, 'DELETE', 'Category', categoryId); });
    res.status(204).end();
  });
  return router;
}
