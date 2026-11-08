'use client';
import { useState, useRef, useMemo } from 'react';
import { adminApi, cmsImageSources, AdminError } from '@/lib/admin/api';
import { formPayload, type Field } from '@/lib/admin/fields';
import { localDateInput, type Row } from '@/lib/admin/model';
import { Feedback, LoadState, Select, useLoad } from './ui';

export function CategoryImageUpload({ field, value, initialPublicId = '', categoryId = 'new', maxBytes = 5242880 }: { field: Field; value: unknown; initialPublicId?: string; categoryId?: string; maxBytes?: number }) {
  const [url, setUrl] = useState(String(value || ''));
  const [publicId, setPublicId] = useState(String(initialPublicId || ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > maxBytes) {
      setError(`Image size must be under ${Math.round(maxBytes / (1024 * 1024))} MiB.`);
      return;
    }

    setBusy(true);
    setProgress('Uploading to Cloudinary…');
    try {
      const endpoint = categoryId && categoryId !== 'new'
        ? `admin/categories/${categoryId}/image`
        : 'admin/categories/image';
      const res = await adminApi<{ url: string; publicId: string }>(endpoint, 'POST', file);
      setUrl(res.data.url);
      setPublicId(res.data.publicId);
      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed.');
      setProgress('');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setError('');
    const prevPublicId = publicId;
    setUrl('');
    setPublicId('');

    if (categoryId && categoryId !== 'new') {
      setBusy(true);
      try {
        await adminApi(`admin/categories/${categoryId}/image`, 'DELETE');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove image.');
      } finally {
        setBusy(false);
      }
    } else if (prevPublicId) {
      try {
        await adminApi('admin/categories/image/destroy', 'POST', { publicId: prevPublicId });
      } catch {
        // Safe to ignore draft cleanup error
      }
    }
  }

  return (
    <div className="a-field a-wide" style={{ marginTop: '6px', marginBottom: '18px' }}>
      <span>{field.label}</span>
      <input type="hidden" name={field.name} value={url} />
      <input type="hidden" name="imagePublicId" value={publicId} />
      <div style={{ border: '1px solid var(--a-line)', borderRadius: '8px', padding: '18px', background: '#fffdf9' }}>
        {url ? (
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '150px', height: '150px', borderRadius: '6px', overflow: 'hidden', background: '#faf8f4', border: '1px solid var(--a-line)', flexShrink: 0 }}>
              <img src={url} alt="Category preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="a-badge a-published" style={{ fontSize: '11px', padding: '3px 8px' }}>✓ Cloudinary active</span>
                <span className="a-muted" style={{ fontSize: '11px' }}>Secure HTTPS CDN URL</span>
              </div>
              <p className="a-muted" style={{ fontSize: '11px', margin: 0 }}>
                This image will represent this category across showroom navigation and collection grids.
              </p>
              <div className="a-actions" style={{ marginTop: '8px' }}>
                <button type="button" className="a-btn" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                  {busy ? 'Processing…' : 'Replace image'}
                </button>
                <button type="button" className="a-btn a-danger" disabled={busy} onClick={handleRemove}>
                  Remove image
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 16px' }}>
            <p className="a-muted" style={{ marginBottom: '14px', fontSize: '13px' }}>
              No image uploaded yet. Add an elegant photograph to feature this category on the website.
            </p>
            <button type="button" className="a-btn a-primary" disabled={busy} onClick={() => fileInputRef.current?.click()}>
              {busy ? 'Processing…' : '+ Upload category image'}
            </button>
            <p className="a-muted" style={{ fontSize: '11px', marginTop: '12px', marginBottom: 0 }}>
              JPEG, PNG or WebP · Up to 5 MiB · Processed securely via Cloudinary
            </p>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFile} />
        {progress && <p role="status" className="a-muted" style={{ marginTop: '10px', fontSize: '12px', fontWeight: 600 }}>{progress}</p>}
        {error && <div className="a-notice a-error" style={{ marginTop: '12px' }}>{error}</div>}
      </div>
    </div>
  );
}

