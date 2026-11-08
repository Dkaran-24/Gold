'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Check, Copy, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { appointmentBody, appointmentSchema, enquiryBody, enquirySchema, type AppointmentValues, type EnquiryValues } from '@/lib/forms';
import type { DataResponse, Receipt } from '@/lib/types';

function FieldError({ id, message }: { id: string; message?: string }) { return message ? <span id={id} className="field-error">{message}</span> : null; }
export function ReceiptPanel({ receipt, appointment = false }: { receipt: Receipt; appointment?: boolean }) {
  const panel = useRef<HTMLDivElement>(null); const [copyState, setCopyState] = useState('');
  useEffect(() => { panel.current?.focus(); }, []);
  async function copy() {
    try { await navigator.clipboard.writeText(`Shree Ram Jewellers ${appointment ? 'appointment request' : 'enquiry'}\nReference: ${receipt.reference}\nReceipt token: ${receipt.token}\nKeep this private. Check your request at ${window.location.origin}/request-status`); setCopyState('Receipt copied. Keep it somewhere private.'); }
    catch { setCopyState('Copy is unavailable. Select and save the reference and token below.'); }
  }
  return <div className="receipt-panel" ref={panel} tabIndex={-1}><Check size={32} strokeWidth={1.3} aria-hidden="true" /><p className="eyebrow">{appointment ? 'Request received' : 'Thank you for getting in touch'}</p><h2>{appointment ? 'Your visit starts here.' : 'Let’s make it personal.'}</h2><p>{appointment ? 'Your preferred time has been submitted. This is a request, not a confirmed appointment. The showroom will review it and contact you.' : 'Your enquiry has been received. The showroom can now review the details you shared.'}</p><dl><dt>Reference</dt><dd>{receipt.reference}</dd><dt>Status</dt><dd>{receipt.status.replaceAll('_', ' ')}</dd>{receipt.requestedAt && <><dt>Requested time</dt><dd>{new Date(receipt.requestedAt).toLocaleString()}</dd></>}</dl>{receipt.token && <><p className="small">Save your private receipt before leaving this page. You will need its reference and token to check your request for up to 90 days. The token is shown only once and cannot be recovered here.</p><details><summary>View private receipt token</summary><code className="receipt-token">{receipt.token}</code></details><button type="button" className="button button-outline" onClick={copy}><Copy size={16} />Copy private receipt</button><p role="status" className="small">{copyState}</p></>}<Link href="/request-status" className="text-link">Check a request <ArrowRight size={16} /></Link></div>;
}

