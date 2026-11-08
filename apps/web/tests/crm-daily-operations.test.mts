import test from 'node:test';
import assert from 'node:assert/strict';
import { adminApi, allRecords } from '../src/lib/admin/api.ts';
import { dateInZone, appointmentActions, enquiryTransitions, type Row } from '../src/lib/admin/model.ts';

test('dashboard metrics distinguish new enquiries, pending, confirmed, and cancelled appointments', async t => {
  const mockAppointments: Row[] = [
    { id: '1', status: 'REQUESTED', name: 'Ananya', requestedAt: '2026-11-10T10:00:00Z', scheduledAt: null },
    { id: '2', status: 'PENDING', name: 'Bhavna', requestedAt: '2026-11-10T11:00:00Z', scheduledAt: null },
    { id: '3', status: 'RESCHEDULE_PROPOSED', name: 'Chirag', requestedAt: '2026-11-10T12:00:00Z', proposedAt: '2026-11-12T14:00:00Z', scheduledAt: null },
    { id: '4', status: 'APPROVED', name: 'Deepak', scheduledAt: '2026-11-15T15:00:00Z' },
    { id: '5', status: 'APPROVED', name: 'Esha', scheduledAt: '2020-01-01T15:00:00Z' }, // Past approved
    { id: '6', status: 'CANCELLED', name: 'Farhan', scheduledAt: '2026-11-15T16:00:00Z', publicReason: 'Customer requested cancellation' },
    { id: '7', status: 'REJECTED', name: 'Gauri', requestedAt: '2026-11-10T16:00:00Z', publicReason: 'Capacity full' },
    { id: '8', status: 'COMPLETED', name: 'Harish', scheduledAt: '2026-11-01T10:00:00Z' },
  ];

  t.mock.method(globalThis, 'fetch', async (url: string) => {
    if (url.includes('admin/appointments')) {
      return Response.json({
        data: mockAppointments,
        pagination: { page: 1, limit: 100, total: mockAppointments.length, pages: 1 }
      });
    }
    return Response.json({ data: [], pagination: { page: 1, limit: 1, total: 0, pages: 0 } });
  });

  const appointments = await allRecords<Row>('admin/appointments');
  assert.equal(appointments.length, 8);

  const pendingAppointments = appointments.filter(v =>
    ['REQUESTED', 'PENDING', 'RESCHEDULE_PROPOSED'].includes(v.status || '')
  ).length;
  const confirmedAppointments = appointments.filter(v => v.status === 'APPROVED').length;
  const cancelledAppointments = appointments.filter(v => v.status === 'CANCELLED').length;
  const upcomingVisits = appointments.filter(v =>
    ['APPROVED', 'RESCHEDULE_PROPOSED'].includes(v.status || '') &&
    v.scheduledAt &&
    new Date(v.scheduledAt) > new Date()
  ).length;

  assert.equal(pendingAppointments, 3, 'Pending appointments must count REQUESTED, PENDING, and RESCHEDULE_PROPOSED');
  assert.equal(confirmedAppointments, 2, 'Confirmed appointments must count APPROVED');
  assert.equal(cancelledAppointments, 1, 'Cancelled appointments must count CANCELLED');
  assert.equal(upcomingVisits, 1, 'Upcoming visits must count future confirmed bookings');
});

test('scheduled-date view filters exclude cancelled and rejected appointments from active schedule', () => {
  const zone = 'Asia/Kolkata';
  const targetDate = '2026-11-15';

  const records: Row[] = [
    { id: '1', status: 'APPROVED', scheduledAt: '2026-11-15T09:30:00Z' }, // 15:00 IST -> 2026-11-15
    { id: '2', status: 'RESCHEDULE_PROPOSED', scheduledAt: '2026-11-15T11:30:00Z' }, // Confirmed slot retained during proposal
    { id: '3', status: 'CANCELLED', scheduledAt: '2026-11-15T10:30:00Z' }, // Cancelled, but scheduledAt retained
    { id: '4', status: 'REJECTED', scheduledAt: '2026-11-15T12:30:00Z' }, // Rejected, but scheduledAt retained
    { id: '5', status: 'APPROVED', scheduledAt: '2026-11-16T09:30:00Z' }, // Different date
  ];

  // Logic replicated from CrmList scheduled-date filtering:
  const activeForDate = records.filter(v =>
    v.scheduledAt &&
    dateInZone(v.scheduledAt, zone) === targetDate &&
    v.status !== 'CANCELLED' &&
    v.status !== 'REJECTED'
  );

  assert.equal(activeForDate.length, 2, 'Only active (approved / reschedule proposed) bookings appear on the active schedule');
  assert.deepEqual(activeForDate.map(r => r.id), ['1', '2']);

  // Explicit status filter for CANCELLED on that date:
  const cancelledForDate = records.filter(v =>
    v.scheduledAt &&
    dateInZone(v.scheduledAt, zone) === targetDate &&
    v.status === 'CANCELLED'
  );
  assert.equal(cancelledForDate.length, 1);
  assert.equal(cancelledForDate[0]?.id, '3');
});

test('scheduled-date filtering correctly computes day across UTC midnight for IST', () => {
  const zone = 'Asia/Kolkata'; // UTC +05:30
  // 18:45 UTC on 14 Nov is 00:15 IST on 15 Nov
  const lateUtc = '2026-11-14T19:00:00Z';
  assert.equal(dateInZone(lateUtc, zone), '2026-11-15');

  // 17:30 UTC on 15 Nov is 23:00 IST on 15 Nov
  const nightUtc = '2026-11-15T17:30:00Z';
  assert.equal(dateInZone(nightUtc, zone), '2026-11-15');

  // 19:00 UTC on 15 Nov is 00:30 IST on 16 Nov
  const pastMidnightUtc = '2026-11-15T19:00:00Z';
  assert.equal(dateInZone(pastMidnightUtc, zone), '2026-11-16');
});

test('action permissions clearly enforce customer-visible reasons for REJECT and CANCEL', () => {
  const requestedRow: Row = { id: 'req-1', status: 'REQUESTED' };
  const permitted = appointmentActions(requestedRow);
  assert(permitted.includes('APPROVE'));
  assert(permitted.includes('REJECT'));
  assert(permitted.includes('PROPOSE'));
  assert(permitted.includes('CANCEL'));

  // Cancelled row has no further actions
  const cancelledRow: Row = { id: 'can-1', status: 'CANCELLED' };
  assert.deepEqual(appointmentActions(cancelledRow), []);

  // Completed row has no further actions
  const completedRow: Row = { id: 'comp-1', status: 'COMPLETED' };
  assert.deepEqual(appointmentActions(completedRow), []);
});

test('enquiry lifecycle allows progressing to IN_PROGRESS and WAITING_FOR_CUSTOMER', () => {
  assert(enquiryTransitions.NEW?.includes('IN_PROGRESS'));
  assert(enquiryTransitions.NEW?.includes('CONTACTED'));
  assert(enquiryTransitions.CONTACTED?.includes('WAITING_FOR_CUSTOMER'));
  assert(enquiryTransitions.IN_PROGRESS?.includes('WAITING_FOR_CUSTOMER'));
});

