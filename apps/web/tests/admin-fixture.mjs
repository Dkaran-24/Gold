// Explicitly isolated QA tooling. Never loaded by either application.
import { createDatabase } from '@showroom/database';
import { hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import sharp from 'sharp';
const connection = process.env.SHOWROOM_TEST_DATABASE_URL;
const url = new URL(connection || 'http://invalid');
if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || url.port !== '55432' || url.username !== 'showroom_test' || url.pathname !== '/postgres') throw new Error('Only the named isolated test database is permitted.');
const db = createDatabase(connection);
const manifestPath = new URL('../../../.local/admin-fixture.json', import.meta.url);
const models = ['user','product','category','collection','homepageSection','banner','homepageVersion','enquiry','appointment','showroomAvailability'];
const counts = async () => Object.fromEntries(await Promise.all(models.map(async key => [key, await db[key].count()])));
try {
  const mode = process.argv[2];
  if (mode === 'seed') {
    if (Object.values(await counts()).some(Boolean)) throw new Error('Seeding requires an empty isolated test database.');
    const password = randomBytes(24).toString('base64url');
    const owner = await db.user.create({ data: { email: 'qa-m8@example.invalid', name: 'QA M8 Owner', passwordHash: await hash(password, 12), ownerSlot: 1 } });
    await writeFile(manifestPath, JSON.stringify({ ownerId: owner.id, email: owner.email, password }));
    await sharp({ create: { width: 100, height: 100, channels: 3, background: '#d8bb80' } }).png().toFile(new URL('../../../.local/qa-m8-image.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
    console.log('Seeded disposable QA owner. Credentials remain in ignored .local/admin-fixture.json.');
  } else if (mode === 'expire') {
    const fixture = JSON.parse(await readFile(manifestPath, 'utf8'));
    await db.session.updateMany({ where: { userId: fixture.ownerId }, data: { expiresAt: new Date(0) } });
    console.log('Expired only QA owner sessions.');
  } else if (mode === 'counts') console.log(await counts());
  else if (mode === 'clean') {
    const fixture = JSON.parse(await readFile(manifestPath, 'utf8'));
    const matched = {};
    for (const key of ['product','category','collection','enquiry','appointment']) {
      matched[key] = await db[key].findMany({ where: { name: { startsWith: 'QA M8' } }, select: { id: true } });
      if (matched[key].length !== await db[key].count()) throw new Error(`Unrelated ${key} records found. Refusing cleanup.`);
    }
    const sections = await db.homepageSection.findMany({ where: { internalName: { startsWith: 'QA M8' } }, select: { key: true } });
    const banners = await db.banner.findMany({ where: { internalName: { startsWith: 'QA M8' } }, select: { id: true } });
    const versions = await db.homepageVersion.findMany();
    if (sections.length !== await db.homepageSection.count() || banners.length !== await db.banner.count() || versions.some(v => !JSON.stringify(v.payload).includes('QA M8'))) throw new Error('Unrelated CMS data. Refusing cleanup.');
    if (await db.user.count({ where: { id: { not: fixture.ownerId } } })) throw new Error('Unexpected owner. Refusing cleanup.');
    await db.$transaction(async tx => {
      await tx.homepageSection.deleteMany({ where: { key: { in: sections.map(v=>v.key) } } });
      await tx.banner.deleteMany({ where: { id: { in: banners.map(v=>v.id) } } });
      await tx.homepageVersion.deleteMany({ where: { id: { in: versions.map(v=>v.id) } } });
      for (const key of ['enquiry','appointment','collection']) await tx[key].deleteMany({ where: { id: { in: matched[key].map(v=>v.id) } } });
      await tx.inventoryHistory.deleteMany({ where: { actorId: fixture.ownerId, productId: { in: matched.product.map(v=>v.id) } } });
      await tx.imageCleanup.deleteMany({ where: { productId: { in: matched.product.map(v=>v.id) } } });
      await tx.product.deleteMany({ where: { id: { in: matched.product.map(v=>v.id) } } });
      await tx.category.deleteMany({ where: { id: { in: matched.category.map(v=>v.id) } } });
      await tx.showroomAvailability.deleteMany({ where: { id: 1 } });
      await tx.auditLog.deleteMany({ where: { OR: [{ actorId: fixture.ownerId }, { entityId: { in: [...matched.enquiry, ...matched.appointment].map(v=>v.id) } }] } });
      await tx.user.delete({ where: { id: fixture.ownerId } });
    });
    await unlink(manifestPath); console.log('Removed only verified isolated QA records.', await counts());
  } else throw new Error('Use seed, expire, counts or clean.');
} finally { await db.$disconnect(); }
