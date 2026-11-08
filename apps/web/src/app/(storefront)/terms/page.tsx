import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs, PageIntro } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description: 'How to use the Shree Ram Jewellers website and confirm a purchase with the showroom.',
  alternates: { canonical: '/terms' },
};

export default function Terms() {
  return <div className="wrap section"><Breadcrumbs items={[{ label: 'Terms and Conditions' }]} /><PageIntro eyebrow="Customer information" title="Terms and Conditions">The website is for exploring jewellery, collections and design ideas. A purchase, reservation or custom piece is confirmed with the showroom, not by browsing this site. Photographs and descriptions are offered to help you choose. Please ask the showroom about the piece you are considering before you decide.</PageIntro><Link className="text-link" href="/contact">Contact the showroom ↗</Link></div>;
}
