'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { adminApi, allRecords } from '@/lib/admin/api';
import { Heading, LoadState, Panel, useAction, useLoad } from './ui';
import { TryOnOverlayUpload } from './try-on-overlay';

interface CatalogueItem { id: string; name: string; sku?: string }
interface Settings {
  photoEnabled: boolean;
  arEnabled: boolean;
  eligibleCategoryIds: string[];
  dailyLimit: number;
  maxUploadMb: number;
  retentionHours: number;
  providerConfigured: boolean;
  model: string;
}
interface Analytics { total: number; succeeded: number; failed: number; queued: number; processing: number }
interface ProductSetup {
  enabled: boolean;
  kind: 'EARRINGS' | 'NECKLACE' | null;
  overlayImageId: string | null;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
}

function NumericField({ name, title, value, min, max, step = 1 }: {
  name: string; title: string; value: number; min: number; max: number; step?: number;
}) {
  return <label className="a-field">
    <span>{title}</span>
    <input type="number" name={name} required defaultValue={value} min={min} max={max} step={step}/>
  </label>;
}

function ModeSettings({ initial, categories, onSaved }: {initial: Settings; categories: CatalogueItem[]; onSaved:()=>void}) {
  const action = useAction();
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const update = {
      photoEnabled: form.has('photoEnabled'),
      arEnabled: form.has('arEnabled'),
      eligibleCategoryIds: form.getAll('category').map(String),
      dailyLimit: Number(form.get('dailyLimit')),
      retentionHours: Number(form.get('retentionHours')),
      maxUploadMb: Number(form.get('maxUploadMb')),
    };
    void action.run(() => adminApi('admin/try-on/settings', 'PATCH', update), 'Try-on settings saved.').then(saved=>{if(saved)onSaved();});
  }

  return <Panel title="Shape the fitting experience">
    <p className="a-eyebrow">01 / Experiences & privacy</p>
    <p className="a-muted">A considered introduction to your collection. Choose the experiences your customers can explore.</p>
    <div className={'a-notice ' + (initial.providerConfigured ? '' : 'a-error')}>
      {initial.providerConfigured
        ? 'Photo provider configuration is present. Model access is checked before generation.'
        : 'Photo previews are unavailable. Ask your administrator to configure the image provider.'}
      {initial.model && <small> Model: {initial.model}</small>}
    </div>
    <form onSubmit={save}><fieldset disabled={action.busy}>
      <div className="a-form-grid">
        <label className="a-field a-check"><span>Allow photo try-on</span><input type="checkbox" name="photoEnabled" defaultChecked={initial.photoEnabled}/></label>
        <label className="a-field a-check"><span>Allow live camera try-on</span><input type="checkbox" name="arEnabled" defaultChecked={initial.arEnabled}/></label>
        <NumericField name="dailyLimit" title="Photo attempts per day" value={initial.dailyLimit} min={1} max={10000}/>
        <NumericField name="maxUploadMb" title="Maximum upload (MiB)" value={initial.maxUploadMb} min={1} max={20}/>
        <NumericField name="retentionHours" title="Private preview retention (hours)" value={initial.retentionHours} min={1} max={72}/>
      </div>
      <div className="tryon-section-label"><h3>Curate your categories</h3><p>Only selected categories and individually enabled pieces appear in the fitting room.</p></div>
      {categories.length === 0 && <p className="a-muted">Create a jewellery category to make pieces eligible.</p>}
      <div className="a-form-grid">{categories.map(category =>
        <label key={category.id} className="a-field a-check">
          <span>{category.name}</span>
          <input name="category" type="checkbox" value={category.id} defaultChecked={initial.eligibleCategoryIds.includes(category.id)}/>
        </label>
      )}</div>
      <button type="submit" className="a-btn a-primary">Save settings</button>
    </fieldset>{action.feedback}</form>
  </Panel>;
}

function ProductSetupForm({ productId, setup, onSaved }: {productId: string; setup: ProductSetup; onSaved:()=>void}) {
  const action = useAction();
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const update = {
      enabled: form.has('enabled'), kind: form.get('kind'),
      scale: Number(form.get('scale')), rotation: Number(form.get('rotation')),
      offsetX: Number(form.get('offsetX')), offsetY: Number(form.get('offsetY')),
    };
    void action.run(() => adminApi('admin/products/' + productId + '/try-on', 'PATCH', update), 'Piece settings saved.').then(saved=>{if(saved)onSaved();});
  }
  return <form onSubmit={save}><fieldset disabled={action.busy}>
    <label className="a-field a-check"><span>Enable this piece for try-on</span><input type="checkbox" name="enabled" defaultChecked={setup.enabled}/></label>
    <div className="a-form-grid">
      <label className="a-field"><span>Jewellery type</span>
        <select required name="kind" defaultValue={setup.kind ?? ''}>
          <option value="" disabled>Select jewellery type</option>
          <option value="EARRINGS">Earrings</option><option value="NECKLACE">Necklace</option>
        </select>
      </label>
    </div>
    <p className="a-muted">Gallery images and the legacy overlay reference are preserved. Customer fittings use only a separately uploaded, validated transparent PNG.</p>
    <div className="tryon-section-label"><h3>Refine the placement</h3><p>Fine adjustments for a natural visual fit. These settings do not represent physical dimensions.</p></div>
    <div className="a-form-grid">
      <NumericField name="scale" title="Relative size" value={setup.scale} min={0.1} max={3} step={0.01}/>
      <NumericField name="rotation" title="Rotation (degrees)" value={setup.rotation} min={-180} max={180} step={0.1}/>
      <NumericField name="offsetX" title="Horizontal adjustment" value={setup.offsetX} min={-1} max={1} step={0.01}/>
      <NumericField name="offsetY" title="Vertical adjustment" value={setup.offsetY} min={-1} max={1} step={0.01}/>
    </div>
    <button className="a-btn a-primary" type="submit">Save piece settings</button>
  </fieldset>{action.feedback}</form>;
}

