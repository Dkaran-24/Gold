import path from 'node:path';
import { imageLimits, validateImage } from '../../apps/api/src/modules/images/validation.js';
import { at, containedFile, readBoundedFile, type Finding, type IntakeRow } from './input.js';
import type { ProductIndex } from './products.js';

const limits = imageLimits({});
const formats = new Map([['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.png', 'image/png'], ['.webp', 'image/webp']]);
interface Gallery {
  positions: Map<number, number>;
  filenames: Set<string>;
  usable: boolean;
}

export async function checkPhotos(root: string, rows: IntakeRow[], products: ProductIndex, issues: Finding[]) {
  const galleries = new Map<string, Gallery>();
  const photoRoot = rows.length ? await containedFile(root, 'photos').catch(() => null) : null;
  for (const { row, cells } of rows) {
    const start = issues.length;
    const add = at(issues, 'images.csv', row);
    const sku = cells.sku!;
    const item = products.get(sku);
    if (!item) add('sku', 'No matching product row.', 'Copy the exact SKU, including case and leading zeros, from products.csv.');
    if (item?.archived) add('sku', 'Archived items cannot receive image attachments.', 'Remove this image row or verify the product availability.');
    if (cells.rightsApproved !== 'true') add('rightsApproved', 'Photo permission is outstanding.', 'Confirm the right to use this exact photograph before entering true.');
    if (cells.alt!.length > 500) add('alt', 'Alternative text exceeds 500 characters.', 'Use a brief, factual description of the photograph.');

    const gallery: Gallery = galleries.get(sku) ?? { positions: new Map(), filenames: new Set(), usable: false };
    galleries.set(sku, gallery);
    const position = Number(cells.position);
    if (!/^[1-9]\d*$/.test(cells.position!) || position > limits.PRODUCT_MAX_IMAGES) {
      add('position', 'Invalid photo position.', 'Use integers from 1 through ' + limits.PRODUCT_MAX_IMAGES + ', starting with the primary photograph.');
    } else if (gallery.positions.has(position)) {
      add('position', 'Position already appears on row ' + gallery.positions.get(position) + '.', 'Choose a distinct display position for this SKU.');
    } else gallery.positions.set(position, row);

    const filename = cells.filename!;
    const mime = formats.get(path.extname(filename).toLowerCase());
    let file: string | undefined;
    if (photoRoot && mime) file = await containedFile(photoRoot, filename).catch(() => undefined);
    const fileKey = (file ?? filename.replaceAll('\\', '/')).toLowerCase();
    if (gallery.filenames.has(fileKey)) {
      add('filename', 'Photograph already listed for this SKU.', 'Keep one row per photograph per SKU.');
    } else if (!file || !mime) {
      add('filename', 'Missing, unsafe or unsupported photo path.', 'Supply a local JPEG, PNG or WebP file within photos/ using a relative path.');
    } else {
      try {
        const bytes = await readBoundedFile(file, limits.IMAGE_MAX_BYTES);
        await validateImage(bytes, mime, limits.IMAGE_MAX_BYTES);
      } catch {
        add('filename', 'The file could not pass image validation.', 'Use a readable, nonanimated JPEG, PNG or WebP matching its extension, within 5 MiB and 25 million pixels.');
      }
    }
    gallery.filenames.add(fileKey);
    if (issues.length === start) gallery.usable = true;
  }
  for (const gallery of galleries.values()) {
    const ordered = [...gallery.positions].sort(([first], [second]) => first - second);
    ordered.forEach(([position, row], index) => {
      if (position !== index + 1) {
        at(issues, 'images.csv', row)('position', 'Gap in the display order.', 'Start at 1 for the primary photograph and number consecutively for this SKU.');
      }
    });
  }
  for (const [sku, item] of products) {
    if (!item.archived && !galleries.get(sku)?.usable) {
      at(issues, 'products.csv', item.row)('images', 'No usable rights-approved photograph for this product.', 'Provide an eligible image row in images.csv and the corresponding file in photos/.');
    }
  }
}
