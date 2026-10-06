import { AiSettings, CommStyle, Autonomy, Language, ToolSettings, type ServerEvent, type SettingsDTO } from '@opervio/contracts';
import { execa } from 'execa';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { bus } from '../bus';
import { db } from '../db';
import { isApproved } from '../domain/decisions';
import { founderDTO, routineDTO } from '../domain/dto';
import { requireFounder } from '../domain/founder';
import { nextRun } from '../domain/routines';
import { log } from '../log';
import { resolveToken } from '../mcp/tokens';
import { allProviders, providerStatus } from '../providers/registry';
import { configureQueue } from '../runtime/queue';
import { runEvent } from '../runtime/events';
import { getAiSettings, getToolSettings, setAiSettings, setToolSettings } from '../settings';
import { openSignInBrowser, signedIn, signInOpen } from '../tools/browser';
import { applyStandingPermissions, checkToolUse } from '../tools/policy';
import { ensurePython, pythonStatus } from '../tools/python';

export function systemRoutes(app: FastifyInstance) {
  // ── Live events (SSE) ──────────────────────────────────────────────
  app.get('/api/events', (req, reply) => {
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    res.write('retry: 2000\n\n');
    const send = (event: ServerEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);
    const ping = setInterval(() => res.write(': ping\n\n'), 20_000);
    bus.on('event', send);
    req.raw.on('close', () => {
      clearInterval(ping);
      bus.off('event', send);
    });
  });

  // ── Settings ───────────────────────────────────────────────────────
  app.get('/api/settings', async (): Promise<SettingsDTO> => {
    const founder = await requireFounder();
    const [ai, tools, status, py, git, routines] = await Promise.all([
      getAiSettings(),
      getToolSettings(),
      providerStatus(),
      pythonStatus(),
      execa('git', ['--version'], { reject: false, windowsHide: true }),
      db.routine.findMany({ orderBy: { createdAt: 'asc' }, include: { focus: true } }),
    ]);
    return {
      founder: founderDTO(founder),
      ai,
      tools,
      providers: allProviders().map((p) => ({ id: p.id, label: p.label, ...status[p.id], efforts: p.efforts, models: p.models })),
      toolStatus: {
        browser: { channel: tools.browserChannel, available: true, signedIn: signedIn(), signInOpen: signInOpen() },
        python: py,
        git: { available: git.exitCode === 0, version: git.exitCode === 0 ? String(git.stdout).replace('git version ', '').trim() : null },
        workspaceDir: tools.workspaceDir,
      },
      routines: routines.map(routineDTO),
    };
  });

  app.put('/api/settings/ai', async (req) => {
    const ai = await setAiSettings(AiSettings.parse(req.body));
    await configureQueue();
    bus.invalidate('settings');
    return ai;
  });

  app.put('/api/settings/tools', async (req) => {
    const tools = await setToolSettings(ToolSettings.parse(req.body));
    bus.invalidate('settings');
    return tools;
  });

  app.put('/api/settings/founder', async (req) => {
    const body = z
      .object({
        name: z.string().trim().min(1).max(60),
        language: Language,
        work: z.string().max(1000),
        timeAvailable: z.string().max(200),
        commStyle: CommStyle,
        autonomy: Autonomy,
        alwaysAsk: z.array(z.string()),
        timezone: z.string().max(60),
        links: z.object({ github: z.string().optional(), website: z.string().optional(), social: z.string().optional() }),
      })
      .parse(req.body);
    await db.founder.update({ where: { id: 'founder' }, data: body });
    bus.invalidate('settings', 'bootstrap', 'home');
    return { ok: true };
  });

  app.post('/api/settings/providers/refresh', async () => {
    await providerStatus(true);
    bus.invalidate('settings');
    return { ok: true };
  });

  app.post('/api/tools/python/install', async () => {
    void ensurePython().then(() => bus.invalidate('settings'));
    bus.invalidate('settings');
    return { ok: true };
  });

  app.post('/api/tools/browser/signin', async (req) => {
    const { url } = z.object({ url: z.string().url().optional() }).parse(req.body ?? {});
    await openSignInBrowser(url);
    bus.invalidate('settings');
    return { ok: true };
  });

  app.patch<{ Params: { id: string } }>('/api/routines/:id', async (req) => {
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    const r = await db.routine.findUniqueOrThrow({ where: { id: req.params.id } });
    await db.routine.update({ where: { id: r.id }, data: { enabled, nextRunAt: enabled ? await nextRun(r.schedule) : r.nextRunAt } });
    bus.invalidate('settings', 'routines');
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>('/api/routines/:id', async (req) => {
    await db.routine.delete({ where: { id: req.params.id } });
    bus.invalidate('settings', 'routines');
    return { ok: true };
  });

  // ── Tool policy (called by the Claude Code PreToolUse hook) ─────────
  app.post<{ Params: { token: string } }>('/internal/policy/:token', async (req) => {
    const ctx = resolveToken(req.params.token);
    if (!ctx) return { action: 'deny', reason: 'Unknown Opervio run' };
    const body = z.object({ tool: z.string(), input: z.record(z.string(), z.unknown()).default({}) }).parse(req.body);
    const founder = await requireFounder();
    let decision = applyStandingPermissions(checkToolUse(body), founder.alwaysAsk);
    const command = typeof body.input.command === 'string' ? body.input.command : '';
    if (decision.action === 'ask' && ctx.role === 'agent' && command && (await isApproved(ctx.taskId, command))) decision = { action: 'allow' };
    if (decision.action === 'allow') return decision;
    const reason =
      decision.action === 'ask'
        ? `${decision.reason}. This needs the founder's approval: call request_approval with the exact command, do not run it now, and continue with other work.`
        : `${decision.reason}. Blocked by Opervio safety policy — do not retry; find another way or report it.`;
    if (ctx.role === 'agent') await runEvent(ctx.runId, ctx.agentId, 'blocked', `Blocked: ${decision.reason}`, { tool: body.tool }).catch(() => {});
    log.info({ tool: body.tool, action: decision.action }, 'policy blocked a tool call');
    return { action: decision.action, reason };
  });
}
