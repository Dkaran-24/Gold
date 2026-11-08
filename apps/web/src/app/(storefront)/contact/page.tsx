import { showroomDetails, showroomContactLinks } from '@/lib/showroom-details';
import { ShowroomDetails } from '@/components/showroom-details';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { EnquiryForm } from '@/components/request-forms';
import { Breadcrumbs, WhatsAppLink } from '@/components/ui';
import { contactOptions } from '@/lib/server-api';
export const metadata: Metadata = {
  title: 'Contact the showroom',
  description: 'Contact Shree Ram Jewellers about a piece, a custom design or a showroom visit.',
  alternates: { canonical: '/contact' },
};
export default async function Contact() { const contact = await contactOptions(); const number = contact.ok ? contact.value.data.whatsappNumber : null; return <div className="wrap"><Breadcrumbs items={[{ label: 'Contact' }]} /><div className="form-page"><div className="form-story"><p className="eyebrow">Shree Ram Jewellers</p><h1>Good things start<br />with hello.</h1><p className="intro-copy">A question about a piece? An idea you’d like to explore? We’d love to hear what’s on your mind.</p><div className="contact-block"><h2>Speak with the showroom</h2>{showroomContactLinks(showroomDetails).map(link => <p key={link.href}><a className="text-link" href={link.href}>{link.label}</a></p>)}{number ? <><p className="contact-number">{number}</p><WhatsAppLink number={number} /></> : <p>Use the enquiry form to share your question and preferred way to be contacted.</p>}</div><div className="contact-block"><h2>Thinking of a visit?</h2><ShowroomDetails/><Link href="/appointments" className="text-link">Request an appointment <ArrowUpRight size={16} /></Link></div><div className="contact-block"><h2>Already sent a request?</h2><Link href="/request-status" className="text-link">Check with your private receipt <ArrowUpRight size={16} /></Link></div></div><div className="form-panel"><h2>Leave a little note</h2><EnquiryForm whatsappEnabled={!!number} /></div></div></div>; }
