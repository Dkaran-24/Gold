import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverPreview, canStartPreview } from '../src/lib/try-on/recovery.ts';
import type { TryOnJob } from '../src/lib/try-on/types.ts';

const job: TryOnJob = { id: 'previous-preview', status: 'PROCESSING', expiresAt: '2099-01-01T00:00:00Z', errorCode: null, canRetry: false, resultUrl: null };
const statusError = (status: number) => Object.assign(new Error('Test response'), { status });

test('timeouts and server errors retain the previous job and prevent a new submission', async () => {
  for (const error of [new DOMException('Timed out', 'TimeoutError'), statusError(500), statusError(503), statusError(429), statusError(401), statusError(403)]) {
    const result = await recoverPreview(job.id, async () => { throw error; });
    assert.deepEqual(result, { state: 'unresolved', id: job.id });
    assert.equal(canStartPreview(result, null), false);
  }
});

test('retry reconciles the same previous job without creating or replacing it', async () => {
  const reads: string[] = [];
  const read = async (id: string) => { reads.push(id); if (reads.length === 1) throw statusError(503); return job; };
  const failed = await recoverPreview(job.id, read);
  assert.equal(canStartPreview(failed, null), false);
  const recovered = await recoverPreview(job.id, read);
  assert.deepEqual(reads, [job.id, job.id]);
  assert.deepEqual(recovered, { state: 'restored', job });
  assert.equal(canStartPreview(recovered, job), false);
});

test('only definitive missing or expired responses release the recovery gate', async () => {
  for (const status of [404, 410]) {
    const result = await recoverPreview(job.id, async () => { throw statusError(status); });
    assert.deepEqual(result, { state: 'ready' });
    assert.equal(canStartPreview(result, null), true);
  }
});

test('all restored statuses remain available for existing status/result/retry/deletion controls', async () => {
  for (const status of ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'] as const) {
    const previous = { ...job, status };
    assert.deepEqual(await recoverPreview(job.id, async () => previous), { state: 'restored', job: previous });
  }
});

test('unreadable or mismatched job responses cannot unlock new generation', async () => {
  for (const value of [null, {}, { ...job, id: 'another-job' }, { ...job, status: 'UNKNOWN' }]) {
    const result = await recoverPreview(job.id, async () => value as TryOnJob);
    assert.deepEqual(result, { state: 'unresolved', id: job.id });
    assert.equal(canStartPreview(result, null), false);
  }
  assert.equal(canStartPreview({ state: 'checking' }, null), false);
  assert.equal(canStartPreview({ state: 'ready' }, job), false);
});
