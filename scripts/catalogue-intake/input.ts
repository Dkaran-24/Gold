import path from 'node:path';
import { open, realpath, stat } from 'node:fs/promises';
import { CsvFormatError, parseCsv } from './csv.js';

export const columns = {
  'products.csv': ['sku','slug','name','categorySlug','metal','purity','purityVerified','grossWeight','netWeight','description','enquiryOnly','publicPrice','priceApproved','featured','arrivalDate','newUntil','availability'],
  'images.csv': ['sku','position','filename','alt','rightsApproved'],
  'memberships.csv': ['sku','collectionSlug'],
} as const;
export interface Finding { file: string; row: number; field: string; issue: string; correction: string }
export interface IntakeRow { row: number; cells: Record<string, string> }
export type AddIssue = (field: string, issue: string, correction: string) => void;
export function at(issues: Finding[], file: string, row: number): AddIssue {
  return (field, issue, correction) => { issues.push({ file, row, field, issue, correction }); };
}

const maxDocumentBytes = 5 * 1024 * 1024;
export async function containedFile(root: string, relativeName: string) {
  // Resolve only portable relative names. Reject device paths, traversal and Windows alternate streams.
  const components = relativeName.split(/[\\/]/);
  if (components.some(part => !part || part === '.' || part === '..' || /[:*?"<>|\x00-\x1f]/.test(part) ||
    /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
    throw new Error('Unsafe relative path');
  }
  const actual = await realpath(path.join(root, ...components));
  const relative = path.relative(root, actual);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('Path escapes the intake directory');
  }
  return actual;
}

export async function readBoundedFile(file: string, limit: number): Promise<Buffer> {
  if (!(await stat(file)).isFile()) throw new Error('Expected a regular file');
  const handle = await open(file, 'r');
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > limit) throw new Error('File exceeds limit');
    const buffer = Buffer.alloc(info.size + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size !== info.size) throw new Error('File changed during review');
    return buffer.subarray(0, size);
  } finally { await handle.close(); }
}

async function document(root: string, name: string) {
  const file = await containedFile(root, name);
  return new TextDecoder('utf-8', { fatal: true }).decode(await readBoundedFile(file, maxDocumentBytes));
}

export async function readTable(root: string, name: keyof typeof columns, issues: Finding[]): Promise<IntakeRow[]> {
  let parsed;
  try { parsed = parseCsv(await document(root, name)); }
  catch (error) {
    if (error instanceof CsvFormatError) at(issues, name, error.row)('CSV', error.message, 'Use comma separators and double quotes for quoted cells. Double any embedded quotes.');
    else at(issues, name, 1)('file', 'Cannot read this intake CSV.', 'Supply the named UTF-8 file within the intake folder, no larger than 5 MiB.');
    return [];
  }
  const header = parsed.shift();
  const expected: readonly string[] = columns[name];
  if (!header || expected.length !== header.values.length || !expected.every(column => header.values.includes(column))) {
    at(issues, name, header?.row ?? 1)('header', 'Missing, repeated or unexpected header.', 'Use each template column exactly once: ' + expected.join(',') + '.');
    return [];
  }
  const rows: IntakeRow[] = [];
  for (const record of parsed) {
    if (record.values.length !== expected.length) {
      at(issues, name, record.row)('CSV', 'The cell count differs from the header.', 'Include every column and quote values containing commas or newlines.');
      continue;
    }
    rows.push({ row: record.row, cells: Object.fromEntries(header.values.map((key, i) => [key, record.values[i]!.trim()])) });
  }
  return rows;
}

export async function references(root: string, issues: Finding[]) {
  const issue = at(issues, 'references.json', 1);
  let value: unknown;
  try { value = JSON.parse(await document(root, 'references.json')); }
  catch { issue('file', 'Cannot read the approved reference list.', 'Supply a valid UTF-8 references.json within the intake folder, no larger than 5 MiB.'); return null; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    issue('file', 'Expected a JSON object.', 'Include categorySlugs and collectionSlugs arrays of owner-approved slugs.'); return null;
  }
  const record = value as Record<string, unknown>;
  const approved = { categorySlugs: new Set<string>(), collectionSlugs: new Set<string>() };
  for (const field of ['categorySlugs','collectionSlugs'] as const) {
    const slugs = record[field];
    if (!Array.isArray(slugs)) { issue(field, 'Missing slug list.', 'Supply an array of approved slugs, using [] if none are approved.'); continue; }
    for (const slug of slugs) {
      if (typeof slug !== 'string' || slug.length > 180 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || approved[field].has(slug)) {
        issue(field, 'Invalid or repeated reference slug.', 'Use each approved lowercase, hyphen-separated slug once.'); break;
      }
      approved[field].add(slug);
    }
  }
  return approved;
}
