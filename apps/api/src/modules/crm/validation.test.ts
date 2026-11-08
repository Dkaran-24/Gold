import { describe, expect, it } from 'vitest';
import { enquiryInput, appointmentInput, availabilityInput } from './validation.js';
import { receipt, timeWindow, transition } from './service.js';
const contact = { name: 'Test', phone: '+919876543210', consent: true };
describe('CRM validation and availability', () => {
  it('rejects malformed contact, missing consent and mass assignment', () => {
    for (const extra of [{ phone: '123' }, { email: 'bad' }, { consent: false }, { status: 'CONVERTED' }, { preferredContact: 'EMAIL' }]) expect(enquiryInput.safeParse({ ...contact, type: 'GENERAL', message: 'Hello', ...extra }).success).toBe(false);
    expect(enquiryInput.safeParse({ ...contact, type: 'PRODUCT', message: 'Hello' }).success).toBe(false);
    expect(appointmentInput.safeParse({ ...contact, purpose: 'CONSULTATION', requestedAt: '2020-01-01T00:00:00Z', visitors: 0 }).success).toBe(false);
  });
  it('generates independent unpredictable receipts and hashes', () => {
    const a = receipt(), b = receipt(); expect(a.reference).not.toBe(b.reference); expect(a.token).not.toBe(b.token); expect(a.lookupTokenHash).not.toBe(a.token); expect(a.token).toHaveLength(64);
  });
  it('validates status transitions including terminal reopening', () => {
    expect(() => transition('NEW', 'CONVERTED')).toThrow(); expect(() => transition('NEW', 'CONTACTED')).not.toThrow(); expect(() => transition('CLOSED', 'IN_PROGRESS')).not.toThrow();
  });
  it('uses configured timezone, closure dates, slot alignment and buffer', () => {
    const config = availabilityInput.parse({ timezone: 'Asia/Kolkata', weekly: [{ day: 1, open: '10:00', close: '18:00' }], durationMinutes: 30, bufferMinutes: 15, capacity: 1, closureDates: [] });
    const time = new Date('2030-01-07T10:00:00+05:30'); const now = new Date('2029-01-01T00:00:00Z');
    expect(timeWindow(time, config, now).occupiedUntil.toISOString()).toBe('2030-01-07T05:15:00.000Z');
    expect(() => timeWindow(new Date(time.getTime() + 60000), config, now)).toThrow();
    expect(() => timeWindow(time, { ...config, closureDates: ['2030-01-07'] }, now)).toThrow();
    expect(availabilityInput.safeParse({ ...config, timezone: 'Invalid/Timezone' }).success).toBe(false);
  });
});
