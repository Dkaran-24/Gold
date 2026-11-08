import type { Metadata } from 'next';
import { StatusForm } from '@/components/status-form';
import { Breadcrumbs, PageIntro } from '@/components/ui';
export const metadata: Metadata = { title: 'Check your request', robots: { index: false, follow: false } };
export default function RequestStatus() { return <div className="wrap section-bottom"><Breadcrumbs items={[{ label: 'Request status' }]} /><PageIntro eyebrow="Stay in touch" title="Your conversation, continued.">Use the reference and private token saved from your receipt. Receipts can be checked for up to 90 days after submission.</PageIntro><div className="status-form-panel"><StatusForm /></div></div>; }
