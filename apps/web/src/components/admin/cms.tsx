'use client';

import { useState, useRef, type DragEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUp,
  ArrowDown,
  Upload,
  Trash2,
  Copy,
  Eye,
  Plus,
  Clock,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import { adminApi, allRecords, cmsImageSources, AdminError } from '@/lib/admin/api';
import { dateLabel, type Row } from '@/lib/admin/model';
import type { Homepage } from '@/lib/types';
import { CmsSection, Campaign } from '@/components/home-sections';
import { Badge, Heading, LoadState, Panel, useAction, useLoad } from './ui';

interface Draft {
  sections: Row[];
  banners: Row[];
}

const SECTION_TYPE_DESCRIPTIONS: Record<string, { label: string; desc: string; icon: string }> = {
  HERO: { label: 'Hero Campaign', desc: 'Prominent full-width visual banner with campaign copy and primary call-to-action.', icon: '✦' },
  FEATURED_PRODUCTS: { label: 'Featured Products', desc: 'Handcrafted jewellery showcase grid highlighting signature pieces.', icon: '◆' },
  FEATURED_COLLECTIONS: { label: 'Featured Collections', desc: 'Showcase curated showroom collections with bespoke covers.', icon: '◈' },
  NEW_ARRIVALS: { label: 'New Arrivals', desc: 'Dynamic showcase of latest creations based on catalog arrival schedule.', icon: '✧' },
  BRIDAL: { label: 'Bridal Showcase', desc: 'Specialized bridal trousseau curation with rich collection link.', icon: '✤' },
  PROMOTIONAL: { label: 'Promotional Feature', desc: 'Targeted visual campaign highlight with custom imagery and button.', icon: '★' },
  CUSTOM_JEWELLERY: { label: 'Custom Jewellery Atelier', desc: 'Made-for-you bespoke design and craftsmanship invitation.', icon: '✂' },
  APPOINTMENT: { label: 'Showroom Consultation', desc: 'Private atelier appointment booking invitation with concierge note.', icon: '✉' },
  EDITORIAL: { label: 'Heritage Story', desc: 'Narrative brand legacy and craftsmanship editorial story.', icon: '¶' },
};

const COMMON_PATHS = [
  { label: 'All Jewellery', path: '/products' },
  { label: 'Showroom Collections', path: '/collections' },
  { label: 'Bridal Trousseau', path: '/collections/bridal' },
  { label: 'Book Appointment', path: '/appointments' },
  { label: 'Bespoke / Custom', path: '/custom-jewellery' },
];

/* -------------------------------------------------------------------------- */
/*                          IMAGE UPLOAD COMPONENT                            */
/* -------------------------------------------------------------------------- */

interface CmsImageUploaderProps {
  label: string;
  hint: string;
  required?: boolean;
  initialUrl?: string;
  initialPublicId?: string;
  initialImageId?: string;
  slot: 'sections' | 'banners';
  availableProducts?: Row[];
  onChange: (data: { url: string | null; publicId: string | null; imageId: string | null }) => void;
}

function CmsImageUploader({
  label,
  hint,
  required,
  initialUrl = '',
  initialPublicId = '',
  initialImageId = '',
  slot,
  availableProducts = [],
  onChange,
}: CmsImageUploaderProps) {
  const [url, setUrl] = useState(initialUrl);
  const [publicId, setPublicId] = useState(initialPublicId);
  const [imageId, setImageId] = useState(initialImageId);
  const [tab, setTab] = useState<'upload' | 'product'>('upload');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const productImages = useLoad(
    s => (selectedProductId ? adminApi<Row[]>(`admin/products/${selectedProductId}/images`, 'GET', undefined, s) : Promise.resolve({ data: [] as Row[] })),
    [selectedProductId]
  );

  async function uploadFile(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file must not exceed 10 MB.');
      return;
    }

    setBusy(true);
    setProgress('Uploading securely to Cloudinary…');
    setError('');

    try {
      const res = await adminApi<{ url: string; publicId: string; width: number; height: number; format: string }>(
        `admin/cms/image?slot=${slot}`,
        'POST',
        file
      );

      const newUrl = res.data.url;
      const newPid = res.data.publicId;

      setUrl(newUrl);
      setPublicId(newPid);
      setImageId(''); // Clear linked product image since direct upload takes precedence
      onChange({ url: newUrl, publicId: newPid, imageId: null });
      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setProgress('');
    } finally {
      setBusy(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  async function handleRemove() {
    if (publicId && publicId.startsWith('showroom/cms/')) {
      try {
        await adminApi('admin/cms/image/destroy', 'POST', { publicId });
      } catch {
        // Safe to ignore on cleanup
      }
    }
    setUrl('');
    setPublicId('');
    setImageId('');
    onChange({ url: null, publicId: null, imageId: null });
  }

  return (
    <div className="a-field" style={{ marginBottom: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, color: '#382e25', fontSize: '13px' }}>
          {label} {required ? <span style={{ color: '#9d4438' }}>*</span> : <span className="a-muted" style={{ fontWeight: 400 }}>(Optional)</span>}
        </span>
        {availableProducts.length > 0 && !url && (
          <div className="cms-tab-group" style={{ margin: 0 }}>
            <button
              type="button"
              className={`cms-tab ${tab === 'upload' ? 'active' : ''}`}
              onClick={() => setTab('upload')}
            >
              Direct Upload
            </button>
            <button
              type="button"
              className={`cms-tab ${tab === 'product' ? 'active' : ''}`}
              onClick={() => setTab('product')}
            >
              From Product
            </button>
          </div>
        )}
      </div>
      <small style={{ color: '#8c7b66', marginTop: '-3px', marginBottom: '8px', display: 'block' }}>{hint}</small>

      {url ? (
        <div className="cms-image-preview-box">
          <div className="cms-preview-img-wrap">
            <img src={url} alt={`${label} preview`} />
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="a-badge a-published" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={12} /> Image Ready
              </span>
              <span className="a-muted" style={{ fontSize: '11px' }}>
                {publicId ? 'Stored on Cloudinary CDN' : 'Referencing catalog image'}
              </span>
            </div>
            <p className="a-muted" style={{ fontSize: '11px', margin: '0 0 12px', lineHeight: 1.5 }}>
              This image is active and will be displayed in the storefront layout.
            </p>
            <div className="a-actions">
              <button
                type="button"
                className="a-btn"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {busy ? 'Processing…' : 'Replace Image'}
              </button>
              <button
                type="button"
                className="a-btn a-danger"
                disabled={busy}
                onClick={handleRemove}
              >
                Remove Image
              </button>
            </div>
          </div>
        </div>
      ) : tab === 'upload' ? (
        <div
          className={`cms-dropzone ${isDragOver ? 'is-dragover' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={{ display: 'inline-grid', placeItems: 'center', width: '44px', height: '44px', borderRadius: '50%', background: '#ede3d1', color: '#7a603c', marginBottom: '10px' }}>
            <Upload size={20} />
          </div>
          <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#4c3924', fontSize: '13px' }}>
            {busy ? 'Processing upload…' : 'Click to upload or drag and drop'}
          </p>
          <p className="a-muted" style={{ margin: 0, fontSize: '11px' }}>
            JPEG, PNG or WebP · High resolution recommended · Up to 10 MB
          </p>
        </div>
      ) : (
        <div style={{ padding: '16px', border: '1px solid var(--a-line)', borderRadius: '8px', background: '#fdfcf9' }}>
          <p className="a-muted" style={{ marginBottom: '10px', fontSize: '12px' }}>
            Select a published product to reuse its imagery:
          </p>
          <select
            value={selectedProductId}
            onChange={e => setSelectedProductId(e.target.value)}
            style={{ marginBottom: '12px' }}
          >
            <option value="">Select a published piece…</option>
            {availableProducts.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.sku}
              </option>
            ))}
          </select>
          <LoadState {...productImages} retry={productImages.reload} />
          {productImages.data && productImages.data.data.length > 0 && (
            <div className="a-image-options" style={{ marginTop: '10px' }}>
              {productImages.data.data.map(img => (
                <button
                  type="button"
                  key={img.id}
                  className={imageId === img.id ? 'selected' : ''}
                  onClick={() => {
                    setImageId(img.id);
                    setUrl(img.url || '');
                    setPublicId('');
                    onChange({ url: img.url || null, publicId: null, imageId: img.id });
                  }}
                  title={img.alt || 'Product image'}
                >
                  <img src={img.url} alt={img.alt || 'Product thumbnail'} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {progress && (
        <p role="status" className="a-muted" style={{ marginTop: '8px', fontSize: '12px', fontWeight: 600, color: '#856e4f' }}>
          {progress}
        </p>
      )}
      {error && (
        <div className="a-notice a-error" style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           STUDIO MAIN DASHBOARD                            */
/* -------------------------------------------------------------------------- */

export function CmsHome() {
  const r = useLoad(s => adminApi<Draft>('admin/homepage/draft', 'GET', undefined, s), []);
  const action = useAction();
  const router = useRouter();

  async function duplicateSection(sec: Row) {
    action.run(async () => {
      const { key, id, position, createdAt, updatedAt, ...rest } = sec;
      await adminApi('admin/homepage/sections', 'POST', {
        ...rest,
        internalName: `${sec.internalName || 'Section'} (Copy)`,
      });
      r.reload();
    }, 'Section duplicated into draft.', 'Duplicate this section? A copy will be added to the end of your draft.');
  }

  async function toggleSectionEnabled(sec: Row) {
    const key = sec.key || sec.id;
    try {
      await adminApi(`admin/homepage/sections/${key}`, 'PATCH', { enabled: !sec.enabled });
      r.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to update section.');
    }
  }

  async function toggleBannerActive(banner: Row) {
    try {
      await adminApi(`admin/homepage/banners/${banner.id}`, 'PATCH', { active: !banner.active });
      r.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to update banner.');
    }
  }

  async function moveSection(index: number, direction: 'up' | 'down') {
    if (!r.data?.data.sections) return;
    const sections = [...r.data.data.sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const current = sections[index];
    const target = sections[targetIndex];
    if (!current || !target) return;
    sections[index] = target;
    sections[targetIndex] = current;

    try {
      await adminApi('admin/homepage/sections/order', 'POST', {
        ids: sections.map(s => s.key || s.id),
      });
      r.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to save order.');
    }
  }

  const sections = r.data?.data.sections || [];
  const banners = r.data?.data.banners || [];

  return (
    <>
      <div className="cms-studio-header">
        <div>
          <p className="a-eyebrow">Shree Ram Jewellers · Content Management</p>
          <h1 style={{ margin: '0 0 8px', font: '34px Georgia, serif', color: '#382e25' }}>Homepage Studio</h1>
          <p className="a-muted" style={{ margin: 0, fontSize: '13px', maxWidth: '640px', lineHeight: 1.6 }}>
            Curate your luxury showroom storefront, hero campaigns, and seasonal showcase stories. Edits save safely as a private draft until published.
          </p>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '14px' }}>
            <span className="cms-status-badge cms-status-draft">
              <Sparkles size={11} /> Private Draft Active
            </span>
            <span className="a-muted" style={{ fontSize: '12px' }}>
              {sections.length} section{sections.length === 1 ? '' : 's'} · {banners.length} campaign banner{banners.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <div className="a-actions">
          <Link className="a-btn" href="/admin/homepage/preview" style={{ gap: '6px' }}>
            <Eye size={15} /> Preview Draft
          </Link>
          <button
            className="a-btn a-primary"
            disabled={action.busy || r.loading || !!r.error}
            onClick={() =>
              action.run(
                async () => {
                  const result = await adminApi<{ version: number }>('admin/homepage/publish', 'POST', {});
                  if (!result.data.version) throw new Error('No publication version returned.');
                },
                'Homepage published! Your storefront has been updated with an atomic snapshot.',
                'Publish the entire homepage draft to the live storefront? This creates an atomic version visible to all customers.'
              )
            }
            style={{ gap: '6px' }}
          >
            <Sparkles size={15} /> Publish Homepage
          </button>
        </div>
      </div>

      {action.feedback}
      <LoadState {...r} retry={r.reload} />

      {/* SECTION A: HOMEPAGE SECTIONS */}
      <div className="a-panel" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0, font: '22px Georgia, serif', color: '#3a2b1c' }}>Homepage Sections</h2>
            <p className="a-muted" style={{ margin: '4px 0 0', fontSize: '12px' }}>
              Arrange the narrative flow of your storefront. Drag or use move buttons to adjust section order.
            </p>
          </div>
          <Link className="a-btn a-primary" href="/admin/homepage/sections/new" style={{ gap: '6px' }}>
            <Plus size={15} /> Add Section
          </Link>
        </div>

        {sections.length === 0 ? (
          <div className="a-empty" style={{ border: '1px dashed #dcd1be', borderRadius: '8px', padding: '48px 20px', background: '#fdfbf7' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#efe5d4', color: '#886d48', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
              <Layers size={22} />
            </div>
            <h3 style={{ font: '20px Georgia, serif', color: '#44321f', margin: '0 0 8px' }}>No Sections Configured</h3>
            <p className="a-muted" style={{ maxWidth: '420px', margin: '0 auto 18px', fontSize: '13px' }}>
              Create your first homepage section—such as a Hero Campaign, Featured Collection, or Bridal Showcase.
            </p>
            <Link className="a-btn a-primary" href="/admin/homepage/sections/new">
              + Add Your First Section
            </Link>
          </div>
        ) : (
          <div>
            {sections.map((sec, idx) => {
              const key = sec.key || sec.id;
              const typeMeta = SECTION_TYPE_DESCRIPTIONS[sec.type || 'EDITORIAL'] || { label: sec.type, desc: '', icon: '✦' };
              const thumbUrl = (sec.desktopImageUrl as string) || (sec.desktopImage as { url?: string })?.url;

              return (
                <div key={key} className="cms-section-card">
                  {/* Reorder controls */}
                  <div className="cms-order-col">
                    <button
                      type="button"
                      className="cms-order-btn"
                      disabled={idx === 0}
                      onClick={() => moveSection(idx, 'up')}
                      title="Move up"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <span className="cms-order-num">#{idx + 1}</span>
                    <button
                      type="button"
                      className="cms-order-btn"
                      disabled={idx === sections.length - 1}
                      onClick={() => moveSection(idx, 'down')}
                      title="Move down"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>

                  {/* Thumbnail */}
                  <div className="cms-thumb-col">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt="" />
                    ) : (
                      <span>{typeMeta.icon} No Image</span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="cms-info-col">
                    <div className="cms-info-title">
                      <strong>{sec.internalName || 'Untitled Section'}</strong>
                      <span className="a-badge" style={{ background: '#f5eee2', color: '#7a5a2e', fontSize: '10px' }}>
                        {typeMeta.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleSectionEnabled(sec)}
                        className={`a-badge ${sec.enabled ? 'a-published' : 'a-archived'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        title="Click to toggle status"
                      >
                        {sec.enabled ? '● Enabled' : '○ Disabled'}
                      </button>
                    </div>
                    <p className="cms-info-heading">“{String(sec.heading || '')}”</p>
                    <div className="cms-info-meta">
                      {sec.startsAt || sec.endsAt ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={11} /> {sec.startsAt ? dateLabel(String(sec.startsAt)) : 'Immediate'} → {sec.endsAt ? dateLabel(String(sec.endsAt)) : 'Indefinite'}
                        </span>
                      ) : (
                        <span>Always Visible</span>
                      )}
                      {sec.ctaLabel ? (
                        <span>Button: “{String(sec.ctaLabel)}” → {String(sec.ctaPath || '')}</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="cms-actions-col">
                    <Link className="a-btn" href={`/admin/homepage/sections/${key}`}>
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="a-btn"
                      onClick={() => duplicateSection(sec)}
                      title="Duplicate section"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      className="a-btn a-danger"
                      onClick={() =>
                        action.run(
                          async () => {
                            await adminApi(`admin/homepage/sections/${key}`, 'DELETE', { confirm: true });
                            r.reload();
                          },
                          'Section removed from draft.',
                          `Delete section “${sec.internalName || sec.heading}”?`
                        )
                      }
                      title="Delete section"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION B: CAMPAIGN BANNERS */}
      <div className="a-panel" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0, font: '22px Georgia, serif', color: '#3a2b1c' }}>Campaign Banners</h2>
            <p className="a-muted" style={{ margin: '4px 0 0', fontSize: '12px' }}>
              Full-width promotional ribbons and seasonal announcements shown on the storefront.
            </p>
          </div>
          <Link className="a-btn a-primary" href="/admin/homepage/banners/new" style={{ gap: '6px' }}>
            <Plus size={15} /> Add Banner
          </Link>
        </div>

        {banners.length === 0 ? (
          <div className="a-empty" style={{ border: '1px dashed #dcd1be', borderRadius: '8px', padding: '40px 20px', background: '#fdfbf7' }}>
            <h3 style={{ font: '18px Georgia, serif', color: '#44321f', margin: '0 0 6px' }}>No Campaign Banners</h3>
            <p className="a-muted" style={{ maxWidth: '380px', margin: '0 auto 16px', fontSize: '12px' }}>
              Create top-of-homepage seasonal ribbons, festive promotional banners, or bridal atelier announcements.
            </p>
            <Link className="a-btn a-primary" href="/admin/homepage/banners/new">
              + Add Campaign Banner
            </Link>
          </div>
        ) : (
          <div>
            {banners.map(b => {
              let thumb = b.imageUrl as string;
              if (thumb && thumb.startsWith('{')) {
                try {
                  thumb = JSON.parse(thumb).desktopUrl || '';
                } catch {
                  thumb = '';
                }
              }
              if (!thumb && (b.desktopImage as { url?: string })?.url) {
                thumb = (b.desktopImage as { url: string }).url;
              }

              return (
                <div key={b.id} className="cms-section-card" style={{ gridTemplateColumns: '90px minmax(0,1fr) auto' }}>
                  <div className="cms-thumb-col">
                    {thumb ? <img src={thumb} alt="" /> : <span>No Image</span>}
                  </div>
                  <div className="cms-info-col">
                    <div className="cms-info-title">
                      <strong>{b.internalName || b.heading}</strong>
                      <span className={`a-badge ${b.publication === 'PUBLISHED' ? 'a-published' : 'a-new'}`}>
                        {b.publication}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleBannerActive(b)}
                        className={`a-badge ${b.active ? 'a-published' : 'a-archived'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                      >
                        {b.active ? '● Active' : '○ Inactive'}
                      </button>
                    </div>
                    <p className="cms-info-heading">“{String(b.heading || '')}” {b.subtitle ? `· ${String(b.subtitle)}` : ''}</p>
                    <div className="cms-info-meta">
                      <span>CTA: “{String(b.ctaLabel || '')}” → {String(b.ctaPath || '')}</span>
                      {b.startsAt ? <span>Starts: {dateLabel(String(b.startsAt))}</span> : null}
                      {b.endsAt ? <span>Ends: {dateLabel(String(b.endsAt))}</span> : null}
                    </div>
                  </div>
                  <div className="cms-actions-col">
                    <Link className="a-btn" href={`/admin/homepage/banners/${b.id}`}>
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="a-btn a-danger"
                      onClick={() =>
                        action.run(
                          async () => {
                            await adminApi(`admin/homepage/banners/${b.id}`, 'DELETE', { confirm: true });
                            r.reload();
                          },
                          'Banner removed.',
                          `Delete banner “${b.internalName || b.heading}”?`
                        )
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION C: HOMEPAGE PREVIEW CALLOUT */}
      <div className="a-panel" style={{ background: '#faf6ee', border: '1px solid #e2d3bb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: '0 0 6px', font: '18px Georgia, serif', color: '#44321f' }}>Test Before Going Live</h3>
          <p className="a-muted" style={{ margin: 0, fontSize: '12px', maxWidth: '580px' }}>
            Verify your draft typography, high-resolution imagery, and call-to-action buttons using the private live preview renderer.
          </p>
        </div>
        <Link className="a-btn a-primary" href="/admin/homepage/preview" style={{ gap: '6px' }}>
          <Eye size={15} /> Open Draft Preview
        </Link>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                        SECTION & BANNER EDITOR FORM                        */
/* -------------------------------------------------------------------------- */

export function CmsEditor({ kind, id }: { kind: 'sections' | 'banners'; id: string }) {
  const create = id === 'new';
  const router = useRouter();
  const action = useAction();

  const r = useLoad(
    async s => ({
      draft: (await adminApi<Draft>('admin/homepage/draft', 'GET', undefined, s)).data,
      products: await allRecords<Row>('admin/products?publication=PUBLISHED', s),
      collections: await allRecords<Row>('admin/collections', s),
    }),
    [kind, id]
  );

  const isSection = kind === 'sections';
  const record = create ? null : r.data?.draft[kind].find(v => (isSection ? v.key : v.id) === id);

  // Form states for sections
  const [type, setType] = useState(String(record?.type || 'HERO'));
  const [internalName, setInternalName] = useState(String(record?.internalName || ''));
  const [heading, setHeading] = useState(String(record?.heading || ''));
  const [subtitle, setSubtitle] = useState(String(record?.subtitle || ''));
  const [description, setDescription] = useState(String(record?.description || ''));
  const [ctaLabel, setCtaLabel] = useState(String(record?.ctaLabel || ''));
  const [ctaPath, setCtaPath] = useState(String(record?.ctaPath || ''));
  const [productId, setProductId] = useState(String(record?.productId || ''));
  const [collectionId, setCollectionId] = useState(String(record?.collectionId || ''));
  const [enabled, setEnabled] = useState(record?.enabled !== false);
  const [active, setActive] = useState(record?.active !== false);
  const [publication, setPublication] = useState(String(record?.publication || 'DRAFT'));
  const [imageAlt, setImageAlt] = useState(String(record?.imageAlt || ''));
  const [startsAt, setStartsAt] = useState(record?.startsAt ? String(record.startsAt).slice(0, 16) : '');
  const [endsAt, setEndsAt] = useState(record?.endsAt ? String(record.endsAt).slice(0, 16) : '');

  // Image states
  const [desktopImageUrl, setDesktopImageUrl] = useState<string>(
    String(record?.desktopImageUrl || (record?.imageUrl && !String(record.imageUrl).startsWith('{') ? record.imageUrl : '') || '')
  );
  const [desktopImagePublicId, setDesktopImagePublicId] = useState<string>(String(record?.desktopImagePublicId || record?.imagePublicId || ''));
  const [desktopImageId, setDesktopImageId] = useState<string>(String(record?.desktopImageId || ''));

  const [mobileImageUrl, setMobileImageUrl] = useState<string>(String(record?.mobileImageUrl || ''));
  const [mobileImagePublicId, setMobileImagePublicId] = useState<string>(String(record?.mobileImagePublicId || ''));
  const [mobileImageId, setMobileImageId] = useState<string>(String(record?.mobileImageId || ''));

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Handle banner image extraction if stored as JSON
  useState(() => {
    if (!isSection && record?.imageUrl && String(record.imageUrl).startsWith('{')) {
      try {
        const parsed = JSON.parse(record.imageUrl as string);
        if (parsed.desktopUrl) setDesktopImageUrl(parsed.desktopUrl);
        if (parsed.mobileUrl) setMobileImageUrl(parsed.mobileUrl);
      } catch {}
    }
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    setFormError('');
    setFormSuccess('');
    setSaving(true);

    try {
      if (isSection) {
        // Validate section constraints
        if (!internalName.trim()) throw new Error('Internal name is required.');
        if (!heading.trim()) throw new Error('Customer heading is required.');
        if (['HERO', 'PROMOTIONAL'].includes(type) && !desktopImageUrl && !desktopImageId) {
          throw new Error('Hero and Promotional sections require a desktop image.');
        }
        if (type === 'BRIDAL' && !collectionId) {
          throw new Error('Bridal showcase requires selecting a bridal collection.');
        }
        if (type === 'EDITORIAL' && !description.trim()) {
          throw new Error('Editorial stories require a description.');
        }
        if (Boolean(ctaPath) !== Boolean(ctaLabel)) {
          throw new Error('Please provide both button text and destination URL.');
        }
        if (ctaPath && !ctaPath.startsWith('/')) {
          throw new Error('Button destination must be a relative website path starting with "/".');
        }
        if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
          throw new Error('Schedule end time must be later than start time.');
        }

        const payload: Record<string, unknown> = {
          type,
          internalName: internalName.trim(),
          heading: heading.trim(),
          subtitle: subtitle.trim() || undefined,
          description: description.trim() || undefined,
          ctaLabel: ctaLabel.trim() || undefined,
          ctaPath: ctaPath.trim() || undefined,
          productId: type === 'FEATURED_PRODUCTS' && productId ? productId : null,
          collectionId: ['BRIDAL', 'FEATURED_COLLECTIONS'].includes(type) && collectionId ? collectionId : null,
          desktopImageId: desktopImageId || null,
          mobileImageId: mobileImageId || null,
          desktopImageUrl: desktopImageUrl || null,
          desktopImagePublicId: desktopImagePublicId || null,
          mobileImageUrl: mobileImageUrl || null,
          mobileImagePublicId: mobileImagePublicId || null,
          enabled,
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        };

        const res = await adminApi<Row>(`admin/homepage/sections${create ? '' : `/${id}`}`, create ? 'POST' : 'PATCH', payload);
        setFormSuccess('Section saved to draft.');
        if (create) {
          router.replace(`/admin/homepage/sections/${res.data.key || res.data.id}`);
        }
      } else {
        // Validate banner constraints
        if (!internalName.trim()) throw new Error('Internal name is required.');
        if (!heading.trim()) throw new Error('Heading is required.');
        if (!imageAlt.trim()) throw new Error('Image description (alt text) is required.');
        if (!ctaPath.trim() || !ctaLabel.trim()) throw new Error('Both button text and destination URL are required.');
        if (!desktopImageUrl && !desktopImageId) {
          throw new Error('Campaign banners require a desktop image.');
        }
        if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
          throw new Error('Schedule end time must be later than start time.');
        }

        let combinedImageUrl = desktopImageUrl;
        if (mobileImageUrl) {
          combinedImageUrl = JSON.stringify({ desktopUrl: desktopImageUrl, mobileUrl: mobileImageUrl });
        }

        const payload: Record<string, unknown> = {
          internalName: internalName.trim(),
          heading: heading.trim(),
          subtitle: subtitle.trim() || undefined,
          ctaLabel: ctaLabel.trim(),
          ctaPath: ctaPath.trim(),
          imageAlt: imageAlt.trim(),
          imageUrl: combinedImageUrl || undefined,
          imagePublicId: desktopImagePublicId || undefined,
          desktopImageId: desktopImageId || null,
          mobileImageId: mobileImageId || null,
          active,
          publication,
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        };

        const res = await adminApi<Row>(`admin/homepage/banners${create ? '' : `/${id}`}`, create ? 'POST' : 'PATCH', payload);
        setFormSuccess('Campaign banner saved to draft.');
        if (create) {
          router.replace(`/admin/homepage/banners/${res.data.id}`);
        }
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  }

  const products = r.data?.products || [];
  const collections = r.data?.collections || [];

  return (
    <>
      <div className="cms-studio-header">
        <div>
          <p className="a-eyebrow">Homepage Studio · {isSection ? 'Section Customizer' : 'Campaign Banner'}</p>
          <h1 style={{ margin: '0 0 8px', font: '32px Georgia, serif', color: '#382e25' }}>
            {create ? `Add ${isSection ? 'Section' : 'Banner'}` : `Edit ${internalName || heading || (isSection ? 'Section' : 'Banner')}`}
          </h1>
          <p className="a-muted" style={{ margin: 0, fontSize: '13px' }}>
            Customize your storefront showcase. Changes remain in your private draft until you publish the entire homepage.
          </p>
        </div>
        <div className="a-actions">
          <Link className="a-btn" href="/admin/homepage">
            ← Back to Studio
          </Link>
        </div>
      </div>

      <LoadState {...r} retry={r.reload} />
      {action.feedback}

      {formSuccess && (
        <div className="a-notice a-success" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <CheckCircle2 size={16} /> {formSuccess}
        </div>
      )}
      {formError && (
        <div className="a-notice a-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <AlertCircle size={16} /> {formError}
        </div>
      )}

      {r.data && (create || record) && (
        <form onSubmit={handleSubmit}>
          {/* STEP 1: CONTENT DETAILS */}
          <div className="cms-form-card">
            <h3>
              <Layers size={18} color="#8a6e49" /> 1. {isSection ? 'Section Details & Copy' : 'Banner Headline & Copy'}
            </h3>
            <p className="cms-card-desc">
              Define the customer-facing narrative and internal reference name.
            </p>

            <div className="a-form-grid">
              {isSection && (
                <label className="a-field a-wide">
                  <span>Section Type *</span>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value)}
                    style={{ fontSize: '13px', background: '#faf8f5', borderColor: '#dcd1c2' }}
                  >
                    {Object.entries(SECTION_TYPE_DESCRIPTIONS).map(([t, meta]) => (
                      <option key={t} value={t}>
                        {meta.label} — {meta.desc}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="a-field">
                <span>Internal Name *</span>
                <input
                  type="text"
                  value={internalName}
                  onChange={e => setInternalName(e.target.value)}
                  placeholder="e.g. Summer Bridal Hero 2026"
                  required
                />
                <small>For management reference in the admin studio.</small>
              </label>

              <label className="a-field">
                <span>Customer-Facing Heading *</span>
                <input
                  type="text"
                  value={heading}
                  onChange={e => setHeading(e.target.value)}
                  placeholder="e.g. Some things become a part of you."
                  required
                />
                <small>Main headline displayed prominently on the website.</small>
              </label>

              <label className="a-field">
                <span>Subtitle / Eyebrow</span>
                <input
                  type="text"
                  value={subtitle}
                  onChange={e => setSubtitle(e.target.value)}
                  placeholder="e.g. Heritage Atelier · Wadala"
                />
                <small>Delicate gold label placed above the heading.</small>
              </label>

              {isSection && (
                <label className="a-field a-wide">
                  <span>Description {type === 'EDITORIAL' ? '*' : '(Optional)'}</span>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Rich story or background narrative describing this collection or atelier moment…"
                  />
                </label>
              )}

              {!isSection && (
                <label className="a-field a-wide">
                  <span>Accessibility Description (Alt Text) *</span>
                  <input
                    type="text"
                    value={imageAlt}
                    onChange={e => setImageAlt(e.target.value)}
                    placeholder="e.g. Model wearing handcrafted 22K polki bridal necklace"
                    required
                  />
                  <small>Describes the imagery for screen readers and search engines.</small>
                </label>
              )}
            </div>
          </div>

          {/* STEP 2: CALL TO ACTION */}
          <div className="cms-form-card">
            <h3>
              <ExternalLink size={18} color="#8a6e49" /> 2. Call to Action (Button)
            </h3>
            <p className="cms-card-desc">
              Direct customers to your showroom collections, products, or appointment scheduling.
            </p>

            <div className="a-form-grid">
              <label className="a-field">
                <span>Button Text {!isSection && '*'}</span>
                <input
                  type="text"
                  value={ctaLabel}
                  onChange={e => setCtaLabel(e.target.value)}
                  placeholder="e.g. Explore the Jewellery"
                  required={!isSection}
                />
              </label>

              <label className="a-field">
                <span>Destination Path {!isSection && '*'}</span>
                <input
                  type="text"
                  value={ctaPath}
                  onChange={e => setCtaPath(e.target.value)}
                  placeholder="e.g. /products or /collections/bridal"
                  required={!isSection}
                />
                <small>Must be a safe internal path starting with “/”.</small>
              </label>
            </div>

            <div style={{ marginTop: '10px' }}>
              <span className="a-muted" style={{ fontSize: '11px', display: 'block', marginBottom: '6px' }}>
                Quick suggestions:
              </span>
              <div className="cms-chip-group">
                {COMMON_PATHS.map(cp => (
                  <button
                    type="button"
                    key={cp.path}
                    className="cms-chip"
                    onClick={() => {
                      setCtaPath(cp.path);
                      if (!ctaLabel) setCtaLabel(cp.label);
                    }}
                  >
                    {cp.label} ({cp.path})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* STEP 3: CONTEXTUAL CONTENT ASSOCIATION (Sections only) */}
          {isSection && (
            <div className="cms-form-card">
              <h3>
                <Sparkles size={18} color="#8a6e49" /> 3. Catalog Content Association
              </h3>
              <p className="cms-card-desc">
                Link specific catalog products or collections to display in this section layout.
              </p>

              {type === 'FEATURED_PRODUCTS' && (
                <label className="a-field a-wide">
                  <span>Featured Product *</span>
                  <select value={productId} onChange={e => setProductId(e.target.value)}>
                    <option value="">Select a published piece…</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {String(p.name || '')} · {String(p.sku || '')}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {['BRIDAL', 'FEATURED_COLLECTIONS'].includes(type) && (
                <label className="a-field a-wide">
                  <span>{type === 'BRIDAL' ? 'Bridal Collection *' : 'Collection Showcase'}</span>
                  <select value={collectionId} onChange={e => setCollectionId(e.target.value)}>
                    <option value="">Select a collection…</option>
                    {collections
                      .filter(c => (type === 'BRIDAL' ? c.bridal : true))
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.bridal ? '(Bridal)' : ''}
                        </option>
                      ))}
                  </select>
                </label>
              )}

              {!['FEATURED_PRODUCTS', 'BRIDAL', 'FEATURED_COLLECTIONS'].includes(type) && (
                <p className="a-muted" style={{ margin: 0, fontSize: '12px', fontStyle: 'italic' }}>
                  The “{SECTION_TYPE_DESCRIPTIONS[type]?.label || type}” section type does not require manual catalog linking.
                </p>
              )}
            </div>
          )}

          {/* STEP 4: SECTION & BANNER IMAGERY */}
          <div className="cms-form-card">
            <h3>
              <ImageIcon size={18} color="#8a6e49" /> {isSection ? '4' : '3'}. Imagery & Artwork (Cloudinary)
            </h3>
            <p className="cms-card-desc">
              Upload high-resolution photography directly via Cloudinary CDN or optionally link a published product image.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '24px', minWidth: 0 }}>
              <CmsImageUploader
                label="Desktop Image"
                hint="Landscape 16:9 or 1920×1080 recommended for full-width presentation."
                required={!isSection || ['HERO', 'PROMOTIONAL'].includes(type)}
                initialUrl={desktopImageUrl}
                initialPublicId={desktopImagePublicId}
                initialImageId={desktopImageId}
                slot={isSection ? 'sections' : 'banners'}
                availableProducts={products}
                onChange={({ url, publicId, imageId }) => {
                  setDesktopImageUrl(url || '');
                  setDesktopImagePublicId(publicId || '');
                  setDesktopImageId(imageId || '');
                }}
              />

              <CmsImageUploader
                label="Mobile Image"
                hint="Portrait 3:4 or 750×1000 recommended for optimal mobile display."
                required={false}
                initialUrl={mobileImageUrl}
                initialPublicId={mobileImagePublicId}
                initialImageId={mobileImageId}
                slot={isSection ? 'sections' : 'banners'}
                availableProducts={products}
                onChange={({ url, publicId, imageId }) => {
                  setMobileImageUrl(url || '');
                  setMobileImagePublicId(publicId || '');
                  setMobileImageId(imageId || '');
                }}
              />
            </div>
          </div>

          {/* STEP 5: SCHEDULING & PUBLICATION */}
          <div className="cms-form-card">
            <h3>
              <Clock size={18} color="#8a6e49" /> {isSection ? '5' : '4'}. Scheduling & Visibility
            </h3>
            <p className="cms-card-desc">
              Control when this content appears on your live storefront.
            </p>

            <div className="a-form-grid">
              {isSection ? (
                <label className="a-field a-check a-wide">
                  <span>Enable section in draft</span>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={e => setEnabled(e.target.checked)}
                  />
                  <small>When unchecked, this section will be hidden from live customers upon publishing.</small>
                </label>
              ) : (
                <>
                  <label className="a-field a-check">
                    <span>Active in rotation</span>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={e => setActive(e.target.checked)}
                    />
                  </label>
                  <label className="a-field">
                    <span>Publication State</span>
                    <select value={publication} onChange={e => setPublication(e.target.value)}>
                      <option value="DRAFT">DRAFT (Private)</option>
                      <option value="PUBLISHED">PUBLISHED (Live upon homepage publish)</option>
                    </select>
                  </label>
                </>
              )}

              <label className="a-field">
                <span>Start Schedule</span>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={e => setStartsAt(e.target.value)}
                />
                <small>Leave empty to show immediately once published.</small>
              </label>

              <label className="a-field">
                <span>End Schedule</span>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={e => setEndsAt(e.target.value)}
                />
                <small>Leave empty to run indefinitely.</small>
              </label>
            </div>
          </div>

          {/* ACTIONS BAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div className="a-actions">
              <button
                type="submit"
                className="a-btn a-primary"
                disabled={saving}
                style={{ padding: '12px 24px', fontSize: '14px', fontWeight: 600, gap: '6px' }}
              >
                <Sparkles size={16} /> {saving ? 'Saving to Draft…' : `Save Draft ${isSection ? 'Section' : 'Banner'}`}
              </button>
              <Link className="a-btn" href="/admin/homepage">
                Cancel
              </Link>
            </div>

            {!create && (
              <button
                type="button"
                className="a-btn a-danger"
                disabled={action.busy}
                onClick={() =>
                  action.run(
                    async () => {
                      await adminApi(`admin/homepage/${kind}/${id}`, 'DELETE', { confirm: true });
                      router.push('/admin/homepage');
                    },
                    'Draft content removed.',
                    `Delete this draft ${isSection ? 'section' : 'banner'}? The live snapshot changes only when you publish again.`
                  )
                }
              >
                Delete from Draft
              </button>
            )}
          </div>
        </form>
      )}

      {r.data && !create && !record && (
        <div className="a-panel a-empty">
          <h3>Content Not Found</h3>
          <p className="a-muted">The requested {isSection ? 'section' : 'banner'} does not exist in the current draft.</p>
          <Link className="a-btn" href="/admin/homepage">
            Back to Homepage Studio
          </Link>
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                                DRAFT PREVIEW                               */
/* -------------------------------------------------------------------------- */

export function CmsPreview() {
  const r = useLoad(s => adminApi<Homepage>('admin/homepage/preview', 'GET', undefined, s), []);
  const action = useAction();

  return (
    <>
      <div style={{ background: '#382b1d', color: '#fffaf0', padding: '18px 28px', borderRadius: '8px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="a-badge" style={{ background: '#cba052', color: '#2a1a08', fontWeight: 600 }}>
              PRIVATE DRAFT PREVIEW
            </span>
            <span style={{ fontSize: '13px', color: '#d5c4aa' }}>
              Showing how your draft will render for visitors
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#b9a58b' }}>
            Resolved using current active date schedules and eligibility rules.
          </p>
        </div>
        <div className="a-actions">
          <Link className="a-btn" href="/admin/homepage" style={{ background: '#4e3b28', color: '#f7efe1', borderColor: '#664e35' }}>
            ← Back to Studio
          </Link>
          <button
            className="a-btn a-primary"
            style={{ background: '#cba052', color: '#2a1a08', borderColor: '#cba052', fontWeight: 600 }}
            disabled={action.busy || r.loading}
            onClick={() =>
              action.run(
                async () => {
                  await adminApi<{ version: number }>('admin/homepage/publish', 'POST', {});
                },
                'Homepage published successfully!',
                'Publish this version to the live storefront now?'
              )
            }
          >
            Publish Live Now
          </button>
        </div>
      </div>

      {action.feedback}
      <LoadState {...r} retry={r.reload} />

      {r.data && (
        <div className="a-preview" style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 8px 30px #2a1a0808' }}>
          {!r.data.data.sections.length && !r.data.data.banners.length ? (
            <div className="a-empty" style={{ padding: '60px 20px' }}>
              <h3>No Draft Content Eligible</h3>
              <p className="a-muted">Enable sections or check scheduling dates in the studio.</p>
              <Link className="a-btn a-primary" href="/admin/homepage">
                Return to Studio
              </Link>
            </div>
          ) : (
            <>
              {r.data.data.sections.map((s, i) => (
                <CmsSection key={s.id} section={s} primary={i === 0} />
              ))}
              {r.data.data.banners.map(b => (
                <Campaign key={b.id} banner={b} />
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}
