'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PublicImage } from '@/lib/types';
import { Media } from './media';

export function Gallery({ images, name }: { images: PublicImage[]; name: string }) {
  const [active, setActive] = useState(0);
  const selected = images[active];
  return <div className="gallery"><div className="gallery-main"><Media key={selected?.url || 'empty'} image={selected} alt={name} priority sizes="(max-width: 800px) 100vw, 55vw" />{images.length > 1 && <div className="gallery-controls"><button className="icon-button" type="button" aria-label="Previous photograph" onClick={() => setActive((active + images.length - 1) % images.length)}><ChevronLeft size={20} /></button><span aria-live="polite">{active + 1} / {images.length}</span><button className="icon-button" type="button" aria-label="Next photograph" onClick={() => setActive((active + 1) % images.length)}><ChevronRight size={20} /></button></div>}</div>{images.length > 1 && <div className="gallery-thumbnails" aria-label="Product photographs">{images.map((img, index) => <button type="button" key={`${img.url}-${index}`} onClick={() => setActive(index)} aria-pressed={index === active} aria-label={`Show photograph ${index + 1} of ${name}`}><Media image={img} alt={img.alt || `${name}, photograph ${index + 1}`} sizes="90px" /></button>)}</div>}</div>;
}
