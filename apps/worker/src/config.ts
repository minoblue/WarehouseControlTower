import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  WORKER_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: z.url(),
  AWS_REGION: z.string().min(1).default('us-east-1'),
  AWS_ENDPOINT_URL: z.url().optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  ORDER_QUEUE_URL: z.url(),
  SQS_WAIT_TIME_SECONDS: z.coerce.number().int().min(1).max(20).default(20),
  SQS_VISIBILITY_TIMEOUT_SECONDS: z.coerce.number().int().min(10).default(30),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),
  CARRIER_BASE_URL: z.url(),
  CARRIER_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(3000),
});

export type WorkerConfig = z.infer<typeof schema>;
let cached: WorkerConfig | undefined;

export const workerConfig = (): WorkerConfig => {
  cached ??= schema.parse(process.env);
  if (cached.NODE_ENV === 'production' && cached.AWS_ENDPOINT_URL) {
    throw new Error('AWS_ENDPOINT_URL must not be set in production.');
  }
  return cached;
};