export function EnquiryForm({
  kind = 'general',
  productId,
  productName,
  whatsappEnabled = false,
  selectedJewelleryType,
  onTypeSelected,
  submitLabel,
}: {
  kind?: 'general' | 'custom' | 'product';
  productId?: string;
  productName?: string;
  whatsappEnabled?: boolean;
  selectedJewelleryType?: string;
  onTypeSelected?: (type: string) => void;
  submitLabel?: string;
}) {
  const [receipt, setReceipt] = useState<Receipt | null>(null); const [failure, setFailure] = useState('');
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<EnquiryValues>({
    resolver: zodResolver(enquirySchema),
    defaultValues: { name: '', phone: '', email: '', consent: false, message: '', jewelleryType: selectedJewelleryType || '', preferredContact: 'PHONE' }
  });
  const currentType = watch('jewelleryType') || selectedJewelleryType;

  useEffect(() => {
    if (selectedJewelleryType) {
      setValue('jewelleryType', selectedJewelleryType, { shouldValidate: true });
    }
  }, [selectedJewelleryType, setValue]);

  const submit = handleSubmit(async values => { setFailure(''); try { const result = await api<DataResponse<Receipt>>(`/enquiries/${kind}`, enquiryBody(values, kind, productId)); setReceipt(result.data); } catch (error) { setFailure(error instanceof Error ? error.message : 'We could not submit your request.'); } });
  if (receipt) return <ReceiptPanel receipt={receipt} />;

  if (kind === 'custom') {
    return (
      <form method="post" className="request-form bespoke-request-form" onSubmit={submit} noValidate aria-label="Custom jewellery enquiry">
        <div className="bespoke-form-groups">
          <div className="bespoke-form-group">
            <div className="bespoke-group-header">
              <span className="bespoke-group-step">Section A</span>
              <h3>Your details</h3>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="name">Full name *</label>
                <input id="name" required autoComplete="name" maxLength={150} placeholder="Your full name" {...register('name')} aria-invalid={!!errors.name} aria-describedby="name-error" />
                <FieldError id="name-error" message={errors.name?.message} />
              </div>
              <div className="field">
                <label htmlFor="phone">Mobile number *</label>
                <input id="phone" required type="tel" autoComplete="tel" placeholder="+91…" maxLength={16} {...register('phone')} aria-invalid={!!errors.phone} aria-describedby="phone-hint phone-error" />
                <span id="phone-hint" className="field-hint">Include country code; no spaces.</span>
                <FieldError id="phone-error" message={errors.phone?.message} />
              </div>
              <div className="field field-full">
                <label htmlFor="email">Email address <span className="field-optional">(optional, unless replying by email)</span></label>
                <input id="email" type="email" autoComplete="email" placeholder="name@example.com" maxLength={254} {...register('email')} aria-invalid={!!errors.email} aria-describedby="email-error" />
                <FieldError id="email-error" message={errors.email?.message} />
              </div>
            </div>
          </div>

          <div className="bespoke-form-group">
            <div className="bespoke-group-header">
              <span className="bespoke-group-step">Section B</span>
              <h3>Your jewellery idea</h3>
            </div>
            <div className="form-grid">
              <div className="field field-full">
                <label htmlFor="jewelleryType">Jewellery type *</label>
                <div className="bespoke-type-pills" role="group" aria-label="Select jewellery type">
                  {(['Ring', 'Necklace', 'Bracelet', 'Earrings', 'Other'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      className={`bespoke-type-pill ${currentType === type ? 'is-active' : ''}`}
                      onClick={() => {
                        setValue('jewelleryType', type, { shouldValidate: true, shouldDirty: true });
                        onTypeSelected?.(type);
                      }}
                      aria-pressed={currentType === type}
                    >
                      {currentType === type && <Check size={13} aria-hidden="true" />}
                      {type}
                    </button>
                  ))}
                </div>
                <select
                  id="jewelleryType"
                  required
                  {...register('jewelleryType', {
                    required: 'Please select a jewellery type.',
                    onChange: e => onTypeSelected?.(e.target.value),
                  })}
                  aria-invalid={!!errors.jewelleryType}
                  aria-describedby={errors.jewelleryType ? 'jewelleryType-error' : undefined}
                >
                  <option value="">Select jewellery type *</option>
                  <option value="Ring">Ring</option>
                  <option value="Necklace">Necklace</option>
                  <option value="Bracelet">Bracelet</option>
                  <option value="Earrings">Earrings</option>
                  <option value="Other">Other</option>
                </select>
                <FieldError id="jewelleryType-error" message={errors.jewelleryType?.message} />
              </div>
              <div className="field field-full">
                <label htmlFor="preferredContact">Preferred contact method</label>
                <select id="preferredContact" {...register('preferredContact')}>
                  {whatsappEnabled && <option value="WHATSAPP">WhatsApp</option>}
                  <option value="PHONE">Phone call</option>
                  <option value="EMAIL">Email</option>
                </select>
              </div>
              <div className="field field-full">
                <label htmlFor="message">Design description *</label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  maxLength={5000}
                  placeholder="Describe the piece you have in mind — metal (e.g. 22K yellow gold or rose gold), diamonds, gemstones, approximate size, or the special occasion. If you have reference sketches or photographs, mention them here…"
                  {...register('message')}
                  aria-invalid={!!errors.message}
                  aria-describedby="message-error"
                />
                <FieldError id="message-error" message={errors.message?.message} />
              </div>
            </div>
          </div>
        </div>

        <div className="bespoke-form-footer">
          <label className="checkbox-label">
            <input type="checkbox" required {...register('consent')} aria-invalid={!!errors.consent} aria-describedby="consent-error" />
            <span>I agree that Shree Ram Jewellers may use the details I provide to contact me about this enquiry. *</span>
          </label>
          <FieldError id="consent-error" message={errors.consent?.message} />

          {failure && <p className="form-error" role="alert">{failure}</p>}

          <button className="button button-bespoke-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <><LoaderCircle className="spin" size={18} /> Sending enquiry…</>
            ) : (
              <>{submitLabel || 'SEND MY ENQUIRY →'}</>
            )}
          </button>
          <p className="small muted">
            Your enquiry goes directly to our Wadala showroom team. Please avoid sharing payment details or identity documents.
          </p>
        </div>
      </form>
    );
  }

  return <form method="post" className="request-form" onSubmit={submit} noValidate aria-label="Enquiry form">
    {productName && <p className="form-context">Enquiring about <strong>{productName}</strong></p>}
    <p className="small muted">Fields marked * are required.</p>
    <div className="form-grid">
      <div className="field"><label htmlFor="name">Your name *</label><input id="name" required autoComplete="name" maxLength={150} {...register('name')} aria-invalid={!!errors.name} aria-describedby="name-error" /><FieldError id="name-error" message={errors.name?.message} /></div>
      <div className="field"><label htmlFor="phone">Phone number *</label><input id="phone" required type="tel" autoComplete="tel" placeholder="+91…" maxLength={16} {...register('phone')} aria-invalid={!!errors.phone} aria-describedby="phone-hint phone-error" /><span id="phone-hint" className="field-hint">Include country code; no spaces.</span><FieldError id="phone-error" message={errors.phone?.message} /></div>
      <div className="field"><label htmlFor="email">Email address <span>(optional, unless replying by email)</span></label><input id="email" type="email" autoComplete="email" maxLength={254} {...register('email')} aria-invalid={!!errors.email} aria-describedby="email-error" /><FieldError id="email-error" message={errors.email?.message} /></div>
      <div className="field"><label htmlFor="preferredContact">How should we reply?</label><select id="preferredContact" {...register('preferredContact')}><option value="PHONE">Phone call</option><option value="EMAIL">Email</option>{whatsappEnabled && <option value="WHATSAPP">WhatsApp</option>}</select></div>
      <div className="field field-full"><label htmlFor="message">How can we help? *</label><textarea id="message" required rows={6} maxLength={5000} placeholder="Share a little about what you are looking for…" {...register('message')} aria-invalid={!!errors.message} aria-describedby="message-error" /><FieldError id="message-error" message={errors.message?.message} /></div>
    </div>
    <label className="checkbox-label"><input type="checkbox" required {...register('consent')} aria-invalid={!!errors.consent} aria-describedby="consent-error" /><span>I agree that Shree Ram Jewellers may use the details I provide to contact me about this enquiry. *</span></label><FieldError id="consent-error" message={errors.consent?.message} />
    {failure && <p className="form-error" role="alert">{failure}</p>}
    <button className="button" type="submit" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle className="spin" size={18} /> Sending enquiry…</> : <>Send enquiry <ArrowRight size={17} /></>}</button><p className="small muted">Your enquiry goes directly to the showroom. Please avoid sharing payment details or identity documents.</p>
  </form>;
}

