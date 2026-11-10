// Complete Viewport Responsiveness & Mobile Interaction Verification
// Runs Next.js with an in-memory fixture and Chromium to test all 9 viewports:
// 320, 360, 375, 390, 414, 430, 768, 1024, 1440 px
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const chrome = [
  process.env.CHROME_PATH,
  ...[process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)
    .flatMap(dir => ['Google/Chrome/Application/chrome.exe', 'Microsoft/Edge/Application/msedge.exe'].map(exe => path.join(dir, exe))),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(candidate => candidate && existsSync(candidate));
assert.ok(chrome, 'Chromium binary found');
assert.ok(existsSync(path.join(webDir, '.next/BUILD_ID')), 'Build Next.js first');

const piece = {
  id: 'release-fixture', slug: 'release-fixture', sku: 'SRJ-TEST-01', name: 'Heritage Gold Choker',
  category: { id: 'fixture-cat', name: 'Necklaces', slug: 'necklaces' },
  images: [{ id: 'img-1', url: '/images/homepage/our-story-gold-bangles.jpg', alt: 'Choker', isPrimary: true }],
  metal: 'GOLD', purity: '22K', availability: 'AVAILABLE', enquiryOnly: false, publicPrice: 285000, featured: true,
  description: 'Handcrafted heritage choker in pure 22K gold.', grossWeight: '48.5', netWeight: '46.2',
  stoneWeight: '2.3', stoneDetails: 'Uncut polki', diamondDetails: null, gemstoneDetails: null,
  hallmark: 'BIS 916', huid: 'HUID916001', newArrival: true, exclusive: false, publicMakingCharge: 18000,
};

const collectionItem = {
  id: 'fixture-col', slug: 'test-collection', name: 'Royal Rajputana',
  description: 'Regal adornments inspired by royal heritage.',
  bridal: true, bannerImage: null, coverImage: null, products: [piece],
};

const homepageData = {
  version: 1,
  publishedAt: new Date().toISOString(),
  sections: [
    {
      id: 'sec-hero', key: 'hero', type: 'HERO', title: 'Every Jewel Tells an Honest Tale',
      subtitle: 'Handcrafted 22K Gold & Polki Jewellery', description: 'Explore our latest collection.',
      ctaLabel: 'Explore Jewellery', ctaUrl: '/products', secondaryCtaLabel: 'Visit Showroom', secondaryCtaUrl: '/appointments',
      desktopImageUrl: '/images/homepage/our-story-gold-bangles.jpg', mobileImageUrl: null, sortOrder: 0,
    },
    {
      id: 'sec-feat', key: 'featured-products', type: 'FEATURED_PRODUCTS', title: 'Pieces Worth Remembering',
      subtitle: 'Curated Selection', description: 'Each design is made with patience and care.',
      ctaLabel: 'View All', ctaUrl: '/products', secondaryCtaLabel: null, secondaryCtaUrl: null,
      desktopImageUrl: null, mobileImageUrl: null, sortOrder: 1,
    },
  ],
  banners: [],
};

const list = data => ({ data, pagination: { page: 1, limit: 100, total: data.length, pages: 1 } });

function fixture(req, res, pathname) {
  const json = (status, body) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
  if (pathname === '/api/auth/me') return json(200, { data: { id: 'test-owner', email: 'owner@example.com', name: 'Shree Ram Owner' } });
  if (pathname === '/api/auth/logout') return json(200, { data: { ok: true } });
  if (pathname === '/api/categories') return json(200, list([piece.category]));
  if (pathname === '/api/collections') return json(200, list([collectionItem]));
  if (pathname === '/api/collections/' + collectionItem.slug) return json(200, { data: collectionItem, pagination: { page: 1, limit: 12, total: 1, pages: 1 } });
  if (pathname === '/api/products') return json(200, list([piece]));
  if (pathname === '/api/products/' + piece.slug) return json(200, { data: piece });
  if (pathname === '/api/contact-options') return json(200, { data: { whatsappNumber: '+919000000001', timezone: 'Asia/Kolkata' } });
  if (pathname === '/api/homepage') return json(200, { data: homepageData });
  if (pathname === '/api/try-on/studio-products') return json(200, { data: [{ product: piece, asset: { kind: 'NECKLACE' } }], hasMore: false });
  if (pathname === '/api/try-on/products') return json(200, { data: [piece] });
  if (pathname === '/api/try-on/products/' + piece.id + '/config') return json(200, { data: {
    eligible: true, photoEnabled: true, arEnabled: false, providerConfigured: true,
    kind: 'NECKLACE', overlay: null, maxUploadMb: 5, retentionHours: 24, consentVersion: '1.0',
  }});

  // Admin APIs
  if (pathname === '/api/admin/products') return json(200, list([piece]));
  if (pathname.startsWith('/api/admin/products/by-slug/')) return json(200, { data: piece });
  if (pathname.startsWith('/api/admin/products/')) return json(200, { data: piece });
  if (pathname === '/api/admin/categories') return json(200, list([piece.category]));
  if (pathname === '/api/admin/collections') return json(200, list([collectionItem]));
  if (pathname === '/api/admin/enquiries') return json(200, list([{
    id: 'enq-1', name: 'Priya Sharma', phone: '+919820012345', email: 'priya@example.com',
    status: 'NEW', type: 'PRODUCT', priority: 'HIGH', createdAt: new Date().toISOString(),
  }]));
  if (pathname === '/api/admin/appointments') return json(200, list([{
    id: 'apt-1', name: 'Rajesh Patel', phone: '+919820054321', email: 'rajesh@example.com',
    status: 'APPROVED', purpose: 'BRIDAL', requestedAt: new Date().toISOString(), scheduledAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }]));
  if (pathname === '/api/admin/availability') return json(200, { data: {
    timezone: 'Asia/Kolkata',
    weekly: [1,2,3,4,5,6].map(day => ({ day, open: '11:00', close: '20:00' })),
    durationMinutes: 45, bufferMinutes: 15, capacity: 2, closureDates: [], whatsappNumber: '+919000000001',
  }});
  if (pathname === '/api/admin/homepage') return json(200, { data: homepageData });
  if (pathname === '/api/admin/try-on') return json(200, { data: { stats: { total: 1, eligible: 1, configured: 1 } } });

  return json(404, { error: { message: 'Unknown fixture route: ' + pathname } });
}

async function runBrowserChecks() {
  const frame = document.querySelector('iframe');
  const doc = () => frame.contentDocument;
  const win = () => frame.contentWindow;

  function check(condition, message) {
    if (!condition) throw new Error(message);
  }

  async function waitFor(fn, timeoutMsg, timeoutMs = 8000) {
    const end = performance.now() + timeoutMs;
    do {
      try {
        const val = fn();
        if (val) return val;
      } catch {}
      await new Promise(r => setTimeout(r, 60));
    } while (performance.now() < end);
    throw new Error(timeoutMsg);
  }

  async function loadUrl(url) {
    frame.src = url;
    await waitFor(() => {
      const d = doc();
      return d && d.readyState === 'complete' && d.body && d.body.children.length > 0;
    }, 'Failed to load ' + url);
    await new Promise(r => setTimeout(r, 120));
  }

  function assertNoHorizontalScroll(route, width) {
    const el = doc().documentElement;
    const scrollW = el.scrollWidth;
    const clientW = el.clientWidth;
    if (scrollW > clientW + 1) {
      const header = doc().querySelector('header.site-header');
      const headerChildren = header ? Array.from(header.querySelectorAll('*')).map(c => `${c.tagName.toLowerCase()}.${Array.from(c.classList).join('.')}[w=${Math.round(c.getBoundingClientRect().width)},sw=${c.scrollWidth}]`).join(' | ') : 'no-header';
      const culprits = Array.from(doc().querySelectorAll('*'))
        .filter(e => {
          const r = e.getBoundingClientRect();
          return r.right > clientW + 0.5 || e.scrollWidth > clientW + 1 || e.offsetWidth > clientW + 1;
        })
        .slice(0, 8)
        .map(e => `${e.tagName.toLowerCase()}.${Array.from(e.classList).join('.')}[sw=${e.scrollWidth},cw=${clientW},r=${Math.round(e.getBoundingClientRect().right)},txt="${(e.textContent||'').slice(0,40)}"]`);
      throw new Error(`Horizontal overflow on ${route} at ${width}px: scrollWidth=${scrollW}, clientWidth=${clientW}. Culprits: ${culprits.join('; ')}\nHeader children: ${headerChildren}`);
    }
  }

  const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1440];

  const storefrontRoutes = [
    '/',
    '/products',
    '/products/release-fixture',
    '/collections',
    '/collections/test-collection',
    '/custom-jewellery',
    '/try-on/release-fixture',
    '/appointments',
    '/about',
    '/contact',
    '/wishlist',
    '/request-status',
    '/privacy',
    '/terms',
  ];

  const adminRoutes = [
    '/admin/login',
    '/admin',
    '/admin/products',
    '/admin/products/new',
    '/admin/categories',
    '/admin/collections',
    '/admin/homepage',
    '/admin/enquiries',
    '/admin/appointments',
    '/admin/appointments/availability',
    '/admin/inventory',
    '/admin/try-on',
    '/admin/settings',
  ];

  // Set auth cookie for admin testing
  doc().cookie = 'showroom_session=0000000000000000000000000000000000000000000000000000000000000000; path=/';

  const report = [];

  // 1. Audit every storefront route across all 9 viewports
  for (const route of storefrontRoutes) {
    for (const width of widths) {
      frame.style.width = width + 'px';
      await loadUrl(route);
      assertNoHorizontalScroll(route, width);
    }
    report.push(`PASS: Storefront route ${route} tested across all 9 widths (320px–1440px) with 0 horizontal overflow`);
  }

  // 2. Audit every admin route across all 9 viewports
  for (const route of adminRoutes) {
    for (const width of widths) {
      frame.style.width = width + 'px';
      await loadUrl(route);
      assertNoHorizontalScroll(route, width);
    }
    report.push(`PASS: Admin route ${route} tested across all 9 widths (320px–1440px) with 0 horizontal overflow`);
  }

  // 3. Test Mobile Navigation functionality in Storefront Header at 375px
  frame.style.width = '375px';
  await loadUrl('/');

  const menuBtn = await waitFor(() => doc().querySelector('.menu-button'), 'Missing hamburger button');
  const nav = () => doc().querySelector('.main-navigation');
  const backdrop = () => doc().querySelector('.site-nav-backdrop');

  // Verify initial closed state
  check(!nav().classList.contains('is-open'), 'Navigation should be closed initially');
  check(!backdrop(), 'Backdrop should not exist when closed');
  check(doc().body.style.overflow !== 'hidden', 'Body overflow should not be locked initially');

  // Open menu
  menuBtn.click();
  await waitFor(() => nav().classList.contains('is-open'), 'Navigation failed to open');
  await waitFor(() => backdrop(), 'Backdrop missing after opening menu');
  check(doc().body.style.overflow === 'hidden', 'Body overflow must be locked to hidden when menu is open');

  // Tap backdrop to close
  backdrop().click();
  await waitFor(() => !nav().classList.contains('is-open'), 'Menu failed to close on backdrop click');
  check(!backdrop(), 'Backdrop must disappear after closing');
  check(doc().body.style.overflow !== 'hidden', 'Body overflow must be restored after closing menu');

  // Re-open and verify link accessibility
  menuBtn.click();
  await waitFor(() => nav().classList.contains('is-open'), 'Navigation failed to re-open');
  const allNavLinks = Array.from(nav().querySelectorAll('a'));
  check(allNavLinks.length >= 5, 'Expected at least 5 navigation links');
  for (const a of allNavLinks) {
    check(a.textContent.trim().length > 0, 'Navigation link text must not be empty');
  }

  report.push('PASS: Mobile navigation drawer, backdrop, scroll-lock and dismiss verified');

  // 4. Test Admin Navigation Sidebar Drawer at 375px
  await loadUrl('/admin');
  const adminMenuBtn = await waitFor(() => doc().querySelector('.a-menu'), 'Missing admin menu button');
  const adminSidebar = () => doc().querySelector('.a-sidebar');
  const adminOverlay = () => doc().querySelector('.a-overlay');

  check(!adminSidebar().classList.contains('is-open'), 'Admin sidebar should be closed initially');
  adminMenuBtn.click();
  await waitFor(() => adminSidebar().classList.contains('is-open'), 'Admin sidebar failed to open');
  await waitFor(() => adminOverlay(), 'Admin overlay missing when sidebar is open');
  check(doc().body.style.overflow === 'hidden', 'Admin body overflow must be locked when sidebar open');

  // Tap overlay to dismiss
  adminOverlay().click();
  await waitFor(() => !adminSidebar().classList.contains('is-open'), 'Admin sidebar failed to close');
  check(doc().body.style.overflow !== 'hidden', 'Admin body overflow must be restored after close');

  report.push('PASS: Admin mobile sidebar drawer, overlay, scroll-lock and dismiss verified');

  return report.join('\n');
}

