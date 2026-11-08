'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Heart, MapPin, Menu, Search, X } from 'lucide-react';
import { WishlistCount } from './wishlist-button';

export interface NavLink { href: string; label: string }

const links = [
  { href: '/products', label: 'Jewellery', menu: 'categories' as const },
  { href: '/collections', label: 'Collections', menu: 'collections' as const },
  { href: '/custom-jewellery', label: 'VIRTUAL TRY-ON' },
  { href: '/about', label: 'Our story' },
  { href: '/contact', label: 'Contact' },
];

export function SiteHeader({ categories = [], collections = [] }: { categories?: NavLink[]; collections?: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [pathname]);
  const menus = { categories, collections };
  return <header className="site-header" onKeyDown={event => { if (event.key === 'Escape' && open) { setOpen(false); menuRef.current?.focus(); } }}>
    <div className="announcement"><span className="announcement-gem" aria-hidden="true">✦</span><span>A piece for every chapter of your story</span><span className="announcement-gem" aria-hidden="true">✦</span></div>
    <div className="header-main wrap">
      <button ref={menuRef} type="button" className="icon-button menu-button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
      <Link href="/" className="wordmark" aria-label="Shree Ram Jewellers home"><span className="brand-symbol" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" fill="currentColor"/><circle cx="12" cy="10" r="1.5" fill="#FAF5EC"/></svg></span><span className="wordmark-text">SHREE RAM<small>JEWELLERS</small></span></Link>
      <nav id="main-navigation" className={`main-navigation ${open ? 'is-open' : ''}`} aria-label="Main navigation">
        {links.map(item => {
          const children = item.menu ? menus[item.menu] : [];
          const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
          if (!children.length) return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={current ? 'page' : undefined}>{item.label}</Link>;
          return <div key={item.href} className="nav-drop"><Link href={item.href} onClick={() => setOpen(false)} aria-current={current ? 'page' : undefined}>{item.label} <ChevronDown className="nav-caret" size={14} aria-hidden="true" /></Link><div className="nav-drop-panel">{children.map(child => <Link key={child.href} href={child.href} onClick={() => setOpen(false)}>{child.label}</Link>)}</div></div>;
        })}
        <Link href="/appointments" className="mobile-appointment">Visit the showroom</Link>
      </nav>
      <div className="header-actions"><Link className="icon-button" href="/products#catalogue-search" onClick={() => window.dispatchEvent(new Event('show-catalogue-search'))} aria-label="Search jewellery"><Search size={19} strokeWidth={1.5} /></Link><Link className="icon-button" href="/wishlist" aria-label="Your wishlist"><Heart size={19} strokeWidth={1.5} /><WishlistCount /></Link><Link className="visit-link" href="/appointments"><MapPin size={14} aria-hidden="true" /> <span>Visit the showroom</span></Link></div>
    </div>
  </header>;
}
