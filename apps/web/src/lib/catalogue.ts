import type { Product, SearchParams } from './types';

export const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || '' : value || '';
export const pageNumber = (value: string | string[] | undefined) => /^\d+$/.test(first(value)) ? Math.max(1, Math.min(100000, Number(first(value)))) : 1;
export function catalogueQuery(input: SearchParams) {
  const q = new URLSearchParams({ page: String(pageNumber(input.page)), limit: '12' });
  for (const [key, max] of [['search', 200], ['categoryId', 100], ['category', 100], ['purity', 50]] as const) {
    const value = first(input[key]).trim().slice(0, max); if (value) q.set(key, value);
  }
  if (q.has('category') && !q.has('categoryId')) {
    q.set('categoryId', q.get('category')!);
  }
  const enums: Record<string, string[]> = { metal: ['GOLD', 'SILVER', 'PLATINUM', 'MIXED'], availability: ['AVAILABLE', 'RESERVED', 'SOLD'], sort: ['latest', 'oldest', 'name', 'price-asc', 'price-desc'], featured: ['true', 'false'], newArrival: ['true', 'false'] };
  for (const [key, values] of Object.entries(enums)) { const value = first(input[key]); if (values.includes(value)) q.set(key, value); }
  return q;
}
export function filterHrefWithout(query: URLSearchParams, removeKeys: string[]) {
  const copy = new URLSearchParams(query);
  for (const k of removeKeys) copy.delete(k);
  copy.delete('page');
  const qs = copy.toString();
  return `/products${qs ? `?${qs}` : ''}`;
}
export function pageHref(path: string, query: Record<string, string>, page: number) { const q = new URLSearchParams(query); q.set('page', String(page)); return `${path}?${q}`; }
export function money(value: string | number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const num = Number(value);
  const decimals = num > 0 && Number.isInteger(num) ? 0 : 2;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}
export function productPrice(product: Pick<Product, 'enquiryOnly' | 'publicPrice'>) {
  if (product.enquiryOnly || product.publicPrice == null) return 'Price on enquiry';
  const num = Number(product.publicPrice);
  if (!Number.isFinite(num)) return 'Price on enquiry';
  if (num === 0) return '₹0.00';
  if (num < 0) return 'Price on enquiry';
  return money(num) || 'Price on enquiry';
}
export function whatsappHref(number: string | null | undefined, message: string) { return number && /^\+?[1-9][0-9]{7,14}$/.test(number) ? `https://wa.me/${number.replace(/^\+/, '')}?text=${encodeURIComponent(message)}` : null; }
export function safeImageUrl(value?: string | null) {
  if (!value) return null;
  if (/^\/(?!\/)[a-zA-Z0-9/_.-]+$/.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
export function safeCta(value?: string | null) { return value && /^\/(?!\/)[^\\\s]*$/.test(value) ? value : null; }
export function readWishlist(raw: string | null): string[] { try { const data: unknown = JSON.parse(raw || '[]'); return Array.isArray(data) ? [...new Set(data.filter((v): v is string => typeof v === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)))].slice(0, 100) : []; } catch { return []; } }
