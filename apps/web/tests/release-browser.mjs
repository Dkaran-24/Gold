// Build the frontend first. Run: node apps/web/tests/release-browser.mjs
// SHOWROOM_TEST_WEB_DIR selects a separate build; CHROME_PATH selects a Chromium executable.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = path.resolve(process.env.SHOWROOM_TEST_WEB_DIR || fileURLToPath(new URL('../', import.meta.url)));
const chrome = [
  process.env.CHROME_PATH,
  ...[process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)
    .flatMap(dir => ['Google/Chrome/Application/chrome.exe', 'Microsoft/Edge/Application/msedge.exe'].map(exe => path.join(dir, exe))),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(candidate => candidate && existsSync(candidate));
assert.ok(chrome, 'Supply CHROME_PATH for a local Chromium browser.');
assert.ok(existsSync(path.join(webDir, '.next/BUILD_ID')), 'Build the selected Next.js application first.');

const savedId = '00000000-0000-4000-8000-000000000042';
const piece = {
  id: 'release-fixture', slug: 'release-fixture', sku: 'TEST-ONLY', name: 'Test fixture ring',
  category: {id: 'fixture-category', name: 'Test category', slug: 'test-category'}, images: [],
  metal: 'GOLD', purity: 'Test', availability: 'AVAILABLE', enquiryOnly: true, publicPrice: null, featured: true,
};
const list = data => ({data, pagination: {page: 1, limit: 100, total: data.length, pages: 1}});
let collections = 'offline', job = 'offline', generationRequests = 0;
const preview = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/0uoAAAAASUVORK5CYII=', 'base64');
function fixture(req, res, pathname) {
  const json = (status, body) => res.writeHead(status, {'Content-Type': 'application/json'}).end(JSON.stringify(body));
  if (req.method !== 'GET') {
    if (pathname === '/api/try-on/photo' || pathname.endsWith('/retry')) generationRequests++;
    return json(405, {error: {message: 'Fixture rejected mutation'}});
  }
  if (pathname === '/api/categories') return json(200, list([piece.category]));
  if (pathname === '/api/collections') return collections === 'offline'
    ? json(503, {error: {message: 'Fixture unavailable'}})
    : json(200, list(collections === 'empty' ? [] : [{slug: 'test-collection', name: 'Test collection'}]));
  if (pathname === '/api/products') return json(200, list([piece]));
  if (pathname === '/api/products/' + piece.slug) return json(200, {data: piece});
  if (pathname === '/api/contact-options') return json(200, {data: {whatsappNumber: null, timezone: null}});
  if (pathname === '/api/try-on/products') return json(200, {data: []});
  if (pathname === '/api/try-on/products/' + piece.id + '/config') return json(200, {data: {
    eligible: true, photoEnabled: true, arEnabled: false, providerConfigured: true,
    kind: 'EARRINGS', overlay: null, maxUploadMb: 1, retentionHours: 1, consentVersion: 'fixture',
  }});
  const jobPath = '/api/try-on/jobs/' + savedId;
  if (pathname === jobPath) {
    if (job === 'offline' || job === 'gone') return json(job === 'offline' ? 503 : 404, {error: {message: 'Fixture status'}});
    const resultUrl = job === 'malformed' ? 'http://[' : jobPath + '/result?until=9999999999999&signature=' + '0'.repeat(64);
    return json(200, {data: {id: savedId, status: 'COMPLETED', resultUrl, canRetry: false, expiresAt: '2030-01-01T00:00:00Z'}});
  }
  if (pathname === jobPath + '/result') return res.writeHead(200, {'Content-Type': 'image/png'}).end(preview);
  return json(404, {error: {message: 'Unknown fixture route'}});
}

// Runs inside a fresh headless browser. A same-origin frame provides a real, precisely sized viewport.
async function exercise(savedId) {
  const frame = document.querySelector('iframe');
  const doc = () => frame.contentDocument;
  function check(condition, name) { if (!condition) throw new Error(name); }
  async function waitFor(read, name) {
    const deadline = performance.now() + 12000;
    do {
      const value = read();
      if (value) return value;
      await new Promise(resolve => setTimeout(resolve, 50));
    } while (performance.now() < deadline);
    throw new Error(name);
  }
  const byText = (selector, text) => [...doc().querySelectorAll(selector)].find(el => el.textContent.trim() === text);
  const button = label => byText('button', label);
  const scenario = value => fetch('/__release/scenario/' + value, {method: 'POST'});
  function fit(width) {
    check(frame.contentWindow.innerWidth === width, 'Unexpected viewport width ' + width);
    check(doc().documentElement.scrollWidth <= doc().documentElement.clientWidth + 1, 'Horizontal overflow at ' + width);
  }
  const key = 'showroom.tryon.job.release-fixture';
  const search = '?search=fixture+ring&categoryId=fixture-category&metal=GOLD&sort=name&featured=true';
  for (const width of [1440, 768, 390]) {
    frame.style.width = width + 'px';
    await scenario('collections-offline');
    frame.src = '/products' + search + '#catalogue-search';
    const retry = await waitFor(() => byText('a', 'Retry collection filter'), 'Missing collection error at ' + width);
    await waitFor(() => retry.getClientRects().length, 'Collection error hidden at ' + width);
    check(!!byText('[role=status]', 'The collection filter is temporarily unavailable.'), 'Missing filter status');
    check(!!byText('.product-card h3 a', 'Test fixture ring'), 'Product disappeared with filter outage');
    fit(width);
    await scenario('collections-ready');
    retry.click();
    await waitFor(() => doc().querySelector('#browse-collection option[value="test-collection"]'), 'Retry failed to restore collections');
    const query = new URL(frame.contentWindow.location.href).searchParams;
    for (const [name, value] of new URLSearchParams(search)) {
      const input = doc().querySelector('.filter-form [name="' + name + '"]');
      check(query.get(name) === value && input?.value === value && (input.type !== 'checkbox' || input.checked), 'Retry lost filter ' + name);
    }
    fit(width);
    await scenario('job-offline');
    sessionStorage.setItem(key, savedId);
    frame.src = '/try-on/release-fixture';
    const checkPrevious = await waitFor(() => button('Check previous preview'), 'Missing restore retry at ' + width);
    check(sessionStorage.getItem(key) === savedId, 'Stored preview ID lost on temporary failure');
    const freshForm = () => doc().querySelector('.try-photo-panel form, .try-photo-panel input[type=file]');
    check(!freshForm(), 'New submission available during uncertain previous generation');
    fit(width);
    await scenario('job-malformed');
    checkPrevious.click();
    const refresh = await waitFor(() => button('Refresh preview link'), 'Malformed result recovery missing');
    check(!freshForm() && !doc().querySelector('img[alt="Generated jewellery preview"]'), 'Malformed result enabled an unsafe action');
    await scenario('job-ready');
    refresh.click();
    await waitFor(() => doc().querySelector('img[alt="Generated jewellery preview"]')?.naturalWidth, 'Refreshed result failed to load');
    fit(width);
  }
  await scenario('job-gone');
  frame.contentWindow.location.reload();
  await waitFor(() => doc().querySelector('.try-photo-panel input[type=file]'), 'Definitively missing job did not release the form');
  check(sessionStorage.getItem(key) === null, 'Definitively missing job ID retained');
}

let app, handle, browser;
let finish;
const outcome = new Promise(resolve => { finish = resolve; });
const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  res.setHeader('Cache-Control', 'no-store');
  // Both browser requests and server-rendered API calls terminate here, before Next rewrites.
  if (pathname === '/api' || pathname.startsWith('/api/')) return fixture(req, res, pathname);
  if (pathname.startsWith('/__release/scenario/') && req.method === 'POST') {
    const [area, state] = pathname.split('/').pop().split('-');
    if (area === 'collections') collections = state;
    if (area === 'job') job = state;
    return res.writeHead(204).end();
  }
  if (pathname === '/__release/outcome' && req.method === 'POST') {
    req.setEncoding('utf8');
    let result = '';
    req.on('data', chunk => { result = (result + chunk).slice(0, 240); });
    req.on('end', () => { res.writeHead(204).end(); finish(result); });
    return;
  }
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'");
  if (pathname === '/__release') {
    const script = '(' + exercise.toString() + ')(' + JSON.stringify(savedId) + ')'
      + ".then(() => 'PASS', error => error.message).then(body => fetch('/__release/outcome', {method:'POST', body}));";
    return res.writeHead(200, {'Content-Type': 'text/html'}).end('<!doctype html><iframe style="border:0;height:900px"></iframe><script>' + script + '</script>');
  }
  if (!handle) return res.writeHead(503).end();
  void handle(req, res);
});

