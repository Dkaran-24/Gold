import test from 'node:test';
import assert from 'node:assert/strict';
import { formPayload, productFields, categoryFields, sectionFields, bannerFields, type Field } from '../src/lib/admin/fields.ts';
import { appointmentActions, dateInZone, enquiryTransitions, moved, validateUpload } from '../src/lib/admin/model.ts';
import { adminApi, allRecords, cmsImageSources, AdminError } from '../src/lib/admin/api.ts';

function payload(fields: Field[], overrides: Record<string, unknown>) {
  const form = new FormData();
  for (const field of fields) {
    const value = overrides[field.name] ?? field.initial ?? '';
    if (field.type === 'checkbox') { if (value) form.set(field.name, 'on'); }
    else form.set(field.name, String(value));
  }
  return formPayload(fields, form);
}
const product = { name: 'QA ring', sku: 'QA-1', slug: 'qa-ring', categoryId: 'category', purity: '22K', grossWeight: '12.125', netWeight: '12', enquiryOnly: true };
test('product form sends exact numeric, boolean and nullable values', () => {
  const value = payload(productFields, product);
  assert.equal(value.grossWeight, 12.125); assert.equal(value.enquiryOnly, true);
  assert.equal(value.publicPrice, null); assert.equal(value.arrivalDate, null);
  assert.equal(value.publication, 'DRAFT'); assert.equal(value.exclusive, false);
});
test('net weight and precision are validated before mutation', () => {
  assert.throws(() => payload(productFields, { ...product, netWeight: '20' }), /Net weight/);
  assert.throws(() => payload(productFields, { ...product, grossWeight: '12.1234' }), /Gross weight/);
});
test('public price required and negative price rejected', () => {
  assert.throws(() => payload(productFields, { ...product, enquiryOnly: false }), /public price/);
  assert.throws(() => payload(productFields, { ...product, publicPrice: -1 }), /Public price/);
});
test('archived products cannot be published', () => assert.throws(() => payload(productFields, { ...product, publication: 'PUBLISHED', availability: 'ARCHIVED' }), /Unpublish/));
test('invalid slugs and missing required text fail', () => {
  assert.throws(() => payload(productFields, { ...product, slug: 'Bad Slug' }), /slug/);
  assert.throws(() => payload(productFields, { ...product, name: '   ' }), /name/);
});
test('new arrival expiration must follow a start date', () => assert.throws(() => payload(productFields, { ...product, newUntil: '2030-01-01T12:00' }), /expiry/));
test('category URL must use HTTPS; order is an integer', () => {
  assert.throws(() => payload(categoryFields, { name: 'QA', slug: 'qa', imageUrl: 'http://example.com/image' }), /HTTPS/);
  assert.throws(() => payload(categoryFields, { name: 'QA', slug: 'qa', sortOrder: 1.5 }), /Display order/);
  const valid = payload(categoryFields, { name: 'Gold', slug: 'gold', imageUrl: 'https://res.cloudinary.com/example/image/upload/v1/cat.jpg' });
  assert.strictEqual(valid.imageUrl, 'https://res.cloudinary.com/example/image/upload/v1/cat.jpg');
  const empty = payload(categoryFields, { name: 'Silver', slug: 'silver', imageUrl: '' });
  assert.strictEqual(empty.imageUrl, null);
});
test('CMS validates section-specific references and editorial content', () => {
  assert.throws(() => payload(sectionFields, { type: 'HERO', internalName: 'Hero', heading: 'Test' }), /desktop image/);
  assert.throws(() => payload(sectionFields, { type: 'BRIDAL', internalName: 'Bridal', heading: 'Test' }), /bridal collection/);
  assert.throws(() => payload(sectionFields, { type: 'EDITORIAL', internalName: 'Story', heading: 'Test' }), /description/);
  assert.throws(() => payload(sectionFields, { type: 'NEW_ARRIVALS', internalName: 'New', heading: 'Test', productId: 'p' }), /Only featured products/);
});
test('CMS rejects unsafe CTA paths and invalid schedules', () => {
  for (const ctaPath of ['https://evil.test', '//evil.test', '/%2f%2fevil.test']) assert.throws(() => payload(sectionFields, { type: 'APPOINTMENT', internalName: 'Visit', heading: 'Visit', ctaLabel: 'Book', ctaPath }), /destination/);
  assert.throws(() => payload(sectionFields, { type: 'NEW_ARRIVALS', internalName: 'New', heading: 'New', startsAt: '2030-02-02T10:00', endsAt: '2030-02-01T10:00' }), /Schedule/);
});
test('banners require a managed desktop image', () => assert.throws(() => payload(bannerFields, { internalName: 'Banner', heading: 'Test', imageAlt: 'Test', ctaLabel: 'See', ctaPath: '/products' }), /desktop image/));
test('appointment actions respect transition and start-time rules', () => {
  assert.deepEqual(appointmentActions({ id: 'a', status: 'REQUESTED' }), ['APPROVE', 'REJECT', 'PROPOSE', 'CANCEL']);
  assert.deepEqual(appointmentActions({ id: 'a', status: 'RESCHEDULED' }), []);
  assert(!appointmentActions({ id: 'a', status: 'APPROVED', scheduledAt: '2030-01-01T12:00:00Z' }, 0).includes('COMPLETE'));
  assert(appointmentActions({ id: 'a', status: 'APPROVED', scheduledAt: '2020-01-01T12:00:00Z' }).includes('NO_SHOW'));
});
test('enquiry workflow cannot skip directly from new to converted', () => { assert(!enquiryTransitions.NEW!.includes('CONVERTED')); assert.deepEqual(enquiryTransitions.SPAM, ['NEW']); });
test('date view uses showroom timezone across UTC midnight', () => assert.equal(dateInZone('2030-01-01T20:00:00Z', 'Asia/Kolkata'), '2030-01-02'));
test('image formats, empty files and size limits are checked', () => {
  assert.match(validateUpload({ type: 'image/svg+xml', size: 10 }, 100)!, /JPEG/);
  assert.match(validateUpload({ type: 'image/png', size: 0 }, 100)!, /nonempty/);
  assert(validateUpload({ type: 'image/png', size: 101 }, 100));
  assert.equal(validateUpload({ type: 'image/webp', size: 100 }, 100), null);
});
test('ordering preserves all IDs without changing the input', () => { const list = ['a', 'b', 'c']; assert.deepEqual(moved(list, 1, -1), ['b', 'a', 'c']); assert.deepEqual(list, ['a', 'b', 'c']); assert.deepEqual(moved(list, 0, -1), list); });
test('admin client exhausts pagination for derived metrics and filters', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => { calls++; assert.equal(init.cache, 'no-store'); assert.equal(init.credentials, 'same-origin'); const page = Number(new URL(url, 'http://test').searchParams.get('page')); return new Response(JSON.stringify({ data: [{ id: page }], pagination: { page, limit: 1, total: 3, pages: 3 } }), { headers: { 'content-type': 'application/json' } }); });
  assert.deepEqual(await allRecords('admin/enquiries?status=NEW'), [{ id: 1 }, { id: 2 }, { id: 3 }]); assert.equal(calls, 3);
});
test('backend validation and forbidden errors remain visible', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: { message: 'Category contains products.', fields: { fieldErrors: { categoryId: ['Protected'] } } } }), { status: 409 }));
  await assert.rejects(() => adminApi('admin/categories/c', 'DELETE', { confirm: true }), (e: unknown) => e instanceof AdminError && e.status === 409 && e.fields.categoryId?.[0] === 'Protected');
});
test('binary uploads preserve MIME type and blob bytes', async t => {
  const blob = new Blob(['test'], { type: 'image/png' });
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => { assert.equal((init.headers as Record<string, string>)['Content-Type'], 'image/png'); assert.equal(init.body, blob); return new Response('{"data":{"id":"image"}}'); });
  assert.deepEqual((await adminApi('admin/products/p/images', 'POST', blob)).data, { id: 'image' });
});
test('mutation network failures do not automatically retry', async t => { let calls = 0; t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('network'); }); await assert.rejects(() => adminApi('admin/products', 'POST', {}), /may have been saved/); assert.equal(calls, 1); });

