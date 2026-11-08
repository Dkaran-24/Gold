import sharp from 'sharp';
import { z } from 'zod';
import { ApiError } from '../../errors.js';

export function imageLimits(environment = process.env) {
  return z.object({ IMAGE_MAX_BYTES: z.coerce.number().int().min(1).max(20 * 1024 * 1024).default(5 * 1024 * 1024), PRODUCT_MAX_IMAGES: z.coerce.number().int().min(1).max(10).default(10) }).parse(environment);
}
export async function validateImage(bytes: unknown, mime: string, limit: number) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw new ApiError(422, 'INVALID_IMAGE', 'Send a nonempty binary image body.');
  if (bytes.length > limit) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Image exceeds the file size limit.');
  try {
    const image = sharp(bytes, { limitInputPixels: 25000000, failOn: 'warning' });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || mime !== `image/${metadata.format}` || (metadata.pages ?? 1) > 1) throw new Error('Unsupported format');
    // Decode and re-encode, remove metadata/trailing payloads, orient and bound delivered dimensions.
    const clean = await image.rotate().resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true }).toBuffer({ resolveWithObject: true });
    if (clean.data.length > limit) throw new Error('Encoded image too large');
    return { buffer: clean.data, format: metadata.format!, width: clean.info.width, height: clean.info.height, bytes: clean.data.length };
  } catch { throw new ApiError(422, 'INVALID_IMAGE', 'Only valid, nonanimated JPEG, PNG and WebP images matching Content-Type are supported.'); }
}
