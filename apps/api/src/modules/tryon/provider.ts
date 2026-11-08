import sharp from 'sharp';
import { z } from 'zod';
import { ApiError } from '../../errors.js';
import { validateImage } from '../images/validation.js';

export const PROMPT_VERSION = 'srj-photo-v1';
export interface TryOnInput {
  portrait: Buffer;
  portraitMime: string;
  referenceUrl: string;
  kind: 'EARRINGS' | 'NECKLACE';
}
export interface TryOnProvider {
  readonly configured: boolean;
  readonly name: string;
  readonly model: string;
  generate(input: TryOnInput): Promise<{ bytes: Buffer; mime: string }>;
}

const prompt = [
  'Edit the first image (customer portrait) using the second image (selected jewellery reference).',
  'Preserve the identity, facial characteristics, expression, skin texture and pose of the person.',
  'Place only the selected jewellery on the person, with a natural attachment point, scale and occlusion.',
  'Preserve its exact silhouette, stone count, stone placement, setting, metal colour, motif and asymmetry.',
  'Do not invent or replace design details or change hair, clothing, lighting, background or unrelated objects.',
  'Return a single edited portrait. If you cannot preserve the design, decline the edit.',
].join(' ');

// Allow only IDs whose official model cards explicitly document image output.
const models = new Set(['gemini-3.1-flash-image', 'gemini-3-pro-image']);
const endpoint = 'https://generativelanguage.googleapis.com';
const MiB = 1024 * 1024;
const invalidOutput = () => new ApiError(502, 'PROVIDER_OUTPUT', 'The provider did not return a usable preview.');
const unavailable = () => new ApiError(503, 'PROVIDER_UNAVAILABLE', 'Photo try-on is unavailable. Please try again later.');
const invalidReference = () => new ApiError(422, 'INVALID_REFERENCE', 'This product needs a suitable catalogue reference.');

async function readLimited(response: Response, limit: number): Promise<Buffer> {
  if (!response.body || Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel();
    throw invalidOutput();
  }
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        throw invalidOutput();
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, length);
  } finally {
    reader.releaseLock();
  }
}

function checkedReference(url: string, cloud: string) {
  const reference = URL.canParse(url) ? new URL(url) : null;
  if (!reference || reference.origin !== 'https://res.cloudinary.com' ||
      reference.username || reference.password || reference.search || reference.hash ||
      !reference.pathname.startsWith('/' + cloud + '/image/upload/')) throw invalidReference();
  const assetPath = reference.pathname.slice(('/' + cloud + '/image/upload/').length);
  if (!/^(?:v[0-9]+\/)?showroom\/products\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i.test(assetPath)) throw invalidReference();
  return reference;
}

async function inlinePhoto(bytes: Buffer, mime: string) {
  const clean = await validateImage(bytes, mime, 20 * MiB);
  // Bound the two inline images together below the REST request-size limit.
  const jpeg = await sharp(clean.buffer).flatten({ background: '#ffffff' })
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 92 }).toBuffer();
  if (jpeg.length > 6 * MiB) throw invalidReference();
  return { inline_data: { mime_type: 'image/jpeg', data: jpeg.toString('base64') } };
}

const modelMetadata = z.object({ name: z.string(), supportedGenerationMethods: z.array(z.string()) });
const candidate = z.object({
  finishReason: z.literal('STOP'),
  content: z.object({ parts: z.array(z.object({
    thought: z.boolean().optional(),
    inlineData: z.object({ mimeType: z.string(), data: z.string().min(1) }).optional(),
  })) }),
});

export function createTryOnProvider(environment = process.env, transport = fetch): TryOnProvider {
  const key = environment.GEMINI_API_KEY?.trim();
  const model = environment.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-image';
  const cloud = environment.CLOUDINARY_CLOUD_NAME?.trim();
  const configured = Boolean(key && cloud && /^[a-z0-9_-]+$/i.test(cloud) && models.has(model));
  return {
    name: 'gemini', model: models.has(model) ? model : 'unsupported', configured,
    async generate(input) {
      if (!configured || !key || !cloud) throw new ApiError(503, 'PROVIDER_NOT_CONFIGURED', 'Photo try-on needs provider configuration.');
      const reference = checkedReference(input.referenceUrl, cloud);
      const signal = AbortSignal.timeout(90_000);
      const headers = { 'x-goog-api-key': key };
      try {
        const metadata = await transport(endpoint + '/v1beta/models/' + model, { headers, signal, redirect: 'error' });
        if (!metadata.ok) { await metadata.body?.cancel(); throw unavailable(); }
        const info = modelMetadata.safeParse(JSON.parse((await readLimited(metadata, 64 * 1024)).toString()));
        if (!info.success || info.data.name !== 'models/' + model || !info.data.supportedGenerationMethods.includes('generateContent')) throw unavailable();

        const asset = await transport(reference, { signal, redirect: 'error' });
        if (!asset.ok) { await asset.body?.cancel(); throw invalidReference(); }
        let jewellery;
        try {
          const bytes = await readLimited(asset, 20 * MiB);
          jewellery = await inlinePhoto(bytes, asset.headers.get('content-type')?.split(';')[0]?.trim() || '');
        } catch { throw invalidReference(); }
        const portrait = await inlinePhoto(input.portrait, input.portraitMime);
        const response = await transport(endpoint + '/v1/models/' + model + ':generateContent', {
          method: 'POST', signal, redirect: 'error', headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [
              { text: prompt + ' Jewellery type: ' + input.kind + '.' }, portrait, jewellery,
            ] }],
            generationConfig: { responseModalities: ['IMAGE'] },
          }),
        });
        if (!response.ok) { await response.body?.cancel(); throw unavailable(); }
        const json = JSON.parse((await readLimited(response, 22 * MiB)).toString());
        const result = candidate.safeParse(json?.candidates?.[0]);
        if (!result.success) throw invalidOutput();
        const inline = result.data.content.parts.find(part => !part.thought && part.inlineData)?.inlineData;
        if (!inline || inline.data.length > 20 * MiB || !/^[A-Za-z0-9+/]+={0,2}$/.test(inline.data)) throw invalidOutput();
        try {
          const clean = await validateImage(Buffer.from(inline.data, 'base64'), inline.mimeType, 15 * MiB);
          return { bytes: clean.buffer, mime: 'image/' + clean.format };
        } catch { throw invalidOutput(); }
      } catch (error) {
        if (signal.aborted) throw new ApiError(504, 'PROVIDER_TIMEOUT', 'The preview request timed out.');
        if (error instanceof ApiError) throw error;
        throw unavailable();
      }
    },
  };
}
