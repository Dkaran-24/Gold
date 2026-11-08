import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = path.join(root, 'scripts', 'catalogue-preflight.ts');
const headers = {
  'products.csv': 'sku,slug,name,categorySlug,metal,purity,purityVerified,grossWeight,netWeight,description,enquiryOnly,publicPrice,priceApproved,featured,arrivalDate,newUntil,availability',
  'images.csv': 'sku,position,filename,alt,rightsApproved',
  'memberships.csv': 'sku,collectionSlug',
} as const;

type IntakeFile = keyof typeof headers;
type FixtureRow = Record<string, string>;
type Issue = { file: string; row: number; field: string; issue: string; correction: string };
type Report = { valid: boolean; counts: { products: number; images: number; memberships: number }; issues: Issue[] };

function product(changes: FixtureRow = {}): FixtureRow {
  return {
    sku: '0001', slug: 'test-one', name: 'Fixture only', description: 'Offline test fixture.',
    categorySlug: 'test-category', metal: 'GOLD', purity: 'Test-only purity', purityVerified: 'true',
    grossWeight: '10.125', netWeight: '10.1', enquiryOnly: 'true', publicPrice: '',
    priceApproved: 'false', featured: 'false', arrivalDate: '', newUntil: '', availability: 'AVAILABLE',
    ...changes,
  };
}
function photo(changes: FixtureRow = {}): FixtureRow {
  return { sku: '0001', position: '1', filename: 'one.png', alt: 'Test fixture', rightsApproved: 'true', ...changes };
}
function membership(changes: FixtureRow = {}): FixtureRow {
  return { sku: '0001', collectionSlug: 'test-collection', ...changes };
}
async function writeRows(dir: string, file: IntakeFile, rows: FixtureRow[], bom = false) {
  const keys = headers[file].split(',');
  const encode = (v: string) => /[",\r\n]/.test(v) ? '"' + v.replaceAll('"', '""') + '"' : v;
  const csv = [headers[file], ...rows.map(row => keys.map(key => encode(row[key] ?? '')).join(','))].join('\r\n');
  await writeFile(path.join(dir, file), (bom ? '\uFEFF' : '') + csv + '\r\n');
}
async function fixture(t: TestContext) {
  const temp = await realpath(tmpdir());
  const folder = await mkdtemp(path.join(temp, 'showroom-catalogue-preflight-'));
  const dir = path.join(folder, 'intake');
  t.after(async () => {
    const target = await realpath(folder);
    assert.equal(path.dirname(target), temp);
    assert.match(path.basename(target), /^showroom-catalogue-preflight-[a-z\d]+$/i);
    await rm(target, { recursive: true, force: true });
  });
  await mkdir(path.join(dir, 'photos'), { recursive: true });
  const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#777' } }).png().toBuffer();
  await Promise.all([
    writeRows(dir, 'products.csv', [product()]),
    writeRows(dir, 'images.csv', [photo()]),
    writeRows(dir, 'memberships.csv', [membership()]),
    writeFile(path.join(dir, 'references.json'), JSON.stringify({ categorySlugs: ['test-category'], collectionSlugs: ['test-collection'] })),
    writeFile(path.join(dir, 'photos', 'one.png'), image),
  ]);
  return { dir, folder, image };
}
async function snapshot(dir: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  async function visit(relative: string) {
    for (const entry of await readdir(path.join(dir, relative), { withFileTypes: true })) {
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) await visit(child);
      else files[child] = createHash('sha256').update(await readFile(path.join(dir, child))).digest('hex');
    }
  }
  await visit('');
  return files;
}
function run(...args: string[]) {
  const child = spawnSync(process.execPath, ['--import', 'tsx', cli, ...args], {
    cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30_000,
  });
  assert.ifError(child.error);
  return child;
}
function validate(dir: string, expectedExit: 0 | 1) {
  const result = run(dir, '--json');
  assert.equal(result.status, expectedExit, result.stderr + result.stdout);
  const report: Report = JSON.parse(result.stdout);
  assert.equal(report.valid, expectedExit === 0);
  for (const issue of report.issues) {
    assert.ok(issue.file && Number.isInteger(issue.row) && issue.row >= 1 && issue.field && issue.issue && issue.correction,
      'Every finding identifies the file, physical line, field, issue and recommended correction.');
  }
  return report;
}
function expectIssue(report: Report, file: string, field: string, row?: number) {
  assert.ok(report.issues.some(i => i.file === file && i.field === field && (row === undefined || i.row === row)),
    `Missing ${file}:${row ?? '*'}:${field} in ${JSON.stringify(report.issues)}`);
}

