import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyBaseLogger } from 'fastify';
import fs from 'fs-extra';
import { ZodError } from 'zod';
import { config } from './config';
import { ValidationError } from './domain/pages';
import { log } from './log';
import { registerMcpRoutes } from './mcp/server';
import { coreRoutes } from './routes/core';
import { libraryRoutes } from './routes/library';
import { systemRoutes } from './routes/system';
import { workRoutes } from './routes/work';

const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export async function buildApp() {
  const app = Fastify({ loggerInstance: log.child({}, { level: 'warn' }) as FastifyBaseLogger, bodyLimit: 5 * 1024 * 1024 });

  // Local-first: refuse requests addressed to any other host (DNS-rebinding protection).
  app.addHook('onRequest', async (req, reply) => {
    if (!LOCAL_HOSTS.test(req.headers.host ?? '')) return reply.code(403).send({ error: 'Forbidden host' });
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) return reply.code(400).send({ error: 'Invalid request', issues: err.issues.slice(0, 5) });
    if (err instanceof ValidationError) return reply.code(400).send({ error: err.message });
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) log.error({ err }, 'request failed');
    return reply.code(status).send({ error: status >= 500 ? 'Something went wrong' : (err as Error).message });
  });

  coreRoutes(app);
  workRoutes(app);
  libraryRoutes(app);
  systemRoutes(app);
  registerMcpRoutes(app);

  // Production: serve the built web app from the same origin.
  if (await fs.pathExists(config.webDist)) {
    await app.register(fastifyStatic, { root: config.webDist, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/mcp') || req.url.startsWith('/internal')) return reply.code(404).send({ error: 'Not found' });
      return reply.sendFile('index.html');
    });
  }
  return app;
}
