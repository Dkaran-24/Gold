'use client';
import Link from 'next/link';
import {useConfirmation} from './confirmation';
import { useCallback, useEffect, useState } from 'react';
import { adminApi, type Page } from '@/lib/admin/api';
import { dateLabel, label, type Row } from '@/lib/admin/model';
export function useLoad<T>(load: (signal: AbortSignal) => Promise<T>, dependencies: unknown[]) {
  const [data,setData]=useState<T>(); const [error,setError]=useState(''); const [loading,setLoading]=useState(true); const [version,setVersion]=useState(0);
  useEffect(()=>{ const control=new AbortController(); setLoading(true); setError(''); setData(undefined); load(control.signal).then(v=>{ if(!control.signal.aborted)setData(v); }).catch(e=>{if(!control.signal.aborted)setError(e.message);}).finally(()=>{if(!control.signal.aborted)setLoading(false);}); return ()=>control.abort(); }, [...dependencies,version]); // Callers list their complete resource keys.
  return {data,error,loading,reload:useCallback(()=>setVersion(v=>v+1),[])};
}
export function useAction() {
  const confirm=useConfirmation();
  const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [success,setSuccess]=useState('');
  async function run(action:()=>Promise<unknown>, message='Changes saved.', confirmation?:string) { if(busy)return false;if(confirmation&&!await confirm(confirmation))return false; setBusy(true);setError('');setSuccess(''); try{await action();setSuccess(message);window.dispatchEvent(new CustomEvent('owner-saved',{detail:message}));return true;}catch(e){setError(e instanceof Error?e.message:'Unable to save.');return false;}finally{setBusy(false);} }
  return {busy,run,feedback:<Feedback error={error} success={success}/>};
}
export function Feedback({error,success}:{error?:string;success?:string}) {return <>{error&&<div className="a-notice a-error" role="alert">{error}</div>}{success&&<div className="a-notice a-success" role="status">{success}</div>}</>;}
export function LoadState({loading,error,retry}:{loading:boolean;error:string;retry:()=>void}) {return loading?<div className="a-empty" role="status">Loading showroom records…</div>:error?<div className="a-empty"><Feedback error={error}/><button className="a-btn" onClick={retry}>Retry</button></div>:null;}
export function Heading({title,description,children}:{title:string;description?:string;children?:React.ReactNode}) {return <div className="a-heading"><div><p className="a-eyebrow">OWNER WORKSPACE</p><h1>{title}</h1>{description&&<p>{description}</p>}</div><div className="a-actions">{children}</div></div>;}
export function Badge({value}:{value?:string|null}) {return <span className={`a-badge a-${(value||'').toLowerCase()}`}>{label(value)}</span>;}
export function Panel({title,children}:{title?:string;children:React.ReactNode}) {return <section className="a-panel">{title&&<h2>{title}</h2>}{children}</section>;}
export function Pager({page,onChange}:{page?:Page;onChange:(n:number)=>void}) {return page?<div className="a-pager"><span>{page.total} records · Page {page.page} of {Math.max(1,page.pages)}</span><div className="a-actions"><button className="a-btn" disabled={page.page<=1} onClick={()=>onChange(page.page-1)}>Previous</button><button className="a-btn" disabled={page.page>=page.pages} onClick={()=>onChange(page.page+1)}>Next</button></div></div>:null;}
export function Select({label:caption,value,onChange,options,empty='All'}:{label:string;value:string;onChange:(v:string)=>void;options:(string|{value:string;label:string})[];empty?:string}) {return <label className="a-field"><span>{caption}</span><select value={value} onChange={e=>onChange(e.target.value)}><option value="">{empty}</option>{options.map(o=>{const v=typeof o==='string'?o:o.value;return <option key={v} value={v}>{typeof o==='string'?label(o):o.label}</option>;})}</select></label>;}
export function Table({rows,columns,empty='No records yet.'}:{rows:Row[];columns:{title:string;render:(r:Row)=>React.ReactNode}[];empty?:string}) {return rows.length?<div className="a-table-wrap" tabIndex={0} role="region" aria-label="Scrollable records"><table className="a-table"><thead><tr>{columns.map(c=><th key={c.title} scope="col">{c.title}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id||r.key}>{columns.map(c=><td key={c.title}>{c.render(r)}</td>)}</tr>)}</tbody></table></div>:<div className="a-empty">{empty}</div>;}
export function RecordLink({href,children}:{href:string;children:React.ReactNode}) {return <Link className="a-link" href={href} prefetch={false}>{children}</Link>;}
export function History({path,title='History'}:{path:string;title?:string}) {const [page,setPage]=useState(1);const r=useLoad(s=>adminApi<Row[]>(`${path}?page=${page}&limit=10`,'GET',undefined,s),[path,page]);return <Panel title={title}><LoadState {...r} retry={r.reload}/>{r.data&&<><Table rows={r.data.data} columns={[{title:'When',render:v=>dateLabel(v.createdAt)},{title:'Activity',render:v=>v.body||[v.action?label(v.action):'',v.previous?`${label(v.previous)} → ${label(v.next)}`:v.next?label(v.next):'',v.reason].filter(Boolean).join(' · ')}]}/><Pager page={r.data.pagination} onChange={setPage}/></>}</Panel>;}
