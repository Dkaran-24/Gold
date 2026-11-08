import { realpath, stat } from 'node:fs/promises';
import { at, readTable, references, type Finding } from './catalogue-intake/input.js';
import { checkProducts, checkMemberships } from './catalogue-intake/products.js';
import { checkPhotos } from './catalogue-intake/photos.js';

/** Validate an owner-controlled, local intake folder. The report is returned in memory. */
export async function validateCatalogue(directory: string) {
  const issues: Finding[] = [];
  const counts = { products: 0, images: 0, memberships: 0 };
  let root: string;
  try {
    if (!directory || /^(?:\\\\|\/\/)/.test(directory)) throw new Error('Expected a local path');
    root = await realpath(directory);
    if (!(await stat(root)).isDirectory()) throw new Error('Expected a directory');
  } catch {
    at(issues, 'intake', 1)('file', 'Cannot open the local intake folder.', 'Supply the path to an existing, readable local directory.');
    return { valid: false, counts, issues };
  }

  const approved = await references(root, issues);
  const products = await readTable(root, 'products.csv', issues);
  const photos = await readTable(root, 'images.csv', issues);
  const memberships = await readTable(root, 'memberships.csv', issues);
  counts.products = products.length;
  counts.images = photos.length;
  counts.memberships = memberships.length;

  if (!products.length && !issues.some(i => i.file === 'products.csv')) {
    at(issues, 'products.csv', 1)('products', 'The batch contains no product records.', 'Enter at least one verified item below the header.');
  }
  const index = checkProducts(products, approved?.categorySlugs, issues);
  await checkPhotos(root, photos, index, issues);
  checkMemberships(memberships, index, approved?.collectionSlugs, issues);
  return { valid: !issues.length, counts, issues };
}

async function main(args: string[]) {
  const [dir, option] = args;
  if (!dir || dir.startsWith('-') || args.length > 2 || (option !== undefined && option !== '--json')) {
    console.error('Usage: node --import tsx scripts/catalogue-preflight.ts <private-directory> [--json]');
    return 2;
  }
  const report = await validateCatalogue(dir);
  if (option === '--json') console.log(JSON.stringify(report, null, 2));
  else {
    const { products, images, memberships } = report.counts;
    console.log('Catalogue preflight | ' + products + ' products | ' + images + ' images | ' + memberships + ' memberships');
    for (const result of report.issues) {
      console.log(result.file + ':' + result.row + ' [' + result.field + '] ' + result.issue + ' ' + result.correction);
    }
    console.log(report.valid ? 'Batch passed offline validation.' : report.issues.length + ' finding(s) require review.');
  }
  return report.valid ? 0 : 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(() => {
    console.error('The offline preflight could not complete. Check local file access and installed project dependencies.');
    process.exitCode = 1;
  });
}
