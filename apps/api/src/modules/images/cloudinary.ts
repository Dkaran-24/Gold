import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ApiError } from '../../errors.js';

export interface ImageStorage {
  ready(): void;
  upload(publicId: string, bytes: Buffer): Promise<{ url: string }>;
  destroy(publicId: string): Promise<void>;
}
export function signature(params: Record<string, string>, secret: string) {
  return createHash('sha256').update(Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&') + secret).digest('hex');
}
export function cloudinaryStorage(environment = process.env, transport = fetch): ImageStorage {
  const config = () => {
    const result = z.object({ CLOUDINARY_CLOUD_NAME: z.string().regex(/^[a-zA-Z0-9_-]+$/), CLOUDINARY_API_KEY: z.string().min(1), CLOUDINARY_API_SECRET: z.string().min(1) }).safeParse(environment);
    if (!result.success) throw new ApiError(503, 'IMAGE_STORAGE_NOT_CONFIGURED', 'Configure the server Cloudinary credentials to manage images.');
    return result.data;
  };
  async function call(action: string, params: Record<string, string>, bytes?: Buffer) {
    const c = config();
    const signed = { ...params, timestamp: String(Math.floor(Date.now() / 1000)) };
    const body = new FormData();
    for (const [k, v] of Object.entries(signed)) body.set(k, v);
    body.set('signature', signature(signed, c.CLOUDINARY_API_SECRET)); body.set('api_key', c.CLOUDINARY_API_KEY);
    if (bytes) body.set('file', new Blob([new Uint8Array(bytes)]), 'image');
    try {
      const result = await transport(`https://api.cloudinary.com/v1_1/${c.CLOUDINARY_CLOUD_NAME}/image/${action}`, { method: 'POST', body, signal: AbortSignal.timeout(30000) });
      if (!result.ok) {
        const payload = await result.json().catch(() => null) as { error?: { message?: string } } | null;
        const providerMessage = payload?.error?.message ?? '';

        if (result.status === 403 || /missing permissions|forbidden|restricted|not allowed/i.test(providerMessage)) {
          const actionMatch = providerMessage.match(/actions=\[([^\]]+)\]/);
          const actions = actionMatch ? ` for action(s) [${actionMatch[1]}]` : '';
          throw new ApiError(502, 'IMAGE_STORAGE_ERROR', `Cloudinary access forbidden: The configured API key is missing required permissions${actions} in this environment. In Cloudinary Console (Settings → Access Keys), grant "Upload/Create" permissions to this Access Key, or use the Primary Environment Credentials.`);
        }

        if (result.status === 401) {
          if (/invalid cloud_name/i.test(providerMessage)) {
            throw new ApiError(502, 'IMAGE_STORAGE_ERROR', `Cloudinary storage rejected request: Invalid cloud_name "${c.CLOUDINARY_CLOUD_NAME}". Please check your Cloud Name in the Cloudinary Console.`);
          }
          if (/invalid api_key/i.test(providerMessage)) {
            throw new ApiError(502, 'IMAGE_STORAGE_ERROR', 'Cloudinary authentication failed: Invalid or unknown API key. Please verify your CLOUDINARY_API_KEY.');
          }
          if (/invalid signature/i.test(providerMessage)) {
            throw new ApiError(502, 'IMAGE_STORAGE_ERROR', 'Cloudinary authentication failed: Invalid signature. Please verify your CLOUDINARY_API_SECRET.');
          }
          throw new ApiError(502, 'IMAGE_STORAGE_ERROR', 'Cloudinary authentication failed. Please verify your Cloudinary API key and secret.');
        }

        if (result.status === 400 && /stale request|timestamp/i.test(providerMessage)) {
          throw new ApiError(502, 'IMAGE_STORAGE_ERROR', 'Cloudinary rejected request: Stale request or invalid timestamp. Please verify your server system clock.');
        }

        throw new ApiError(502, 'IMAGE_STORAGE_ERROR', 'Image storage could not complete the operation.');
      }
      return await result.json() as Record<string, unknown>;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(502, 'IMAGE_STORAGE_ERROR', 'Image storage could not complete the operation.');
    }
  }
  return {
    ready: () => { config(); },
    async upload(publicId, bytes) {
      const result = await call('upload', { public_id: publicId, overwrite: 'false' }, bytes);
      const url = typeof result.secure_url === 'string' ? new URL(result.secure_url) : null;
      if (result.public_id !== publicId || !url || url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') throw new ApiError(502, 'IMAGE_STORAGE_ERROR', 'Invalid image storage response.');
      return { url: url.href };
    },
    async destroy(publicId) {
      const result = await call('destroy', { public_id: publicId, invalidate: 'true' });
      if (result.result !== 'ok' && result.result !== 'not found') throw new ApiError(502, 'IMAGE_STORAGE_ERROR', 'Image cleanup is pending.');
    },
  };
}
