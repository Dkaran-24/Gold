'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Media } from '@/components/media';
import { WishlistButton } from '@/components/wishlist-button';
import { WhatsAppLink } from '@/components/ui';
import { productPrice } from '@/lib/catalogue';
import type { Product } from '@/lib/types';
import type { OverlayAsset } from '@/lib/try-on/types';
import { LocalFitting } from './local-fitting';

interface Piece { product:Product; asset:OverlayAsset }
export function CatalogueStudio({whatsappNumber}:{whatsappNumber:string|null}) {
  const [pieces,setPieces]=useState<Piece[]>([]);
  const [selected,setSelected]=useState<Piece|null>(null);
  const [kind,setKind]=useState('ALL');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const [page,setPage]=useState(1);
  const [more,setMore]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    fetch('/api/try-on/studio-products?page='+page,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)])})
      .then(async response=>{if(!response.ok)throw new Error('The jewellery selection could not be loaded. Please try again.');return response.json() as Promise<{data:Piece[];hasMore:boolean}>;})
      .then(result=>{if(!controller.signal.aborted){setPieces(previous=>page===1?result.data:[...previous,...result.data.filter(p=>!previous.some(old=>old.product.id===p.product.id))]);setMore(result.hasMore);}})
      .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to load jewellery.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[page,retry]);
  const filtered=pieces.filter(p=>kind==='ALL'||p.asset.kind===kind);
  const product=selected?.product;
  const path=product?'/products/'+encodeURIComponent(product.slug):'';
  return <div className="virtual-studio">
    <header className="vs-intro"><p className="eyebrow">SHREE RAM JEWELLERS · VIRTUAL TRY-ON</p><h1>See How It Looks <em>on You.</em></h1><p>Discover your favourite jewellery in a new way. Try different designs virtually and find the piece that feels right for you.</p></header>
    <div className="vs-layout">
      <LocalFitting asset={selected?.asset??null}/>
      <aside className="vs-selection" aria-label="Choose your jewellery">
        <p className="eyebrow">THE FINISHING TOUCH</p><h2>Find your favourite.</h2>
        <label className="vs-filter">Jewellery category<select value={kind} onChange={e=>{setKind(e.target.value);setSelected(null);}}><option value="ALL">All available pieces</option><option value="NECKLACE">Necklaces</option><option value="EARRINGS">Earrings</option><option disabled>Rings — unavailable</option><option disabled>Bracelets — unavailable</option></select></label>
        <p className="vs-small">Necklaces & earrings with prepared fitting images. Rings and bracelets need hand tracking and are not available.</p>
        {error&&<p role="alert" className="notice">{error} <button className="text-link" onClick={()=>setRetry(v=>v+1)}>Retry selection</button></p>}
        <div className="vs-products" aria-label="Available catalogue pieces" aria-busy={loading}>{filtered.map(piece=><button className="vs-product" key={piece.product.id} aria-pressed={product?.id===piece.product.id} onClick={()=>setSelected(piece)}><span className="vs-thumbnail"><Media image={piece.product.images[0]} alt={piece.product.name} sizes="90px"/></span><span><strong>{piece.product.name}</strong><small>{piece.product.category.name}</small><small>{productPrice(piece.product)}</small></span></button>)}</div>
        {loading&&<p role="status">Loading jewellery…</p>}
        {!loading&&!error&&!filtered.length&&<div className="vs-empty"><p>No pieces are available for this fitting selection yet.</p><Link className="text-link" href="/products">Explore the jewellery catalogue ↗</Link></div>}
        {more&&!error&&<button className="text-link" disabled={loading} onClick={()=>setPage(p=>p+1)}>Load more pieces</button>}
        {product?<div className="vs-selected"><p className="eyebrow">YOUR SELECTED PIECE</p><h3>{product.name}</h3><p>{productPrice(product)}</p><dl><div><dt>Purity</dt><dd>{product.purity}</dd></div><div><dt>Reference</dt><dd>{product.sku}</dd></div><div><dt>Availability</dt><dd>{product.availability.toLowerCase()}</dd></div></dl><Link className="text-link" href={path}>View product details ↗</Link><WishlistButton slug={product.slug} name={product.name} full/><Link className="button" href={path+'#product-enquiry'}>Enquire about this jewellery</Link><WhatsAppLink number={whatsappNumber} message={`Hello Shree Ram Jewellers, I would like to enquire about ${product.name} (SKU: ${product.sku}).`}/><button className="text-link" onClick={()=>setSelected(null)}>Remove selected jewellery</button></div>:<p className="vs-small">Select a piece to see it in your mirror. You can change designs without removing your photograph or stopping the camera.</p>}
      </aside>
    </div>
    <p className="vs-disclaimer">Virtual previews are illustrative. Actual appearance, size, colour and fit may differ. Front-facing views work best; hair, turned faces and existing jewellery can affect the preview.</p>
  </div>;
}

