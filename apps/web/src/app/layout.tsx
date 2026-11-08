import type { Metadata } from 'next';
import { siteOrigin } from '@/lib/seo';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: { default: 'Shree Ram Jewellers · Jewellery for your story', template: '%s | Shree Ram Jewellers' },
  description: 'Explore jewellery and collections at Shree Ram Jewellers. Save your favourite pieces, discuss a custom design or request a showroom appointment.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-IN" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