export function PricingModeSection({
  initialEnquiryOnly = true,
  initialPrice,
  initialMakingCharge,
  errors = {},
}: {
  initialEnquiryOnly?: boolean;
  initialPrice?: unknown;
  initialMakingCharge?: unknown;
  errors?: Record<string, string[]>;
}) {
  const [mode, setMode] = useState<'fixed' | 'enquiry'>(initialEnquiryOnly ? 'enquiry' : 'fixed');
  const [price, setPrice] = useState(initialPrice != null && String(initialPrice) !== '' ? String(initialPrice) : '');
  const [makingCharge, setMakingCharge] = useState(initialMakingCharge != null && String(initialMakingCharge) !== '' ? String(initialMakingCharge) : '');

  const formattedPreview = useMemo(() => {
    if (mode === 'enquiry') {
      return 'Price on enquiry';
    }
    const num = Number(price);
    if (!price || isNaN(num) || num <= 0) {
      return 'Please enter a valid price';
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: num % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(num);
  }, [mode, price]);

  return (
    <div className="a-pricing-mode-card" style={{ gridColumn: '1 / -1', background: '#faf8f5', border: '1px solid #dcd1c2', borderRadius: '10px', padding: '20px', marginTop: '8px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <span style={{ fontWeight: 600, color: '#382e25', fontSize: '14px' }}>Product Pricing & Commercial Mode *</span>
          <p className="a-muted" style={{ margin: '3px 0 0', fontSize: '12px' }}>
            Choose whether to present a transparent showroom selling price or require concierge consultation.
          </p>
        </div>
        <div style={{ background: mode === 'fixed' && Number(price) > 0 ? '#f0ede4' : '#f5efe6', border: '1px solid #c5a059', borderRadius: '20px', padding: '4px 14px', fontSize: '12px', fontWeight: 600, color: '#4a3b2c' }}>
          Customers see: <span style={{ color: mode === 'fixed' && Number(price) > 0 ? '#27522d' : '#8a6e49' }}>{formattedPreview}</span>
        </div>
      </div>

      <input type="hidden" name="enquiryOnly" value={mode === 'enquiry' ? 'true' : 'false'} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginBottom: '16px' }}>
        {/* Option A: Fixed Price */}
        <label
          style={{
            display: 'block',
            border: `2px solid ${mode === 'fixed' ? '#c5a059' : '#e6dfd5'}`,
            background: mode === 'fixed' ? '#fff' : '#faf8f5',
            borderRadius: '8px',
            padding: '14px',
            cursor: 'pointer',
            boxShadow: mode === 'fixed' ? '0 2px 8px rgba(197, 160, 89, 0.15)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="radio"
              name="pricingModeRadio"
              value="fixed"
              checked={mode === 'fixed'}
              onChange={() => setMode('fixed')}
              style={{ accentColor: '#c5a059', width: '16px', height: '16px', margin: 0 }}
            />
            <div>
              <strong style={{ display: 'block', fontSize: '13px', color: '#382e25' }}>Option A — Fixed Price (INR)</strong>
              <small style={{ color: '#7a6a58', fontSize: '11.5px', lineHeight: 1.4 }}>
                Showroom selling price displayed prominently on catalogue cards and detail pages.
              </small>
            </div>
          </div>
        </label>

        {/* Option B: Price on Enquiry */}
        <label
          style={{
            display: 'block',
            border: `2px solid ${mode === 'enquiry' ? '#c5a059' : '#e6dfd5'}`,
            background: mode === 'enquiry' ? '#fff' : '#faf8f5',
            borderRadius: '8px',
            padding: '14px',
            cursor: 'pointer',
            boxShadow: mode === 'enquiry' ? '0 2px 8px rgba(197, 160, 89, 0.15)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="radio"
              name="pricingModeRadio"
              value="enquiry"
              checked={mode === 'enquiry'}
              onChange={() => setMode('enquiry')}
              style={{ accentColor: '#c5a059', width: '16px', height: '16px', margin: 0 }}
            />
            <div>
              <strong style={{ display: 'block', fontSize: '13px', color: '#382e25' }}>Option B — Price on Enquiry</strong>
              <small style={{ color: '#7a6a58', fontSize: '11.5px', lineHeight: 1.4 }}>
                Displays “Price on enquiry” with an atelier consultation & WhatsApp button.
              </small>
            </div>
          </div>
        </label>
      </div>

      {mode === 'fixed' ? (
        <div style={{ background: '#fff', border: '1px solid #e6dfd5', borderRadius: '8px', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <label className="a-field" style={{ margin: 0 }}>
            <span>Public Selling Price (₹) *</span>
            <input
              name="publicPrice"
              type="number"
              min="1"
              max="999999999999.99"
              step="0.01"
              required
              placeholder="e.g. 85000"
              value={price}
              onChange={e => setPrice(e.target.value)}
              aria-invalid={!!errors['publicPrice']}
            />
            <small>Selling price in INR shown to online customers.</small>
            {errors['publicPrice'] && <small className="a-field-error">{errors['publicPrice']?.join(' ')}</small>}
          </label>

          <label className="a-field" style={{ margin: 0 }}>
            <span>Making Charge Included / Separate (₹)</span>
            <input
              name="publicMakingCharge"
              type="number"
              min="0"
              max="999999999999.99"
              step="0.01"
              placeholder="Optional, e.g. 12000"
              value={makingCharge}
              onChange={e => setMakingCharge(e.target.value)}
              aria-invalid={!!errors['publicMakingCharge']}
            />
            <small>Optional making charge breakdown for transparency.</small>
            {errors['publicMakingCharge'] && <small className="a-field-error">{errors['publicMakingCharge']?.join(' ')}</small>}
          </label>
        </div>
      ) : (
        <div style={{ background: '#f8f5ee', border: '1px solid #e2dac9', borderRadius: '8px', padding: '14px 16px', fontSize: '12.5px', color: '#5f4e3c' }}>
          <p style={{ margin: '0 0 6px', fontWeight: 600 }}>✦ High-Value Bespoke & Bridal Mode Active</p>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            No price will be displayed. Previous prices are safely cleared so they never leak to customers. Visitors will see <strong>“Price on enquiry”</strong> and can contact your showroom concierge directly.
          </p>
        </div>
      )}
    </div>
  );
}

export function ImagePicker({ field, value }: { field: Field; value: unknown }) {
  const [selected, setSelected] = useState(String(value || ''));
  const [product, setProduct] = useState('');
  const products = useLoad(cmsImageSources, []);
  const images = useLoad(s => product ? adminApi<Row[]>(`admin/products/${product}/images`, 'GET', undefined, s) : Promise.resolve({ data: [] as Row[] }), [product]);
  return <div className="a-field a-image-picker">
    <span>{field.label}</span><input type="hidden" name={field.name} value={selected} />
    <p className="a-muted">Choose an image from a published product in a visible category.</p>
    <LoadState {...products} retry={products.reload} />
    {products.data && (products.data.length
      ? <Select label={`${field.label}: source product`} value={product} onChange={setProduct} options={products.data.map(p => ({ value: p.id, label: `${p.name} · ${p.sku}` }))} empty="Choose a product" />
      : <p role="status" className="a-muted">No published products with images are available in visible categories.</p>)}
    <LoadState {...images} retry={images.reload} />
    {images.data && <div className="a-image-options">{images.data.data.map(i => <button type="button" key={i.id} className={selected === i.id ? 'selected' : ''} aria-label={`${field.label}: ${i.alt || 'image'} ${Number(i.position) + 1}`} aria-pressed={selected === i.id} onClick={() => setSelected(i.id)}><img src={i.url} alt={i.alt || 'Product image'} /></button>)}</div>}
    {product && images.data?.data.length === 0 && <p role="status" className="a-muted">This product currently has no images to select.</p>}
    <span className="a-muted">{selected ? 'An image is selected.' : 'No image selected.'}</span>
    {selected && <button className="a-btn" type="button" onClick={() => setSelected('')}>Clear {field.label.toLowerCase()}</button>}
  </div>;
}
export function Editor({ fields, initial = {}, onSave, submit = 'Save changes' }: { fields: Field[]; initial?: Record<string, unknown>; onSave: (value: Record<string, unknown>) => Promise<unknown>; submit?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  return <form className="a-editor" onSubmit={async e => {
    e.preventDefault(); if (busy) return;
    setError(''); setSuccess(''); setErrors({}); setBusy(true);
    try { const input = formPayload(fields, new FormData(e.currentTarget)); await onSave(input); setSuccess('Changes saved.'); window.dispatchEvent(new CustomEvent('owner-saved', { detail: 'Changes saved.' })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save.'); if (e instanceof AdminError) setErrors(e.fields || {}); }
    finally { setBusy(false); }
  }}>
    <fieldset disabled={busy}><div className="a-form-grid">{fields.map(f => {
      if (f.name === 'publicPrice' || f.name === 'publicMakingCharge') return null;
      if (f.name === 'enquiryOnly') {
        return (
          <PricingModeSection
            key="pricing-mode"
            initialEnquiryOnly={initial.enquiryOnly !== false}
            initialPrice={initial.publicPrice}
            initialMakingCharge={initial.publicMakingCharge}
            errors={errors}
          />
        );
      }
      const value = initial[f.name] ?? f.initial ?? '';
      if (f.type === 'image') return <ImagePicker key={f.name} field={f} value={value} />;
      if (f.type === 'category-image') return <CategoryImageUpload key={f.name} field={f} value={value} initialPublicId={String(initial.imagePublicId || '')} categoryId={String(initial.id || 'new')} />;
      return <label key={f.name} className={`a-field ${f.type === 'textarea' ? 'a-wide' : ''} ${f.type === 'checkbox' ? 'a-check' : ''}`}>
        <span>{f.label}{f.required ? ' *' : ''}</span>
        {f.type === 'checkbox' ? <input type="checkbox" name={f.name} defaultChecked={Boolean(value)} />
          : f.type === 'select' ? <select name={f.name} required={f.required} defaultValue={String(value)}><option value="">Select…</option>{f.options?.map(o => <option value={o.value} key={o.value}>{o.label}</option>)}</select>
          : f.type === 'textarea' ? <textarea name={f.name} rows={4} maxLength={f.max} required={f.required} defaultValue={String(value)} aria-invalid={!!errors[f.name]} />
          : <input name={f.name} type={f.type || 'text'} defaultValue={f.type === 'datetime-local' ? localDateInput(value) : String(value)} min={f.min} max={f.type === 'number' ? f.max : undefined} maxLength={f.type !== 'number' ? f.max : undefined} step={f.step} required={f.required} aria-invalid={!!errors[f.name]} />}
        <small>{f.hint}{f.type === 'datetime-local' ? ' Times use your device timezone; saved as an exact UTC instant.' : ''}</small>
        {errors[f.name] && <small className="a-field-error">{errors[f.name]?.join(' ')}</small>}
      </label>;
    })}</div></fieldset>
    <Feedback error={error} success={success} />
    <div className="a-form-footer"><span className="a-muted">* Required fields</span><button className="a-btn a-primary" disabled={busy}>{busy ? 'Saving…' : submit}</button></div>
  </form>;
}
