import type { Metadata } from 'next';
import { CalendarDays } from 'lucide-react';
import { AppointmentForm } from '@/components/request-forms';
import { Breadcrumbs } from '@/components/ui';
import { contactOptions } from '@/lib/server-api';
export const metadata: Metadata = {
  title: 'Request a showroom appointment',
  description: 'Share your preferred date and time for a jewellery consultation. Appointments are subject to showroom confirmation.',
  alternates: { canonical: '/appointments' },
};
export default async function Appointments() { const contact = await contactOptions(); return <div className="wrap"><Breadcrumbs items={[{ label: 'Appointment' }]} /><div className="form-page"><div className="form-story"><p className="eyebrow">A moment, just for you</p><h1>Let’s find<br />your next favourite.</h1><p className="intro-copy">Take a closer look. Ask your questions. Explore what feels right for you.</p><p>Whether you have a particular piece in mind or would like to discuss a new design, share your preferred time for a showroom visit.</p><div className="visit-note"><CalendarDays size={28} strokeWidth={1} /><h2>A request, thoughtfully considered.</h2><p>Submitting this form does not reserve a slot. The showroom will review your preference and contact you to confirm or discuss another time.</p></div></div><div className="form-panel"><h2>Plan a conversation</h2><AppointmentForm showroomTimezone={contact.ok ? contact.value.data.timezone : null} /></div></div></div>; }
