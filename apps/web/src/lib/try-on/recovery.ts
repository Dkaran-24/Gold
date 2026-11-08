import type { TryOnJob } from './types';

export type PreviewRecovery =
  | { state: 'checking' }
  | { state: 'ready' }
  | { state: 'restored'; job: TryOnJob }
  | { state: 'unresolved'; id: string };

/** A failed read is not evidence that a previous paid generation no longer exists. */
export async function recoverPreview(id: string, read: (id: string) => Promise<TryOnJob>): Promise<PreviewRecovery> {
  try {
    const job = await read(id);
    if (!job || job.id !== id || !['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'].includes(job.status)) {
      return { state: 'unresolved', id };
    }
    return { state: 'restored', job };
  } catch (error) {
    if (error instanceof Error && 'status' in error && [404, 410].includes(Number(error.status))) {
      return { state: 'ready' };
    }
    return { state: 'unresolved', id };
  }
}

export function canStartPreview(recovery: PreviewRecovery, job: TryOnJob | null) {
  return recovery.state === 'ready' && job === null;
}