test('real CLI accepts BOM, quoted commas, quotes, newlines and distinct leading-zero SKUs without rewriting inputs', async t => {
  const { dir } = await fixture(t);
  await writeRows(dir, 'products.csv', [
    product({ name: 'TEST ONLY, "one"', description: 'First line\r\nSecond line' }),
    product({ sku: '1', slug: 'test-two', enquiryOnly: 'false', publicPrice: '100.25', priceApproved: 'true',
      featured: 'true', arrivalDate: '2026-01-01T00:00:00+05:30', newUntil: '2026-02-01T00:00:00+05:30' }),
  ], true);
  await writeFile(path.join(dir, 'photos', 'two.png'),
    await sharp({ create: { width: 2, height: 2, channels: 3, background: '#eee' } }).png().toBuffer());
  await writeFile(path.join(dir, 'photos', 'secondary.png'),
    await sharp({ create: { width: 2, height: 2, channels: 3, background: '#aaa' } }).png().toBuffer());
  await writeRows(dir, 'images.csv', [photo(), photo({ sku: '1', filename: 'two.png' }),
    photo({ position: '2', filename: 'secondary.png' })]);
  const before = await snapshot(dir);
  const report = validate(dir, 0);
  assert.deepEqual(report.issues, []);
  assert.deepEqual(report.counts, { products: 2, images: 3, memberships: 1 });
  assert.deepEqual(await snapshot(dir), before);
});

test('reports duplicate identifiers and unapproved references at physical CSV lines even after multiline fields', async t => {
  const { dir } = await fixture(t);
  await writeRows(dir, 'products.csv', [
    product({ sku: 'CASE-01', description: 'Test line one\nTest line two' }),
    product({ sku: 'case-01', categorySlug: 'unapproved-category' }),
  ]);
  await writeRows(dir, 'images.csv', [photo({ sku: 'CASE-01' })]);
  await writeRows(dir, 'memberships.csv', [membership({ sku: 'CASE-01' }), membership({ sku: 'CASE-01' }),
    membership({ sku: 'unknown-sku', collectionSlug: 'unknown-collection' })]);
  const before = await snapshot(dir);
  const report = validate(dir, 1);
  expectIssue(report, 'products.csv', 'sku', 4);
  expectIssue(report, 'products.csv', 'slug', 4);
  expectIssue(report, 'products.csv', 'categorySlug', 4);
  expectIssue(report, 'memberships.csv', 'collectionSlug', 3);
  expectIssue(report, 'memberships.csv', 'sku', 4);
  expectIssue(report, 'memberships.csv', 'collectionSlug', 4);
  assert.deepEqual(await snapshot(dir), before);
});

test('reports product approval, precision, price visibility and arrival-window issues independently', async t => {
  const { dir } = await fixture(t);
  await writeRows(dir, 'products.csv', [
    product({ purityVerified: 'false', publicPrice: '300', netWeight: '11', arrivalDate: '2026-01-01T00:00:00Z' }),
    product({ sku: '0002', slug: 'test-two', grossWeight: '9.1234', enquiryOnly: 'false', publicPrice: '500.123', priceApproved: 'false',
      arrivalDate: '2026-01-10T00:00:00Z', newUntil: '2026-01-01T00:00:00Z' }),
    product({ sku: '0003', slug: 'test-three', enquiryOnly: 'false', publicPrice: '', priceApproved: 'true',
      arrivalDate: '2026-01-01T00:00:00', newUntil: '2026-01-20T00:00:00Z' }),
  ]);
  const report = validate(dir, 1);
  for (const [row, fields] of [
    [2, ['purityVerified', 'publicPrice', 'netWeight', 'newUntil']],
    [3, ['grossWeight', 'publicPrice', 'priceApproved', 'newUntil']],
    [4, ['publicPrice', 'arrivalDate']],
  ] as const) for (const field of fields) expectIssue(report, 'products.csv', field, row);
});

