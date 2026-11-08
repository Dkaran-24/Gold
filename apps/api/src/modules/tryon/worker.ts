export interface WorkerLogger {
  error: (msg: string) => void;
  info: (msg: string) => void;
}

export interface WorkerRuntime {
  tick: () => Promise<void>;
}

export const WORKER_ERROR_MESSAGE = 'Try-on worker failed; inspect database and private storage availability.';
export const WORKER_RECOVERY_MESSAGE = 'Try-on worker recovered.';

export class TryOnWorker {
  private timer?: NodeJS.Timeout;
  private inFlight?: Promise<void>;
  private isFailing = false;

  constructor(
    private readonly runtime: WorkerRuntime,
    private readonly logger: WorkerLogger,
    private readonly intervalMs = 3000,
  ) {}

  get current(): Promise<void> | undefined {
    return this.inFlight;
  }

  get failing(): boolean {
    return this.isFailing;
  }

  start(): this {
    if (this.timer) return this;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    this.timer.unref();
    return this;
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async tick(): Promise<void> {
    if (this.inFlight) return;

    const task = (async () => {
      try {
        await this.runtime.tick();
        if (this.isFailing) {
          this.isFailing = false;
          try {
            this.logger.info(WORKER_RECOVERY_MESSAGE);
          } catch {
            // Logger failure must not crash worker
          }
        }
      } catch {
        if (!this.isFailing) {
          this.isFailing = true;
          try {
            this.logger.error(WORKER_ERROR_MESSAGE);
          } catch {
            // Logger failure must not crash worker
          }
        }
      }
    })();

    this.inFlight = task;
    try {
      await task;
    } finally {
      this.inFlight = undefined;
    }
  }
}

export function startTryOnWorker(
  runtime: WorkerRuntime,
  logger: WorkerLogger,
  intervalMs = 3000,
): TryOnWorker {
  const worker = new TryOnWorker(runtime, logger, intervalMs);
  return worker.start();
}

