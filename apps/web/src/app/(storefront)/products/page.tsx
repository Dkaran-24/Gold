import type { Metadata } from 'next';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { catalogueQuery, filterHrefWithout } from '@/lib/catalogue';
import { paginatedCanonical } from '@/lib/seo';
import { categories, collectionOptions, products } from '@/lib/server-api';
import type { SearchParams } from '@/lib/types';
import { ProductGrid } from '@/components/cards';
import { CollectionSelect } from '@/components/collection-select';
import { FilterPanel } from '@/components/filter-panel';
import { Breadcrumbs, ErrorState, PageIntro, Pager } from '@/components/ui';

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const query = catalogueQuery(await searchParams);
  const filtered = Array.from(query.keys()).some(key => key !== 'page' && key !== 'limit');
  const catList = await categories();
  const activeCatParam = query.get('categoryId') || query.get('category');
  const activeCat = catList.ok && activeCatParam ? catList.value.find(c => c.id === activeCatParam || c.slug === activeCatParam) : null;

  return {
    title: activeCat ? `${activeCat.name} Collection | Shree Ram Jewellers` : 'The Jewellery Collection | Shree Ram Jewellers',
    description: activeCat ? `Explore handcrafted ${activeCat.name.toLowerCase()} in pure 22K gold, polki and diamonds at Shree Ram Jewellers.` : 'Explore our jewellery collection and discover pieces for every occasion.',
    ...(filtered
      ? { robots: { index: false, follow: true } }
      : { alternates: { canonical: paginatedCanonical('/products', Number(query.get('page'))) } }),
  };
}

