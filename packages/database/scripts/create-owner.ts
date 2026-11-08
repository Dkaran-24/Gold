import { createDatabase } from '../index.js';
import { hash } from 'bcryptjs';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const db = createDatabase(process.env.DATABASE_URL);
async function main() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set a valid OWNER_EMAIL.');
  if (!password || password.length < 14 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('OWNER_PASSWORD must contain at least 14 characters and at most 72 UTF-8 bytes.');
  }
  if (await db.user.count()) throw new Error('An owner already exists. Use password recovery; setup never overwrites accounts.');
  await db.user.create({ data: { email, ownerSlot: 1, passwordHash: await hash(password, 12) } });
  console.log('Owner created. Remove OWNER_PASSWORD from your environment.');
}
main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
