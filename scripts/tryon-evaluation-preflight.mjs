// Offline Phase 1 intake. Input paths and photographs stay on the operator's machine.
import path from 'node:path';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { z } from 'zod';

const identifier = z.string().trim().min(1).max(100);
const product = z.object({
  sku: identifier, kind: z.enum(['earrings', 'necklace']),
  image: identifier, catalogueReference: identifier,
  showroomApproved: z.literal(true),
}).strict();
const portrait = z.object({
  alias: identifier, image: identifier, lighting: identifier, orientation: identifier,
  consentReference: identifier, consentToGoogleEvaluation: z.literal(true),
}).strict();
const schema = z.object({
  products: z.array(product).min(10).max(100),
  portraits: z.array(portrait).min(2).max(20),
}).strict();

function distinct(values) {
  return new Set(values.map(value => value.trim().toLowerCase())).size;
}

async function inspectPhoto(root, relative) {
  if (path.isAbsolute(relative)) throw new Error('Image paths must be relative to the private manifest folder.');
  const file = await realpath(path.resolve(root, relative));
  const location = path.relative(root, file);
  if (!location || location === '..' || location.startsWith('..' + path.sep) || path.isAbsolute(location)) {
    throw new Error('An image resolves outside the private manifest folder.');
  }
  const info = await stat(file);
  if (!info.isFile() || !info.size || info.size > 5 * 1024 * 1024) throw new Error('Each image must be a nonempty file of at most 5 MiB.');
  const bytes = await readFile(file);
  const image = sharp(bytes, { limitInputPixels: 25000000, failOn: 'warning' });
  const metadata = await image.metadata();
  if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages ?? 1) !== 1) throw new Error('Use single-frame JPEG, PNG or WebP photographs.');
  // Decode before accepting a file. Hash normalized pixels to catch renamed or metadata-only copies.
  const pixels = await image.rotate().resize(256, 256, {fit:'contain'}).flatten().toColourspace('srgb').raw().toBuffer();
  return createHash('sha256').update(pixels).digest('hex');
}

export async function prepareEvaluation(manifestPath) {
  const file = await realpath(manifestPath);
  const root = path.dirname(file);
  const parsed = schema.safeParse(JSON.parse(await readFile(file, 'utf8')));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Invalid manifest field ${issue.path.join('.') || 'root'} (${issue.code}).`);
  }
  const { products, portraits } = parsed.data;
  if (distinct(products.map(p => p.sku)) !== products.length || distinct(products.map(p => p.kind)) !== 2) {
    throw new Error('Use distinct SKUs and include both earrings and necklaces.');
  }
  if (distinct(portraits.map(p => p.alias)) !== portraits.length || distinct(portraits.map(p => p.lighting)) < 2 || distinct(portraits.map(p => p.orientation)) < 2) {
    throw new Error('Use distinct portrait aliases and vary lighting and orientation.');
  }
  const fingerprints = new Set();
  for (const [index, item] of [...products, ...portraits].entries()) {
    let hash;
    try { hash = await inspectPhoto(root, item.image); }
    catch { throw new Error(`Image ${index + 1} failed path, file-size or image-decoding checks. Check the private manifest.`); }
    if (fingerprints.has(hash)) throw new Error(`Image ${index + 1} duplicates an earlier photograph.`);
    fingerprints.add(hash);
  }
  const cases = products.flatMap(p => portraits.map(s => ({
    sku: p.sku, kind: p.kind, portrait: s.alias, lighting: s.lighting,
    orientation: s.orientation, state: 'planned', model: 'gemini-3.1-flash-image',
  })));
  return { products: products.length, portraits: portraits.length, plannedCases: cases.length, cases };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Pass one private evaluation manifest path.');
    console.log(JSON.stringify(await prepareEvaluation(process.argv[2]), null, 2));
  } catch (error) {
    // OS and JSON parse errors can contain private paths or snippets of the manifest.
    console.error(error.code || error instanceof SyntaxError ? 'Cannot read the private evaluation manifest.' : error.message);
    process.exitCode = 1;
  }
}
