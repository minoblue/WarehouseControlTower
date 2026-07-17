import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.url(),
  AWS_REGION: z.string().min(1).default('us-east-1'),
  AWS_ENDPOINT_URL: z.url().optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  EVENT_BUS_NAME: z.string().min(1),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(1000),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  JWT_SECRET: z.string().min(32),
  WEB_ORIGIN: z.url(),
});

export type ApiConfig = z.infer<typeof schema>;

let cached: ApiConfig | undefined;

export const apiConfig = (): ApiConfig => {
  cached ??= schema.parse(process.env);
  if (cached.NODE_ENV === 'production' && cached.AWS_ENDPOINT_URL) {
    throw new Error('AWS_ENDPOINT_URL must not be set in production.');
  }
  return cached;
};
