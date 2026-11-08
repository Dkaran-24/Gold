import type { ListResponse } from './types';

export const siteOrigin = 'https://shreeramjewellers.store';

export function paginatedCanonical(path: string, page: number) {
  return page > 1 ? `${path}?page=${page}` : path;
}

const indexablePages = ['/', '/products', '/collections', '/about', '/custom-jewellery', '/appointments', '/contact'];
const pageSize = 100;
const maxSitemapUrls = 50_000;
type ReadPage = (path: string) => Promise<ListResponse<{ slug: string }>>;

async function collectPaths(resource: 'products' | 'collections', readPage: ReadPage, paths: Set<string>) {
  let total: number | undefined;
  let page = 1;
  while (true) {
    const { data, pagination } = await readPage(`/${resource}?page=${page}&limit=${pageSize}`);
    const remaining = pagination.total - (page - 1) * pageSize;
    if (!Number.isSafeInteger(pagination.total) || pagination.total < 0 ||
        pagination.page !== page || pagination.limit !== pageSize ||
        pagination.pages !== Math.ceil(pagination.total / pageSize) ||
        !Array.isArray(data) || data.length !== Math.min(pageSize, remaining)) {
      throw new Error('Incomplete public catalogue page');
    }
    if (total === undefined) {
      total = pagination.total;
      if (paths.size + total > maxSitemapUrls) throw new Error('Catalogue requires multiple sitemaps');
    } else if (pagination.total !== total) {
      throw new Error('Catalogue changed during pagination');
    }
    for (const { slug } of data) {
      // Both public catalogue resources use the same hyphenated-slug contract.
      if (typeof slug !== 'string' || slug.length > 180 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new Error('Invalid public catalogue slug');
      }
      const path = `/${resource}/${slug}`;
      if (paths.has(path)) throw new Error('Duplicate catalogue record during pagination');
      paths.add(path);
    }
    if (page >= pagination.pages) return;
    page++;
  }
}

export async function publicSitemap(readPage: ReadPage): Promise<Response> {
  try {
    const paths = new Set(indexablePages);
    await collectPaths('products', readPage, paths);
    await collectPaths('collections', readPage, paths);
    const entries = Array.from(paths, path => `  <url><loc>${siteOrigin}${path}</loc></url>`).join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch {
    return new Response('The sitemap is temporarily unavailable.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '300' },
    });
  }
}
