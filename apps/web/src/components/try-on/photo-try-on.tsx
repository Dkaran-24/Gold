'use client';
import { useEffect, useRef, useState } from 'react';
import { Upload, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { safeResultUrl, TryOnError, tryOnRequest } from '@/lib/try-on/client';
import type { TryOnConfig, TryOnJob } from '@/lib/try-on/types';
import { canStartPreview, recoverPreview, type PreviewRecovery } from '@/lib/try-on/recovery';

function remember(key: string, id: string | null) {
  try { if (id) sessionStorage.setItem(key, id); else sessionStorage.removeItem(key); }
  catch { /* Browser storage is optional. Ownership is checked by the server. */ }
}

export function PhotoTryOn({ productId, config }: { productId: string; config: TryOnConfig }) {
  const [file, setFile] = useState<File | null>(null);
  const [original, setOriginal] = useState('');
  const [consent, setConsent] = useState(false);
  const [job, setJob] = useState<TryOnJob | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<PreviewRecovery>({ state: 'checking' });
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const [revision, setRevision] = useState(0);
  const [dragging, setDragging] = useState(false);
  const key = 'showroom.tryon.job.' + productId;
  const requestKey = useRef('');
  const input = useRef<HTMLInputElement>(null);
  const operations = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setRecovery({ state: 'checking' });
    let id: string | null = null;
    try { id = sessionStorage.getItem(key); } catch {}
    if (id) {
      recoverPreview(id, savedId => tryOnRequest<TryOnJob>('jobs/' + encodeURIComponent(savedId), {signal:controller.signal})).then(result => {
        if (controller.signal.aborted) return;
        if (result.state === 'ready') remember(key, null);
        if (result.state === 'restored') setJob(result.job);
        setRecovery(result);
      });
    } else setRecovery({ state: 'ready' });
    return () => controller.abort();
  }, [key, recoveryAttempt]);
  useEffect(() => {
    if (!file) { setOriginal(''); return; }
    const url = URL.createObjectURL(file);
    setOriginal(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const jobId = job?.id;
  const pending = job?.status === 'QUEUED' || job?.status === 'PROCESSING';
  useEffect(() => {
    if (!pending || busy || !jobId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const latest = await tryOnRequest<TryOnJob>('jobs/' + encodeURIComponent(jobId), {signal:controller.signal});
        if (controller.signal.aborted) return;
        setJob(latest);
        if (['QUEUED','PROCESSING'].includes(latest.status)) timer = setTimeout(poll, 3000);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof TryOnError ? e.message : 'Could not check preview status.');
      }
    };
    timer = setTimeout(poll, 1800);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [jobId, pending, revision, busy]);

  function reset() {
    setJob(null); setFile(null); setConsent(false); setError('');
    setRecovery({ state: 'ready' });
    requestKey.current = '';
    if (input.current) input.current.value = '';
    remember(key, null);
  }
  async function run(action: () => Promise<void>) {
    if (operations.current) return;
    operations.current = true;
    setBusy(true); setError('');
    try { await action(); }
    catch (e) { setError(e instanceof TryOnError ? e.message : 'The response could not be verified. Check your connection and try again.'); }
    finally { operations.current = false; setBusy(false); }
  }
  async function submit() {
    if (!canStartPreview(recovery, job) || !consent || !file || !config.providerConfigured) return;
    requestKey.current ||= crypto.randomUUID();
    const params = new URLSearchParams({productId, consent:'true', consentVersion:config.consentVersion});
    const created = await tryOnRequest<TryOnJob>('photo?' + params, {method:'POST', body:file, headers:{
      'Content-Type':file.type, 'Idempotency-Key':requestKey.current,
    }});
    remember(key, created.id);
    setJob(created);
  }
  function chooseFile(selected?: File) {
    if (!canStartPreview(recovery, job) || busy || !consent || !config.providerConfigured) return;
    setError(''); setDragging(false);
    if (!selected) return;
    if (!selected.size || selected.size > config.maxUploadMb * 1048576 || !['image/png','image/jpeg','image/webp'].includes(selected.type)) {
      setError('Choose a JPEG, PNG or WebP within the displayed size limit.');
      if(input.current) input.current.value='';
      return;
    }
    setFile(selected); requestKey.current='';
  }
  async function download(share: boolean) {
    if (!job) return;
    const latest = await tryOnRequest<TryOnJob>('jobs/' + encodeURIComponent(job.id));
    const url = safeResultUrl(latest.resultUrl);
    if (!url) throw new Error('Preview unavailable');
    const response = await fetch(url, {cache:'no-store',credentials:'same-origin'});
    if (!response.ok) throw new Error('Preview expired');
    const blob = await response.blob();
    if (!['image/png','image/jpeg','image/webp'].includes(blob.type)) throw new Error('Invalid preview');
    const filename = 'jewellery-preview.' + (blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1]);
    const output = new File([blob], filename, {type:blob.type});
    if (share && navigator.canShare?.({files:[output]})) {
      try { await navigator.share({files:[output], title:'My jewellery preview'}); } catch (e) { if (!(e instanceof Error && e.name==='AbortError')) throw e; }
    } else {
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl; link.download = filename; link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
  }
  const result = job ? safeResultUrl(job.resultUrl) : null;
  const missingResult = job?.status === 'COMPLETED' && !result;
  return <section className="try-panel try-photo-panel" aria-label="AI photo fitting">
    <div className="try-panel-heading"><p className="eyebrow">{result?'Your personal styling portrait':'The portrait experience'}</p><h2>{result?'A little closer to your look.':'Imagine the possibilities.'}</h2><p>{result?'Your selected piece, seen in a new light.':'A favourite photograph is all it takes to explore a new detail.'}</p></div>
    {!config.providerConfigured && <div className="try-service-note" role="status"><strong>A little pause in the fitting room.</strong><p>Photo generation is temporarily unavailable. Explore the live experience, if available, or speak with our showroom.</p></div>}
    {recovery.state === 'checking' && <p role="status">Checking for a previous preview…</p>}
    {recovery.state === 'unresolved' && <div className="notice" role="alert"><p>We couldn’t check your previous preview. It may still be processing. Check its status before starting another preview.</p><button type="button" className="button button-outline" onClick={() => setRecoveryAttempt(value => value + 1)}>Check previous preview</button></div>}
    {canStartPreview(recovery, job) && <form onSubmit={e => {e.preventDefault(); void run(submit);}}>
      <fieldset disabled={busy || !config.providerConfigured}>
        <label className="try-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required/><span><strong>Your photograph, your permission.</strong>I have permission to use this photograph and consent to sending it to Google Gemini for this preview.</span></label>
        <div className={'try-dropzone'+(dragging?' is-dragging':'')+(file?' has-photo':'')} onDragOver={e=>{e.preventDefault();if(consent&&!busy&&config.providerConfigured)setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();chooseFile(e.dataTransfer.files[0]);}}>
          {original?<img src={original} alt="Your selected portrait" className="try-upload-preview"/>:<><span className="try-upload-icon"><Upload size={28} strokeWidth={1.1} aria-hidden="true"/></span><h3>A portrait, beautifully you.</h3><p>Drag your photograph here, or choose one from your device.</p><small>Face the camera in soft, even light.<br/>Keep your ears and neckline visible.</small></>}
          <input ref={input} className="try-visually-hidden" type="file" aria-label="Choose your portrait" accept="image/png,image/jpeg,image/webp" disabled={!consent} onChange={e=>chooseFile(e.target.files?.[0])}/>
          <div className="try-controls"><button type="button" className="button button-outline" disabled={!consent} onClick={()=>input.current?.click()}>{file?'Change photograph':'Upload from device'}</button>{file&&<button type="button" className="text-link" onClick={()=>{setFile(null);requestKey.current='';if(input.current)input.current.value='';}}>Remove photograph</button>}</div><small>JPEG, PNG or WebP · up to {config.maxUploadMb} MiB</small>
          {!consent&&<small>Give your permission above to choose a photograph.</small>}
        </div>
        <div className="try-generate-row"><span>One piece. Your own perspective.</span><button className="button" disabled={!consent || !file}>{busy ? 'Submitting your portrait…' : 'Generate my preview'}<ArrowUpRight size={16} aria-hidden="true"/></button></div>
      </fieldset>
    </form>}
    {job && <div className={'try-job'+(pending?' is-processing':'')} role="status" aria-live="polite">
      {pending&&<span className="try-progress-ring" aria-hidden="true"/>}
      <strong>{{QUEUED:'Your preview is queued.',PROCESSING:'Creating your preview…',COMPLETED:'Your preview is ready.',FAILED:'This preview could not be generated.'}[job.status]}</strong>
      <p className="small">Private preview expires {new Date(job.expiresAt).toLocaleString()}.</p>
    </div>}
    {((job && original) || result) && <div className="try-comparison">
      {original && <figure><figcaption>Your original</figcaption><img src={original} alt="Your original portrait"/></figure>}
      {result && <figure><figcaption>AI preview</figcaption><img src={result} alt="Generated jewellery preview" referrerPolicy="no-referrer" onError={() => setError('The private image link may have expired. Refresh the preview link.')}/></figure>}
    </div>}
    {error && <p className="notice" role="alert">{error}</p>}
    {missingResult && <p className="notice" role="status">The preview link is unavailable. Refresh the link to view your result.</p>}
    {job && <div className="try-controls">
      {pending && error && <button className="button" onClick={() => {setError('');setRevision(r=>r+1);}}>Check status</button>}
      {job.canRetry && <button className="button" disabled={busy || !config.providerConfigured} onClick={() => run(async () => setJob(await tryOnRequest<TryOnJob>('jobs/'+job.id+'/retry',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})))}>Retry generation</button>}
      {result && <><button className="button" disabled={busy} onClick={() => run(() => download(false))}>Download preview</button>
        {typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && <button className="button button-outline" disabled={busy} onClick={() => run(() => download(true))}>Share or download</button>}
      </>}
      {(missingResult || (result && error)) && <button className="text-link" disabled={busy} onClick={() => run(async () => setJob(await tryOnRequest<TryOnJob>('jobs/'+job.id)))}>Refresh preview link</button>}
      <button className="text-link" disabled={busy} onClick={() => run(async () => {
        try { await tryOnRequest('jobs/'+job.id,{method:'DELETE'}); }
        catch (e) { if (!(e instanceof TryOnError && [404,410].includes(e.status))) throw e; }
        reset();
      })}>Delete preview &amp; restart</button>
    </div>}
    <p className="try-private-note"><ShieldCheck size={17} aria-hidden="true"/><span>Your portrait and the selected jewellery reference are sent to Google Gemini only when you generate a preview. Showroom copies expire within {config.retentionHours} hours; you can delete your preview earlier.</span></p>
  </section>;
}