test('unreadable successful mutations never reach a saved confirmation or automatically retry', async t => {
  let calls = 0; let saved = false;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('<html>private upstream detail</html>', { status: 200 }); });
  await assert.rejects(async () => { await adminApi('admin/availability', 'PUT', {}); saved = true; }, (error: unknown) => {
    assert(error instanceof AdminError); assert.equal(error.status, 200);
    assert.match(error.message, /could not be verified/); assert.match(error.message, /Refresh this record before retrying/);
    assert.doesNotMatch(error.message, /private upstream detail/); return true;
  });
  assert.equal(saved, false); assert.equal(calls, 1);
});

test('successful mutations reject missing, null, array and contradictory envelopes', async t => {
  let responseBody = '';
  t.mock.method(globalThis, 'fetch', async () => new Response(responseBody, { status: 201 }));
  for (const value of [null, [], 'ok', true, {}, { success: true }, { data: null }, { data: 'saved' }, { data: true }, { data: 42 }, { error: { message: 'private error' } }, { data: { id: 'p' }, error: { message: 'private error' } }]) {
    responseBody = JSON.stringify(value);
    await assert.rejects(() => adminApi('admin/products', 'POST', {}), (error: unknown) => error instanceof AdminError && error.message.includes('may have been saved') && !error.message.includes('private error'));
  }
});

