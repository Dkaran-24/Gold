// Disposable browser-QA data only. Refuses every operational database URL.
import { createDatabase } from '@showroom/database';
import { readFile, writeFile, unlink } from 'node:fs/promises';
const connection = process.env.SHOWROOM_TEST_DATABASE_URL;
const url = new URL(connection || 'http://invalid');
if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || url.port !== '55432' || url.username !== 'showroom_test' || url.pathname !== '/postgres') throw new Error('Only the isolated showroom_test database is permitted.');
const db = createDatabase(connection);
const manifestPath = new URL('../../../.local/frontend-fixture.json', import.meta.url);
const prefix = 'qa-m7-';
try {
  if (process.argv[2] === 'seed') {
    if (await db.product.count() || await db.category.count() || await db.homepageVersion.count() || await db.user.count()) throw new Error('Seed requires an empty isolated catalogue, CMS and owner table.');
    const manifest = await db.$transaction(async tx => {
      const category = await tx.category.create({ data: { name: 'QA test rings', slug: `${prefix}rings`, description: 'Disposable frontend verification category.' } });
      const items = [];
      for (let index = 1; index <= 15; index++) items.push(await tx.product.create({ data: { name: `QA test piece ${String(index).padStart(2, '0')}`, sku: `${prefix}${index}`, slug: `${prefix}piece-${index}`, categoryId: category.id, metal: index % 2 ? 'GOLD' : 'SILVER', purity: index % 2 ? '22K' : '925', grossWeight: 10, netWeight: 8, stoneWeight: 2, stoneDetails: 'Test specification; not real jewellery.', description: 'QA fixture only. This is not a real showroom product. Used to verify layout, filtering, privacy and enquiry workflows.', publication: index === 15 ? 'DRAFT' : 'PUBLISHED', availability: index === 2 ? 'SOLD' : index === 3 ? 'RESERVED' : 'AVAILABLE', featured: index <= 4, enquiryOnly: index % 2 === 0, publicPrice: 10000 + index * 100, arrivalDate: new Date(Date.now() - 86400000), newUntil: new Date(Date.now() + 86400000), privateDetails: { create: { internalNotes: 'PRIVATE-QA-MUST-NOT-RENDER', costPrice: 999 } } } }));
      // Cloudinary's public demo photo verifies delivery only; it is not a product photograph.
      const image = await tx.productImage.create({ data: { productId: items[0].id, publicId: `${prefix}image`, url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', alt: 'QA delivery sample, not jewellery', position: 0, width: 864, height: 576 } });
      await tx.productImage.create({ data: { productId: items[0].id, publicId: `${prefix}missing`, url: 'https://res.cloudinary.com/demo/image/upload/qa-m7-missing-image.jpg', alt: 'QA unavailable image', position: 1, width: 600, height: 600 } });
      const collection = await tx.collection.create({ data: { name: 'QA test collection', slug: `${prefix}collection`, description: 'Disposable selection for frontend verification, not a showroom collection.', publication: 'PUBLISHED', coverImageId: image.id, bannerImageId: image.id, products: { create: items.map((p, position) => ({ productId: p.id, position })) } } });
      return { productIds: items.map(p => p.id), categoryId: category.id, collectionId: collection.id };
    });
    await writeFile(manifestPath, JSON.stringify(manifest)); console.log('Seeded 15 clearly labelled QA products (14 public), one category and one collection.');
  } else if (process.argv[2] === 'cms') {
    const fixture = JSON.parse(await readFile(manifestPath, 'utf8'));
    const sections = [
      { key: `${prefix}hero`, type: 'HERO', heading: 'QA published homepage', subtitle: 'Disposable CMS verification', description: 'Testing published content, not a business claim.', ctaLabel: 'Browse QA pieces', ctaPath: '/products' },
      { key: `${prefix}featured`, type: 'FEATURED_PRODUCTS', heading: 'QA featured pieces' },
      { key: `${prefix}collections`, type: 'FEATURED_COLLECTIONS', heading: 'QA collections' },
      { key: `${prefix}editorial`, type: 'EDITORIAL', heading: 'QA brand editorial', description: 'A published editorial used to verify About content.' },
    ].map((s, position) => ({ ...s, position, enabled: true, startsAt: null, endsAt: null, desktopImageId: null, mobileImageId: null, productId: null, collectionId: null }));
    const version = await db.homepageVersion.create({ data: { payload: { sections, banners: [] } } });
    fixture.versionId = version.id; await writeFile(manifestPath, JSON.stringify(fixture)); console.log('Created QA-only published snapshot.');
  } else if (process.argv[2] === 'withdraw') {
    await db.product.update({ where: { slug: `${prefix}piece-1` }, data: { publication: 'DRAFT' } }); console.log('Withdrew QA piece 1 for wishlist verification.');
  } else if (process.argv[2] === 'restore') {
    await db.product.update({ where: { slug: `${prefix}piece-1` }, data: { publication: 'PUBLISHED' } }); console.log('Restored QA piece 1.');
  } else if (process.argv[2] === 'clean') {
    const fixture = JSON.parse(await readFile(manifestPath, 'utf8'));
    await db.$transaction(async tx => {
      const enquiries = await tx.enquiry.findMany({ where: { name: { startsWith: 'QA M7' } }, select: { id: true } });
      const appointments = await tx.appointment.findMany({ where: { name: { startsWith: 'QA M7' } }, select: { id: true } });
      await tx.auditLog.deleteMany({ where: { entityId: { in: [...enquiries, ...appointments].map(e => e.id) } } });
      await tx.enquiry.deleteMany({ where: { id: { in: enquiries.map(e => e.id) } } });
      await tx.appointment.deleteMany({ where: { id: { in: appointments.map(e => e.id) } } });
      if (fixture.versionId) await tx.homepageVersion.delete({ where: { id: fixture.versionId } });
      await tx.collection.delete({ where: { id: fixture.collectionId } });
      await tx.product.deleteMany({ where: { id: { in: fixture.productIds }, sku: { startsWith: prefix } } });
      await tx.category.delete({ where: { id: fixture.categoryId } });
    });
    await unlink(manifestPath); console.log('Removed only this run’s QA fixtures and requests.');
  } else throw new Error('Use seed, cms, withdraw, restore, or clean.');
} finally { await db.$disconnect(); }