const profileRoot = await realpath(tmpdir());
const profile = await mkdtemp(path.join(profileRoot, 'showroom-release-browser-'));
let timer;
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const {port} = server.address();
  const origin = 'http://127.0.0.1:' + port;
  process.env.API_INTERNAL_URL = origin;
  process.env.NEXT_TELEMETRY_DISABLED = '1';
  process.env.NODE_ENV = 'production';
  process.chdir(webDir);
  const {default: next} = await import('next');
  app = next({dev: false, dir: webDir, hostname: '127.0.0.1', port});
  await app.prepare();
  handle = app.getRequestHandler();
  browser = spawn(chrome, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--disable-background-timer-throttling', '--window-size=1600,1000',
    '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--user-data-dir=' + profile, origin + '/__release',
  ], {stdio: 'ignore', windowsHide: true});
  browser.once('error', () => finish('Browser failed to launch'));
  browser.once('exit', () => finish('Browser exited before reporting'));
  timer = setTimeout(() => finish('Browser regression timed out'), 90000);
  assert.equal(await outcome, 'PASS');
  assert.equal(generationRequests, 0, 'Recovery must never create or retry a paid generation');
  console.log('PASS: previous preview recovery, safe result refresh, filter retry and responsive layout at 1440, 768 and 390 px');
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
  assert.equal(path.relative(profileRoot, resolvedProfile), path.basename(profile));
  assert.match(path.basename(profile), /^showroom-release-browser-[A-Za-z0-9]{6}$/);
  await rm(resolvedProfile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
}