export default async function Products({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = catalogueQuery(await searchParams);
  const [result, cats, edits] = await Promise.all([products(query.toString()), categories(), collectionOptions()]);
  const activeCategoryParam = query.get('categoryId') || query.get('category');
  const selectedCategory = cats.ok && activeCategoryParam
    ? cats.value.find(c => c.id === activeCategoryParam || c.slug === activeCategoryParam)
    : null;

  const hasFilters = Boolean(
    query.get('search') ||
    query.get('categoryId') ||
    query.get('metal') ||
    query.get('availability') ||
    query.get('newArrival') ||
    query.get('featured')
  );

  const emptyTitle = selectedCategory
    ? `${selectedCategory.name} are coming soon.`
    : query.get('search')
    ? `No pieces matching “${query.get('search')}”`
    : hasFilters
    ? 'Nothing here quite matches your filters.'
    : 'Something beautiful is on its way.';

  const emptyDesc = selectedCategory
    ? `We are handcrafting signature designs for our ${selectedCategory.name} showcase. Visit our Wadala showroom or start a bespoke enquiry to create your own piece.`
    : query.get('search')
    ? 'Try searching with a broader keyword, check for spelling, or clear filters to view the full collection.'
    : hasFilters
    ? 'Try adjusting or clearing your filters to explore more handcrafted pieces.'
    : 'Explore our showroom or contact us to discover available pieces.';

  const breadcrumbs = selectedCategory
    ? [{ label: 'Jewellery', href: '/products' }, { label: selectedCategory.name }]
    : [{ label: 'Jewellery' }];

  return (
    <div className="wrap catalogue-page">
      <Breadcrumbs items={breadcrumbs} />
      <PageIntro
        eyebrow={selectedCategory ? selectedCategory.name.toUpperCase() : 'THE JEWELLERY COLLECTION'}
        title={selectedCategory ? `Handcrafted ${selectedCategory.name}` : 'Find something that feels like you.'}
      >
        {selectedCategory?.description || 'Explore our jewellery collection and discover pieces for every occasion.'}
      </PageIntro>

      <div className="catalogue-layout">
        <aside className="catalogue-sidebar" aria-label="Catalogue filters">
          <FilterPanel key={query.toString()}>
            <form action="/products" className="filter-form" key={query.toString()}>
              <div className="filter-toolbar">
                <div className="field search-field-compact">
                  <label htmlFor="catalogue-search" className="sr-only">Search jewellery</label>
                  <div className="search-field">
                    <Search size={16} aria-hidden="true" />
                    <input
                      id="catalogue-search"
                      name="search"
                      defaultValue={query.get('search') || ''}
                      maxLength={200}
                      placeholder="Search jewellery…"
                      type="search"
                    />
                  </div>
                </div>

                <div className="field filter-select-compact">
                  <label htmlFor="category" className="sr-only">Category</label>
                  <select id="category" name="categoryId" defaultValue={selectedCategory ? selectedCategory.id : (query.get('categoryId') || '')}>
                    <option value="">All categories</option>
                    {cats.ok && cats.value.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {!cats.ok && <span className="field-hint">Categories unavailable</span>}
                </div>

                <div className="field filter-select-compact">
                  <label htmlFor="metal" className="sr-only">Metal</label>
                  <select id="metal" name="metal" defaultValue={query.get('metal') || ''}>
                    <option value="">All metals</option>
                    <option value="GOLD">Gold</option>
                    <option value="SILVER">Silver</option>
                    <option value="PLATINUM">Platinum</option>
                    <option value="MIXED">Mixed metals</option>
                  </select>
                </div>

                <div className="field filter-select-compact">
                  <label htmlFor="availability" className="sr-only">Availability</label>
                  <select id="availability" name="availability" defaultValue={query.get('availability') || ''}>
                    <option value="">All pieces</option>
                    <option value="AVAILABLE">Available</option>
                    <option value="RESERVED">Reserved</option>
                    <option value="SOLD">Sold</option>
                  </select>
                </div>

                <div className="field filter-select-compact">
                  <label htmlFor="sort" className="sr-only">Sort by</label>
                  <select id="sort" name="sort" defaultValue={query.get('sort') || 'latest'}>
                    <option value="latest">Latest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="name">Name, A–Z</option>
                    <option value="price-asc">Price, low to high</option>
                    <option value="price-desc">Price, high to low</option>
                  </select>
                </div>

                <div className="filter-actions-inline">
                  <button type="submit" className="button button-filter">Apply</button>
                  <Link className="text-link reset-link" href="/products">Clear all filters</Link>
                </div>
              </div>

              <div className="filter-secondary-row">
                <div className="filter-checkbox-group">
                  <label className="checkbox-label">
                    <input type="checkbox" name="newArrival" value="true" defaultChecked={query.get('newArrival') === 'true'} />
                    New arrivals only
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" name="featured" value="true" defaultChecked={query.get('featured') === 'true'} />
                    Featured pieces only
                  </label>
                </div>
              </div>
            </form>
            {edits.ok ? (
              edits.value.length > 0 && <CollectionSelect options={edits.value.map(c => ({ slug: c.slug, name: c.name }))} />
            ) : (
              <div className="field collection-select">
                <p role="status" className="field-hint">The collection filter is temporarily unavailable.</p>
                <a className="text-link" href={'/products?' + query.toString()}>Retry collection filter</a>
              </div>
            )}
          </FilterPanel>
        </aside>

        <section className="catalogue-results" aria-label="Jewellery results">
          {result.ok ? (
            <>
              <div className="results-bar">
                <p>
                  <strong>{result.value.pagination.total}</strong> {result.value.pagination.total === 1 ? 'piece' : 'pieces'}
                  {selectedCategory && <> in <strong>{selectedCategory.name}</strong></>}
                  {query.get('search') && <> matching “<strong>{query.get('search')}</strong>”</>}
                </p>
                <span className="small">Selected with you in mind</span>
              </div>

              {hasFilters && (
                <div className="active-filters-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '22px' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', fontWeight: 600 }}>Active filters:</span>
                  {selectedCategory && (
                    <Link
                      href={filterHrefWithout(query, ['categoryId', 'category'])}
                      className="a-badge"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f5eee3', color: '#4a3828', border: '1px solid #dfd3c0', borderRadius: '16px', padding: '4px 10px', fontSize: '12px', textDecoration: 'none' }}
                      title="Remove category filter"
                    >
                      Category: {selectedCategory.name} <X size={12} />
                    </Link>
                  )}
                  {query.get('search') && (
                    <Link
                      href={filterHrefWithout(query, ['search'])}
                      className="a-badge"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f5eee3', color: '#4a3828', border: '1px solid #dfd3c0', borderRadius: '16px', padding: '4px 10px', fontSize: '12px', textDecoration: 'none' }}
                      title="Remove search query"
                    >
                      Search: “{query.get('search')}” <X size={12} />
                    </Link>
                  )}
                  {query.get('metal') && (
                    <Link
                      href={filterHrefWithout(query, ['metal'])}
                      className="a-badge"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f5eee3', color: '#4a3828', border: '1px solid #dfd3c0', borderRadius: '16px', padding: '4px 10px', fontSize: '12px', textDecoration: 'none' }}
                      title="Remove metal filter"
                    >
                      Metal: {query.get('metal')?.toLowerCase()} <X size={12} />
                    </Link>
                  )}
                  {query.get('availability') && (
                    <Link
                      href={filterHrefWithout(query, ['availability'])}
                      className="a-badge"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f5eee3', color: '#4a3828', border: '1px solid #dfd3c0', borderRadius: '16px', padding: '4px 10px', fontSize: '12px', textDecoration: 'none' }}
                      title="Remove stock filter"
                    >
                      Status: {query.get('availability')?.toLowerCase()} <X size={12} />
                    </Link>
                  )}
                  {query.get('newArrival') === 'true' && (
                    <Link
                      href={filterHrefWithout(query, ['newArrival'])}
                      className="a-badge"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f5eee3', color: '#4a3828', border: '1px solid #dfd3c0', borderRadius: '16px', padding: '4px 10px', fontSize: '12px', textDecoration: 'none' }}
                      title="Remove new arrivals filter"
                    >
                      New arrivals <X size={12} />
                    </Link>
                  )}
                  {query.get('featured') === 'true' && (
                    <Link
                      href={filterHrefWithout(query, ['featured'])}
                      className="a-badge"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f5eee3', color: '#4a3828', border: '1px solid #dfd3c0', borderRadius: '16px', padding: '4px 10px', fontSize: '12px', textDecoration: 'none' }}
                      title="Remove featured filter"
                    >
                      Featured pieces <X size={12} />
                    </Link>
                  )}
                  <Link href="/products" className="text-link" style={{ fontSize: '12px', marginLeft: '6px' }}>
                    Reset all
                  </Link>
                </div>
              )}

              <ProductGrid
                products={result.value.data}
                empty={emptyTitle}
                description={emptyDesc}
                href={hasFilters ? '/products' : '/appointments'}
                action={hasFilters ? 'Explore all jewellery' : 'Explore our showroom'}
              />
              <Pager pagination={result.value.pagination} path="/products" query={Object.fromEntries(query)} />
            </>
          ) : (
            <ErrorState message={result.error} href={`/products?${query}`} />
          )}
        </section>
      </div>
    </div>
  );
}
