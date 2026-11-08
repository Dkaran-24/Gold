'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, ExternalLink, Sparkles, CheckCircle2 } from 'lucide-react';
import { adminApi, allRecords, query } from '@/lib/admin/api';
import { categoryFields, productFields, select, text } from '@/lib/admin/fields';
import { stocks, publications, label, type Row } from '@/lib/admin/model';
import { Editor } from './form';
import { GalleryManager } from './images';
import { Badge, Heading, History, LoadState, Pager, Panel, RecordLink, Select, Table, useAction, useLoad } from './ui';

export function ProductList({ inventory = false, initialPublication = '' }: { inventory?: boolean; initialPublication?: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ categoryId: '', publication: initialPublication, availability: '', sort: 'latest' });
  const categories = useLoad(s => allRecords<Row>('admin/categories', s), []);
  const resource = useLoad(s => adminApi<Row[]>(`admin/products?${query({ page, limit: 12, search, ...filters })}`, 'GET', undefined, s), [page, search, JSON.stringify(filters)]);
  const filter = (key: string, value: string) => { setFilters(v => ({ ...v, [key]: value })); setPage(1); };

  return (
    <>
      <Heading
        title={inventory ? 'Inventory' : 'Your jewellery'}
        description={inventory ? 'Availability and recorded stock movements for every physical piece.' : 'Every piece, thoughtfully presented.'}
      >
        {!inventory && <Link className="a-btn a-primary" href="/admin/products/new">+ Add product</Link>}
      </Heading>
      <Panel>
        <form
          className="a-filters"
          onSubmit={e => {
            e.preventDefault();
            setSearch(String(new FormData(e.currentTarget).get('search') || ''));
            setPage(1);
          }}
        >
          <label className="a-field">
            <span>Search products</span>
            <input name="search" placeholder="Name, SKU, or category" maxLength={200} />
          </label>
          <button className="a-btn">Search</button>
          <Select label="Category" value={filters.categoryId} onChange={v => filter('categoryId', v)} options={categories.data?.map(c => ({ value: c.id, label: c.name || '' })) || []} />
          <Select label="Publication" value={filters.publication} onChange={v => filter('publication', v)} options={publications} />
          <Select label="Stock status" value={filters.availability} onChange={v => filter('availability', v)} options={stocks} />
          <Select label="Sort" value={filters.sort} onChange={v => filter('sort', v)} options={['latest', 'oldest', 'name', 'price-asc', 'price-desc']} />
        </form>
        {categories.error && <LoadState {...categories} retry={categories.reload} />}
        <LoadState {...resource} retry={resource.reload} />
        {resource.data && (
          <>
            <Table
              rows={resource.data.data}
              empty="No products match. Add your first piece or adjust the filters."
              columns={[
                { title: 'Piece', render: r => <><RecordLink href={`/admin/products/${r.id}`}>{r.name}</RecordLink><small>{r.sku}</small></> },
                { title: 'Category', render: r => categories.data?.find(c => c.id === r.categoryId)?.name || '—' },
                { title: 'Publication', render: r => <Badge value={r.publication} /> },
                { title: 'Stock', render: r => <Badge value={r.availability} /> },
                { title: 'Details', render: r => <RecordLink href={`/admin/products/${r.id}${inventory ? '#inventory' : ''}`}>{inventory ? 'Manage stock' : 'Edit product'} →</RecordLink> }
              ]}
            />
            <Pager page={resource.data.pagination} onChange={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}

export function ProductEditor({ id, maxBytes, maxImages }: { id: string; maxBytes: number; maxImages: number }) {
  const router = useRouter();
  const create = id === 'new';
  const action = useAction();
  const [revision, setRevision] = useState(0);

  const r = useLoad(
    async s => ({
      categories: await allRecords<Row>('admin/categories', s),
      product: create ? {} : (await adminApi<Row>(`admin/products/${id}`, 'GET', undefined, s)).data
    }),
    [id, revision]
  );

  const refresh = () => setRevision(v => v + 1);
  const p = r.data?.product as Row | undefined;
  const fields = productFields.map(f =>
    f.name === 'categoryId'
      ? { ...f, options: r.data?.categories.map(c => ({ value: c.id, label: c.name || '' })) }
      : f
  );

  return (
    <>
      <Heading
        title={create ? 'Add a jewellery piece' : (p?.name || 'Product details')}
        description={
          create
            ? 'Start with accurate specifications. Save as a draft, add photographs, and preview before publishing.'
            : `${p?.sku || ''} · Manage presentation, Cloudinary photography, inventory and publication.`
        }
      >
        <div className="a-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link className="a-btn" href="/admin/products">
            ← All products
          </Link>
          {!create && p && (
            <>
              <a
                className="a-btn"
                href={`/products/${p.slug}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#faf6ee', borderColor: '#c5a059' }}
              >
                <Eye size={14} color="#8a6e49" /> Preview piece ↗
              </a>
              <button
                className={`a-btn ${p.publication === 'DRAFT' ? 'a-primary' : ''}`}
                disabled={action.busy || p.availability === 'ARCHIVED'}
                onClick={() =>
                  action.run(async () => {
                    await adminApi(`admin/products/${id}/publication`, 'PATCH', {
                      publication: p.publication === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED',
                    });
                    refresh();
                  }, p.publication === 'PUBLISHED' ? 'Piece unpublished to draft.' : 'Piece published to storefront!')
                }
              >
                {p.publication === 'PUBLISHED' ? 'Unpublish to draft' : '✦ Publish piece'}
              </button>
            </>
          )}
        </div>
      </Heading>

      <LoadState {...r} retry={r.reload} />
      {action.feedback}

      {r.data && (
        <>
          {!create && p && (
            <>
              <Panel title="Website visibility & publication status">
                <div className="a-actions" style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="a-muted" style={{ fontSize: '13px' }}>Current status:</span>
                    <Badge value={p.publication} />
                    <Badge value={p.availability} />
                  </div>
                  <button
                    className={`a-btn ${p.publication === 'DRAFT' ? 'a-primary' : ''}`}
                    disabled={action.busy || p.availability === 'ARCHIVED'}
                    onClick={() =>
                      action.run(async () => {
                        await adminApi(`admin/products/${id}/publication`, 'PATCH', {
                          publication: p.publication === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED',
                        });
                        refresh();
                      }, p.publication === 'PUBLISHED' ? 'Piece unpublished to draft.' : 'Piece published to storefront!')
                    }
                  >
                    {p.publication === 'PUBLISHED' ? 'Unpublish to draft' : '✦ Publish piece'}
                  </button>
                  <a
                    className="a-btn"
                    href={`/products/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Eye size={14} /> View {p.publication === 'PUBLISHED' ? 'public storefront page' : 'draft preview'} ↗
                  </a>
                </div>
                <p className="a-muted" style={{ marginTop: '10px', fontSize: '12.5px' }}>
                  {p.publication === 'PUBLISHED'
                    ? 'This piece is live on your public website and appears in category listings and search results.'
                    : 'This piece is saved in private draft mode. You can preview it using the preview button above before publishing.'}
                </p>
              </Panel>

              <GalleryManager productId={id} archived={p.availability === 'ARCHIVED'} maxBytes={maxBytes} maxImages={maxImages} />
            </>
          )}

          <Panel title={create ? 'Piece specifications' : 'Edit piece specifications'}>
            {!r.data.categories.length ? (
              <p>Create a <RecordLink href="/admin/categories/new">category</RecordLink> before adding products.</p>
            ) : (
              <Editor
                key={`${id}-${revision}`}
                fields={fields}
                initial={r.data.product}
                submit={create ? 'Save piece as draft' : 'Save changes'}
                onSave={async value => {
                  const saved = await adminApi<Row>(`admin/products${create ? '' : `/${id}`}`, create ? 'POST' : 'PATCH', value);
                  if (create) {
                    router.replace(`/admin/products/${saved.data.id}`);
                  } else {
                    refresh();
                  }
                }}
              />
            )}
          </Panel>

          {!create && p && (
            <>
              <div id="inventory">
                <Panel title="Inventory & physical stock">
                  <p>Current physical stock status: <Badge value={p.availability} /></p>
                  <Editor
                    key={`stock-${revision}`}
                    fields={[select('availability', 'New stock status', stocks, p.availability), text('reason', 'Reason for the change', 1000)]}
                    submit="Update inventory"
                    onSave={async v => {
                      await adminApi(`admin/products/${id}/inventory`, 'PATCH', v);
                      refresh();
                    }}
                  />
                </Panel>
                <History key={revision} path={`admin/products/${id}/inventory-history`} title="Inventory history" />
              </div>

              <Panel title="Archive & removal">
                <p>Archiving unpublishes the piece and preserves its inventory history. Soft deletion removes it from this dashboard and cannot be undone here.</p>
                <div className="a-actions">
                  <button
                    className="a-btn"
                    disabled={action.busy || p.availability === 'ARCHIVED'}
                    onClick={() =>
                      action.run(async () => {
                        await adminApi(`admin/products/${id}/inventory`, 'PATCH', { availability: 'ARCHIVED', reason: 'Archived by owner dashboard' });
                        refresh();
                      }, 'Product archived.', 'Archive this product and remove it from public listings?')
                    }
                  >
                    Archive product
                  </button>
                  <button
                    className="a-btn a-danger"
                    disabled={action.busy}
                    onClick={() =>
                      action.run(async () => {
                        await adminApi(`admin/products/${id}`, 'DELETE', { confirm: true });
                        router.push('/admin/products');
                      }, 'Product removed.', 'Soft-delete this product? It will disappear from the dashboard. Its history remains in the database; there is no restore button.')
                    }
                  >
                    Soft-delete product
                  </button>
                </div>
              </Panel>
            </>
          )}
        </>
      )}
    </>
  );
}
export function CategoryList(){const [page,setPage]=useState(1);const r=useLoad(s=>adminApi<Row[]>(`admin/categories?page=${page}&limit=12`,'GET',undefined,s),[page]);return <><Heading title="Categories" description="Organise your catalogue. Lower display order numbers appear first."><Link className="a-btn a-primary" href="/admin/categories/new">+ Add category</Link></Heading><Panel><LoadState {...r} retry={r.reload}/>{r.data&&<><Table rows={r.data.data} columns={[{title:'Category',render:v=><div style={{display:'flex',alignItems:'center',gap:'12px'}}>{v.imageUrl?<img src={v.imageUrl} alt="" style={{width:36,height:36,objectFit:'cover',borderRadius:4,border:'1px solid var(--a-line)',background:'#faf8f4'}}/>:null}<RecordLink href={`/admin/categories/${v.id}`}>{v.name||'Category'}</RecordLink></div>},{title:'Visibility',render:v=>v.visible?'Visible':'Hidden'},{title:'Display order',render:v=>v.sortOrder},{title:'Manage',render:v=><RecordLink href={`/admin/categories/${v.id}`}>Edit & reorder →</RecordLink>}]}/><Pager page={r.data.pagination} onChange={setPage}/></>}</Panel></>;}
export function CategoryEditor({id}:{id:string}){const create=id==='new';const router=useRouter();const action=useAction();const r=useLoad(async s=>create?{}:(await allRecords<Row>('admin/categories',s)).find(c=>c.id===id),[id]);return <><Heading title={create?'Add category':'Edit category'}><Link className="a-btn" href="/admin/categories">All categories</Link></Heading><LoadState {...r} retry={r.reload}/>{!r.loading&&!r.error&&!r.data&&<Panel>Category not found.</Panel>}{action.feedback}{r.data&&<Panel><Editor fields={categoryFields} initial={r.data} onSave={async v=>{const saved=await adminApi<Row>(`admin/categories${create?'':'/'+id}`,create?'POST':'PATCH',v);if(create)router.replace(`/admin/categories/${saved.data.id}`);}}/>{!create&&<div className="a-danger-zone"><p>Categories containing any products cannot be deleted. Reassign products first; historical deleted products may still prevent removal.</p><button className="a-btn a-danger" disabled={action.busy} onClick={()=>action.run(async()=>{await adminApi(`admin/categories/${id}`,'DELETE',{confirm:true});router.push('/admin/categories');},'Category deleted.','Permanently delete this empty category?')}>Delete category</button></div>}</Panel>}</>;}
