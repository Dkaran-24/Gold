import { afterAll, expect, it } from 'vitest';
import request from 'supertest';
import { pino } from 'pino';
import type { PrismaClient } from '@showroom/database';
import type { Config } from '../../config.js';
import { createApp } from '../../app.js';
import { appointmentAction } from './service.js';

export function crmIntegrationCases(context: () => { db: PrismaClient; config: Config; cookie: string; ownerId: string; create: (suffix: string, extra?: object) => Promise<{ id: string }> }) {
  const enquiries: string[] = [], appointments: string[] = [];
  let configured = false;
  const contact = { name: 'CRM fixture', phone: '+919876543210', consent: true };
  const tomorrow = new Date(Date.now() + 3 * 86400000); tomorrow.setUTCHours(10, 0, 0, 0);
  function setup() { const c = context(); const app = createApp(c.db, c.config, pino({ enabled: false })); const api = (method: 'get' | 'post' | 'patch' | 'put', path: string) => request(app)[method](path).set('Origin', c.config.WEB_ORIGIN).set('Cookie', c.cookie); return { ...c, app, api }; }
  async function appointment(c: ReturnType<typeof setup>, extra = {}) { const r = await c.api('post', '/api/appointments').send({ ...contact, purpose: 'CONSULTATION', requestedAt: tomorrow.toISOString(), ...extra }); expect(r.status).toBe(201); const row = await c.db.appointment.findUniqueOrThrow({ where: { reference: r.body.data.reference } }); appointments.push(row.id); return { row, receipt: r.body.data }; }
  afterAll(async () => { const { db } = context(); await db.enquiry.deleteMany({ where: { id: { in: enquiries } } }); await db.appointment.deleteMany({ where: { id: { in: appointments } } }); if (configured) await db.showroomAvailability.delete({ where: { id: 1 } }); });
  it('submits all enquiry types with unique receipts and preserves product snapshots', async () => {
    const c = setup(); const product = await c.create('crm-product', { publication: 'PUBLISHED' });
    for (const type of ['product', 'general', 'custom', 'callback']) {
      const r = await c.api('post', `/api/enquiries/${type}`).send({ ...contact, message: 'Interested in jewellery', ...(type === 'product' ? { productId: product.id } : {}), ...(type === 'callback' ? { callbackAt: tomorrow.toISOString() } : {}) });
      expect(r.status).toBe(201); expect(r.body.data.reference).toBeTruthy(); expect(r.body.data.token).toHaveLength(64); expect(r.text).not.toContain(contact.phone);
      const e = await c.db.enquiry.findUniqueOrThrow({ where: { reference: r.body.data.reference } }); enquiries.push(e.id);
      if (type === 'product') { const old = e.productName; await c.db.product.update({ where: { id: product.id }, data: { name: 'Renamed', availability: 'ARCHIVED' } }); expect((await c.db.enquiry.findUniqueOrThrow({ where: { id: e.id } })).productName).toBe(old); }
    }
    const duplicate = await c.api('post', '/api/enquiries/general').send({ ...contact, message: 'Interested in jewellery' }); expect(duplicate.status).toBe(201); const e = await c.db.enquiry.findUniqueOrThrow({ where: { reference: duplicate.body.data.reference } }); enquiries.push(e.id); expect(new Set((await c.db.enquiry.findMany({ where: { id: { in: enquiries } } })).map(e => e.reference)).size).toBe(5);
    expect((await c.api('post', '/api/enquiries/product').send({ ...contact, message: 'Invalid', productId: 'missing' })).status).toBe(422);
  });
  it('manages CRM status, priority, notes, search, dates and immutable history privately', async () => {
    const c = setup(); const r = await c.api('post', '/api/enquiries/general').send({ ...contact, message: 'Follow up' }); const row = await c.db.enquiry.findUniqueOrThrow({ where: { reference: r.body.data.reference } }); enquiries.push(row.id); const path = `/api/admin/enquiries/${row.id}`;
    expect((await c.api('patch', path).send({ status: 'CONVERTED' })).status).toBe(409);
    for (const status of ['CONTACTED', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'CONVERTED']) expect((await c.api('patch', path).send({ status })).status).toBe(200);
    await c.api('patch', path).send({ priority: 'HIGH' }); await c.api('post', `${path}/notes`).send({ body: 'PRIVATE_OWNER_NOTE' });
    expect((await c.api('get', `${path}/history`)).body.pagination.total).toBe(5);
    expect((await c.api('get', `${path}/notes`)).text).toContain('PRIVATE_OWNER_NOTE');
    expect((await c.api('get', `${path}/activity`)).text).toContain('PRIORITY_CHANGED');
    const list = await c.api('get', '/api/admin/enquiries').query({ search: row.reference, status: 'CONVERTED', type: 'GENERAL', from: new Date(Date.now() - 60000).toISOString(), limit: 1 }); expect(list.body.pagination.total).toBe(1);
    const safe = await c.api('post', '/api/enquiries/status').send({ reference: r.body.data.reference, token: r.body.data.token }); expect(safe.status).toBe(200); expect(safe.body.data.status).toBe('CLOSED'); expect(safe.text).not.toMatch(/PRIVATE_OWNER_NOTE|authorId|phone|priority|CONVERTED/);
    expect((await c.api('post', '/api/enquiries/status').send({ reference: r.body.data.reference, token: 'a'.repeat(64) })).status).toBe(404);
  });
  it('stores unconfirmed requests and blocks approval until availability is configured', async () => {
    const c = setup(); expect(await c.db.showroomAvailability.count()).toBe(0);
    const a = await appointment(c); expect(a.row.status).toBe('REQUESTED'); expect(a.row.scheduledAt).toBeNull();
    expect((await c.api('post', `/api/admin/appointments/${a.row.id}/actions`).send({ action: 'APPROVE' })).status).toBe(503);
    expect((await c.api('post', '/api/appointments').send({ ...contact, purpose: 'OTHER', requestedAt: 'bad', visitors: 0 })).status).toBe(422);
  });
  it('configures availability and serializes capacity across concurrent approvals', async () => {
    const c = setup();
    const config = { timezone: 'UTC', weekly: Array.from({ length: 7 }, (_, day) => ({ day, open: '09:00', close: '18:00' })), durationMinutes: 60, bufferMinutes: 0, capacity: 1, closureDates: [] };
    expect((await c.api('put', '/api/admin/availability').send(config)).status).toBe(200); configured = true;
    const a = await appointment(c), b = await appointment(c);
    const result = await Promise.all([a, b].map(x => c.api('post', `/api/admin/appointments/${x.row.id}/actions`).send({ action: 'APPROVE' })));
    expect(result.map(r => r.status).sort()).toEqual([200, 409]);
    const winner = result[0]!.status === 200 ? a : b;
    await c.api('post', `/api/admin/appointments/${winner.row.id}/actions`).send({ action: 'CANCEL', reason: 'Customer requested cancellation' });
    // Increase capacity; multiple confirmations now fit at the same time.
    expect((await c.api('put', '/api/admin/availability').send({ ...config, capacity: 2 })).status).toBe(200);
    const x = await appointment(c), y = await appointment(c);
    expect((await c.api('post', `/api/admin/appointments/${x.row.id}/actions`).send({ action: 'APPROVE' })).status).toBe(200);
    expect((await c.api('post', `/api/admin/appointments/${y.row.id}/actions`).send({ action: 'APPROVE' })).status).toBe(200);
  });
  it('preserves requested and proposed times through rescheduling, confirmation and cancellation', async () => {
    const c = setup(); const a = await appointment(c, { requestedAt: new Date(tomorrow.getTime() + 3600000).toISOString() }); const path = `/api/admin/appointments/${a.row.id}`; const proposed = new Date(tomorrow.getTime() + 7200000).toISOString();
    expect((await c.api('post', `${path}/actions`).send({ action: 'PROPOSE', time: proposed })).status).toBe(200);
    const intermediate = await c.db.appointment.findUniqueOrThrow({ where: { id: a.row.id } }); expect(intermediate.requestedAt).toEqual(a.row.requestedAt); expect(intermediate.scheduledAt).toBeNull();
    expect((await c.api('post', `${path}/actions`).send({ action: 'CONFIRM' })).status).toBe(200);
    await c.api('post', `${path}/notes`).send({ body: 'PRIVATE_APPOINTMENT_NOTE' });
    const safe = await c.api('post', '/api/appointments/status').send({ reference: a.receipt.reference, token: a.receipt.token }); expect(safe.body.data.scheduledAt).toBe(proposed); expect(safe.text).not.toMatch(/PRIVATE_APPOINTMENT_NOTE|phone|actorId|internalNotes/);
    expect((await c.api('post', `${path}/actions`).send({ action: 'CANCEL', reason: 'No longer visiting' })).status).toBe(200);
    expect((await c.api('get', `${path}/history`)).body.pagination.total).toBe(4);
    expect((await c.db.appointment.findUniqueOrThrow({ where: { id: a.row.id } })).requestedAt).toEqual(a.row.requestedAt);
  });
  it('supports rejection, completion and no-show with transition safeguards', async () => {
    const c = setup(); const rejected = await appointment(c);
    expect((await c.api('post', `/api/admin/appointments/${rejected.row.id}/actions`).send({ action: 'REJECT' })).status).toBe(422);
    expect((await c.api('post', `/api/admin/appointments/${rejected.row.id}/actions`).send({ action: 'REJECT', reason: 'Unable to accommodate' })).status).toBe(200);
    for (const action of ['COMPLETE', 'NO_SHOW']) {
      const a = await appointment(c); expect((await c.api('post', `/api/admin/appointments/${a.row.id}/actions`).send({ action })).status).toBe(409);
      await c.db.appointment.update({ where: { id: a.row.id }, data: { status: 'APPROVED', scheduledAt: new Date(Date.now() - 7200000), endsAt: new Date(Date.now() - 3600000), occupiedUntil: new Date(Date.now() - 3600000) } });
      expect((await c.api('post', `/api/admin/appointments/${a.row.id}/actions`).send({ action })).status).toBe(200);
    }
  });
  it('rolls back confirmation when audit/history writes fail', async () => {
    const c = setup(); const a = await appointment(c, { requestedAt: new Date(tomorrow.getTime() + 10800000).toISOString() });
    await expect(appointmentAction(c.db, a.row.id, 'invalid-owner', { action: 'APPROVE' })).rejects.toThrow();
    expect((await c.db.appointment.findUniqueOrThrow({ where: { id: a.row.id } })).status).toBe('REQUESTED');
    expect(await c.db.appointmentHistory.count({ where: { appointmentId: a.row.id } })).toBe(1);
  });
  it('accepts managed custom inspiration, rejects foreign images and expires receipt access', async () => {
    const c = setup(); const p = await c.create('crm-inspiration', { publication: 'PUBLISHED' });
    const image = await c.db.productImage.create({ data: { productId: p.id, publicId: `crm-fixture-${p.id}`, url: 'https://res.cloudinary.com/test/image/upload/fixture.png', alt: 'Fixture', position: 0 } });
    const response = await c.api('post', '/api/enquiries/custom').send({ ...contact, message: 'Custom design request', imageIds: [image.id] });
    expect(response.status).toBe(201); const row = await c.db.enquiry.findUniqueOrThrow({ where: { reference: response.body.data.reference } }); enquiries.push(row.id);
    expect((await c.api('get', `/api/admin/enquiries/${row.id}`)).body.data.inspirationImages).toHaveLength(1);
    expect((await c.api('post', '/api/enquiries/custom').send({ ...contact, message: 'Invalid', imageIds: ['missing'] })).status).toBe(422);
    await c.db.enquiry.update({ where: { id: row.id }, data: { createdAt: new Date(Date.now() - 91 * 86400000) } });
    expect((await c.api('post', '/api/enquiries/status').send({ reference: response.body.data.reference, token: response.body.data.token })).status).toBe(404);
  });
  it('retains the original confirmed slot during a rescheduling proposal', async () => {
    const c = setup(); const current = await c.db.showroomAvailability.findUniqueOrThrow({ where: { id: 1 } });
    await c.api('put', '/api/admin/availability').send({ timezone: current.timezone, weekly: current.weekly, durationMinutes: current.durationMinutes, bufferMinutes: current.bufferMinutes, capacity: 1, closureDates: current.closureDates });
    const time = new Date(tomorrow.getTime() + 14400000).toISOString();
    const a = await appointment(c, { requestedAt: time }), b = await appointment(c, { requestedAt: time });
    expect((await c.api('post', `/api/admin/appointments/${a.row.id}/actions`).send({ action: 'APPROVE' })).status).toBe(200);
    expect((await c.api('post', `/api/admin/appointments/${a.row.id}/actions`).send({ action: 'PROPOSE', time: new Date(tomorrow.getTime() + 18000000).toISOString() })).status).toBe(200);
    expect((await c.api('post', `/api/admin/appointments/${b.row.id}/actions`).send({ action: 'APPROVE' })).status).toBe(409);
    expect((await c.api('post', `/api/admin/appointments/${a.row.id}/actions`).send({ action: 'CONFIRM' })).status).toBe(200);
    expect((await c.api('post', `/api/admin/appointments/${b.row.id}/actions`).send({ action: 'APPROVE' })).status).toBe(200);
  });
  it('prevents cross-customer lookup, protects CRM administration and limits abusive requests', async () => {
    const c = setup(); const a = await appointment(c), b = await appointment(c);
    expect((await c.api('post', '/api/appointments/status').send({ reference: b.receipt.reference, token: a.receipt.token })).status).toBe(404);
    for (const path of ['/api/admin/enquiries', '/api/admin/appointments', '/api/admin/availability', `/api/admin/appointments/${a.row.id}/notes`, `/api/admin/appointments/${a.row.id}/history`]) expect((await request(c.app).get(path)).status).toBe(401);
    for (let i = 0; i < 8; i++) expect((await c.api('post', '/api/appointments').send({})).status).toBe(422);
    expect((await c.api('post', '/api/appointments').send({})).status).toBe(429);
  });
}
