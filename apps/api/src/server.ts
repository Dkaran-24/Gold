import { fileURLToPath } from 'node:url';
import { config as dotenv } from 'dotenv';
import { createDatabase } from '@showroom/database';
import { pino } from 'pino';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { createTryOnRuntime } from './modules/tryon/runtime.js';
import { startTryOnWorker } from './modules/tryon/worker.js';

dotenv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
const config = readConfig(process.env);
const logger = pino({ level: config.NODE_ENV === 'production' ? 'info' : 'debug' });
const db = createDatabase(config.DATABASE_URL);
const tryOn = createTryOnRuntime(db);
const worker = startTryOnWorker(tryOn, logger);
const server = createApp(db, config, logger, undefined, tryOn).listen(config.PORT, '127.0.0.1', () => {
  logger.info({ port: config.PORT }, 'Showroom API listening');
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  worker.stop();
  const deadline = setTimeout(() => process.exit(1), 120_000).unref();
  server.close(async () => {
    await worker.current;
    await db.$disconnect(); clearTimeout(deadline); process.exit(0);
  });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
