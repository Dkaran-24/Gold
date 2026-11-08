import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { collection } from '@/lib/server-api';
import { pageNumber } from '@/lib/catalogue';
import { paginatedCanonical } from '@/lib/seo';
import type { SearchParams } from '@/lib/types';
import { Media } from '@/components/media';
import { ProductGrid } from '@/components/cards';
import { Breadcrumbs, ErrorState, PageIntro, Pager } from '@/components/ui';
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const page = pageNumber((await searchParams).page);
  const result = await collection((await params).slug, page);
  if (!result.ok) return { title: 'Collection unavailable', robots: { index: false } };
  const c = result.value.data;
  return {
    title: c.seoTitle || c.name,
    description: c.seoDescription || c.description.slice(0, 160),
    alternates: { canonical: paginatedCanonical(`/collections/${encodeURIComponent(c.slug)}`, page) },
  };
}
export default async function CollectionDetail({ params, searchParams }: Props) { const { slug } = await params; const result = await collection(slug, pageNumber((await searchParams).page)); if (!result.ok) { if (result.status === 404) notFound(); return <div className="wrap section"><h1>Collection</h1><ErrorState message={result.error} href={`/collections/${encodeURIComponent(slug)}`} /></div>; } const c = result.value.data; return <div className="wrap"><Breadcrumbs items={[{ label: 'Collections', href: '/collections' }, { label: c.name }]} /><PageIntro eyebrow={c.bridal ? 'The bridal collection' : 'A Shree Ram collection'} title={c.name}>{c.description}</PageIntro>{(c.bannerImage || c.coverImage) && <div className="collection-banner"><Media image={c.bannerImage || c.coverImage} alt={c.name} sizes="100vw" priority /></div>}<section className="section"><div className="results-bar"><span>{result.value.pagination.total} pieces in this collection</span></div><ProductGrid products={c.products} empty="More to look forward to" description="There are no publicly available pieces in this selection right now." /><Pager pagination={result.value.pagination} path={`/collections/${c.slug}`} /></section></div>; }
