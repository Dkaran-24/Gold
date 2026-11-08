'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Camera, Image as PhotoIcon, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { WhatsAppLink } from '@/components/ui';
import { Media } from '@/components/media';
import { productPrice } from '@/lib/catalogue';
import type { Product } from '@/lib/types';
import type { TryOnConfig, EligibleProduct } from '@/lib/try-on/types';
import { tryOnRequest } from '@/lib/try-on/client';
import { PhotoTryOn } from './photo-try-on';
import { LiveCamera } from './live-camera';
import { JewelleryRail } from './jewellery-rail';

export function Studio({product,whatsappNumber,initialMode='photo'}:{product:Product;whatsappNumber:string|null;initialMode?:'photo'|'live'}) {
  const [options,setOptions]=useState<EligibleProduct[]>([]);
  const [config,setConfig]=useState<TryOnConfig|null>(null);
  const [error,setError]=useState('');
  const [optionsError,setOptionsError]=useState(false);
  const [mode,setMode]=useState<'photo'|'live'>(initialMode);
  const [version,setVersion]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    setConfig(null);setError('');setOptionsError(false);
    tryOnRequest<TryOnConfig>('products/'+encodeURIComponent(product.id)+'/config',{signal:controller.signal})
      .then(data=>{if(!controller.signal.aborted){setConfig(data);setMode(initialMode==='live'&&data.arEnabled?'live':!data.photoEnabled&&data.arEnabled?'live':'photo');}})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    tryOnRequest<EligibleProduct[]>('products',{signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setOptions(data);}).catch(()=>{if(!controller.signal.aborted)setOptionsError(true);});
    return ()=>controller.abort();
  },[product.id,initialMode,version]);
  const path='/products/'+encodeURIComponent(product.slug);
  const live=!!(config?.arEnabled&&config.overlay&&config.kind);
  return <div className="try-studio">
    <header className="try-intro"><div><p className="eyebrow">Shree Ram · The personal styling studio</p><h1>Your Jewellery,<br/><em>Your Look.</em></h1></div><div className="try-intro-note"><span className="try-fine-rule"/><p>A piece you love. A look that feels like you. <br/>Discover your next favourite, before you visit.</p><span className="try-privacy"><ShieldCheck size={16} aria-hidden="true"/> A thoughtful, private fitting experience</span></div></header>
    <ol className="try-steps" aria-label="Your fitting experience"><li><span>01</span> Choose your jewellery</li><li><span>02</span> Find your perspective</li><li><span>03</span> Make it your own</li></ol>
    <div className="try-layout">
      <aside className="try-piece"><div className="try-piece-image"><Media image={product.images[0]} alt={product.name} sizes="(max-width:720px) 35vw, (max-width:1100px) 30vw, 420px" priority/><span className="try-piece-caption">The piece, in focus</span></div><div className="try-piece-copy"><p className="eyebrow">{product.category.name}</p><h2>{product.name}</h2><p className="try-piece-price">{productPrice(product)}</p><dl><div><dt>Purity</dt><dd>{product.purity}</dd></div><div><dt>Reference</dt><dd>{product.sku}</dd></div></dl><Link className="text-link" href={path}>Discover this piece <ArrowUpRight size={15}/></Link></div></aside>
      <div className="try-workspace">
        <div className="try-workspace-title"><span className="eyebrow">Your personal fitting</span><span className="try-session-label">Made for your perspective</span></div>
        {error?<div className="notice" role="alert">{error} <button className="text-link" onClick={()=>setVersion(v=>v+1)}>Retry</button></div>:!config?<div className="try-skeleton" role="status">Opening your fitting room…</div>:!config.eligible||(!config.photoEnabled&&!live)?<div className="try-panel try-empty"><p className="eyebrow">A personal invitation</p><h2>Some pieces are best met in person.</h2><p>This piece has no fitting option available just now. Explore another piece below, or let our showroom help you discover it.</p><Link href={path+'#product-enquiry'} className="text-link">Speak to the showroom <ArrowUpRight size={16}/></Link></div>:<>
          <div className="try-modes" aria-label="Choose your try-on experience">
            <button disabled={!config.photoEnabled} aria-pressed={mode==='photo'} onClick={()=>setMode('photo')} aria-controls="try-experience"><PhotoIcon size={23} strokeWidth={1.2} aria-hidden="true"/><span><strong>AI Photo Try-On</strong><small>Your portrait. A new possibility.</small></span><span className="try-mode-mark" aria-hidden="true"/>{!config.photoEnabled&&<small>Unavailable for this piece</small>}</button>
            <button disabled={!live} aria-pressed={mode==='live'} onClick={()=>setMode('live')} aria-controls="try-experience"><Camera size={23} strokeWidth={1.2} aria-hidden="true"/><span><strong>Live Camera Try-On</strong><small>See the details move with you.</small></span><span className="try-mode-mark" aria-hidden="true"/>{!live&&<small>Unavailable for this piece</small>}</button>
          </div>
          <div id="try-experience">{mode==='photo'&&config.photoEnabled&&<PhotoTryOn productId={product.id} config={config}/>} {mode==='live'&&live&&<LiveCamera asset={{...config.overlay!,kind:config.kind!,format:'image2d'}}/>}</div>
        </>}
        <div className="try-concierge"><div><p className="eyebrow">Love what you see?</p><h3>Let’s make it personal.</h3><p>Our showroom is here for the finer details.</p></div><div className="try-controls"><Link className="text-link" href={path+'#product-enquiry'}>Enquire about this piece <ArrowUpRight size={16}/></Link><WhatsAppLink number={whatsappNumber} message={`Hello Shree Ram Jewellers, I would like to enquire about ${product.name} (SKU: ${product.sku}).`}/></div></div>
        <p className="try-disclaimer">A different perspective, not a perfect replica. Virtual try-on is a visual approximation. Actual jewellery appearance, fit, dimensions, weight and colour may vary.</p>
      </div>
    </div>
    {optionsError?<p className="notice" role="alert">Other pieces could not be loaded. <button className="text-link" onClick={()=>setVersion(v=>v+1)}>Retry selection</button></p>:<JewelleryRail eligible={options} selected={product} mode={mode}/>}
    <footer className="try-studio-footer"><span>Considered details. Personal connections.</span><span>SHREE RAM JEWELLERS</span></footer>
  </div>;
}
