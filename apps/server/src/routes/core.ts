import { Aggregate, DataSource, type BootstrapDTO } from '@opervio/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { aggregate, metricSeries, resolveSource } from '../domain/data';
import { founderDTO } from '../domain/dto';
import { getFounder } from '../domain/founder';
import { getHome } from '../domain/home';
import { getPageDTO, listNav, reorderPages } from '../domain/pages';
import { updateRecordFields } from '../domain/records';
import { completeSetup } from '../domain/setup';

export function coreRoutes(app: FastifyInstance) {
  app.get('/api/bootstrap', async (): Promise<BootstrapDTO> => {
    const founder = await getFounder();
    return {
      setupComplete: Boolean(founder?.setupAt),
      founder: founder ? founderDTO(founder) : null,
      nav: founder ? await listNav() : [],
      unreadNotifications: await db.notification.count({ where: { readAt: null } }),
    };
  });

  app.post('/api/setup', async (req) => {
    await completeSetup(req.body);
    return { ok: true };
  });

  app.get('/api/home', async () => getHome());

  app.get<{ Params: { slug: string } }>('/api/pages/:slug', async (req, reply) => {
    const page = await getPageDTO(req.params.slug);
    return page ?? reply.code(404).send({ error: 'Page not found' });
  });

  app.post('/api/pages/reorder', async (req) => {
    const { slugs } = z.object({ slugs: z.array(z.string()).max(50) }).parse(req.body);
    await reorderPages(slugs);
    return { ok: true };
  });

  app.post('/api/data', async (req) => {
    const body = z.object({ focusId: z.string().nullish(), source: DataSource }).parse(req.body);
    return resolveSource(body.source, body.focusId);
  });

  app.post('/api/data/aggregate', async (req) => {
    const body = z.object({ focusId: z.string().nullish(), aggregate: Aggregate }).parse(req.body);
    return { value: await aggregate(body.aggregate, body.focusId) };
  });

  app.get<{ Params: { key: string }; Querystring: { range?: '7d' | '30d' | '90d' | 'all' } }>('/api/metrics/:key', async (req) =>
    metricSeries(req.params.key, req.query.range ?? '30d'),
  );

  app.patch<{ Params: { id: string } }>('/api/records/:id', async (req) => {
    const { patch } = z.object({ patch: z.record(z.string(), z.unknown()) }).parse(req.body);
    const rec = await updateRecordFields(req.params.id, patch);
    return { id: rec.id };
  });
}
