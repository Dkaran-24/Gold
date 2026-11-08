// Real API, authorization, PostgreSQL and image processing; only the remote storage transport is a test double.
// Requires explicit test database and storage flag. This entry point is never imported by production code.
import { createDatabase } from '@showroom/database';
import { pino } from 'pino';
import { createApp } from '../../api/dist/app.js';
import { readConfig } from '../../api/dist/config.js';
const connection = process.env.SHOWROOM_TEST_DATABASE_URL;
const url = new URL(connection || 'http://invalid');
if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || url.port !== '55432' || url.username !== 'showroom_test' || url.pathname !== '/postgres' || process.env.SHOWROOM_QA_STORAGE !== 'explicit-test-double') throw new Error('Refusing non-isolated test configuration.');
const db = createDatabase(connection);
const storage = { ready() {}, async upload(_publicId, bytes) { if (!bytes.length) throw new Error('Empty processed image'); return { url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg' }; }, async destroy() {} };
const config = readConfig({ ...process.env, NODE_ENV: 'test', DATABASE_URL: connection, WEB_ORIGIN: 'http://localhost:3000', PORT: '4000' });
const server = createApp(db, config, pino({ enabled: false }), storage).listen(4000, '127.0.0.1', () => console.log('Isolated QA API listening. Remote image transport is a test double; no Cloudinary account mutations.'));
process.on('SIGINT', () => server.close(async()=>{await db.$disconnect();process.exit(0);}));
