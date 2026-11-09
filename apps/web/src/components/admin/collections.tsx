'use client';

import { useState, useRef, useEffect, type DragEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Upload,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Eye,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  Image as ImageIcon,
  Sliders,
  Search,
  Trash2,
} from 'lucide-react';
import { adminApi, allRecords, AdminError } from '@/lib/admin/api';
import { moved, type Row } from '@/lib/admin/model';
import { Badge, Heading, LoadState, Panel, RecordLink, Select, Table, useAction, useLoad } from './ui';

export function OrderButtons({
  rows,
  index,
  onSave,
  disabled = false,
}: {
  rows: Row[];
  index: number;
  onSave: (rows: Row[]) => Promise<unknown>;
  disabled?: boolean;
}) {
  const action = useAction();
  return (
    <>
      <div className="a-actions">
        {[-1, 1].map(d => (
          <button
            className="a-btn"
            key={d}
            type="button"
            disabled={disabled || action.busy || index + d < 0 || index + d >= rows.length}
            aria-label={`Move ${rows[index]?.name || rows[index]?.internalName || 'item'} ${d < 0 ? 'up' : 'down'}`}
            onClick={() => action.run(() => onSave(moved(rows, index, d)), 'Order saved.')}
          >
            {d < 0 ? '↑' : '↓'}
          </button>
        ))}
      </div>
      {action.feedback}
    </>
  );
}

export function CollectionList() {
  const r = useLoad(s => allRecords<Row>('admin/collections', s), []);
  return (
    <>
      <Heading title="Collections" description="Curate pieces into stories your customers can explore.">
        <Link className="a-btn a-primary" href="/admin/collections/new">
          + Add collection
        </Link>
      </Heading>
      <Panel>
        <LoadState {...r} retry={r.reload} />
        {r.data && (
          <Table
            rows={r.data}
            columns={[
              {
                title: 'Collection',
                render: c => <RecordLink href={`/admin/collections/${c.id}`}>{c.name}</RecordLink>,
              },
              {
                title: 'Publication',
                render: c => <Badge value={c.archivedAt ? 'ARCHIVED' : c.publication} />,
              },
              {
                title: 'Visibility',
                render: c => (c.visible ? 'Visible' : 'Hidden'),
              },
              {
                title: 'Order',
                render: c => {
                  const active = r.data!.filter(v => !v.archivedAt);
                  return c.archivedAt ? (
                    '—'
                  ) : (
                    <OrderButtons
                      rows={active}
                      index={active.findIndex(v => v.id === c.id)}
                      onSave={async rows => {
                        await adminApi('admin/collections/order', 'POST', { ids: rows.map(v => v.id) });
                        r.reload();
                      }}
                    />
                  );
                },
              },
            ]}
          />
        )}
      </Panel>
    </>
  );
}

async function collectionDetail(id: string, signal: AbortSignal) {
  const result = await adminApi<Row>(`admin/collections/${id}?limit=100`, 'GET', undefined, signal);
  const products = [...(result.data.products || [])];
  for (let page = 2; page <= (result.pagination?.pages || 1); page++) {
    const more = await adminApi<Row>(`admin/collections/${id}?limit=100&page=${page}`, 'GET', undefined, signal);
    products.push(...(more.data.products || []));
  }
  return { ...result.data, products };
}

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'collection';
}