export function AppointmentForm({ showroomTimezone }: { showroomTimezone?: string | null }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null); const [failure, setFailure] = useState(''); const [timezone, setTimezone] = useState('your device’s local timezone');
  useEffect(() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AppointmentValues>({ resolver: zodResolver(appointmentSchema), defaultValues: { name: '', phone: '', email: '', consent: false, requestedAt: '', purpose: 'CONSULTATION', visitors: 1, message: '' } });
  const submit = handleSubmit(async values => { setFailure(''); try { const result = await api<DataResponse<Receipt>>('/appointments', appointmentBody(values)); setReceipt(result.data); } catch (error) { setFailure(error instanceof Error ? error.message : 'We could not submit your request.'); } });
  if (receipt) return <ReceiptPanel receipt={receipt} appointment />;
  return <form method="post" className="request-form" onSubmit={submit} noValidate aria-label="Appointment request"><p className="small muted">Fields marked * are required.</p><div className="form-grid">
    <div className="field"><label htmlFor="name">Your name *</label><input id="name" required autoComplete="name" maxLength={150} {...register('name')} aria-invalid={!!errors.name} aria-describedby="name-error" /><FieldError id="name-error" message={errors.name?.message} /></div>
    <div className="field"><label htmlFor="phone">Phone number *</label><input id="phone" required type="tel" autoComplete="tel" placeholder="+91…" maxLength={16} {...register('phone')} aria-invalid={!!errors.phone} aria-describedby="phone-error phone-hint" /><span id="phone-hint" className="field-hint">Include country code; no spaces.</span><FieldError id="phone-error" message={errors.phone?.message} /></div>
    <div className="field field-full"><label htmlFor="email">Email address <span>(optional)</span></label><input id="email" type="email" autoComplete="email" maxLength={254} {...register('email')} aria-invalid={!!errors.email} aria-describedby="email-error" /><FieldError id="email-error" message={errors.email?.message} /></div>
    <div className="field field-full"><label htmlFor="requestedAt">Preferred date & time *</label><input id="requestedAt" required type="datetime-local" {...register('requestedAt')} aria-invalid={!!errors.requestedAt} aria-describedby="time-hint time-error" /><span id="time-hint" className="field-hint">Enter your local time ({timezone}).{showroomTimezone && ` Showroom timezone: ${showroomTimezone}.`} This is a preference, subject to showroom confirmation.</span><FieldError id="time-error" message={errors.requestedAt?.message} /></div>
    <div className="field"><label htmlFor="purpose">What brings you in? *</label><select id="purpose" required {...register('purpose')}><option value="CONSULTATION">Jewellery consultation</option><option value="BRIDAL">Bridal jewellery</option><option value="CUSTOM">Custom design</option><option value="PRODUCT_VIEWING">View a piece</option><option value="PURCHASE">Purchase enquiry</option><option value="OTHER">Something else</option></select></div>
    <div className="field"><label htmlFor="visitors">Number of visitors *</label><input id="visitors" required type="number" min={1} max={20} {...register('visitors', { valueAsNumber: true })} aria-invalid={!!errors.visitors} aria-describedby="visitors-error" /><FieldError id="visitors-error" message={errors.visitors?.message} /></div>
    <div className="field field-full"><label htmlFor="message">Anything you’d like us to know? <span>(optional)</span></label><textarea id="message" rows={4} maxLength={5000} {...register('message')} aria-invalid={!!errors.message} aria-describedby="message-error" /><FieldError id="message-error" message={errors.message?.message} /></div>
    </div><label className="checkbox-label"><input type="checkbox" required {...register('consent')} aria-invalid={!!errors.consent} aria-describedby="consent-error" /><span>I agree that Shree Ram Jewellers may use my details to contact me about this appointment request. *</span></label><FieldError id="consent-error" message={errors.consent?.message} />{failure && <p className="form-error" role="alert">{failure}</p>}<button className="button" type="submit" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle className="spin" size={18} /> Sending request…</> : <>Request an appointment <ArrowRight size={17} /></>}</button><p className="small muted">Please wait for the showroom to confirm a time before planning your visit.</p></form>;
}
