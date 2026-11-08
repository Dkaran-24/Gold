import type { Product } from '../types';

export interface Page { page: number; limit: number; total: number; pages: number }
export interface Result<T> { data: T; pagination?: Page }
export class AdminError extends Error {
  status: number; fields: Record<string, string[]>;
  constructor(message: string, status = 0, fields: Record<string, string[]> = {}) { super(message); this.status = status; this.fields = fields; }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function validEnvelope(value: unknown, readOnly: boolean): value is Result<unknown> {
  if (!isRecord(value) || !Object.hasOwn(value, 'data') || value.data === undefined || 'error' in value) return false;
  // An unconfigured availability read legitimately returns null; mutations return a record or 204.
  if (value.data === null && !readOnly) return false;
  if (value.data !== null && !isRecord(value.data) && !Array.isArray(value.data)) return false;
  if (value.pagination === undefined) return true;
  const page = value.pagination;
  // Collection details paginate their nested products inside a record.
  return value.data !== null && isRecord(page) &&
    ['page', 'limit', 'total', 'pages'].every(key => Number.isSafeInteger(page[key])) &&
    Number(page.page) >= 1 && Number(page.limit) >= 1 && Number(page.total) >= 0 && Number(page.pages) >= 0;
}
export async function adminApi<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<Result<T>> {
  const binary = typeof Blob !== 'undefined' && body instanceof Blob;
  const readOnly = ['GET', 'HEAD'].includes(method.toUpperCase());
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, { method, credentials: 'same-origin', cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000), headers: body === undefined ? undefined : { 'Content-Type': binary ? (body as Blob).type : 'application/json' }, body: body === undefined ? undefined : binary ? body as Blob : JSON.stringify(body) });
  } catch (e) { if (signal?.aborted) throw e; throw new AdminError(method === 'GET' ? 'Unable to load data. Check your connection and retry.' : 'The response was interrupted. Refresh this record before retrying; the change may have been saved.'); }
  const payload = response.status === 204 ? { data: null } : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && path !== 'auth/login' && typeof window !== 'undefined') { window.dispatchEvent(new Event('owner-session-expired')); window.location.replace('/admin/login?expired=1'); }
    throw new AdminError(payload?.error?.message || (response.status === 403 ? 'Access denied. Sign in as the owner on the configured website address.' : response.status === 429 ? 'Too many requests. Please wait a minute and retry.' : 'The request could not be completed.'), response.status, payload?.error?.fields?.fieldErrors);
  }
  if (response.status !== 204 && !validEnvelope(payload, readOnly)) {
    throw new AdminError(readOnly
      ? 'The server returned an unreadable response. Please retry loading this record.'
      : 'The change could not be verified. Refresh this record before retrying; the change may have been saved.', response.status);
  }
  return payload as Result<T>;
}
export function query(values: Record<string, string | number | undefined>) { const q = new URLSearchParams(); for (const [k,v] of Object.entries(values)) if (v !== '' && v !== undefined) q.set(k,String(v)); return q.toString(); }
// Exhaust every page: never compute totals/priority filters from just the first page.
export async function allRecords<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const rows: T[] = []; let page = 1; let pages = 1;
  do { const r = await adminApi<T[]>(`${path}${path.includes('?') ? '&' : '?'}limit=100&page=${page}`, 'GET', undefined, signal); rows.push(...r.data); pages = r.pagination?.pages ?? 1; page++; } while (page <= pages);
  return rows;
}

export async function cmsImageSources(signal?: AbortSignal): Promise<Pick<Product, 'id' | 'name' | 'sku'>[]> {
  // Public catalogue and CMS validation use the same publication, category and inventory rules.
  const products = await allRecords<Pick<Product, 'id' | 'name' | 'sku' | 'images'>>('products', signal);
  return products.flatMap(product => {
    if (!product || typeof product.id !== 'string' || typeof product.name !== 'string' || typeof product.sku !== 'string' || !Array.isArray(product.images)) {
      throw new AdminError('Unable to verify which products have images. Please reload the selection.');
    }
    return product.images.length ? [{ id: product.id, name: product.name, sku: product.sku }] : [];
  });
}