let app, handle, browser;
let finish;
const outcome = new Promise(resolve => { finish = resolve; });

const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  res.setHeader('Cache-Control', 'no-store');

  if (pathname.startsWith('/api')) return fixture(req, res, pathname);

  if (pathname === '/__viewport_test/report' && req.method === 'POST') {
    req.setEncoding('utf8');
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('OK');
      finish(data);
    });
    return;
  }

  if (pathname === '/__viewport_test') {
    const script = `
      (${runBrowserChecks.toString()})()
        .then(report => fetch('/__viewport_test/report', { method: 'POST', body: report }))
        .catch(err => fetch('/__viewport_test/report', { method: 'POST', body: 'FAIL: ' + err.message + '\\n' + err.stack }));
    `;
    return res.writeHead(200, { 'Content-Type': 'text/html' }).end(`
      <!doctype html>
      <html>
        <head><title>Viewport Test Runner</title></head>
        <body style="margin:0;padding:0;background:#111">
          <iframe style="border:0;height:960px;background:#fff;display:block"></iframe>
          <script>${script}</script>
        </body>
      </html>
    `);
  }

  if (!handle) return res.writeHead(503).end('Initializing Next.js...');
  void handle(req, res);
});

const profileRoot = await realpath(tmpdir());
const profile = await mkdtemp(path.join(profileRoot, 'srj-viewport-test-'));

