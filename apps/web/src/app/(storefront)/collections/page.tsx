import type { Metadata } from 'next';
import { collections } from '@/lib/server-api';
import { pageNumber } from '@/lib/catalogue';
import { paginatedCanonical } from '@/lib/seo';
import type { SearchParams } from '@/lib/types';
import { CollectionCard } from '@/components/cards';
import { Breadcrumbs, EmptyState, ErrorState, PageIntro, Pager } from '@/components/ui';
export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  return {
    title: 'Our collections',
    description: 'Explore the jewellery collections at Shree Ram Jewellers.',
    alternates: { canonical: paginatedCanonical('/collections', pageNumber((await searchParams).page)) },
  };
}
export default async function Collections({ searchParams }: { searchParams: Promise<SearchParams> }) { const result = await collections(pageNumber((await searchParams).page)); return <div className="wrap"><Breadcrumbs items={[{ label: 'Collections' }]} /><PageIntro eyebrow="The collections" title="Every piece. A point of connection.">Discover jewellery brought together by an idea, a feeling, an occasion.</PageIntro><section className="section-bottom" aria-label="Collections">{result.ok ? <>{result.value.data.length ? <div className="collection-grid">{result.value.data.map(c => <CollectionCard key={c.id} collection={c} />)}</div> : <EmptyState title="A new story is on its way" href="/products">No collections are currently listed. Explore individual pieces or share what you’re looking for.</EmptyState>}<Pager path="/collections" pagination={result.value.pagination} /></> : <ErrorState message={result.error} href="/collections" />}</section></div>; }
