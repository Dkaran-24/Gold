'use client';

import { Heart } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { readWishlist } from '@/lib/catalogue';

const key = 'shree-ram:wishlist:v1';
let memory: string[] | null = null;
let memoryOnly = false;
export function useWishlist() {
  const [items, setItems] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    function sync(event?: Event) { if (memory === null || (event?.type === 'storage' && !memoryOnly)) { try { memory = readWishlist(localStorage.getItem(key)); } catch { memoryOnly = true; } } setItems(memory || []); setReady(true); }
    sync(); window.addEventListener('storage', sync); window.addEventListener('wishlist-change', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('wishlist-change', sync); };
  }, []);
  const toggle = useCallback((slug: string) => {
    let current = memory || [];
    if (!memoryOnly) { try { current = readWishlist(localStorage.getItem(key)); } catch { memoryOnly = true; } }
    if (!current.includes(slug) && current.length >= 100) { setNotice('Your wishlist has 100 pieces. Remove one before adding another.'); return; }
    memory = current.includes(slug) ? current.filter(v => v !== slug) : [...current, slug];
    try { localStorage.setItem(key, JSON.stringify(memory)); setNotice(''); }
    catch { memoryOnly = true; setNotice('Saved for this visit. Your browser is preventing persistent storage.'); }
    setItems(memory); window.dispatchEvent(new Event('wishlist-change'));
  }, []);
  return { items, ready, toggle, notice };
}
export function WishlistButton({ slug, name, full = false }: { slug: string; name: string; full?: boolean }) {
  const { items, toggle, ready, notice } = useWishlist(); const saved = items.includes(slug);
  return <><button type="button" className={full ? 'button button-outline' : 'icon-button wishlist-toggle'} aria-label={`${saved ? 'Remove' : 'Save'} ${name}${saved ? ' from' : ' to'} wishlist`} aria-pressed={saved} disabled={!ready} onClick={() => toggle(slug)}><Heart size={19} fill={saved ? 'currentColor' : 'none'} strokeWidth={1.5} />{full && (saved ? 'Saved to wishlist' : 'Save to wishlist')}</button>{notice && <span className="storage-notice" role="status">{notice}</span>}</>;
}
export function WishlistCount() { const { items } = useWishlist(); return items.length ? <span className="wish-count">{items.length}<span className="sr-only"> saved pieces</span></span> : null; }
