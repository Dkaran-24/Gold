import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogueQuery, filterHrefWithout, pageNumber, pageHref, productPrice, whatsappHref, readWishlist, safeImageUrl, safeCta } from '../src/lib/catalogue.ts';
import { appointmentBody, appointmentSchema, enquiryBody, enquirySchema } from '../src/lib/forms.ts';
import { api, ApiError, attempt } from '../src/lib/api.ts';

const contact = { name: '  Frontend test  ', phone: '+919000000001', email: '', consent: true };
const enquiry = { ...contact, preferredContact: 'PHONE' as const, message: '  A test enquiry  ', jewelleryType: 'Ring' };
test('catalogue only forwards supported public filters and bounds pagination', () => {
  const q = catalogueQuery({ page: '-4', search: ' ring ', categoryId: 'category', sort: 'privateCost', publication: 'DRAFT', metal: 'GOLD', availability: 'ARCHIVED', featured: 'true', newArrival: 'yes', collectionId: 'unsupported' });
  assert.equal(q.toString(), 'page=1&limit=12&search=ring&categoryId=category&metal=GOLD&featured=true');
  assert.equal(pageNumber('99999999'), 100000); assert.equal(pageNumber(['3', '4']), 3); assert.equal(pageNumber('1.5'), 1);

  const qCategory = catalogueQuery({ category: 'necklaces' });
  assert.equal(qCategory.get('categoryId'), 'necklaces');
});
test('filterHrefWithout removes specified filter keys and resets page', () => {
  const q = new URLSearchParams('page=2&categoryId=necklaces&search=gold&metal=GOLD');
  assert.equal(filterHrefWithout(q, ['search']), '/products?categoryId=necklaces&metal=GOLD');
  assert.equal(filterHrefWithout(q, ['categoryId', 'category']), '/products?search=gold&metal=GOLD');
});
test('pagination preserves search and filters while replacing page', () => {
  const href = pageHref('/products', { search: 'gold & pearls', categoryId: 'a', page: '1' }, 2);
  const q = new URL(href, 'http://localhost').searchParams;
  assert.equal(q.get('search'), 'gold & pearls'); assert.equal(q.get('page'), '2'); assert.equal(q.get('categoryId'), 'a');
});
test('private prices never render even if a response contains a value', () => {
  assert.equal(productPrice({ enquiryOnly: true, publicPrice: '123456' }), 'Price on enquiry');
  assert.equal(productPrice({ enquiryOnly: false, publicPrice: null }), 'Price on enquiry');
  assert.equal(productPrice({ enquiryOnly: false, publicPrice: '0' }), '₹0.00');
});
test('WhatsApp uses only a configured valid number and encodes exact jewellery context', () => {
  assert.equal(whatsappHref(null, 'Hello'), null); assert.equal(whatsappHref('javascript:bad', 'Hello'), null);
  const link = new URL(whatsappHref('+919000000001', 'Ring & pendant (SKU: A/1)')!);
  assert.equal(link.hostname, 'wa.me'); assert.equal(link.pathname, '/919000000001'); assert.equal(link.searchParams.get('text'), 'Ring & pendant (SKU: A/1)');
});
test('unsafe image and CTA protocols are refused', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'http://example.com/a.jpg', 'https://user:pass@example.com/a']) assert.equal(safeImageUrl(value), null);
  assert.equal(safeImageUrl('https://res.cloudinary.com/demo/image.jpg'), 'https://res.cloudinary.com/demo/image.jpg');
  for (const path of ['//evil.com', '/\\evil.com', 'https://evil.com', '/a b']) assert.equal(safeCta(path), null);
  assert.equal(safeCta('/products?newArrival=true'), '/products?newArrival=true');
});
test('wishlist recovers corrupt storage and removes duplicates and invalid entries', () => {
  assert.deepEqual(readWishlist('broken'), []); assert.deepEqual(readWishlist('{}'), []);
  assert.deepEqual(readWishlist('["gold-ring",null,"../secret","gold-ring",4,"silver"]'), ['gold-ring', 'silver']);
  assert.equal(readWishlist(JSON.stringify(Array.from({ length: 120 }, (_, i) => `item-${i}`))).length, 100);
});
test('enquiry validation requires valid contact details, consent and nonempty message', () => {
  assert.equal(enquirySchema.safeParse(enquiry).success, true);
  for (const patch of [{ name: ' ' }, { phone: '123' }, { phone: '+91 9000000001' }, { consent: false }, { message: ' ' }, { message: 'x'.repeat(5001) }]) assert.equal(enquirySchema.safeParse({ ...enquiry, ...patch }).success, false);
});
test('email reply requires email but optional empty email is accepted for phone', () => {
  assert.equal(enquirySchema.safeParse({ ...enquiry, preferredContact: 'EMAIL' }).success, false);
  assert.equal(enquirySchema.safeParse({ ...enquiry, preferredContact: 'EMAIL', email: 'test@example.invalid' }).success, true);
  assert.equal(enquirySchema.safeParse({ ...enquiry, email: 'not email' }).success, false);
});
test('custom enquiry maps jewellery type to supported subject and omits empty email', () => {
  assert.deepEqual(enquiryBody(enquiry, 'custom'), { name: 'Frontend test', phone: '+919000000001', consent: true, preferredContact: 'PHONE', message: 'A test enquiry', subject: 'Custom jewellery: Ring' });
});
test('only product enquiries submit product references, without a client type or snapshot', () => {
  assert.equal(enquiryBody(enquiry, 'product', 'product-id').productId, 'product-id');
  assert.equal('productId' in enquiryBody(enquiry, 'general', 'product-id'), false);
  assert.equal('type' in enquiryBody(enquiry, 'product', 'product-id'), false);
});
test('appointment preferences convert to an explicit UTC instant and retain no invented status', () => {
  const values = { ...contact, purpose: 'CONSULTATION' as const, visitors: 2, message: '', requestedAt: '2099-05-01T15:30' };
  const body = appointmentBody(values); assert.equal(body.requestedAt, new Date(values.requestedAt).toISOString());
  assert.equal(body.visitors, 2); assert.equal('status' in body, false); assert.equal('email' in body, false);
});
test('appointment validation rejects past times, invalid times and out-of-range headcounts', () => {
  const values = { ...contact, purpose: 'BRIDAL', visitors: 1, message: '', requestedAt: '2099-05-01T15:30' };
  for (const patch of [{ requestedAt: '2000-01-01T10:00' }, { requestedAt: 'not-a-date' }, { visitors: 0 }, { visitors: 21 }, { visitors: 1.5 }, { consent: false }]) assert.equal(appointmentSchema.safeParse({ ...values, ...patch }).success, false);
});
test('API requests use no-store, never automatically retry mutations and explain uncertain delivery', async () => {
  const original = globalThis.fetch; let count = 0;
  globalThis.fetch = async (_input, options) => { count++; assert.equal(options?.method, 'POST'); assert.equal(options?.cache, 'no-store'); throw new Error('internal secret'); };
  try { await assert.rejects(api('/enquiries/general', {}), error => error instanceof ApiError && error.status === 0 && error.message.includes('could not verify') && !error.message.includes('internal secret')); assert.equal(count, 1); } finally { globalThis.fetch = original; }
});
test('API errors distinguish unavailable and missing data without reflecting server internals', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('{"error":{"message":"database password secret"}}', { status: 404 });
    const missing = await attempt(api('/products/withdrawn')); assert.equal(missing.ok, false); if (!missing.ok) { assert.equal(missing.status, 404); assert.doesNotMatch(missing.error, /secret/); }
    globalThis.fetch = async () => new Response('{}', { status: 429 });
    await assert.rejects(api('/products'), /Too many requests/);
  } finally { globalThis.fetch = original; }
});
