import { z } from 'zod';
import { pageQuery, id } from '../catalogue/validation.js';
export const phone = z.string().trim().regex(/^\+?[1-9][0-9]{7,14}$/);
const text = (n: number) => z.string().trim().max(n);
export const future = z.iso.datetime({ offset: true }).refine(v => new Date(v) > new Date(), 'Time must be in the future');
const contact = { name: text(150).min(1), phone, email: z.email().max(254).optional(), consent: z.literal(true) };
export const enquiryInput = z.object({ ...contact, type: z.enum(['PRODUCT', 'GENERAL', 'CUSTOM', 'CALLBACK']), productId: id.optional(), subject: text(200).optional(), message: text(5000).min(1), preferredContact: z.enum(['PHONE', 'EMAIL', 'WHATSAPP']).default('PHONE'), callbackAt: future.optional(), imageIds: z.array(id).max(5).default([]) }).strict().superRefine((v, ctx) => {
  const error = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (v.type === 'PRODUCT' && !v.productId) error('Product reference required');
  if (v.type !== 'PRODUCT' && v.productId) error('Product reference only permitted for product enquiries');
  if (v.preferredContact === 'EMAIL' && !v.email) error('Email required for email contact');
  if (v.callbackAt && v.type !== 'CALLBACK') error('Callback time only permitted for callback requests');
  if ((v.type !== 'CUSTOM' && v.imageIds.length) || new Set(v.imageIds).size !== v.imageIds.length) error('Invalid inspiration images');
});
export const appointmentInput = z.object({ ...contact, requestedAt: future, alternativeAt: future.optional(), visitors: z.number().int().min(1).max(20).default(1), purpose: z.enum(['CONSULTATION', 'BRIDAL', 'CUSTOM', 'PRODUCT_VIEWING', 'PURCHASE', 'OTHER']), message: text(5000).default(''), productId: id.optional(), collectionId: id.optional() }).strict();
export const enquiryStatus = z.enum(['NEW', 'CONTACTED', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'CONVERTED', 'CLOSED', 'SPAM']);
export const priority = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
export const actionInput = z.object({ action: z.enum(['APPROVE', 'REJECT', 'PROPOSE', 'CONFIRM', 'CANCEL', 'COMPLETE', 'NO_SHOW']), time: future.optional(), reason: text(1000).min(1).optional() }).strict().superRefine((v, ctx) => {
  if (v.action === 'PROPOSE' && !v.time) ctx.addIssue({ code: 'custom', message: 'Proposal time required' });
  if (['REJECT', 'CANCEL'].includes(v.action) && !v.reason) ctx.addIssue({ code: 'custom', message: 'Customer-facing reason required' });
  if (v.time && v.action !== 'PROPOSE') ctx.addIssue({ code: 'custom', message: 'Time is only accepted for proposals' });
});
export const lookupInput = z.object({ reference: z.uuid(), token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const availabilityInput = z.object({
  timezone: z.string().max(100).refine(v => { try { new Intl.DateTimeFormat('en', { timeZone: v }); return true; } catch { return false; } }, 'Valid IANA timezone required'),
  weekly: z.array(z.object({ day: z.number().int().min(0).max(6), open: clock, close: clock }).strict().refine(v => v.close > v.open, 'Closing must follow opening')).max(7).refine(v => new Set(v.map(d => d.day)).size === v.length, 'Duplicate day'),
  durationMinutes: z.number().int().min(5).max(480), bufferMinutes: z.number().int().min(0).max(120), capacity: z.number().int().min(1).max(100),
  closureDates: z.array(z.iso.date()).max(366), whatsappNumber: phone.nullable().optional(),
}).strict();
export const listInput = pageQuery.extend({ search: text(200).optional(), status: text(50).optional(), type: z.enum(['PRODUCT', 'GENERAL', 'CUSTOM', 'CALLBACK']).optional(), from: z.iso.datetime({ offset: true }).optional(), to: z.iso.datetime({ offset: true }).optional(), sort: z.enum(['latest', 'oldest']).default('latest') }).strict().refine(v => !v.from || !v.to || new Date(v.from) <= new Date(v.to), 'Invalid date range');
export const noteInput = z.object({ body: text(5000).min(1) }).strict();
