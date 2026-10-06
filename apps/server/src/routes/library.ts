import type { ArtifactDetailDTO } from '@opervio/contracts';
import { execa } from 'execa';
import type { FastifyInstance } from 'fastify';
import fs from 'fs-extra';
import open from 'open';
import { basename, extname } from 'node:path';
import { z } from 'zod';
import { bus } from '../bus';
import { db } from '../db';
import { previewFor } from '../domain/artifacts';
import { artifactDTO, memoryDTO, notificationDTO } from '../domain/dto';
import { searchMemory } from '../domain/memory';
import { getToday, toggleToday } from '../domain/today';

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/plain; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const artifactInclude = { agent: true, task: true, focus: { include: { page: true } } };

export function libraryRoutes(app: FastifyInstance) {
  // ── Outputs ────────────────────────────────────────────────────────
  app.get<{ Querystring: { q?: string; type?: string; focusId?: string; limit?: string } }>('/api/outputs', async (req) => {
    const { q, type, focusId } = req.query;
    const items = await db.artifact.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(focusId ? { focusId } : {}),
        ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { path: { contains: q, mode: 'insensitive' } }, { summary: { contains: q, mode: 'insensitive' } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(req.query.limit ?? 200), 500),
      include: artifactInclude,
    });
    return items.map(artifactDTO);
  });

  app.get<{ Params: { id: string } }>('/api/outputs/:id', async (req, reply) => {
    const a = await db.artifact.findUnique({ where: { id: req.params.id }, include: artifactInclude });
    if (!a) return reply.code(404).send({ error: 'Not found' });
    const detail: ArtifactDetailDTO = { ...artifactDTO(a), preview: await previewFor(a.id) };
    return detail;
  });

  app.get<{ Params: { id: string }; Querystring: { download?: string } }>('/api/outputs/:id/file', async (req, reply) => {
    const a = await db.artifact.findUnique({ where: { id: req.params.id } });
    if (!a || !(await fs.pathExists(a.path))) return reply.code(404).send({ error: 'File not found' });
    const name = basename(a.path);
    reply.header('content-type', MIME[extname(a.path).toLowerCase()] ?? 'application/octet-stream');
    reply.header('content-disposition', `${req.query.download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(name)}`);
    reply.header('x-content-type-options', 'nosniff');
    reply.header('content-security-policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
    return reply.send(fs.createReadStream(a.path));
  });

  app.post<{ Params: { id: string } }>('/api/outputs/:id/open', async (req) => {
    const a = await db.artifact.findUniqueOrThrow({ where: { id: req.params.id } });
    await open(a.path);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/outputs/:id/reveal', async (req) => {
    const a = await db.artifact.findUniqueOrThrow({ where: { id: req.params.id } });
    if (process.platform === 'win32') await execa('explorer.exe', [`/select,${a.path}`], { reject: false, windowsHide: false });
    else if (process.platform === 'darwin') await execa('open', ['-R', a.path], { reject: false });
    else await open(a.path.replace(/[\\/][^\\/]+$/, ''));
    return { ok: true };
  });

  // ── Memory ─────────────────────────────────────────────────────────
  app.get<{ Querystring: { q?: string } }>('/api/memories', async (req) => {
    if (req.query.q) {
      const hits = await searchMemory(req.query.q, { limit: 30 });
      return hits.map((h) => ({ id: h.id, kind: h.kind, content: h.content, source: h.source, scope: h.focusId ? 'focus' : 'global', focus: null, createdAt: new Date(h.createdAt).toISOString() }));
    }
    const items = await db.memory.findMany({ orderBy: { updatedAt: 'desc' }, take: 100, include: { focus: true } });
    return items.map(memoryDTO);
  });

  app.delete<{ Params: { id: string } }>('/api/memories/:id', async (req) => {
    await db.memory.delete({ where: { id: req.params.id } });
    bus.invalidate('memories');
    return { ok: true };
  });

  // ── Today ──────────────────────────────────────────────────────────
  app.get('/api/today', async () => getToday());
  app.post<{ Params: { id: string } }>('/api/today/:id', async (req) => {
    const { done } = z.object({ done: z.boolean() }).parse(req.body);
    await toggleToday(req.params.id, done);
    return { ok: true };
  });

  // ── Notifications ──────────────────────────────────────────────────
  app.get('/api/notifications', async () => (await db.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 40 })).map(notificationDTO));
  app.post('/api/notifications/read', async () => {
    await db.notification.updateMany({ where: { readAt: null }, data: { readAt: new Date() } });
    bus.invalidate('notifications', 'bootstrap');
    return { ok: true };
  });

  // ── Command palette search ─────────────────────────────────────────
  app.get<{ Querystring: { q?: string } }>('/api/search', async (req) => {
    const q = (req.query.q ?? '').trim();
    if (q.length < 2) return { outputs: [], agents: [], memories: [] };
    const [outputs, agents, memories] = await Promise.all([
      db.artifact.findMany({ where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { path: { contains: q, mode: 'insensitive' } }] }, take: 8, orderBy: { createdAt: 'desc' }, include: artifactInclude }),
      db.agent.findMany({ where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { role: { contains: q, mode: 'insensitive' } }] }, take: 8 }),
      searchMemory(q, { limit: 6 }),
    ]);
    return {
      outputs: outputs.map(artifactDTO),
      agents: agents.map((a) => ({ id: a.id, name: a.name, role: a.role, status: a.status })),
      memories: memories.map((m) => ({ id: m.id, kind: m.kind, content: m.content })),
    };
  });
}
