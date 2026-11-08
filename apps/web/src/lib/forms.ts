import { z } from 'zod';

const contact = {
  name: z.string().trim().min(1, 'Please enter your name.').max(150),
  phone: z.string().trim().regex(/^\+?[1-9][0-9]{7,14}$/, 'Use 8–15 digits, with an optional + country code. No spaces.'),
  email: z.union([z.literal(''), z.email('Please enter a valid email address.').max(254)]),
  consent: z.boolean().refine(v => v, 'Please agree to be contacted about this request.'),
};
export const enquirySchema = z.object({
  ...contact, message: z.string().trim().min(1, 'Please tell us a little about your enquiry.').max(5000),
  jewelleryType: z.string().trim().max(100), preferredContact: z.enum(['PHONE', 'EMAIL', 'WHATSAPP']),
}).refine(v => v.preferredContact !== 'EMAIL' || !!v.email, { path: ['email'], message: 'An email address is needed for an email reply.' });
export const appointmentSchema = z.object({
  ...contact, requestedAt: z.string().min(1, 'Choose your preferred date and time.').refine(v => Number.isFinite(new Date(v).getTime()) && new Date(v).getTime() > Date.now(), 'Please choose a future date and time.'),
  purpose: z.enum(['CONSULTATION', 'BRIDAL', 'CUSTOM', 'PRODUCT_VIEWING', 'PURCHASE', 'OTHER']),
  visitors: z.number().int().min(1).max(20), message: z.string().trim().max(5000),
});
export type EnquiryValues = z.infer<typeof enquirySchema>;
export type AppointmentValues = z.infer<typeof appointmentSchema>;
export function enquiryBody(values: EnquiryValues, kind: 'general' | 'custom' | 'product', productId?: string) {
  const v = enquirySchema.parse(values);
  return { name: v.name, phone: v.phone, ...(v.email ? { email: v.email } : {}), consent: true as const, preferredContact: v.preferredContact, message: v.message,
    ...(kind === 'custom' && v.jewelleryType ? { subject: `Custom jewellery: ${v.jewelleryType}` } : {}),
    ...(kind === 'product' && productId ? { productId } : {}),
  };
}
export function appointmentBody(values: AppointmentValues) {
  const v = appointmentSchema.parse(values);
  return { name: v.name, phone: v.phone, ...(v.email ? { email: v.email } : {}), consent: true as const, purpose: v.purpose, message: v.message, visitors: v.visitors, requestedAt: new Date(v.requestedAt).toISOString() };
}
