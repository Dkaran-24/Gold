import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { Prisma, EnquiryStatus, AppointmentStatus, type PrismaClient } from '@showroom/database';
import { requireOwner, digest } from '../../auth.js';
import { ApiError } from '../../errors.js';
import { id, pageQuery } from '../catalogue/validation.js';
import { enquiryInput, appointmentInput, lookupInput, enquiryStatus, priority, noteInput, listInput, actionInput, availabilityInput } from './validation.js';
import { submitEnquiry, submitAppointment, safeEnquiry, safeAppointment, locked, log, transition, appointmentAction } from './service.js';

const notFound = () => new ApiError(404, 'NOT_FOUND', 'Record not found or verification failed.');
const redact = <T extends { lookupTokenHash: string | null }>(v: T) => { const { lookupTokenHash: _secret, ...data } = v; return data; };
export function crmRoutes(db: PrismaClient) {
  const router = Router(); router.use('/admin', requireOwner(db));
  router.use((_req, res, next) => {
    if (!res.hasHeader('Cache-Control')) res.set('Cache-Control', 'no-store');
    next();
  });
  const message = { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } };
  const submissions = rateLimit({ windowMs: 15 * 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message });
  const lookups = rateLimit({ windowMs: 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message });
  for (const type of ['PRODUCT', 'GENERAL', 'CUSTOM', 'CALLBACK'] as const) router.post(`/enquiries/${type.toLowerCase()}`, submissions, async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || 'type' in req.body) throw new ApiError(422, 'VALIDATION_ERROR', 'Use the enquiry endpoint to select its type.');
    res.status(201).json({ data: await submitEnquiry(db, enquiryInput.parse({ ...req.body, type })) });
  });
  router.post('/appointments', submissions, async (req, res) => res.status(201).json({ data: await submitAppointment(db, appointmentInput.parse(req.body)) }));
  for (const kind of ['enquiries', 'appointments'] as const) {
    const enquiry = kind === 'enquiries';
    router.post(`/${kind}/status`, lookups, async (req, res) => {
      const input = lookupInput.parse(req.body); const where = { reference: input.reference, lookupTokenHash: digest(input.token), createdAt: { gte: new Date(Date.now() - 90 * 86400000) } };
      const data = enquiry ? await db.enquiry.findFirst({ where }) : await db.appointment.findFirst({ where });
      if (!data) throw notFound();
      res.json({ data: enquiry ? safeEnquiry(data as Awaited<ReturnType<typeof db.enquiry.findFirstOrThrow>>) : safeAppointment(data as Awaited<ReturnType<typeof db.appointment.findFirstOrThrow>>) });
    });
    router.get(`/admin/${kind}`, async (req, res) => {
      const q = listInput.parse(req.query);
      if (!enquiry && q.type) throw new ApiError(422, 'VALIDATION_ERROR', 'Enquiry type does not apply to appointments.');
      const date = q.from || q.to ? { createdAt: { gte: q.from, lte: q.to } } : {};
      const search = q.search ? { OR: (enquiry ? ['name', 'phone', 'reference', 'productName', 'productSku', 'subject'] : ['name', 'phone', 'reference', 'purpose']).map(field => ({ [field]: { contains: q.search, mode: 'insensitive' as const } })) } : {};
      const args = { orderBy: [{ createdAt: q.sort === 'oldest' ? 'asc' as const : 'desc' as const }, { id: 'asc' as const }], skip: (q.page - 1) * q.limit, take: q.limit };
      const result = await db.$transaction(async tx => {
        if (enquiry) { const where: Prisma.EnquiryWhereInput = { ...date, ...search, type: q.type, status: q.status ? z.enum(EnquiryStatus).parse(q.status) : undefined }; return { data: (await tx.enquiry.findMany({ ...args, where })).map(redact), total: await tx.enquiry.count({ where }) }; }
        const where: Prisma.AppointmentWhereInput = { ...date, ...search, status: q.status ? z.enum(AppointmentStatus).parse(q.status) : undefined }; return { data: (await tx.appointment.findMany({ ...args, where })).map(redact), total: await tx.appointment.count({ where }) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }); res.json({ data: result.data, pagination: { page: q.page, limit: q.limit, total: result.total, pages: Math.ceil(result.total / q.limit) } });
    });
    router.get(`/admin/${kind}/:id`, async (req, res) => {
      const key = id.parse(req.params.id);
      const data = enquiry ? await db.enquiry.findUnique({ where: { id: key }, include: { inspirationImages: { include: { image: { select: { id: true, url: true, alt: true } } } } } }) : await db.appointment.findUnique({ where: { id: key } });
      if (!data) throw notFound(); res.json({ data: redact(data) });
    });
    router.post(`/admin/${kind}/:id/notes`, async (req, res) => {
      const key = id.parse(req.params.id); const { body } = noteInput.parse(req.body);
      const data = await locked(db, async tx => {
        if (!await (enquiry ? tx.enquiry.findUnique({ where: { id: key } }) : tx.appointment.findUnique({ where: { id: key } }))) throw notFound();
        const note = enquiry ? await tx.enquiryNote.create({ data: { enquiryId: key, authorId: res.locals.ownerId, body } }) : await tx.appointmentNote.create({ data: { appointmentId: key, authorId: res.locals.ownerId, body } });
        await log(tx, enquiry ? 'Enquiry' : 'Appointment', key, 'NOTE_ADDED', res.locals.ownerId); return note;
      }); res.status(201).json({ data });
    });
    for (const resource of ['notes', 'history', 'activity'] as const) router.get(`/admin/${kind}/:id/${resource}`, async (req, res) => {
      const key = id.parse(req.params.id); const q = pageQuery.strict().parse(req.query);
      const args = { orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }], skip: (q.page - 1) * q.limit, take: q.limit };
      const result = await db.$transaction(async tx => {
        if (!await (enquiry ? tx.enquiry.findUnique({ where: { id: key } }) : tx.appointment.findUnique({ where: { id: key } }))) throw notFound();
        if (resource === 'activity') { const where = { entity: enquiry ? 'Enquiry' : 'Appointment', entityId: key }; return { data: await tx.auditLog.findMany({ ...args, where }), total: await tx.auditLog.count({ where }) }; }
        if (enquiry) { const where = { enquiryId: key }; return resource === 'notes' ? { data: await tx.enquiryNote.findMany({ ...args, where }), total: await tx.enquiryNote.count({ where }) } : { data: await tx.enquiryHistory.findMany({ ...args, where }), total: await tx.enquiryHistory.count({ where }) }; }
        const where = { appointmentId: key }; return resource === 'notes' ? { data: await tx.appointmentNote.findMany({ ...args, where }), total: await tx.appointmentNote.count({ where }) } : { data: await tx.appointmentHistory.findMany({ ...args, where }), total: await tx.appointmentHistory.count({ where }) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }); res.json({ data: result.data, pagination: { page: q.page, limit: q.limit, total: result.total, pages: Math.ceil(result.total / q.limit) } });
    });
  }
  router.patch('/admin/enquiries/:id', async (req, res) => {
    const key = id.parse(req.params.id); const input = z.object({ status: enquiryStatus.optional(), priority: priority.optional() }).strict().refine(v => Object.keys(v).length > 0).parse(req.body);
    const data = await locked(db, async tx => {
      const old = await tx.enquiry.findUnique({ where: { id: key } }); if (!old) throw notFound();
      if (input.status && input.status !== old.status) { transition(old.status, input.status); await tx.enquiryHistory.create({ data: { enquiryId: key, previous: old.status, next: input.status, actorId: res.locals.ownerId } }); await log(tx, 'Enquiry', key, 'STATUS_CHANGED', res.locals.ownerId, { previous: old.status, next: input.status }); }
      if (input.priority && input.priority !== old.priority) await log(tx, 'Enquiry', key, 'PRIORITY_CHANGED', res.locals.ownerId, { previous: old.priority, next: input.priority });
      return tx.enquiry.update({ where: { id: key }, data: input });
    }); res.json({ data: redact(data) });
  });
  router.post('/admin/appointments/:id/actions', async (req, res) => res.json({ data: redact(await appointmentAction(db, id.parse(req.params.id), res.locals.ownerId, actionInput.parse(req.body))) }));
  router.get('/admin/availability', async (_req, res) => res.json({ data: await db.showroomAvailability.findUnique({ where: { id: 1 } }) }));
  router.put('/admin/availability', async (req, res) => {
    const input = availabilityInput.parse(req.body);
    const data = await locked(db, async tx => { const config = await tx.showroomAvailability.upsert({ where: { id: 1 }, create: { ...input, id: 1 }, update: input }); await log(tx, 'ShowroomAvailability', '1', 'AVAILABILITY_UPDATED', res.locals.ownerId); return config; }); res.json({ data });
  });
  router.get('/contact-options', async (_req, res) => { const config = await db.showroomAvailability.findUnique({ where: { id: 1 }, select: { whatsappNumber: true, timezone: true } }); res.json({ data: { whatsappNumber: config?.whatsappNumber ?? null, timezone: config?.timezone ?? null } }); });
  return router;
}
