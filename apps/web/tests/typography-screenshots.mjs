// Run after a production build: node apps/web/tests/viewport-responsiveness.mjs --screenshots
// Uses only the existing in-memory fixture; never connects to the production API.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function captureTypography(profile, origin) {
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  let port;
  for (let i = 0; i < 100 && !port; i++) {
    try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; }
    catch { await pause(100); }
  }
  if (!port) throw new Error('Browser debugging connection unavailable');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id);
      clearTimeout(timer); pending.delete(message.id);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id;
    const timer = setTimeout(() => { pending.delete(key); reject(new Error(`Timeout: ${method}`)); }, 20000);
    pending.set(key, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
  const directory = fileURLToPath(new URL('../../../docs/screenshots/typography/', import.meta.url));
  await mkdir(directory, { recursive: true });
  const routes = [
    ['homepage', '/', '.home-page'], ['products', '/products', '.product-card'],
    ['product-details', '/products/release-fixture', '.specifications'],
    ['appointment', '/appointments', 'form'], ['virtual-try-on', '/custom-jewellery', '.virtual-studio-page'],
    ['product-try-on', '/try-on/release-fixture', '.try-studio'], ['admin-dashboard', '/admin', '.a-metric'],
  ];
  const results = [];
  try {
    await send('Page.enable');
    await send('Network.setCookie', { name: 'showroom_session', value: '0'.repeat(64), url: origin, path: '/' });
    for (const [name, route, ready] of routes) {
      for (const width of [360, 390, 430, 768, 1024, 1440]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 960, deviceScaleFactor: 1, mobile: false });
        await send('Page.navigate', { url: origin + route });
        let loaded = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          loaded = await evaluate(`location.pathname === ${JSON.stringify(route)} && document.readyState === 'complete' && !!document.querySelector(${JSON.stringify(ready)})`);
          if (loaded) break;
          await pause(100);
        }
        if (!loaded) throw new Error(`Page not ready: ${route}`);
        await evaluate('document.fonts.ready.then(() => true)');
        await pause(250);
        const audit = await evaluate(`(() => {
          const clipped = [...document.querySelectorAll('h1,h2,h3,p,label,button,a,dt,dd,small')].filter(el => {
            const s=getComputedStyle(el), r=el.getBoundingClientRect();
            return r.width && r.height && s.visibility !== 'hidden' && s.display !== 'none' && s.clipPath === 'none' && s.clip === 'auto' &&
              ['hidden','clip'].includes(s.overflowY) && el.scrollHeight > el.clientHeight + 2;
          }).map(el=>el.textContent.trim().slice(0,100));
          return { heading:document.querySelector('h1')?.textContent, overflow:document.documentElement.scrollWidth > innerWidth + 1, clipped };
        })()`);
        results.push({ name, route, width, ...audit });
        if ([390, 1440].includes(width)) {
          // Scroll once so existing lazy-loaded jewellery images are included.
          await evaluate('window.scrollTo(0, document.body.scrollHeight)'); await pause(300);
          await evaluate('window.scrollTo(0, 0)'); await pause(200);
          const { cssContentSize } = await send('Page.getLayoutMetrics');
          const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82, captureBeyondViewport: true,
            clip: { x: 0, y: 0, width, height: Math.ceil(cssContentSize.height), scale: 1 } });
          await writeFile(path.join(directory, `${name}-${width}.jpg`), Buffer.from(shot.data, 'base64'));
        }
      }
    }
    await writeFile(path.join(directory, 'responsive-checks.json'), JSON.stringify(results, null, 2));
    const failures = results.filter(result => result.overflow || result.clipped.length);
    return `${failures.length ? 'FAIL:' : 'PASS:'} ${results.length} typography viewport checks; ${failures.length} overflow/clipping findings. Screenshots: ${directory}`;
  } finally { socket.close(); }
}

