import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().url().refine(v => /^postgres(ql)?:/.test(v), 'A PostgreSQL connection URL is required'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
});

export type Config = z.infer<typeof schema>;
export function readConfig(environment: NodeJS.ProcessEnv): Config {
  const config = schema.parse(environment);
  const origin = new URL(config.WEB_ORIGIN);
  if (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) {
    throw new Error('WEB_ORIGIN must be an origin without a path, query, or credentials.');
  }
  config.WEB_ORIGIN = origin.origin;
  if (config.NODE_ENV === 'production' && origin.protocol !== 'https:') {
    throw new Error('Production WEB_ORIGIN must use HTTPS.');
  }
  return config;
}
