'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {adminApi} from '@/lib/admin/api';

export interface DedicatedOverlay {
  productId:string;kind:'NECKLACE'|'EARRINGS';publicId:string;url:string;
  width:number;height:number;bytes:number;validatedAt:string;
}
export function TryOnOverlayUpload({productId,kind,onSaved,request=adminApi}:{
  productId:string;kind:'NECKLACE'|'EARRINGS'|null;onSaved:()=>void;request?:typeof adminApi;
}) {
  const [current,setCurrent]=useState<DedicatedOverlay|null>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState('');
  const [confirmed,setConfirmed]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [available,setAvailable]=useState(false);
  const [revision,setRevision]=useState(0);
  const [removeConfirm,setRemoveConfirm]=useState(false);
  const path='admin/products/'+encodeURIComponent(productId)+'/try-on/overlay';
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setAvailable(false);setError('');
    request<DedicatedOverlay|null>(path,'GET',undefined,controller.signal).then(r=>{
      if(!controller.signal.aborted){setCurrent(r.data);setAvailable(true);}
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[path,revision,request]);
  useEffect(()=>{
    if(!file){setPreview('');if(fileInput.current)fileInput.current.value='';return;}
    const url=URL.createObjectURL(file);setPreview(url);
    return()=>URL.revokeObjectURL(url);
  },[file]);
  async function upload(event:FormEvent) {
    event.preventDefault();if(!file || !kind || !confirmed || busy || !available)return;
    setBusy(true);setError('');setNotice('');
    try {
      const query=new URLSearchParams({kind,expectedPublicId:current?.publicId??'',representsActualProduct:'true'});
      const result=await request<DedicatedOverlay>(path+'?'+query,'POST',file);
      setCurrent(result.data);setFile(null);setConfirmed(false);setNotice('Transparent overlay saved separately. The product gallery is unchanged.');onSaved();
    }catch(e){setError(e instanceof Error?e.message:'Upload could not be verified. Refresh before retrying.');setAvailable(false);}
    finally{setBusy(false);}
  }
  async function remove() {
    if(!current || !removeConfirm || busy)return;
    setBusy(true);setError('');
    try {
      await request(path,'DELETE',{confirm:true,expectedPublicId:current.publicId});
      setCurrent(null);setFile(null);setConfirmed(false);setRemoveConfirm(false);setNotice('Overlay removed. Remote cleanup is queued; gallery photographs are unchanged.');onSaved();
    }catch(e){setError(e instanceof Error?e.message:'Removal could not be verified.');setAvailable(false);}
    finally{setBusy(false);}
  }
  const image=preview||current?.url;
  return <section aria-label="Separate virtual try-on overlay" className="a-panel">
    <h3>Transparent try-on overlay</h3>
    <p className="a-muted">Upload a separate PNG cutout of this exact jewellery piece. It will not appear in the public photo gallery. A bust photograph or an AI-generated replacement is unsuitable.</p>
    {loading&&<p role="status">Checking overlay storage…</p>}
    {error&&<div className="a-notice a-error" role="alert">{error} <button type="button" className="a-btn" disabled={busy} onClick={()=>setRevision(v=>v+1)}>Refresh overlay</button></div>}
    {notice&&<p className="a-notice a-success" role="status">{notice}</p>}
    <div style={{backgroundColor:'#fff',backgroundImage:'conic-gradient(#ddd 25%,transparent 0 50%,#ddd 0 75%,transparent 0)',backgroundSize:'20px 20px',border:'1px solid #ccc',minHeight:180,display:'grid',placeItems:'center',margin:'16px 0'}}>
      {image?<img src={image} alt={preview?'Selected PNG preview — not yet saved':'Saved transparent jewellery overlay'} style={{maxWidth:'100%',height:220,objectFit:'contain'}}/>:<p style={{background:'#fff',padding:12}}>No separate overlay uploaded</p>}
    </div>
    {current&&<p className="a-muted">Saved for {current.kind.toLowerCase()} · {current.width} × {current.height}px · {Math.round(current.bytes/1024)} KB</p>}
    {current&&current.kind!==kind&&<p className="a-notice a-error">This overlay belongs to a different jewellery type and will not be shown to customers. Save the correct type and upload the matching cutout.</p>}
    <form onSubmit={upload}><fieldset disabled={busy||loading||!available}>
      <label className="a-field"><span>{current?'Replace transparent PNG':'Choose transparent PNG'} · maximum 5 MB</span><input ref={fileInput} type="file" accept="image/png" onChange={event=>{
        const next=event.target.files?.[0];setConfirmed(false);setNotice('');setError('');
        if(!next){setFile(null);return;}
        if(next.type!=='image/png'||next.size>5*1024*1024){setFile(null);setError('Choose a PNG smaller than 5 MB.');return;}
        setFile(next);
      }}/></label>
      <p className="a-muted">Save the jewellery type in the piece settings first. Upload type: {kind?.toLowerCase()??'not configured'}. The server verifies transparency; previewing a file does not validate it.</p>
      <label className="a-field a-check"><span>I confirm this cutout accurately represents this actual product, with the bust and background removed.</span><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/></label>
      <button className="a-btn a-primary" type="submit" disabled={!file||!confirmed||!kind}>{busy?'Saving…':current?'Replace overlay':'Upload overlay'}</button>
    </fieldset></form>
    {current&&<div style={{marginTop:16}}>{removeConfirm?<><p>Remove only this try-on overlay? Public catalogue photographs will stay unchanged.</p><button className="a-btn" disabled={busy||!available} onClick={remove}>Confirm overlay removal</button><button className="a-btn" disabled={busy} onClick={()=>setRemoveConfirm(false)}>Cancel</button></>:<button className="a-btn" disabled={busy||!available} onClick={()=>setRemoveConfirm(true)}>Remove overlay</button>}</div>}
  </section>;
}
