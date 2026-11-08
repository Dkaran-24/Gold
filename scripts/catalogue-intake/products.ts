import { product, validateState } from '../../apps/api/src/modules/catalogue/validation.js';
import { at, type AddIssue, type Finding, type IntakeRow } from './input.js';

const instructions: Record<string, string> = {
  sku: 'Use the verified physical item SKU as text, up to 100 characters.',
  name: 'Supply the approved product name, up to 200 characters.',
  slug: 'Use a unique lowercase, hyphen-separated slug, up to 180 characters.',
  metal: 'Use GOLD, SILVER, PLATINUM or MIXED.',
  purity: 'Supply the verified purity wording, up to 50 characters.',
  grossWeight: 'Use a positive weight in grams up to 9999999.999 with at most three decimal places.',
  netWeight: 'Use a nonnegative weight in grams, no greater than gross weight, with at most three decimal places.',
  description: 'Supply the approved product description, up to 10000 characters.',
  enquiryOnly: 'Enter true or false in lowercase.',
  publicPrice: 'Use the approved nonnegative INR amount up to 999999999999.99 with at most two decimal places.',
  featured: 'Enter true or false in lowercase.',
  arrivalDate: 'Use an ISO timestamp including Z or a numeric time offset, or clear both arrival fields.',
  newUntil: 'Use an ISO timestamp with a time offset after arrivalDate, or clear both arrival fields.',
  availability: 'Use AVAILABLE, RESERVED, SOLD or ARCHIVED.',
};

function decimal(text: string, places: number) {
  if (!/^\d+(?:\.\d+)?$/.test(text) || (text.split('.')[1]?.length ?? 0) > places) return NaN;
  return Number(text);
}
function flag(text: string | undefined) {
  if (text === 'true') return true;
  if (text === 'false') return false;
  return text ?? '';
}

type State = Parameters<typeof validateState>[0];
// Check each relationship independently so an unrelated invalid cell cannot suppress a second finding.
function checkState(values: Partial<State>, field: string, add: AddIssue) {
  try {
    validateState({ grossWeight: 0, netWeight: 0, enquiryOnly: true, availability: 'AVAILABLE', publication: 'DRAFT', ...values });
  } catch (error) {
    add(field, error instanceof Error ? error.message : 'Invalid field combination.', instructions[field]!);
  }
}

function duplicate(value: string, rows: Map<string, number>, row: number, field: string, add: AddIssue) {
  if (!value) return;
  const key = value.toLowerCase();
  const previous = rows.get(key);
  if (previous !== undefined) add(field, 'Repeated identifier from row ' + previous + '.', 'Use one distinct ' + field + ' per physical item in the batch.');
  else rows.set(key, row);
}

export type ProductIndex = Map<string, { row: number; archived: boolean }>;
export function checkProducts(rows: IntakeRow[], categorySlugs: Set<string> | undefined, issues: Finding[]): ProductIndex {
  const index: ProductIndex = new Map();
  const skuRows = new Map<string, number>();
  const slugRows = new Map<string, number>();
  for (const { row, cells } of rows) {
    const add = at(issues, 'products.csv', row);
    const sku = cells.sku!;
    duplicate(sku, skuRows, row, 'sku', add);
    duplicate(cells.slug!, slugRows, row, 'slug', add);
    if (sku && !index.has(sku)) index.set(sku, { row, archived: cells.availability === 'ARCHIVED' });

    if (!cells.categorySlug || (categorySlugs && !categorySlugs.has(cells.categorySlug))) {
      add('categorySlug', 'Category is missing or absent from the supplied reference list.', 'Copy the exact approved slug from references.json.');
    }
    if (cells.purityVerified !== 'true') add('purityVerified', 'Purity verification is outstanding.', 'Verify the stated purity against the business record before entering true.');
    if (!cells.description) add('description', 'Description is missing.', instructions.description!);

    const grossWeight = decimal(cells.grossWeight!, 3);
    const netWeight = decimal(cells.netWeight!, 3);
    const publicPrice = cells.publicPrice ? decimal(cells.publicPrice, 2) : undefined;
    const enquiryOnly = flag(cells.enquiryOnly);
    const arrivalDate = cells.arrivalDate || undefined;
    const newUntil = cells.newUntil || undefined;
    // categoryId is assigned by the application from a future approved reference; no lookup is performed here.
    const validation = product.safeParse({
      sku, name: cells.name, slug: cells.slug, description: cells.description, categoryId: 'offline-reference',
      metal: cells.metal, purity: cells.purity, grossWeight, netWeight, enquiryOnly, publicPrice,
      availability: cells.availability, featured: flag(cells.featured), arrivalDate, newUntil,
    });
    if (!validation.success) {
      for (const issue of validation.error.issues) {
        const field = String(issue.path[0]);
        add(field, 'Value does not meet the product validation rule.', instructions[field] ?? 'Correct this value using the catalogue intake guide.');
      }
    }
    checkState({ grossWeight, netWeight }, 'netWeight', add);
    if (enquiryOnly === false) {
      checkState({ enquiryOnly, publicPrice }, 'publicPrice', add);
      if (cells.priceApproved !== 'true') add('priceApproved', 'Public price approval is missing.', 'Obtain owner approval for this price before entering true.');
    } else if (enquiryOnly === true) {
      if (cells.publicPrice) add('publicPrice', 'An enquiry-only product includes a public price.', 'Leave publicPrice blank for enquiry-only pricing.');
      if (cells.priceApproved && cells.priceApproved !== 'false') add('priceApproved', 'Unexpected public price approval.', 'Leave priceApproved blank or enter false for an enquiry-only item.');
    }
    if (Boolean(arrivalDate) !== Boolean(newUntil)) {
      const missing = arrivalDate ? 'newUntil' : 'arrivalDate';
      add(missing, 'New arrivals require both dates.', instructions[missing]!);
    } else if (arrivalDate && newUntil) {
      const start = product.shape.arrivalDate.safeParse(arrivalDate);
      const end = product.shape.newUntil.safeParse(newUntil);
      if (start.success && end.success) checkState({ arrivalDate: start.data, newUntil: end.data }, 'newUntil', add);
    }
  }
  return index;
}

export function checkMemberships(rows: IntakeRow[], products: ProductIndex, collectionSlugs: Set<string> | undefined, issues: Finding[]) {
  const seen = new Set<string>();
  for (const { row, cells } of rows) {
    const add = at(issues, 'memberships.csv', row);
    const sku = cells.sku!;
    const slug = cells.collectionSlug!;
    const item = products.get(sku);
    if (!item) add('sku', 'No matching product row.', 'Copy the exact SKU, including case and leading zeros, from products.csv.');
    if (item?.archived) add('sku', 'Archived items cannot receive collection memberships.', 'Remove this membership or verify the product availability.');
    if (!slug || (collectionSlugs && !collectionSlugs.has(slug))) add('collectionSlug', 'Collection is missing or absent from the supplied reference list.', 'Copy the exact approved collection slug from references.json.');
    const key = JSON.stringify([sku, slug]);
    if (seen.has(key)) add('collectionSlug', 'Repeated membership for this SKU.', 'List each SKU and collection combination once.');
    seen.add(key);
  }
}
