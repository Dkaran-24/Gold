import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs, PageIntro } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Shree Ram Jewellers handles enquiries and showroom conversations.',
  alternates: { canonical: '/privacy' },
};

export default function Privacy() {
  return <div className="wrap section"><Breadcrumbs items={[{ label: 'Privacy Policy' }]} /><PageIntro eyebrow="Customer information" title="Privacy Policy">Enquiries, appointment requests and messages you send are used to respond to you and to look after your visit to Shree Ram Jewellers. We do not publish those details on the website. For a question about the information you have shared, contact the Wadala showroom.</PageIntro><Link className="text-link" href="/contact">Contact the showroom ↗</Link></div>;
}