function getUniqueSlug(baseName: string, existingCollections: Row[], currentId?: string): string {
  const base = slugify(baseName);
  const takenSlugs = new Set(
    existingCollections
      .filter(col => col.id !== currentId)
      .map(col => String(col.slug || '').toLowerCase())
  );
  if (!takenSlugs.has(base)) return base;
  let counter = 2;
  while (takenSlugs.has(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}

/* -------------------------------------------------------------------------- */
/*                         COLLECTION IMAGE UPLOADER                          */
/* -------------------------------------------------------------------------- */

interface CollectionImageUploaderProps {
  label: string;
  hint: string;
  aspectDesc: string;
  aspectRatio?: string;
  initialUrl?: string;
  initialPublicId?: string;
  initialImageId?: string;
  availableProducts?: Row[];
  onChange: (data: { url: string | null; publicId: string | null; imageId: string | null }) => void;
}

function CollectionImageUploader({
  label,
  hint,
  aspectDesc,
  aspectRatio = '4 / 3',
  initialUrl = '',
  initialPublicId = '',
  initialImageId = '',
  availableProducts = [],
  onChange,
}: CollectionImageUploaderProps) {
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

  useEffect(() => {
    setUrl(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    setPublicId(initialPublicId);
  }, [initialPublicId]);

  useEffect(() => {
    setImageId(initialImageId);
  }, [initialImageId]);

  const productImages = useLoad(
    s =>
      selectedProductId
        ? adminApi<Row[]>(`admin/products/${selectedProductId}/images`, 'GET', undefined, s)
        : Promise.resolve({ data: [] as Row[] }),
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
      const res = await adminApi<{ url: string; publicId: string }>(
        'admin/cms/image?slot=collections',
        'POST',
        file
      );

      const newUrl = res.data.url;
      const newPid = res.data.publicId;

      setUrl(newUrl);
      setPublicId(newPid);
      setImageId('');
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
    <div className="a-field" style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontWeight: 600, color: '#382e25', fontSize: '13px' }}>{label}</span>
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
      <small style={{ color: '#8c7b66', marginBottom: '8px', display: 'block' }}>
        {hint} · <em style={{ fontStyle: 'normal', color: '#a0896b' }}>{aspectDesc}</em>
      </small>

      {url ? (
        <div className="cms-image-preview-box">
          <div className="cms-preview-img-wrap" style={{ aspectRatio, height: 'auto', maxHeight: '130px' }}>
            <img src={url} alt={`${label} preview`} />
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span
                className="a-badge a-published"
                style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <CheckCircle2 size={12} /> Image Ready
              </span>
              <span className="a-muted" style={{ fontSize: '11px' }}>
                {publicId ? 'Stored on Cloudinary CDN' : 'Referencing product catalog'}
              </span>
            </div>
            <p className="a-muted" style={{ fontSize: '11px', margin: '0 0 10px', lineHeight: 1.4 }}>
              This photograph is active and will be displayed in showroom collection cards.
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
          style={{ padding: '22px 16px' }}
        >
          <div
            style={{
              display: 'inline-grid',
              placeItems: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#ede3d1',
              color: '#7a603c',
              marginBottom: '8px',
            }}
          >
            <Upload size={18} />
          </div>
          <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#4c3924', fontSize: '13px' }}>
            {busy ? progress || 'Processing upload…' : 'Click to upload or drag and drop'}
          </p>
          <p className="a-muted" style={{ margin: 0, fontSize: '11px' }}>
            JPEG, PNG or WebP · High resolution recommended · Up to 10 MB
          </p>
        </div>
      ) : (
        <div style={{ padding: '14px', border: '1px solid var(--a-line)', borderRadius: '8px', background: '#fdfcf9' }}>
          <p className="a-muted" style={{ marginBottom: '8px', fontSize: '12px' }}>
            Select a published product to reuse its photography:
          </p>
          <select
            value={selectedProductId}
            onChange={e => setSelectedProductId(e.target.value)}
            style={{ marginBottom: '10px' }}
          >
            <option value="">Select a product…</option>
            {availableProducts.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.sku}
              </option>
            ))}
          </select>

          <LoadState {...productImages} retry={productImages.reload} />

          {productImages.data && productImages.data.data.length > 0 && (
            <div className="a-image-options" style={{ marginTop: '8px' }}>
              {productImages.data.data.map(img => (
                <button
                  type="button"
                  key={img.id}
                  className={imageId === img.id ? 'selected' : ''}
                  onClick={() => {
                    const chosenId = String(img.id || '');
                    const chosenUrl = String(img.url || '');
                    setImageId(chosenId);
                    setUrl(chosenUrl);
                    setPublicId('');
                    onChange({ url: chosenUrl, publicId: null, imageId: chosenId });
                  }}
                  style={{
                    padding: '3px',
                    border: `2px solid ${imageId === img.id ? '#987847' : '#e2d7c5'}`,
                    borderRadius: '6px',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <img
                    src={img.url}
                    alt={img.alt || 'Product piece'}
                    style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
                  />
                </button>
              ))}
            </div>
          )}

          {selectedProductId && productImages.data?.data.length === 0 && (
            <p className="a-muted" style={{ margin: '8px 0 0', fontSize: '11px' }}>
              This product currently has no images attached.
            </p>
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

      {error && (
        <div className="a-notice a-error" style={{ marginTop: '10px', fontSize: '12px' }}>
          {error}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                         MAIN REDESIGNED COLLECTION EDITOR                  */
/* -------------------------------------------------------------------------- */

export function CollectionEditor({ id }: { id: string }) {
  const create = id === 'new';
  const router = useRouter();
  const action = useAction();

  const [revision, setRevision] = useState(0);
  const [productToAdd, setProductToAdd] = useState('');

  // Core Form States
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Image states
  const [coverImage, setCoverImage] = useState<{ url: string; publicId: string; imageId: string }>({
    url: '',
    publicId: '',
    imageId: '',
  });
  const [bannerImage, setBannerImage] = useState<{ url: string; publicId: string; imageId: string }>({
    url: '',
    publicId: '',
    imageId: '',
  });

  // Merchandising & visibility
  const [visible, setVisible] = useState(true);
  const [bridal, setBridal] = useState(false);
  const [publication, setPublication] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');

  // Advanced SEO (collapsed by default)
  const [seoOpen, setSeoOpen] = useState(false);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');

  // Feedback & saving states
  const [saving, setSaving] = useState(false);
  const [targetPublication, setTargetPublication] = useState<'DRAFT' | 'PUBLISHED' | null>(null);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const r = useLoad(
    async s => ({
      collection: create ? null : await collectionDetail(id, s),
      products: await allRecords<Row>('admin/products', s),
      collections: await allRecords<Row>('admin/collections', s),
    }),
    [id, revision]
  );

  const refresh = () => setRevision(v => v + 1);
  const c = r.data?.collection as Row | null | undefined;
  const availableProducts = r.data?.products || [];
  const existingCollections = r.data?.collections || [];

  // Initialize form when existing collection loads
  useEffect(() => {
    if (c) {
      setName(String(c.name || ''));
      setDescription(String(c.description || ''));
      setVisible(c.visible !== false);
      setBridal(Boolean(c.bridal));
      setPublication(c.publication === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT');
      setSeoTitle(String(c.seoTitle || ''));
      setSeoDescription(String(c.seoDescription || ''));

      // Parse cover and banner images
      let coverUrl = '';
      let coverPid = '';
      let bannerUrl = '';
      let bannerPid = '';

      if (c.imageUrl) {
        if (typeof c.imageUrl === 'string' && c.imageUrl.startsWith('{')) {
          try {
            const parsed = JSON.parse(c.imageUrl);
            coverUrl = String(parsed.coverUrl || '');
            coverPid = String(parsed.coverPublicId || '');
            bannerUrl = String(parsed.bannerUrl || '');
            bannerPid = String(parsed.bannerPublicId || '');
          } catch {
            coverUrl = String(c.imageUrl);
            coverPid = String(c.imagePublicId || '');
          }
        } else {
          coverUrl = String(c.imageUrl);
          coverPid = String(c.imagePublicId || '');
        }
      }

      // Check product-linked cover/banner
      const coverImgId = String(c.coverImageId || '');
      const bannerImgId = String(c.bannerImageId || '');
      const coverObj = c.coverImage as { url?: string } | undefined;
      const bannerObj = c.bannerImage as { url?: string } | undefined;
      if (!coverUrl && coverObj?.url) {
        coverUrl = String(coverObj.url);
      }
      if (!bannerUrl && bannerObj?.url) {
        bannerUrl = String(bannerObj.url);
      }

      setCoverImage({
        url: coverUrl,
        publicId: coverPid,
        imageId: coverImgId,
      });

      setBannerImage({
        url: bannerUrl,
        publicId: bannerPid,
        imageId: bannerImgId,
      });
    }
  }, [c]);

  // Handlers
  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setName(e.target.value);
    if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: '' }));
  }

  async function handleSave(targetPub: 'DRAFT' | 'PUBLISHED') {
    if (saving) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFieldErrors({ name: 'Collection name is required.' });
      setFormError('Please provide a collection name before saving.');
      return;
    }

    setSaving(true);
    setTargetPublication(targetPub);
    setFormError('');
    setFormSuccess('');

    try {
      // Determine the slug automatically, uniquely, and safely
      let targetSlug = '';
      if (create) {
        // Auto-generate unique slug from collection name
        targetSlug = getUniqueSlug(trimmedName, existingCollections);
      } else {
        const isAlreadyPublished = c?.publication === 'PUBLISHED';
        const nameChanged = trimmedName !== String(c?.name || '').trim();

        if (isAlreadyPublished || !nameChanged) {
          // Preserve existing URL for published collections or when name is unchanged
          targetSlug = String(c?.slug || getUniqueSlug(trimmedName, existingCollections, id));
        } else {
          // For unpublished drafts whose name changed, update the generated slug
          targetSlug = getUniqueSlug(trimmedName, existingCollections, id);
        }
      }

      // Pack direct Cloudinary images into imageUrl
      let packedImageUrl: string | null = null;
      let packedImagePublicId: string | null = null;

      const hasDirectCover = Boolean(coverImage.url && !coverImage.imageId);
      const hasDirectBanner = Boolean(bannerImage.url && !bannerImage.imageId);

      if (hasDirectCover || hasDirectBanner) {
        packedImageUrl = JSON.stringify({
          ...(hasDirectCover ? { coverUrl: coverImage.url, coverPublicId: coverImage.publicId || null } : {}),
          ...(hasDirectBanner ? { bannerUrl: bannerImage.url, bannerPublicId: bannerImage.publicId || null } : {}),
        });
        packedImagePublicId = coverImage.publicId || bannerImage.publicId || null;
      }

      const payload: Record<string, unknown> = {
        name: trimmedName,
        slug: targetSlug,
        description: description.trim() || undefined,
        imageUrl: packedImageUrl,
        imagePublicId: packedImagePublicId,
        coverImageId: coverImage.imageId || null,
        bannerImageId: bannerImage.imageId || null,
        visible,
        bridal,
        publication: targetPub,
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
      };

      const res = await adminApi<Row>(
        `admin/collections${create ? '' : `/${id}`}`,
        create ? 'POST' : 'PATCH',
        payload
      );

      const msg = targetPub === 'PUBLISHED'
        ? 'Collection published live to your online showroom!'
        : 'Collection saved as private draft.';

      setFormSuccess(msg);
      window.dispatchEvent(new CustomEvent('owner-saved', { detail: msg }));

      if (create) {
        router.replace(`/admin/collections/${res.data.id}`);
      } else {
        refresh();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save collection changes.');
    } finally {
      setSaving(false);
      setTargetPublication(null);
    }
  }

  return (
    <>
      {/* COMPACT LUXURY HEADER */}
      <div className="cms-studio-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <p className="a-eyebrow" style={{ margin: 0 }}>COLLECTIONS STUDIO</p>
              {!create && c && <Badge value={c.archivedAt ? 'ARCHIVED' : c.publication} />}
            </div>
            <h1 style={{ margin: '0 0 4px', font: '30px Georgia, serif', color: '#382e25' }}>
              {create ? 'Create Collection' : `Edit ${c?.name || 'Collection'}`}
            </h1>
            <p className="a-muted" style={{ margin: 0, fontSize: '13px' }}>
              Organise jewellery into curated collections for your customers.
            </p>
          </div>
          <div className="a-actions">
            <Link className="a-btn" href="/admin/collections" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={14} /> Back to Collections
            </Link>
            {!create && c && c.visible && c.publication === 'PUBLISHED' && (
              <a
                className="a-btn"
                href={`/collections/${c.slug}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#faf6ee', borderColor: '#c5a059' }}
              >
                <Eye size={14} color="#8a6e49" /> Preview Collection ↗
              </a>
            )}
          </div>
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

      {c?.archivedAt ? (
        <Panel title="Archived Collection">
          <p className="a-muted">This collection is archived. Restoring archived collections is not supported by the current API.</p>
          <Link className="a-btn" href="/admin/collections">
            Return to All Collections
          </Link>
        </Panel>
      ) : (create || c) ? (
        <form onSubmit={e => e.preventDefault()}>
          {/* SECTION 1: COLLECTION DETAILS */}
          <div className="cms-form-card">
            <h3>
              <Layers size={18} color="#8a6e49" /> 1. Collection Details
            </h3>
            <p className="cms-card-desc">
              Define the customer-facing title and narrative introduction for this collection.
            </p>

            <div className="a-form-grid">
              {/* Collection Name */}
              <label className="a-field a-wide">
                <span style={{ fontSize: '13.5px', fontWeight: 600 }}>Collection Name *</span>
                <input
                  type="text"
                  value={name}
                  onChange={handleNameChange}
                  placeholder="e.g. Royal Polki & Heritage Chokers"
                  required
                  maxLength={200}
                  style={{ fontSize: '14.5px', padding: '11px 14px' }}
                />
                <small>The primary collection headline displayed across showroom grids and navigation.</small>
                {fieldErrors.name && <small className="a-field-error">{fieldErrors.name}</small>}
              </label>

              {/* Short Description */}
              <label className="a-field a-wide">
                <span style={{ fontSize: '13.5px', fontWeight: 600 }}>Short Description</span>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="A curated celebration of uncut polki diamonds, hand-set in 22-karat gold with royal heritage meenakari work..."
                  maxLength={10000}
                />
                <small>Appears at the top of the collection page to introduce the jewellery curation to customers.</small>
              </label>
            </div>
          </div>

          {/* SECTION 2: COLLECTION IMAGES */}
          <div className="cms-form-card">
            <h3>
              <ImageIcon size={18} color="#8a6e49" /> 2. Collection Images (Cloudinary)
            </h3>
            <p className="cms-card-desc">
              Upload high-resolution photography directly via Cloudinary CDN or optionally link a product image.
            </p>

            <div className="collection-image-grid">
              <CollectionImageUploader
                label="Collection Cover Image"
                hint="Used on collection cards and showroom overview grids."
                aspectDesc="4:3 or square recommended"
                aspectRatio="4 / 3"
                initialUrl={coverImage.url}
                initialPublicId={coverImage.publicId}
                initialImageId={coverImage.imageId}
                availableProducts={availableProducts}
                onChange={({ url, publicId, imageId }) => {
                  setCoverImage({
                    url: url || '',
                    publicId: publicId || '',
                    imageId: imageId || '',
                  });
                }}
              />

              <CollectionImageUploader
                label="Collection Banner Image (Optional)"
                hint="Wide visual header displayed at the top of the collection page."
                aspectDesc="Wide 16:9 or 1920×600 recommended"
                aspectRatio="16 / 7"
                initialUrl={bannerImage.url}
                initialPublicId={bannerImage.publicId}
                initialImageId={bannerImage.imageId}
                availableProducts={availableProducts}
                onChange={({ url, publicId, imageId }) => {
                  setBannerImage({
                    url: url || '',
                    publicId: publicId || '',
                    imageId: imageId || '',
                  });
                }}
              />
            </div>
          </div>

          {/* SECTION 3: COLLECTION SETTINGS */}
          <div className="cms-form-card">
            <h3>
              <Sliders size={18} color="#8a6e49" /> 3. Collection Settings
            </h3>
            <p className="cms-card-desc">
              Control visibility in showroom navigation and select merchandising classifications.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px', marginBottom: '18px', minWidth: 0 }}>
              {/* Website Visibility */}
              <label className="collection-toggle-row">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={e => setVisible(e.target.checked)}
                />
                <div className="collection-toggle-info">
                  <strong>Visible on Website</strong>
                  <small>When enabled, this collection appears in public showroom navigation and the collections directory.</small>
                </div>
              </label>

              {/* Bridal Edit */}
              <label className="collection-toggle-row">
                <input
                  type="checkbox"
                  checked={bridal}
                  onChange={e => setBridal(e.target.checked)}
                />
                <div className="collection-toggle-info">
                  <strong>Bridal Collection Edit</strong>
                  <small>Classifies this collection under the Bridal Trousseau showcase (/collections/bridal).</small>
                </div>
              </label>
            </div>

            {/* Publication Status Selector */}
            <div style={{ marginTop: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#382e25', display: 'block', marginBottom: '8px' }}>
                Publication Status *
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '12px', minWidth: 0 }}>
                <label className={`collection-radio-card ${publication === 'DRAFT' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="publicationRadio"
                    value="DRAFT"
                    checked={publication === 'DRAFT'}
                    onChange={() => setPublication('DRAFT')}
                  />
                  <div>
                    <strong style={{ display: 'block', fontSize: '13px', color: '#382e25' }}>Save as Private Draft</strong>
                    <small style={{ color: '#7a6a58', fontSize: '11.5px', lineHeight: 1.4 }}>
                      Only showroom staff can view and curate this collection. Hidden from public visitors.
                    </small>
                  </div>
                </label>

                <label className={`collection-radio-card ${publication === 'PUBLISHED' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="publicationRadio"
                    value="PUBLISHED"
                    checked={publication === 'PUBLISHED'}
                    onChange={() => setPublication('PUBLISHED')}
                  />
                  <div>
                    <strong style={{ display: 'block', fontSize: '13px', color: '#382e25' }}>Publish Live to Website</strong>
                    <small style={{ color: '#7a6a58', fontSize: '11.5px', lineHeight: 1.4 }}>
                      Immediately visible to online visitors (as long as website visibility is active).
                    </small>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 4: ADVANCED SEO (COLLAPSIBLE) */}
          <div className="collection-seo-box">
            <div
              className={`collection-seo-summary ${seoOpen ? 'is-open' : ''}`}
              onClick={() => setSeoOpen(!seoOpen)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 600, color: '#382e25', fontSize: '13.5px' }}>
                  ✦ Advanced SEO Settings
                </span>
                <span className="a-muted" style={{ fontSize: '11.5px' }}>
                  (Optional search engine title & description)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8a6e49', fontSize: '12px' }}>
                <span>{seoOpen ? 'Hide' : 'Expand'}</span>
                {seoOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </div>
            </div>

            {seoOpen && (
              <div className="collection-seo-content">
                <p className="a-muted" style={{ margin: '0 0 16px', fontSize: '12px' }}>
                  Customize how search engines and social sharing links present this collection. If left blank, your collection name and description will be used automatically.
                </p>

                <div className="a-form-grid">
                  <label className="a-field a-wide">
                    <span>SEO Page Title</span>
                    <input
                      type="text"
                      value={seoTitle}
                      onChange={e => setSeoTitle(e.target.value)}
                      placeholder={name ? `${name} | Shree Ram Jewellers` : 'Custom search title...'}
                      maxLength={200}
                    />
                    <small>Recommended: 50–60 characters. Appears as the clickable headline on Google.</small>
                  </label>

                  <label className="a-field a-wide">
                    <span>SEO Meta Description</span>
                    <textarea
                      rows={2}
                      value={seoDescription}
                      onChange={e => setSeoDescription(e.target.value)}
                      placeholder={description ? description.slice(0, 160) : 'Custom search description snippet...'}
                      maxLength={500}
                    />
                    <small>Recommended: 120–160 characters. Summarizes the collection on search result pages.</small>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* FOOTER ACTIONS */}
          <div
            className="a-form-footer"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#faf8f5',
              padding: '18px 24px',
              borderRadius: '8px',
              border: '1px solid #e7decb',
              marginTop: '20px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <Link className="a-btn" href="/admin/collections" style={{ color: '#6d5a45' }}>
              Cancel
            </Link>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                className="a-btn"
                disabled={saving}
                onClick={() => handleSave('DRAFT')}
                style={{ background: '#fff', borderColor: '#dcd1bd', color: '#443322', fontWeight: 500 }}
              >
                {saving && targetPublication === 'DRAFT' ? 'Saving draft…' : 'Save as Draft'}
              </button>

              <button
                type="button"
                className="a-btn a-primary"
                disabled={saving}
                onClick={() => handleSave('PUBLISHED')}
                style={{
                  background: '#c5a059',
                  borderColor: '#b28e46',
                  color: '#2a1a08',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Sparkles size={15} />
                {saving && targetPublication === 'PUBLISHED' ? 'Publishing…' : 'Publish Collection'}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {/* CURATED PRODUCTS & ARCHIVE (FOR EXISTING COLLECTIONS ONLY) */}
      {!create && c && !c.archivedAt && (
        <div style={{ marginTop: '36px' }}>
          <Panel title="Curated Jewellery Pieces in this Collection">
            <p className="a-muted" style={{ margin: '0 0 16px', fontSize: '13px' }}>
              Manage and reorder individual pieces showcased in this collection.
            </p>

            <div className="a-filters">
              <Select
                label="Add a product"
                value={productToAdd}
                onChange={setProductToAdd}
                empty="Choose a piece"
                options={availableProducts
                  .filter(p => p.availability !== 'ARCHIVED' && !c.products?.some(v => v.id === p.id))
                  .map(p => ({ value: p.id, label: `${p.name} · ${p.sku}` }))}
              />
              <button
                type="button"
                className="a-btn"
                disabled={!productToAdd || action.busy}
                onClick={() =>
                  action.run(async () => {
                    await adminApi(`admin/collections/${id}/products`, 'POST', { productId: productToAdd });
                    setProductToAdd('');
                    refresh();
                  }, 'Piece added to collection.')
                }
              >
                + Add to collection
              </button>
            </div>

            <Table
              rows={c.products || []}
              columns={[
                {
                  title: 'Product',
                  render: p => <RecordLink href={`/admin/products/${p.id}`}>{p.name}</RecordLink>,
                },
                {
                  title: 'Order',
                  render: p => (
                    <OrderButtons
                      rows={c.products || []}
                      index={c.products!.findIndex(v => v.id === p.id)}
                      onSave={async rows => {
                        await adminApi(`admin/collections/${id}/products/order`, 'PATCH', {
                          ids: rows.map(v => v.id),
                        });
                        refresh();
                      }}
                    />
                  ),
                },
                {
                  title: 'Remove',
                  render: p => (
                    <button
                      type="button"
                      className="a-btn a-danger"
                      disabled={action.busy}
                      onClick={() =>
                        action.run(
                          async () => {
                            await adminApi(`admin/collections/${id}/products/${p.id}`, 'DELETE', {});
                            refresh();
                          },
                          'Piece removed from collection.',
                          'Remove this piece from the collection? The piece itself will remain in your catalogue.'
                        )
                      }
                    >
                      Remove
                    </button>
                  ),
                },
              ]}
            />
            <p className="a-muted" style={{ marginTop: '14px', fontSize: '12px' }}>
              This owner list includes all member pieces. The public website displays only published and available pieces.
            </p>
          </Panel>

          <Panel title="Danger Zone · Collection Lifecycle">
            <div className="a-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '13px', color: '#382e25' }}>Archive this collection</strong>
                <span className="a-muted" style={{ fontSize: '12px' }}>
                  Archiving removes the collection from public view and stops further curation.
                </span>
              </div>
              <button
                type="button"
                className="a-btn a-danger"
                disabled={action.busy}
                onClick={() =>
                  action.run(
                    async () => {
                      await adminApi(`admin/collections/${id}`, 'DELETE', { confirm: true });
                      refresh();
                    },
                    'Collection archived.',
                    'Archive this collection? It will be hidden from the website and cannot be restored.'
                  )
                }
              >
                Archive collection
              </button>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