function PieceEditor({productId,onSaved}: {productId: string;onSaved:()=>void}) {
  const resource = useLoad(async signal => {
    const base = 'admin/products/' + encodeURIComponent(productId);
    const setup=await adminApi<ProductSetup>(base + '/try-on', 'GET', undefined, signal);
    return {setup:setup.data};
  }, [productId]);
  const saved=()=>{resource.reload();onSaved();};
  return <><LoadState {...resource} retry={resource.reload}/>{resource.data && <>
    <ProductSetupForm productId={productId} {...resource.data} onSaved={saved}/>
    <TryOnOverlayUpload productId={productId} kind={resource.data.setup.kind} onSaved={onSaved}/>
  </>}</>;
}

function ExperienceOverview({revision}:{revision:number}) {
  const state=useLoad(async signal=>{
    const [settings,eligible]=await Promise.all([adminApi<Settings>('admin/try-on/settings','GET',undefined,signal),adminApi<CatalogueItem[]>('try-on/products','GET',undefined,signal)]);
    return {settings:settings.data,count:eligible.data.length};
  },[revision]);
  return <><LoadState {...state} retry={state.reload}/>{state.data&&<dl className="tryon-overview">
    <div><dt>Photo experience</dt><dd>{state.data.settings.photoEnabled?'Enabled':'Paused'}</dd><small>{state.data.settings.providerConfigured?'Provider configured':'Provider setup needed'}</small></div>
    <div><dt>Live camera</dt><dd>{state.data.settings.arEnabled?'Enabled':'Paused'}</dd><small>Private, on-device fitting</small></div>
    <div><dt>Eligible pieces</dt><dd>{state.data.count}</dd><small>Published pieces with an enabled fitting option</small></div>
    <div><dt>Private retention</dt><dd>{state.data.settings.retentionHours}<span> hours</span></dd><small>Showroom preview lifetime</small></div>
  </dl>}</>;
}

export function TryOnManagement() {
  const [productId, setProductId] = useState('');
  const [revision,setRevision]=useState(0);
  const saved=()=>setRevision(v=>v+1);
  const resource = useLoad(async signal => {
    const [settings, categories, products] = await Promise.all([
      adminApi<Settings>('admin/try-on/settings', 'GET', undefined, signal),
      allRecords<CatalogueItem>('admin/categories', signal),
      allRecords<CatalogueItem>('admin/products', signal),
    ]);
    return {settings: settings.data, categories, products};
  }, []);
  const usage = useLoad(signal => adminApi<Analytics>('admin/try-on/analytics', 'GET', undefined, signal), []);
  return <div className="tryon-owner">
    <Heading title="The virtual fitting room" description="Thoughtfully curated by you. Personally experienced by your customers."><Link href="/products" className="a-btn">View the collection ↗</Link></Heading>
    <ExperienceOverview revision={revision}/>
    <Panel title="A closer look at your studio">
      <div className="tryon-activity-intro"><p>Photo preview activity · all recorded attempts</p><span>Private by design. Customer portraits are never shown here.</span></div>
      <LoadState {...usage} retry={usage.reload}/>
      {usage.data && <><dl className="tryon-stats">
        {([['total','Total attempts'],['succeeded','Succeeded'],['failed','Failed'],['queued','Queued'],['processing','Processing']] as const).map(([key,title]) =>
          <div key={key}><dt>{title}</dt><dd>{usage.data!.data[key]}</dd></div>
        )}
      </dl><div className="tryon-activity-footer"><p>{usage.data.data.total===0?'Your story starts with the first preview. No attempts have been recorded yet.':`${usage.data.data.succeeded} completed · ${usage.data.data.failed} failed · ${usage.data.data.queued+usage.data.data.processing} awaiting completion.`}</p><button className="a-btn" onClick={usage.reload}>Refresh activity</button></div></>}
    </Panel>
    <LoadState {...resource} retry={resource.reload}/>
    {resource.data && <>
      <div className="tryon-owner-grid"><ModeSettings initial={resource.data.settings} categories={resource.data.categories} onSaved={saved}/>
      <Panel title="Prepare a piece for its close-up">
        <p className="a-eyebrow">02 / Jewellery & placement</p><p className="a-muted">Choose a piece, select its camera cutout and refine the details.</p>
        <label className="a-field"><span>Catalogue piece</span>
          <select value={productId} onChange={event => setProductId(event.target.value)}>
            <option value="">Select a piece</option>
            {resource.data.products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
          </select>
        </label>
        {productId ? <PieceEditor key={productId} productId={productId} onSaved={saved}/>:<div className="tryon-owner-empty"><span>Made to be seen.</span><p>Select a catalogue piece above to manage its eligibility and camera overlay.</p><Link href="/admin/products" className="a-link">Explore your catalogue ↗</Link></div>}
      </Panel></div>
    </>}
  </div>;
}
