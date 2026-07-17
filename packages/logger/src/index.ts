import pino, { type Logger, type LoggerOptions } from 'pino';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  '*.password',
  'token',
  '*.token',
  'secret',
  '*.secret',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
];

export const createLogger = (service: string): Logger => {
  const options = {
    name: service,
    level: process.env.LOG_LEVEL ?? 'info',
    base: {
      service,
      environment: process.env.NODE_ENV ?? 'development',
      version: process.env.APP_VERSION ?? 'dev',
      gitSha: process.env.GIT_SHA ?? 'local',
    },
    redact: { paths: redactPaths, censor: '[REDACTED]' },
  } satisfies LoggerOptions;

  return pino(options);
};
