'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Media } from '@/components/media';
import { productPrice } from '@/lib/catalogue';
import type { Product, ListResponse } from '@/lib/types';
import type { EligibleProduct } from '@/lib/try-on/types';

export function JewelleryRail({eligible, selected, mode}:{eligible:EligibleProduct[]; selected:Product; mode:'photo'|'live'}) {
  const [pieces,setPieces]=useState<Product[]>([selected]);
  const [category,setCategory]=useState('');
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [version,setVersion]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true); setError('');
    async function load() {
      if(!eligible.length) {setPieces([]);return;}
      const ids=new Set(eligible.map(p=>p.id));
      const found:Product[]=[];
      let page=1, pages=1;
      do {
        const response=await fetch('/api/products?limit=100&page='+page,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
        if(!response.ok) throw new Error('The jewellery selection could not be loaded.');
        const result=await response.json() as ListResponse<Product>;
        found.push(...result.data.filter(p=>ids.has(p.id)));
        pages=result.pagination.pages; page++;
      } while(page<=pages);
      if(!controller.signal.aborted) setPieces(found);
    }
    load().catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[eligible,version]);
  const categories=[...new Map(pieces.map(p=>[p.category.id,p.category])).values()];
  const matches=pieces.filter(p=>(!category||p.category.id===category)&&(!search||`${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase())));
  return <section className="try-selection" aria-labelledby="try-selection-title">
    <div className="try-section-heading"><div><p className="eyebrow">A different detail. A new perspective.</p><h2 id="try-selection-title">Find your finishing touch.</h2></div><p>Explore the pieces available in your fitting room.</p></div>
    <div className="try-filters"><label>Jewellery category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">All jewellery</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Find a piece<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or SKU"/></label></div>
    {loading ? <div className="try-skeleton" role="status">Preparing your selection…</div> : error ? <p role="alert" className="notice">{error} <button className="text-link" onClick={()=>setVersion(v=>v+1)}>Retry selection</button></p> : matches.length===0 ? <div className="try-empty"><h3>A little more to discover.</h3><p>No eligible pieces match this selection. Try another category or search.</p></div> : <div className="try-product-rail" role="region" aria-label="Available jewellery" tabIndex={0}>{matches.map(p=><Link key={p.id} className={'try-product-card'+(p.id===selected.id?' is-selected':'')} href={'/try-on/'+encodeURIComponent(p.slug)+'?mode='+mode} aria-current={p.id===selected.id?'true':undefined}>
      <div className="try-card-image"><Media image={p.images[0]} alt={p.name} sizes="(max-width:600px) 65vw, 260px"/>{p.id===selected.id&&<span className="try-selected-tag">Your selection</span>}</div><div className="try-card-copy"><span className="eyebrow">{p.category.name}</span><h3>{p.name}</h3><p>{productPrice(p)}</p><small>{p.sku}</small></div>
    </Link>)}</div>}
  </section>;
}
