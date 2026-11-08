'use client';

import { getImageProps } from 'next/image';
import { Gem } from 'lucide-react';
import { useState } from 'react';
import { safeImageUrl } from '@/lib/catalogue';
import type { PublicImage } from '@/lib/types';

export function Media({ image, mobileImage, alt, priority = false, sizes = '(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 25vw', className = '' }: { image?: PublicImage | null; mobileImage?: PublicImage | null; alt: string; priority?: boolean; sizes?: string; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const url = safeImageUrl(image?.url), mobileUrl = safeImageUrl(mobileImage?.url);
  if (!url || failed === url) return <div className={`media image-fallback ${className}`} role="img" aria-label={`${alt}. Photograph unavailable.`}><Gem size={42} strokeWidth={0.8} aria-hidden="true" /><span>Photograph unavailable</span></div>;
  const isCloudinary = (src: string) => {
    try {
      return new URL(src, 'https://localhost').hostname === 'res.cloudinary.com';
    } catch {
      return false;
    }
  };
  const propsFor = (src: string) => getImageProps({ src, alt: image?.alt || alt, fill: true, sizes, loading: priority ? 'eager' : 'lazy', fetchPriority: priority ? 'high' : 'auto', unoptimized: !isCloudinary(src) }).props;
  const props = propsFor(url);
  return <div className={`media ${className}`}><picture>{mobileUrl && <source media="(max-width: 600px)" srcSet={propsFor(mobileUrl).srcSet || mobileUrl} sizes={sizes} />}<img {...props} onError={() => setFailed(url)} /></picture></div>;
}
