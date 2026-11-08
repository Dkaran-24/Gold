'use client';
import { useEffect, useState } from 'react';
import { api, attempt, type Result } from '@/lib/api';
import type { DataResponse, Product } from '@/lib/types';
import { useWishlist } from './wishlist-button';
import { ProductCard } from './cards';
import { EmptyState } from './ui';

export function Wishlist() {
  const { items, ready, toggle, notice } = useWishlist(); const [records, setRecords] = useState<Record<string, Result<DataResponse<Product>>>>({}); const [retry, setRetry] = useState(0);
  const identity = items.join(',');
  useEffect(() => {
    let cancelled = false;
    // Sequential reads respect the existing API rate limit even for a long wishlist.
    async function load() {
      const slugs = identity.split(',').filter(Boolean);
      for (let index = 0; index < slugs.length; index++) {
        const slug = slugs[index]!;
        const result = await attempt(api<DataResponse<Product>>(`/products/${encodeURIComponent(slug)}`));
        if (cancelled) return;
        setRecords(previous => ({ ...previous, [slug]: result }));
        if (!result.ok && (result.status === 429 || result.status === 0)) {
          setRecords(previous => ({ ...previous, ...Object.fromEntries(slugs.slice(index + 1).map(item => [item, result])) }));
          break;
        }
      }
    }
    void load(); return () => { cancelled = true; };
  }, [identity, retry]);
  if (!ready) return <div className="loading-state" role="status">Opening your wishlist…</div>;
  if (!items.length) return <EmptyState title="Keep a little inspiration" href="/products">Save the pieces that speak to you. Your wishlist stays in this browser, ready for your next visit.</EmptyState>;
  return <><div className="results-bar"><span>{items.length} saved {items.length === 1 ? 'piece' : 'pieces'}</span><span className="small">Saved in this browser · up to 100 pieces</span></div>{notice && <p role="status">{notice}</p>}<div className="product-grid">{items.map(slug => { const result = records[slug]; return result?.ok ? <ProductCard key={slug} product={result.value.data} /> : <article className="wishlist-unavailable" key={slug}><h2>{result ? (result.status === 404 ? 'This piece is no longer listed' : 'Unable to check this piece') : 'Checking availability…'}</h2><p>{slug.replaceAll('-', ' ')}</p>{result && <><p className="small">{result.status === 404 ? 'It may have been withdrawn from the public catalogue.' : result.error}</p>{result.status !== 404 && <button type="button" className="text-link" onClick={() => setRetry(v => v + 1)}>Check again</button>}<button className="button button-outline" type="button" onClick={() => toggle(slug)}>Remove from wishlist</button></>}</article>; })}</div></>;
}
