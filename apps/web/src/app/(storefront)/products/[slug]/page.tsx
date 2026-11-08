import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { product, products, contactOptions } from '@/lib/server-api';
import { money, productPrice } from '@/lib/catalogue';
import type { Product } from '@/lib/types';
import { Gallery } from '@/components/gallery';
import { WishlistButton } from '@/components/wishlist-button';
import { EnquiryForm } from '@/components/request-forms';
import { TryOnEntry } from '@/components/try-on/entry';
import { ProductGrid } from '@/components/cards';
import { Breadcrumbs, ErrorState, SectionHeading, WhatsAppLink } from '@/components/ui';

type Props = { params: Promise<{ slug: string }> };

async function fetchDraftProduct(slug: string): Promise<Product | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('showroom_session')?.value;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const base = process.env.API_INTERNAL_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/api/admin/products/by-slug/${encodeURIComponent(slug)}`, {
      headers: { Cookie: `showroom_session=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return (payload?.data as Product) || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  let p: Product | null = null;
  const result = await product(slug);
  if (result.ok) {
    p = result.value.data;
  } else if (result.status === 404) {
    p = await fetchDraftProduct(slug);
  }
  if (!p) return { title: 'Jewellery unavailable', robots: { index: false } };
  const canonical = `/products/${encodeURIComponent(p.slug)}`;
  return {
    title: p.seoTitle || p.name,
    description: p.seoDescription || p.description.slice(0, 160) || `Discover ${p.name} at Shree Ram Jewellers.`,
    alternates: { canonical },
    openGraph: {
      title: p.name,
      url: canonical,
      images: p.images[0] ? [{ url: p.images[0].url, alt: p.images[0].alt || p.name }] : [],
    },
  };
}

export default async function ProductDetail({ params }: Props) {
  const { slug } = await params;
  let isDraftPreview = false;
  let p: Product | null = null;

  const result = await product(slug);
  if (result.ok) {
    p = result.value.data;
  } else if (result.status === 404) {
    p = await fetchDraftProduct(slug);
    if (p) isDraftPreview = true;
  }

  if (!p) {
    if (!result.ok && result.status === 404) notFound();
    return <div className="wrap section"><h1>Jewellery</h1><ErrorState message={!result.ok ? result.error : 'Product not found.'} href={`/products/${encodeURIComponent(slug)}`} /></div>;
  }

  const [related, contact] = await Promise.all([
    products(`categoryId=${encodeURIComponent(p.category.id)}&limit=5`),
    contactOptions(),
  ]);

  const specs = [
    ['Metal', p.metal.toLowerCase()],
    ['Purity', p.purity],
    ['Gross weight', `${p.grossWeight} g`],
    ['Net weight', `${p.netWeight} g`],
    ['Stone weight', p.stoneWeight == null ? null : `${p.stoneWeight} g`],
    ['Stone details', p.stoneDetails],
    ['Diamonds', p.diamondDetails],
    ['Gemstones', p.gemstoneDetails],
    ['Hallmark', p.hallmark],
    ['HUID', p.huid],
  ];

  return (
    <div className="wrap">
      {isDraftPreview && (
        <div
          style={{
            background: 'linear-gradient(135deg, #382b1d 0%, #251b11 100%)',
            color: '#fffaf0',
            padding: '16px 24px',
            borderRadius: '6px',
            margin: '24px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
            border: '1px solid #c5a059',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                background: '#c5a059',
                color: '#2a1a08',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11.5px',
                letterSpacing: '0.05em',
              }}
            >
              ✦ PRIVATE DRAFT PREVIEW
            </span>
            <span style={{ fontSize: '13px', color: '#f3ece0' }}>
              This piece is currently an unpublished draft and is hidden from public showroom visitors.
            </span>
          </div>
          <div>
            <Link
              href={`/admin/products/${p.id}`}
              className="button"
              style={{
                background: '#c5a059',
                color: '#2a1a08',
                padding: '8px 18px',
                fontSize: '12.5px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              ← Back to Admin Editor
            </Link>
          </div>
        </div>
      )}

      <Breadcrumbs
        items={[
          { label: 'Jewellery', href: '/products' },
          { label: p.category.name, href: `/products?categoryId=${p.category.id}` },
          { label: p.name },
        ]}
      />

      <div className="product-detail">
        <Gallery key={p.id} images={p.images} name={p.name} />
        <div className="product-information">
          <p className="eyebrow">{p.category.name}{p.newArrival ? ' · New arrival' : ''}</p>
          <h1>{p.name}</h1>
          <p className="sku">SKU {p.sku}</p>
          <span className={`availability ${p.availability.toLowerCase()}`}>
            <i aria-hidden="true" />
            {p.availability === 'AVAILABLE' ? 'Available for enquiry' : p.availability === 'RESERVED' ? 'Currently reserved' : 'Sold'}
          </span>
          <p className="detail-price">{productPrice(p)}</p>
          {!p.enquiryOnly && p.publicMakingCharge != null && (
            <p className="small muted">Listed making charge: {money(p.publicMakingCharge)}. Please enquire for the final quotation.</p>
          )}
          {p.description && <p className="product-description">{p.description}</p>}
          {p.availability !== 'AVAILABLE' && (
            <p className="notice">
              {p.availability === 'SOLD'
                ? 'This piece has sold. Ask about a similar design or share a custom enquiry.'
                : 'This piece is reserved. Please ask the showroom about its current availability.'}
            </p>
          )}
          <div className="detail-actions">
            <a href="#product-enquiry" className="button">Enquire about this piece <span aria-hidden="true">↗</span></a>
            <WhatsAppLink
              number={contact.ok ? contact.value.data.whatsappNumber : null}
              message={`Hello Shree Ram Jewellers, I would like to enquire about ${p.name} (SKU: ${p.sku}).`}
            />
            <TryOnEntry productId={p.id} slug={p.slug} />
            <WishlistButton slug={p.slug} name={p.name} full />
          </div>
          <dl className="specifications">
            {specs.filter(([, value]) => value != null && value !== '').map(([name, value]) => (
              <div key={name}><dt>{name}</dt><dd>{value}</dd></div>
            ))}
          </dl>
          <div className="detail-links">
            <Link href="/custom-jewellery">Have your own design in mind? ↗</Link>
            <Link href="/appointments">Request a showroom visit ↗</Link>
          </div>
        </div>
      </div>

      <section className="section enquiry-section" id="product-enquiry">
        <SectionHeading
          eyebrow="Let’s talk details"
          title="A piece on your mind?"
          description="Send a question about this piece directly to the showroom."
        />
        <EnquiryForm
          key={p.id}
          kind="product"
          productId={p.id}
          productName={`${p.name} · ${p.sku}`}
          whatsappEnabled={!!(contact.ok && contact.value.data.whatsappNumber)}
        />
      </section>

      <section className="section">
        <SectionHeading eyebrow="Keep exploring" title="You may also love" href={`/products?categoryId=${p.category.id}`} />
        {related.ok ? (
          <ProductGrid products={related.value.data.filter(item => item.id !== p!.id).slice(0, 4)} empty="More to discover" />
        ) : (
          <ErrorState message={related.error} />
        )}
      </section>
    </div>
  );
}
