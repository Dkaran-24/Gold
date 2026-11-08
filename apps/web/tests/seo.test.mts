import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paginatedCanonical, publicSitemap, siteOrigin } from '../src/lib/seo.ts';

function pageOf(slugs: string[], page = 1, total = slugs.length) {
  return {
    data: slugs.map(slug => ({ slug })),
    pagination: { page, limit: 100, total, pages: Math.ceil(total / 100) },
  };
}

test('the sitemap lists a genuinely empty showroom without private destinations', async () => {
  const response = await publicSitemap(async () => pageOf([]));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /application\/xml/);
  const xml = await response.text();
  const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), match => new URL(match[1]));
  assert.deepEqual(urls.map(url => url.pathname).sort(), [
    '/', '/about', '/appointments', '/collections', '/contact', '/custom-jewellery', '/products',
  ]);
  assert.ok(urls.every(url => url.origin === siteOrigin));
});

test('the sitemap reads all pages of the public listings and emits real detail URLs', async () => {
  const requested: string[] = [];
  const first = Array.from({ length: 100 }, (_, index) => `test-product-${index + 1}`);
  const response = await publicSitemap(async path => {
    requested.push(path);
    if (path === '/products?page=1&limit=100') return pageOf(first, 1, 101);
    if (path === '/products?page=2&limit=100') return pageOf(['last-test-product'], 2, 101);
    if (path === '/collections?page=1&limit=100') return pageOf(['test-collection']);
    throw new Error('Unexpected API request');
  });
  assert.equal(response.status, 200);
  assert.equal(requested.length, 3);
  const xml = await response.text();
  assert.equal((xml.match(/<loc>/g) || []).length, 109);
  assert.ok(xml.includes(`<loc>${siteOrigin}/products/last-test-product</loc>`));
  assert.ok(xml.includes(`<loc>${siteOrigin}/collections/test-collection</loc>`));
});

test('unavailable or inconsistent catalogue data returns a retryable 503 instead of partial XML', async () => {
  const fullPage = Array.from({ length: 100 }, (_, index) => `test-${index}`);
  const failures = [
    () => { throw new Error('Internal test error'); },
    () => pageOf([], 2, 101),
    () => pageOf(['test-0'], 2, 101),
    () => pageOf(['../admin'], 2, 101),
    () => pageOf(['test-last'], 2, 102),
  ];
  for (const fail of failures) {
    const response = await publicSitemap(async path =>
      path === '/products?page=1&limit=100' ? pageOf(fullPage, 1, 101) : fail());
    assert.equal(response.status, 503);
    assert.ok(response.headers.has('retry-after'));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(await response.text(), /<urlset|<loc>|Internal test error/);
  }
});

test('paginated canonical URLs distinguish later listing pages', () => {
  assert.equal(paginatedCanonical('/products', 1), '/products');
  assert.equal(paginatedCanonical('/collections/test-collection', 2), '/collections/test-collection?page=2');
});
