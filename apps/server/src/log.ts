import pino from 'pino';
import { config } from './config';

export const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Pretty logs in a terminal; plain JSON lines when running in the background (log files).
  transport: config.isProd || !process.stdout.isTTY ? undefined : { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname', translateTime: 'HH:MM:ss' } },
  redact: { paths: ['*.password', '*.token', '*.apiKey', 'headers.authorization'], censor: '[redacted]' },
});
