import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TryOnWorker,
  startTryOnWorker,
  WORKER_ERROR_MESSAGE,
  WORKER_RECOVERY_MESSAGE,
  type WorkerLogger,
  type WorkerRuntime,
} from './worker.js';

describe('Try-on worker state-transition logging and concurrency', () => {
  let logger: WorkerLogger;
  let runtime: WorkerRuntime;
  let worker: TryOnWorker;

  beforeEach(() => {
    logger = {
      error: vi.fn(),
      info: vi.fn(),
    };
    runtime = {
      tick: vi.fn().mockResolvedValue(undefined),
    };
    worker = new TryOnWorker(runtime, logger, 3000);
  });

  afterEach(() => {
    worker.stop();
    vi.restoreAllMocks();
  });

  it('logs the first consecutive worker failure at error level', async () => {
    vi.mocked(runtime.tick).mockRejectedValueOnce(new Error('Database unavailable'));

    await worker.tick();

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(WORKER_ERROR_MESSAGE);
    expect(logger.info).not.toHaveBeenCalled();
    expect(worker.failing).toBe(true);
  });

  it('suppresses duplicate error logs on consecutive failures', async () => {
    vi.mocked(runtime.tick)
      .mockRejectedValueOnce(new Error('Failure 1'))
      .mockRejectedValueOnce(new Error('Failure 2'))
      .mockRejectedValueOnce(new Error('Failure 3'));

    await worker.tick();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(worker.failing).toBe(true);

    // Second failure
    await worker.tick();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(worker.failing).toBe(true);

    // Third failure
    await worker.tick();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
    expect(worker.failing).toBe(true);
  });

  it('logs a recovery message at info level when a subsequent tick succeeds', async () => {
    // Start with a failure
    vi.mocked(runtime.tick).mockRejectedValueOnce(new Error('Initial failure'));
    await worker.tick();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(worker.failing).toBe(true);

    // Recover with a successful tick
    vi.mocked(runtime.tick).mockResolvedValueOnce(undefined);
    await worker.tick();

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(WORKER_RECOVERY_MESSAGE);
    expect(worker.failing).toBe(false);

    // Subsequent successful ticks do not repeat recovery log
    vi.mocked(runtime.tick).mockResolvedValueOnce(undefined);
    await worker.tick();
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('logs a new error when a failure occurs again after recovery', async () => {
    // 1. Initial failure
    vi.mocked(runtime.tick).mockRejectedValueOnce(new Error('First failure'));
    await worker.tick();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(worker.failing).toBe(true);

    // 2. Recovery
    vi.mocked(runtime.tick).mockResolvedValueOnce(undefined);
    await worker.tick();
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(worker.failing).toBe(false);

    // 3. New failure after recovery
    vi.mocked(runtime.tick).mockRejectedValueOnce(new Error('Second outage'));
    await worker.tick();
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenLastCalledWith(WORKER_ERROR_MESSAGE);
    expect(worker.failing).toBe(true);

    // 4. Consecutive failure after second outage remains suppressed
    vi.mocked(runtime.tick).mockRejectedValueOnce(new Error('Third outage'));
    await worker.tick();
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('prevents concurrent ticks while a previous tick is in-flight', async () => {
    let finishTick!: () => void;
    const pendingTick = new Promise<void>(resolve => {
      finishTick = resolve;
    });

    vi.mocked(runtime.tick).mockImplementation(() => pendingTick);

    // Start first tick
    const firstPromise = worker.tick();
    expect(worker.current).toBeDefined();

    // Trigger second and third concurrent ticks
    const secondPromise = worker.tick();
    const thirdPromise = worker.tick();

    // At this point, runtime.tick should only have been called once
    expect(runtime.tick).toHaveBeenCalledTimes(1);

    // Resolve the first tick
    finishTick();
    await Promise.all([firstPromise, secondPromise, thirdPromise]);

    // Still only called once
    expect(runtime.tick).toHaveBeenCalledTimes(1);
    expect(worker.current).toBeUndefined();
  });

  it('handles rejected worker promises safely without unhandled rejections', async () => {
    vi.mocked(runtime.tick).mockRejectedValueOnce(new Error('Fatal error'));

    // Should resolve cleanly rather than rethrowing
    await expect(worker.tick()).resolves.toBeUndefined();
    expect(worker.current).toBeUndefined();
  });

  it('runs automatically at the configured 3000ms interval when started', async () => {
    vi.useFakeTimers();
    try {
      const activeWorker = startTryOnWorker(runtime, logger, 3000);
      expect(runtime.tick).not.toHaveBeenCalled();

      // Advance by 3000ms
      await vi.advanceTimersByTimeAsync(3000);
      expect(runtime.tick).toHaveBeenCalledTimes(1);

      // Advance by another 3000ms
      await vi.advanceTimersByTimeAsync(3000);
      expect(runtime.tick).toHaveBeenCalledTimes(2);

      // Stop worker
      activeWorker.stop();
      await vi.advanceTimersByTimeAsync(3000);
      expect(runtime.tick).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

