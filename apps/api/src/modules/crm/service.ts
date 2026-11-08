import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient, type Enquiry, type Appointment } from '@showroom/database';
import { z } from 'zod';
import { digest } from '../../auth.js';
import { ApiError } from '../../errors.js';
import { publicWhere } from '../catalogue/service.js';
import { visibleCollection } from '../cms/service.js';
import { enquiryInput, appointmentInput, availabilityInput, actionInput } from './validation.js';
type Tx = Prisma.TransactionClient;
export function locked<T>(db: PrismaClient, work: (tx: Tx) => Promise<T>) { return db.$transaction(async tx => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(509555)`; return work(tx); }, { timeout: 15000 }); }
export const log = (tx: Tx, entity: string, entityId: string, action: string, actorId?: string, metadata?: Prisma.InputJsonValue) => tx.auditLog.create({ data: { entity, entityId, action, actorId, metadata } });
export const receipt = () => { const token = randomBytes(32).toString('hex'); return { reference: randomUUID(), token, lookupTokenHash: digest(token) }; };
export function safeEnquiry(e: Enquiry) { return { reference: e.reference, status: ['CLOSED', 'CONVERTED', 'SPAM', 'NOT_INTERESTED'].includes(e.status) ? 'CLOSED' : e.status === 'NEW' ? 'RECEIVED' : 'IN_REVIEW', type: e.type, productName: e.productName, productSku: e.productSku, receivedAt: e.createdAt, summary: e.productName ? `Enquiry about ${e.productName} (${e.productSku})` : 'Showroom enquiry received' }; }
export function safeAppointment(a: Appointment) { return { reference: a.reference, status: a.status === 'PENDING' ? 'REQUESTED' : a.status, requestedAt: a.requestedAt, proposedAt: a.proposedAt, scheduledAt: a.scheduledAt, endsAt: a.endsAt, reason: a.publicReason, summary: a.status === 'APPROVED' ? 'Showroom appointment confirmed' : a.status === 'RESCHEDULE_PROPOSED' ? 'Alternative time proposed; awaiting owner confirmation' : 'Showroom appointment request status' }; }
export async function submitEnquiry(db: PrismaClient, input: z.infer<typeof enquiryInput>) {
  const { token, ...access } = receipt();
  const result = await db.$transaction(async tx => {
    const product = input.productId ? await tx.product.findFirst({ where: { id: input.productId, ...publicWhere } }) : null;
    if (input.productId && !product) throw new ApiError(422, 'INVALID_REFERENCE', 'Selected jewellery is unavailable.');
    for (const imageId of input.imageIds) if (!await tx.productImage.findFirst({ where: { id: imageId, product: publicWhere } })) throw new ApiError(422, 'INVALID_REFERENCE', 'Selected inspiration image is unavailable.');
    const { consent: _consent, imageIds, ...data } = input;
    const e = await tx.enquiry.create({ data: { ...data, ...access, consentAt: new Date(), source: 'WEBSITE', productSku: product?.sku, productName: product?.name, inspirationImages: { create: imageIds.map(imageId => ({ imageId })) } } });
    await tx.enquiryHistory.create({ data: { enquiryId: e.id, next: 'NEW' } }); await log(tx, 'Enquiry', e.id, 'ENQUIRY_CREATED'); return e;
  }); return { ...safeEnquiry(result), token };
}
export async function submitAppointment(db: PrismaClient, input: z.infer<typeof appointmentInput>) {
  const { token, ...access } = receipt();
  const result = await db.$transaction(async tx => {
    if (input.productId && !await tx.product.findFirst({ where: { id: input.productId, ...publicWhere } })) throw new ApiError(422, 'INVALID_REFERENCE', 'Selected jewellery is unavailable.');
    if (input.collectionId && !await tx.collection.findFirst({ where: { id: input.collectionId, ...visibleCollection } })) throw new ApiError(422, 'INVALID_REFERENCE', 'Selected collection is unavailable.');
    const { consent: _consent, ...data } = input;
    const a = await tx.appointment.create({ data: { ...data, ...access, consentAt: new Date(), status: 'REQUESTED' } });
    await history(tx, a, null, 'CREATED'); await log(tx, 'Appointment', a.id, 'APPOINTMENT_CREATED'); return a;
  }); return { ...safeAppointment(result), token };
}
export const transitions: Record<string, string[]> = {
  NEW: ['CONTACTED', 'IN_PROGRESS', 'CLOSED', 'SPAM'], CONTACTED: ['IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'CONVERTED', 'CLOSED', 'SPAM'],
  IN_PROGRESS: ['WAITING_FOR_CUSTOMER', 'CONTACTED', 'CONVERTED', 'CLOSED', 'SPAM'], WAITING_FOR_CUSTOMER: ['IN_PROGRESS', 'CONTACTED', 'CONVERTED', 'CLOSED', 'SPAM'],
  CONVERTED: ['IN_PROGRESS'], CLOSED: ['IN_PROGRESS'], SPAM: ['NEW'], INTERESTED: ['IN_PROGRESS', 'CONVERTED', 'CLOSED'], FOLLOW_UP: ['IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'CLOSED'], NOT_INTERESTED: ['IN_PROGRESS'],
};
export function transition(from: string, to: string) { if (!transitions[from]?.includes(to)) throw new ApiError(409, 'INVALID_TRANSITION', 'This status transition is not permitted.'); }
export function localTime(date: Date, timezone: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(date).map(p => [p.type, p.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday!), minutes: Number(p.hour) * 60 + Number(p.minute) };
}
const minutes = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
export function timeWindow(time: Date, config: z.infer<typeof availabilityInput>, now = new Date()) {
  if (time <= now || time.getUTCSeconds() || time.getUTCMilliseconds()) throw new ApiError(422, 'INVALID_TIME', 'Choose a future time at minute precision.');
  const start = localTime(time, config.timezone); const day = config.weekly.find(d => d.day === start.day);
  const endsAt = new Date(time.getTime() + config.durationMinutes * 60000); const occupiedUntil = new Date(endsAt.getTime() + config.bufferMinutes * 60000); const end = localTime(occupiedUntil, config.timezone);
  if (!day || config.closureDates.includes(start.date) || start.date !== end.date || start.minutes < minutes(day.open) || end.minutes > minutes(day.close) || (start.minutes - minutes(day.open)) % (config.durationMinutes + config.bufferMinutes) !== 0) throw new ApiError(409, 'OUTSIDE_AVAILABILITY', 'Time is outside the configured appointment slots.');
  return { endsAt, occupiedUntil };
}
async function reserve(tx: Tx, appointmentId: string, time: Date) {
  const row = await tx.showroomAvailability.findUnique({ where: { id: 1 } });
  if (!row) throw new ApiError(503, 'AVAILABILITY_NOT_CONFIGURED', 'Owner must configure appointment availability before confirming visits.');
  const config = availabilityInput.parse({ timezone: row.timezone, weekly: row.weekly, durationMinutes: row.durationMinutes, bufferMinutes: row.bufferMinutes, capacity: row.capacity, closureDates: row.closureDates, whatsappNumber: row.whatsappNumber });
  const window = timeWindow(time, config);
  const bookingStatuses = ['APPROVED', 'RESCHEDULE_PROPOSED'] as const;
  if (await tx.appointment.count({ where: { id: { not: appointmentId }, status: { in: [...bookingStatuses] }, scheduledAt: { not: null }, occupiedUntil: null } })) throw new ApiError(409, 'LEGACY_BOOKING_REVIEW', 'Existing bookings require capacity review.');
  const overlap = await tx.appointment.findMany({ where: { id: { not: appointmentId }, status: { in: [...bookingStatuses] }, scheduledAt: { lt: window.occupiedUntil }, occupiedUntil: { gt: time } }, select: { scheduledAt: true, occupiedUntil: true } });
  const events = overlap.flatMap(a => [{ time: Math.max(time.getTime(), a.scheduledAt!.getTime()), n: 1 }, { time: Math.min(window.occupiedUntil.getTime(), a.occupiedUntil!.getTime()), n: -1 }]).sort((a, b) => a.time - b.time || a.n - b.n);
  let occupied = 0; for (const event of events) { occupied += event.n; if (occupied >= config.capacity) throw new ApiError(409, 'SLOT_FULL', 'This appointment slot is full.'); }
  return window;
}
async function history(tx: Tx, a: Appointment, previous: Appointment['status'] | null, action: string, actorId?: string, reason?: string) {
  await tx.appointmentHistory.create({ data: { appointmentId: a.id, previous, next: a.status, action, actorId, requestedAt: a.requestedAt, proposedAt: a.proposedAt, scheduledAt: a.scheduledAt, endsAt: a.endsAt, reason } });
}
export async function appointmentAction(db: PrismaClient, appointmentId: string, ownerId: string, input: z.infer<typeof actionInput>) {
  return locked(db, async tx => {
    const a = await tx.appointment.findUnique({ where: { id: appointmentId } }); if (!a) throw new ApiError(404, 'NOT_FOUND', 'Appointment not found.');
    const allowed: Record<string, string[]> = { APPROVE: ['REQUESTED', 'PENDING'], REJECT: ['REQUESTED', 'PENDING', 'RESCHEDULE_PROPOSED'], PROPOSE: ['REQUESTED', 'PENDING', 'APPROVED', 'RESCHEDULE_PROPOSED'], CONFIRM: ['RESCHEDULE_PROPOSED'], CANCEL: ['REQUESTED', 'PENDING', 'APPROVED', 'RESCHEDULE_PROPOSED'], COMPLETE: ['APPROVED'], NO_SHOW: ['APPROVED'] };
    if (!allowed[input.action]!.includes(a.status)) throw new ApiError(409, 'INVALID_TRANSITION', 'This appointment action is not permitted.');
    let data: Prisma.AppointmentUpdateInput;
    if (input.action === 'APPROVE' || input.action === 'CONFIRM') {
      const time = input.action === 'APPROVE' ? a.requestedAt : a.proposedAt;
      if (!time) throw new ApiError(409, 'INVALID_TIME', 'No proposed time exists.');
      data = { status: 'APPROVED', scheduledAt: time, ...await reserve(tx, a.id, time), publicReason: null };
    } else if (input.action === 'PROPOSE') {
      // Proposals are checked for opening rules but do not consume capacity until confirmation.
      const row = await tx.showroomAvailability.findUnique({ where: { id: 1 } });
      if (!row) throw new ApiError(503, 'AVAILABILITY_NOT_CONFIGURED', 'Configure availability first.');
      timeWindow(new Date(input.time!), { ...row, weekly: row.weekly as z.infer<typeof availabilityInput>['weekly'] });
      data = { status: 'RESCHEDULE_PROPOSED', proposedAt: new Date(input.time!), publicReason: input.reason ?? null };
    } else {
      if (['COMPLETE', 'NO_SHOW'].includes(input.action) && (!a.scheduledAt || a.scheduledAt > new Date())) throw new ApiError(409, 'TOO_EARLY', 'Appointment has not started.');
      const states = { REJECT: 'REJECTED', CANCEL: 'CANCELLED', COMPLETE: 'COMPLETED', NO_SHOW: 'NO_SHOW' } as const;
      data = { status: states[input.action as keyof typeof states], publicReason: input.reason ?? null };
    }
    const updated = await tx.appointment.update({ where: { id: a.id }, data });
    await history(tx, updated, a.status, input.action, ownerId, input.reason); await log(tx, 'Appointment', a.id, input.action, ownerId); return updated;
  });
}
