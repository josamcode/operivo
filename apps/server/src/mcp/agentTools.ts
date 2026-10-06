import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MetricKey } from '@opervio/contracts';
import { basename } from 'node:path';
import { z } from 'zod';
import { bus } from '../bus';
import { db } from '../db';
import { registerArtifact } from '../domain/artifacts';
import { logMetric } from '../domain/data';
import { createDecision } from '../domain/decisions';
import { remember, searchMemory } from '../domain/memory';
import { updatePage, ValidationError } from '../domain/pages';
import { defineCollection, queryRecords, upsertRecords } from '../domain/records';
import { clip } from '../lib/text';
import { runEvent, setProgress, stateFor } from '../runtime/events';
import { runPython } from '../tools/python';
import type { McpContext } from './tokens';
import { CollectionInput, handle, LooseObject } from './util';

type AgentCtx = Extract<McpContext, { role: 'agent' }>;

export function registerAgentTools(server: McpServer, ctx: AgentCtx) {
  const ev = (kind: Parameters<typeof runEvent>[2], label: string, detail?: unknown) => runEvent(ctx.runId, ctx.agentId, kind, label, detail);

  server.registerTool(
    'report_progress',
    {
      description: 'Report a meaningful milestone the founder sees live, e.g. "12 candidates found" or "Running tests" with current/total when countable. Not for chatter.',
      inputSchema: z.object({ label: z.string().max(120), current: z.number().optional(), total: z.number().optional() }),
    },
    handle(async ({ label, current, total }) => {
      await setProgress(ctx.runId, ctx.agentId, { label: clip(label, 120), current, total });
      return 'ok';
    }),
  );

  server.registerTool(
    'save_output',
    {
      description: 'Register a deliverable file you created (xlsx, md, pdf, pptx, docx, csv, png, code…) so it appears in the founder\'s Outputs and pages. Call once per file, after writing it. Re-registering the same path updates it.',
      inputSchema: z.object({ path: z.string().describe('absolute path, or relative to your working directory'), title: z.string().optional(), summary: z.string().optional().describe('one line: what it contains') }),
    },
    handle(async ({ path, title, summary }) => {
      const { artifact, created } = await registerArtifact({
        path,
        title,
        summary,
        agentId: ctx.agentId,
        taskId: ctx.taskId,
        runId: ctx.runId,
        focusId: ctx.focusId,
        baseDir: ctx.workdir,
      });
      await ev('file', `${created ? 'Saved' : 'Updated'} ${basename(artifact.path)}`, { artifactId: artifact.id });
      return { id: artifact.id, path: artifact.path, type: artifact.type };
    }),
  );

  server.registerTool(
    'define_collection',
    {
      description: 'Define or extend a typed collection for structured results the founder will track (leads, scripts, lessons…). Field types: text, longtext, number, currency, percent, date, datetime, url, email, phone, status (needs options), tags, boolean, person.',
      inputSchema: z.object({ collection: CollectionInput }),
    },
    handle(async ({ collection }) => {
      const res = await defineCollection(collection, ctx.focusId);
      return { key: res.def.key, created: res.created, fields: res.def.fields.map((f) => f.key) };
    }),
  );

  server.registerTool(
    'upsert_records',
    {
      description: 'Add/update records in a collection. Provide "key" (e.g. company domain or URL) so re-runs update instead of duplicating. Returns counts and validation errors to fix.',
      inputSchema: z.object({ collection: z.string(), records: z.array(z.object({ key: z.string().optional(), data: LooseObject })).max(200) }),
    },
    handle(async ({ collection, records }) => {
      const res = await upsertRecords(collection, records, { agentId: ctx.agentId, focusId: ctx.focusId });
      const st = stateFor(ctx.runId).records;
      const prev = st.get(collection) ?? { created: 0, updated: 0 };
      st.set(collection, { created: prev.created + res.created, updated: prev.updated + res.updated });
      if (res.created || res.updated) await ev('progress', `${collection}: ${res.created} added, ${res.updated} updated`);
      return res;
    }),
  );

  server.registerTool(
    'query_records',
    {
      description: 'Read records from a collection (check existing data before adding).',
      inputSchema: z.object({ collection: z.string(), where: z.record(z.string(), z.unknown()).optional(), limit: z.number().optional() }),
    },
    handle(async ({ collection, where, limit }) => {
      const res = await queryRecords(collection, { where: where as never, limit: limit ?? 100 });
      if (!res) return `No collection "${collection}".`;
      return { fields: res.def.fields.map((f) => f.key), count: res.rows.length, records: res.rows.map((r) => ({ key: r.externalKey, ...(r.data as object) })) };
    }),
  );

  server.registerTool(
    'add_page_section',
    {
      description: 'Add a section to your focus page when your results deserve a dedicated view (e.g. a kanban of leads). Uses the fixed UI registry; validated.',
      inputSchema: z.object({ section: LooseObject, index: z.number().optional() }),
    },
    handle(async ({ section, index }) => {
      if (!ctx.focusId) throw new ValidationError('This task has no focus page.');
      const page = await db.page.findUnique({ where: { focusId: ctx.focusId } });
      if (!page) throw new ValidationError('The focus has no page yet.');
      const res = await updatePage(page.id, [{ op: 'add_section', section, ...(index !== undefined ? { index } : {}) }]);
      await ev('note', `Added a section to ${res.page.title}`);
      return { page: res.page.slug, warnings: res.warnings };
    }),
  );

  server.registerTool(
    'run_python',
    {
      description: 'Run a Python script in Opervio\'s isolated environment (pandas, numpy, openpyxl, matplotlib, Pillow, python-docx, python-pptx, PyMuPDF). cwd = your working directory. Returns stdout/stderr.',
      inputSchema: z.object({ code: z.string(), timeout_sec: z.number().optional() }),
    },
    handle(async ({ code, timeout_sec }) => {
      await ev('tool', 'Running Python', { tool: 'run_python' });
      const res = await runPython(code, ctx.workdir, timeout_sec ?? 180);
      return `exit ${res.exitCode}${res.timedOut ? ' (timed out)' : ''}\n${res.output}`;
    }),
  );

  server.registerTool(
    'remember',
    {
      description: 'Save a durable, reusable learning (note), a fact about the founder\'s world, or an approach that worked. Never secrets.',
      inputSchema: z.object({ kind: z.enum(['note', 'approach', 'fact', 'context']), content: z.string() }),
    },
    handle(async ({ kind, content }) => {
      const agent = await db.agent.findUnique({ where: { id: ctx.agentId } });
      await remember({ kind, content, source: `agent:${agent?.name ?? ctx.agentId}`, focusId: ctx.focusId });
      return 'Saved.';
    }),
  );

  server.registerTool(
    'search_memory',
    { description: 'Search Opervio memory (founder facts, preferences, decisions, notes).', inputSchema: z.object({ query: z.string() }) },
    handle(async ({ query }) => {
      const hits = await searchMemory(query, { focusId: ctx.focusId, limit: 8 });
      return hits.map((h) => ({ kind: h.kind, content: clip(h.content, 400), saved: new Date(h.createdAt).toISOString().slice(0, 10) }));
    }),
  );

  server.registerTool(
    'request_approval',
    {
      description:
        'Ask the founder before a consequential action: spending money, sending/publishing in their name, production changes, irreversible deletion, commitments. Do NOT perform it. Continue other work and finish; you will be resumed with the decision.',
      inputSchema: z.object({
        action: z.string().describe('exactly what you want to do'),
        command: z.string().optional().describe('the exact command, if it is a shell command'),
        why: z.string(),
        recommendation: z.string().optional(),
        details: z.string().optional(),
      }),
    },
    handle(async ({ action, command, why, recommendation, details }) => {
      const d = await createDecision({ kind: 'approval', title: action, why, recommendation: recommendation ?? null, details: details ?? null, payload: { action, command }, agentId: ctx.agentId, taskId: ctx.taskId, focus: ctx.focusId });
      await ev('note', `Asked the founder: ${clip(action, 100)}`, { decisionId: d.id });
      return 'Approval requested. Do not perform this action now. Finish the rest of your work and end with a summary; you will be resumed with the founder\'s decision.';
    }),
  );

  server.registerTool(
    'ask_founder',
    {
      description: 'Ask the founder ONE question that needs their judgment and cannot be researched (or ask them to sign in to a site). Keep it tiny; give options and your recommendation when possible.',
      inputSchema: z.object({
        question: z.string(),
        why: z.string(),
        recommendation: z.string().optional(),
        options: z.array(z.object({ label: z.string(), description: z.string().optional() })).max(4).optional(),
      }),
    },
    handle(async ({ question, why, recommendation, options }) => {
      const d = await createDecision({ kind: 'question', title: question, why, recommendation: recommendation ?? null, options, agentId: ctx.agentId, taskId: ctx.taskId, focus: ctx.focusId });
      await ev('note', `Asked the founder: ${clip(question, 100)}`, { decisionId: d.id });
      return 'Question sent. Finish what you can without the answer, then end with a summary; you will be resumed with the answer.';
    }),
  );

  server.registerTool(
    'log_metric',
    { description: 'Record a metric value over time (e.g. leads.qualified = 7).', inputSchema: z.object({ key: MetricKey, value: z.number(), note: z.string().optional() }) },
    handle(async ({ key, value, note }) => {
      await logMetric(key, value, { note, focusId: ctx.focusId });
      bus.invalidate(`metric:${key}`);
      return 'Logged.';
    }),
  );
}
