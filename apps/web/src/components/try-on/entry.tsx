'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ScanFace } from 'lucide-react';
import { tryOnRequest } from '@/lib/try-on/client';
import type { TryOnConfig } from '@/lib/try-on/types';

export function TryOnEntry({productId, slug}:{productId:string;slug:string}) {
  const [eligible, setEligible] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setEligible(false);
    tryOnRequest<TryOnConfig>('products/' + encodeURIComponent(productId) + '/config', {signal:controller.signal})
      .then(config => { if (!controller.signal.aborted) setEligible(config.eligible && (config.photoEnabled || config.arEnabled)); })
      .catch(() => { /* The catalogue remains usable if the optional fitting room is unavailable. */ });
    return () => controller.abort();
  }, [productId]);
  return eligible ? <Link className="button button-outline" href={'/try-on/' + encodeURIComponent(slug)}><ScanFace size={17}/> Try It On</Link> : null;
}

