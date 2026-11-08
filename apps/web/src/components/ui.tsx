import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { pageHref, whatsappHref } from '@/lib/catalogue';
import type { Pagination } from '@/lib/types';

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) { return <Link className="text-link" href={href}>{children}<ArrowRight size={16} aria-hidden="true" /></Link>; }
export function SectionHeading({ eyebrow, title, description, href, link = 'Explore all' }: { eyebrow?: string; title: string; description?: string | null; href?: string; link?: string }) { return <div className="section-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2>{description && <p className="muted prose">{description}</p>}</div>{href && <TextLink href={href}>{link}</TextLink>}</div>; }
export function PageIntro({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) { return <div className="page-intro">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{children && <div className="intro-copy">{children}</div>}</div>; }
export function EmptyState({ title, children, href, action }: { title: string; children: React.ReactNode; href?: string; action?: string }) { return <div className="empty-state"><span className="empty-mark" aria-hidden="true">✧</span><h3>{title}</h3><p>{children}</p>{href && <TextLink href={href}>{action || 'Explore jewellery'}</TextLink>}</div>; }
export function ErrorState({ message = 'We could not load this information. Please try again shortly.', href }: { message?: string; href?: string }) { return <div className="error-state" role="status"><h3>A little pause</h3><p>{message}</p>{href && <a href={href} className="text-link">Try again <ArrowRight size={16} /></a>}</div>; }
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) { return <nav className="breadcrumbs" aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li>{items.map((item, index) => <li key={index}>{item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</li>)}</ol></nav>; }
export function Pager({ pagination: p, path, query = {} }: { pagination: Pagination; path: string; query?: Record<string, string> }) {
  if (p.pages <= 1 && p.page === 1) return null;
  return <nav className="pagination" aria-label="Pagination">{p.page > 1 ? <Link className="button button-outline" href={pageHref(path, query, Math.min(p.page - 1, Math.max(1, p.pages)))}><ChevronLeft size={16} /> Previous</Link> : <span />}<span>Page {p.page} of {Math.max(1, p.pages)}</span>{p.page < p.pages ? <Link className="button button-outline" href={pageHref(path, query, p.page + 1)}>Next <ChevronRight size={16} /></Link> : <span />}</nav>;
}
export function WhatsAppLink({ number, message = 'Hello Shree Ram Jewellers, I would like to enquire about your jewellery.', label = 'Enquire on WhatsApp', className = 'button button-outline' }: { number?: string | null; message?: string; label?: string; className?: string }) {
  const href = whatsappHref(number, message); return href ? <a className={className} href={href} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden="true" />{label}<span className="sr-only"> (opens WhatsApp in a new tab)</span></a> : null;
}
