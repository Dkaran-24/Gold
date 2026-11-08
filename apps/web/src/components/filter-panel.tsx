'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
export function FilterPanel({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function revealSearch() {
      setOpen(true);
      requestAnimationFrame(() => document.getElementById('catalogue-search')?.focus());
    }
    function onHashChange() { if (window.location.hash === '#catalogue-search') revealSearch(); }
    onHashChange();
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('show-catalogue-search', revealSearch);
    return () => { window.removeEventListener('hashchange', onHashChange); window.removeEventListener('show-catalogue-search', revealSearch); };
  }, []);
  return <><button className="filter-panel-toggle" type="button" aria-expanded={open} aria-controls="catalogue-filter-controls" onClick={() => setOpen(!open)}><SlidersHorizontal size={16} />Filter & sort<ChevronDown size={16} /></button><div id="catalogue-filter-controls" className={`filter-panel-content ${open ? 'is-open' : ''}`}>{children}</div></>;
}
