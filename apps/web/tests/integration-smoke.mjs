// Run after fixture.mjs seed/cms and browser form checks; never against operational data.
import assert from 'node:assert/strict';
import { createDatabase } from '@showroom/database';
const connection = process.env.SHOWROOM_TEST_DATABASE_URL;
const url = new URL(connection || 'http://invalid');
if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.username !== 'showroom_test' || url.pathname !== '/postgres') throw new Error('Only the isolated test database is permitted.');
const origin = 'http://localhost:3000';
const get = async path => { const response = await fetch(`${origin}${path}`); assert.equal(response.status, 200, path); return response.json(); };
const list = await get('/api/products?limit=100');
assert.equal(list.data.length, 14); assert.equal(list.pagination.total, 14);
assert.equal(JSON.stringify(list).includes('PRIVATE-QA-MUST-NOT-RENDER'), false);
assert.equal(list.data.some(p => p.slug === 'qa-m7-piece-15'), false);
const privatePrice = await get('/api/products/qa-m7-piece-2');
assert.equal(privatePrice.data.publicPrice, null); assert.equal(privatePrice.data.enquiryOnly, true);
assert.equal((await fetch(`${origin}/api/products/qa-m7-piece-15`)).status, 404);
assert.equal((await fetch(`${origin}/api/admin/products`)).status, 401);
const filtered = await get('/api/products?search=piece%2001&metal=GOLD&sort=price-asc');
assert.equal(filtered.data.length, 1); assert.equal(filtered.data[0].sku, 'qa-m7-1');
const edit = await get('/api/collections/qa-m7-collection?limit=12&page=2');
assert.equal(edit.data.products.length, 2); assert.equal(edit.pagination.total, 14);
const home = await get('/api/homepage');
assert.equal(home.data.sections[0].heading, 'QA published homepage');
assert.equal(home.data.sections.find(s => s.type === 'FEATURED_PRODUCTS').products.length, 4);
for (const [path, expected] of [['/', 'QA published homepage'], ['/products', 'Find your kind of extraordinary.'], ['/products/qa-m7-piece-1', 'QA test piece 01'], ['/collections', 'Every piece. A point of connection.'], ['/collections/qa-m7-collection', 'QA test collection'], ['/wishlist', 'The pieces you keep coming back to.'], ['/custom-jewellery', 'Tell us your idea'], ['/appointments', 'Plan a conversation'], ['/contact', 'Leave a little note'], ['/about', 'QA brand editorial'], ['/request-status', 'Your conversation, continued.']]) {
  const response = await fetch(`${origin}${path}`); const html = await response.text();
  assert.equal(response.status, 200, path); assert.ok(html.includes(expected), path); assert.ok(html.includes('<title>'), `${path} title`); assert.ok(!html.includes('PRIVATE-QA-MUST-NOT-RENDER'), `${path} privacy`);
}
const missing = await (await fetch(`${origin}/products/qa-m7-piece-15`)).text();
assert.ok(missing.includes('This page is no longer here.')); assert.ok(missing.includes('noindex'));
console.log('Public API/proxy, catalogue privacy, filtering, collection pagination, CMS, metadata and all 11 page routes passed.');
const db = createDatabase(connection);
try {
  const enquiries = await db.enquiry.findMany({ where: { name: { startsWith: 'QA M7' } } });
  assert.ok(enquiries.some(e => e.name === 'QA M7 Product' && e.type === 'PRODUCT' && e.productSku === 'qa-m7-1'));
  assert.ok(enquiries.some(e => e.name === 'QA M7 Custom' && e.type === 'CUSTOM' && e.subject === 'Custom jewellery: Ring'));
  assert.ok(enquiries.some(e => e.name === 'QA M7 General' && e.type === 'GENERAL' && e.preferredContact === 'EMAIL'));
  assert.ok(enquiries.every(e => e.status === 'NEW' && e.lookupTokenHash && e.consentAt));
  const appointment = await db.appointment.findFirstOrThrow({ where: { name: 'QA M7 Appointment' } });
  assert.equal(appointment.status, 'REQUESTED'); assert.equal(appointment.scheduledAt, null);
  assert.equal(appointment.requestedAt.toISOString(), '2026-11-10T05:30:00.000Z');
  assert.ok(appointment.lookupTokenHash && appointment.consentAt);
  console.log('Browser-created product/custom/general enquiries and appointment are persisted, consented and unconfirmed; timezone conversion passed.');
} finally { await db.$disconnect(); }
