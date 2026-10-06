import pino from 'pino';
import { config } from './config';

export const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: config.isProd ? undefined : { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname', translateTime: 'HH:MM:ss' } },
  redact: { paths: ['*.password', '*.token', '*.apiKey', 'headers.authorization'], censor: '[redacted]' },
});