let timer;
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  const origin = 'http://127.0.0.1:' + port;

  process.env.API_INTERNAL_URL = origin;
  process.env.NEXT_TELEMETRY_DISABLED = '1';
  process.env.NODE_ENV = 'production';
  process.chdir(webDir);

  const { default: next } = await import('next');
  app = next({ dev: false, dir: webDir, hostname: '127.0.0.1', port });
  await app.prepare();
  handle = app.getRequestHandler();

  browser = spawn(chrome, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--window-size=1600,1050',
    '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--user-data-dir=' + profile, ...(process.argv.includes('--screenshots') ? ['--remote-debugging-port=0', 'about:blank'] : [origin + '/__viewport_test']),
  ], { stdio: 'ignore', windowsHide: true });

  browser.once('error', err => finish('FAIL: Browser failed to launch: ' + err.message));
  browser.once('exit', (code, sig) => {
    if (code !== 0 && code !== null) finish(`FAIL: Browser exited early with code ${code} / ${sig}`);
  });

  if (process.argv.includes('--screenshots')) {
    const { captureTypography } = await import('./typography-screenshots.mjs');
    finish(await captureTypography(profile, origin));
  }

  timer = setTimeout(() => finish('FAIL: Viewport test timed out after 120s'), 120000);

  const result = await outcome;
  console.log(result);
  if (result.startsWith('FAIL:')) {
    process.exitCode = 1;
  }
} finally {
  clearTimeout(timer);
  if (browser?.pid && browser.exitCode === null && browser.signalCode === null) {
    const closed = once(browser, 'exit');
    browser.kill();
    await closed;
  }
  server.closeAllConnections();
  if (server.listening) await new Promise(resolve => server.close(resolve));
  if (app) await app.close();
  const resolvedProfile = await realpath(profile);
  await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
