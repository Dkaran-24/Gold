import { config as dotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createDatabase } from '@showroom/database';
import { pino } from 'pino';
import { Images } from './service.js';
import { cloudinaryStorage } from './cloudinary.js';
import { imageLimits } from './validation.js';

dotenv({ path: fileURLToPath(new URL('../../../../../.env', import.meta.url)) });
const logger = pino();
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Missing database configuration');
  const db = createDatabase(process.env.DATABASE_URL);
  try {
    const result = await new Images(db, cloudinaryStorage(), logger, imageLimits().PRODUCT_MAX_IMAGES).cleanup();
    logger.info(result, 'Image cleanup batch complete');
    if (result.pending) process.exitCode = 1;
  } finally { await db.$disconnect(); }
}
main().catch(() => { logger.error('Image cleanup could not run; check server configuration and database availability'); process.exitCode = 1; });
