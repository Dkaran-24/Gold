import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { productPrice } from '@/lib/catalogue';
import type { Collection, Product } from '@/lib/types';
import { Media } from './media';
import { WishlistButton } from './wishlist-button';
import { EmptyState } from './ui';

const availability = { AVAILABLE: 'Available', RESERVED: 'Reserved', SOLD: 'Sold' };
export function ProductCard({ product: p }: { product: Product }) {
  return <article className="product-card"><div className="product-visual"><Link href={`/products/${p.slug}`} aria-label={`View ${p.name}`}><Media image={p.images.find(i => i.isPrimary) || p.images[0]} alt={p.name} /></Link><WishlistButton slug={p.slug} name={p.name} />{(p.newArrival || p.exclusive) && <span className="product-tag">{p.newArrival ? 'New arrival' : 'Exclusive'}</span>}</div><div className="product-meta"><p className="product-category">{p.category.name} <span>·</span> {p.purity} {p.metal.toLowerCase()}</p><h3><Link href={`/products/${p.slug}`}>{p.name}</Link></h3><div className="product-bottom"><span>{productPrice(p)}</span><span className={`availability ${p.availability.toLowerCase()}`}><i aria-hidden="true" />{availability[p.availability]}</span></div><div className="product-card-actions"><Link href={`/products/${p.slug}`} aria-label={`View details of ${p.name}`}>View details <span aria-hidden="true">↗</span></Link><Link href={`/products/${p.slug}#product-enquiry`} aria-label={`Enquire about ${p.name}`}>Enquire</Link></div></div></article>;
}
export function ProductGrid({ products, empty = 'No pieces to show just yet', description = 'Explore another category, or tell us what you have in mind.', href = '/contact', action = 'Make an enquiry' }: { products: Product[]; empty?: string; description?: string; href?: string; action?: string }) { return products.length ? <div className="product-grid">{products.map(p => <ProductCard key={p.id} product={p} />)}</div> : <EmptyState title={empty} href={href} action={action}>{description}</EmptyState>; }
export function CollectionCard({ collection: c }: { collection: Collection }) { return <Link href={`/collections/${c.slug}`} className="collection-card"><Media image={c.coverImage || c.bannerImage} alt={c.name} sizes="(max-width: 700px) 100vw, 50vw" /><div className="collection-caption"><div>{c.bridal && <p className="eyebrow">The bridal edit</p>}<h3>{c.name}</h3>{c.description && <p>{c.description}</p>}</div><ArrowUpRight size={25} strokeWidth={1} aria-hidden="true" /></div></Link>; }
