import { cache } from 'react';
import { api, attempt } from './api';
import type { Category, Collection, CollectionDetail, ContactOptions, DataResponse, Homepage, ListResponse, Product } from './types';

// React cache deduplicates identical reads within a render; live data is never persisted in Next's data cache.
export const products = cache((query: string) => attempt(api<ListResponse<Product>>(`/products?${query}`)));
export const product = cache((slug: string) => attempt(api<DataResponse<Product>>(`/products/${encodeURIComponent(slug)}`)));
export const collection = cache((slug: string, page = 1) => attempt(api<CollectionDetail>(`/collections/${encodeURIComponent(slug)}?page=${page}&limit=12`)));
export const collections = cache((page = 1, limit = 12) => attempt(api<ListResponse<Collection>>(`/collections?page=${page}&limit=${limit}`)));
export const homepage = cache(() => attempt(api<DataResponse<Homepage>>('/homepage')));
export const contactOptions = cache(() => attempt(api<DataResponse<ContactOptions>>('/contact-options')));
async function allPages<T>(path: string): Promise<T[]> {
  const first = await api<ListResponse<T>>(`${path}?limit=100&page=1`);
  const result = [...first.data];
  for (let page = 2; page <= first.pagination.pages; page++) result.push(...(await api<ListResponse<T>>(`${path}?limit=100&page=${page}`)).data);
  return result;
}
export const categories = cache(() => attempt(allPages<Category>('/categories')));
export const collectionOptions = cache(() => attempt(allPages<Collection>('/collections')));