test('image checks reject unlicensed, missing, mislabelled and corrupt files and relative paths escaping photos', async t => {
  const { dir, image } = await fixture(t);
  await writeFile(path.join(dir, 'outside.png'), image);
  await writeFile(path.join(dir, 'photos', 'wrong.jpg'), image);
  await writeFile(path.join(dir, 'photos', 'broken.png'), 'not a png');
  await writeRows(dir, 'images.csv', [
    photo({ rightsApproved: 'false' }), photo({ position: '2', filename: '../outside.png' }),
    photo({ position: '3', filename: 'absent.png' }), photo({ position: '4', filename: 'wrong.jpg' }),
    photo({ position: '5', filename: 'broken.png' }), photo({ position: '6', filename: 'https://example.invalid/test.png' }),
  ]);
  const report = validate(dir, 1);
  expectIssue(report, 'images.csv', 'rightsApproved', 2);
  for (const row of [3, 4, 5, 6, 7]) expectIssue(report, 'images.csv', 'filename', row);
});

test('a photo directory junction or symlink cannot lead the validator outside the private photo root', async t => {
  const { dir, folder, image } = await fixture(t);
  const outside = path.join(folder, 'elsewhere');
  await mkdir(outside);
  await writeFile(path.join(outside, 'external.png'), image);
  try {
    await symlink(outside, path.join(dir, 'photos', 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (err: any) {
    if (err && (err.code === 'EPERM' || err.code === 'EACCES')) {
      t.skip('Symlink/junction creation requires elevated privileges on this system');
      return;
    }
    throw err;
  }
  await writeRows(dir, 'images.csv', [photo({ filename: 'linked/external.png' })]);
  expectIssue(validate(dir, 1), 'images.csv', 'filename', 2);
});

test('image order and duplicate attachment conflicts must be resolved before an intake can pass', async t => {
  const { dir } = await fixture(t);
  await writeRows(dir, 'images.csv', [photo(), photo(), photo({ position: '4' })]);
  const report = validate(dir, 1);
  expectIssue(report, 'images.csv', 'position', 3);
  expectIssue(report, 'images.csv', 'filename', 3);
  await writeRows(dir, 'images.csv', [photo({ position: '2' })]);
  expectIssue(validate(dir, 1), 'images.csv', 'position', 2);
});

test('a non-archived SKU needs a usable approved photograph even when an image row exists', async t => {
  const { dir } = await fixture(t);
  for (const rows of [[], [photo({ rightsApproved: 'false' })]]) {
    await writeRows(dir, 'images.csv', rows);
    expectIssue(validate(dir, 1), 'products.csv', 'images', 2);
  }
});

test('distributed blank templates match the contract and cannot pass as a completed intake', async t => {
  const { dir } = await fixture(t);
  const templates = path.join(root, 'docs', 'catalogue-intake');
  for (const [file, header] of Object.entries(headers)) {
    const text = await readFile(path.join(templates, file), 'utf8');
    assert.equal(text.trim(), header);
    await writeFile(path.join(dir, file), text);
  }
  const refs = await readFile(path.join(templates, 'references.json'), 'utf8');
  assert.deepEqual(JSON.parse(refs), { categorySlugs: [], collectionSlugs: [] });
  await writeFile(path.join(dir, 'references.json'), refs);
  const report = validate(dir, 1);
  assert.deepEqual(report.counts, { products: 0, images: 0, memberships: 0 });
  expectIssue(report, 'products.csv', 'products', 1);
});

test('an archived draft cannot receive new images or collection memberships', async t => {
  const { dir } = await fixture(t);
  await writeRows(dir, 'products.csv', [product({ availability: 'ARCHIVED' })]);
  const report = validate(dir, 1);
  assert.ok(report.issues.some(i => i.file === 'images.csv' && /archiv/i.test(i.issue + i.correction)));
  assert.ok(report.issues.some(i => i.file === 'memberships.csv' && /archiv/i.test(i.issue + i.correction)));
  await writeRows(dir, 'images.csv', []);
  await writeRows(dir, 'memberships.csv', []);
  validate(dir, 0);
});

test('malformed CSV and invalid reference manifests produce repairable issues, while bad invocation exits 2', async t => {
  const { dir } = await fixture(t);
  await writeFile(path.join(dir, 'images.csv'), headers['images.csv'] + '\n"unterminated\n');
  await writeFile(path.join(dir, 'references.json'), '{');
  const report = validate(dir, 1);
  expectIssue(report, 'images.csv', 'CSV');
  assert.ok(report.issues.some(i => i.file === 'references.json'));
  assert.equal(run().status, 2);
});