test('unreadable reads offer a retry without implying a saved change', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('null'));
  await assert.rejects(() => adminApi('admin/products/p'), (error: unknown) => error instanceof AdminError && error.message.includes('retry loading') && !error.message.includes('saved'));
});

test('valid record, empty list, nullable availability and no-content responses remain supported', async t => {
  let response = new Response('{"data":{"id":"p"}}', { status: 201 });
  t.mock.method(globalThis, 'fetch', async () => response);
  assert.deepEqual(await adminApi('admin/products', 'POST', {}), { data: { id: 'p' } });
  response = new Response('{"data":[],"pagination":{"page":1,"limit":24,"total":0,"pages":0}}');
  assert.deepEqual((await adminApi('admin/products')).data, []);
  response = new Response('{"data":null}');
  assert.deepEqual(await adminApi('admin/availability'), { data: null });
  response = new Response(null, { status: 204 });
  assert.deepEqual(await adminApi('admin/products/p', 'DELETE', { confirm: true }), { data: null });
});

test('invalid pagination is rejected before derived views can treat it as complete data', async t => {
  let page: unknown;
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ data: [], pagination: page })));
  for (page of [null, {}, { page: 1, pages: 1 }, { page: 0, limit: 100, total: 0, pages: 0 }, { page: 1, limit: 0, total: 0, pages: 0 }, { page: 1, limit: 100, total: -1, pages: 0 }, { page: 1, limit: 100, total: 0, pages: '1' }]) {
    await assert.rejects(() => allRecords('admin/enquiries'), /unreadable response/);
  }
});

test('collection details support a record with paginated product members', async t => {
  const result = { data: { id: 'collection', products: [] }, pagination: { page: 1, limit: 12, total: 0, pages: 0 } };
  t.mock.method(globalThis, 'fetch', async () => Response.json(result));
  assert.deepEqual(await adminApi('admin/collections/collection'), result);
});

test('CMS image sources use the public catalogue visibility filter and include only products with images', async t => {
  const product = (id: string, hasImage = true) => ({ id, name: id, sku: id, images: hasImage ? [{ url: 'https://example.invalid/image' }] : [] });
  const visible = product('visible'); const hiddenCategory = product('hidden-category');
  const pages: number[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const url = new URL(input, 'https://example.invalid');
    const page = Number(url.searchParams.get('page'));
    pages.push(page);
    const selection = url.pathname === '/api/products' ? [visible] : [visible, hiddenCategory];
    return Response.json({ data: page === 1 ? [product('no-image', false)] : selection, pagination: { page, limit: 1, total: 2, pages: 2 } });
  });
  assert.deepEqual(await cmsImageSources(), [{ id: visible.id, name: visible.name, sku: visible.sku }]);
  assert.deepEqual(pages, [1, 2]);
});

test('CMS image source failures remain retryable errors instead of an empty or partial selection', async t => {
  let malformed = false;
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    if (malformed) return Response.json({ data: [{ id: 'bad', name: 'bad', sku: 'bad' }] });
    const page = Number(new URL(input, 'https://example.invalid').searchParams.get('page'));
    if (page === 2) return new Response(null, { status: 503 });
    return Response.json({ data: [{ id: 'a', name: 'a', sku: 'a', images: [{}] }], pagination: { page, limit: 1, total: 2, pages: 2 } });
  });
  await assert.rejects(() => cmsImageSources(), (error: unknown) => error instanceof AdminError && error.status === 503);
  malformed = true;
  await assert.rejects(() => cmsImageSources(), /Unable to verify/);
});
