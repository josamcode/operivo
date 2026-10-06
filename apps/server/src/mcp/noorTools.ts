import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MemoryKind, MetricKey } from '@opervio/contracts';
import { z } from 'zod';
import { bus } from '../bus';
import { db } from '../db';
import { logMetric } from '../domain/data';
import { createDecision, proposePlan } from '../domain/decisions';
import { remember, searchMemory } from '../domain/memory';
import { createPage, updatePage, ValidationError } from '../domain/pages';
import { defineCollection, upsertRecords } from '../domain/records';
import { createRoutine } from '../domain/routines';
import { setToday } from '../domain/today';
import { focusByKeyOrId, spawnAgent, stopAgentWork } from '../domain/work';
import { clip } from '../lib/text';
import { noorState, taskDetail } from '../noor/state';
import { addMessageRef, AgentInput, CollectionInput, handle, LooseObject, LoosePage, TaskInput } from './util';

export function registerNoorTools(server: McpServer, ctx: { messageId: string }) {
  const activity = async (label: string) => {
    const msg = await db.message.findUnique({ where: { id: ctx.messageId } });
    if (!msg) return;
    await db.message.update({ where: { id: ctx.messageId }, data: { activity: [...msg.activity, label] } });
    bus.emitEvent({ type: 'message.activity', messageId: ctx.messageId, label });
  };

  server.registerTool(
    'get_state',
    { description: 'Current snapshot: focuses, pages (with section ids), collections, agents, recent tasks with results, open decisions, today, recent outputs. Call before changing existing pages or when you need fresh state.' },
    handle(async () => noorState({ detailed: true })),
  );

  server.registerTool(
    'propose_plan',
    {
      description:
        'Propose how to organize the founder\'s areas (focuses), their pages, first specialist agents with tasks, today\'s founder to-dos and routines. Shown to the founder as a card with Confirm/Adjust. NOTHING is created until they confirm. Use for first setup and for adding new focuses.',
      inputSchema: z.object({
        summary: z.string().describe('Short, in the founder\'s language: how you see it and the priorities'),
        focuses: z.array(
          z.object({
            key: z.string().describe('slug, e.g. "clients"'),
            name: z.string(),
            kind: z.enum(['main', 'supporting', 'continuous', 'goal', 'idea', 'experiment']),
            why: z.string(),
            cadence: z.string().optional(),
            collections: z.array(CollectionInput).optional(),
            page: LoosePage.optional(),
          }),
        ),
        agents: z.array(AgentInput.extend({ focus: z.string(), task: TaskInput })).optional(),
        today: z.array(z.object({ title: z.string(), focus: z.string().optional(), minutes: z.number().optional() })).optional(),
        todayNote: z.string().optional(),
        routines: z.array(LooseObject).optional(),
        confirmMessage: z.string().describe('What you will say once they confirm (founder\'s language, short)'),
      }),
    },
    handle(async (plan) => {
      const decision = await proposePlan(plan);
      await addMessageRef(ctx.messageId, { kind: 'decision', id: decision.id });
      await activity('Prepared a plan for you to confirm');
      return `Plan card shown to the founder (decision ${decision.id}). Do not create these pages/agents yourself — wait for confirmation. End your reply with a short line asking them to confirm or adjust.`;
    }),
  );

  server.registerTool(
    'create_page',
    {
      description: 'Create a page in the founder\'s sidebar from the UI registry. Use focus to attach it to a confirmed focus. Returns the slug and warnings.',
      inputSchema: LoosePage.extend({ focus: z.string().optional().describe('focus key or id') }),
    },
    handle(async ({ focus, ...spec }) => {
      const f = await focusByKeyOrId(focus);
      if (focus && !f) throw new ValidationError(`Unknown focus "${focus}"`);
      const { page, warnings } = await createPage({ spec, focusId: f?.id ?? null });
      await addMessageRef(ctx.messageId, { kind: 'page', slug: page.slug, title: page.title });
      await activity(`Created page ${page.title}`);
      return { slug: page.slug, warnings };
    }),
  );

  server.registerTool(
    'update_page',
    {
      description:
        'Change a page with operations: rename, set_icon, set_description, add_section {section,index?}, remove_section {id}, move_section {id,index}, update_section {id,patch}, replace_sections {sections}. All changes are validated.',
      inputSchema: z.object({ page: z.string().describe('slug or id'), ops: z.array(LooseObject) }),
    },
    handle(async ({ page, ops }) => {
      const res = await updatePage(page, ops);
      await activity(`Updated page ${res.page.title}`);
      return { slug: res.page.slug, warnings: res.warnings };
    }),
  );

  server.registerTool(
    'define_collection',
    {
      description: 'Define (or extend) a typed collection of structured records that pages can display (leads, scripts, lessons, workouts…). Field types: text, longtext, number, currency, percent, date, datetime, url, email, phone, status (needs options), tags, boolean, person.',
      inputSchema: z.object({ focus: z.string().optional(), collection: CollectionInput }),
    },
    handle(async ({ focus, collection }) => {
      const f = await focusByKeyOrId(focus);
      const res = await defineCollection(collection, f?.id ?? null);
      return { key: res.def.key, created: res.created };
    }),
  );

  server.registerTool(
    'upsert_records',
    {
      description: 'Add or update records in a collection (e.g. the founder tells you about a new lead). Use "key" (domain, URL, email) to update instead of duplicate.',
      inputSchema: z.object({ collection: z.string(), records: z.array(z.object({ key: z.string().optional(), data: LooseObject })) }),
    },
    handle(async ({ collection, records }) => upsertRecords(collection, records)),
  );

  server.registerTool(
    'spawn_agent',
    {
      description:
        'Start a specialist agent on a task right away (no approval needed). Give a short human name, a precise role, and a task with a concrete objective, deliverable and verifiable success criteria. Opervio compiles a task-specific prompt, picks tools and effort, and checks the result. Reuses an idle agent with the same name in the same focus.',
      inputSchema: z.object({ agent: AgentInput, focus: z.string().optional(), task: TaskInput }),
    },
    handle(async ({ agent, focus, task }) => {
      const res = await spawnAgent({ agent, task, focus });
      await addMessageRef(ctx.messageId, { kind: 'agent', id: res.agent.id, name: res.agent.name });
      await activity(`Started ${res.agent.name}`);
      return { agentId: res.agent.id, taskId: res.task.id, status: 'queued' };
    }),
  );

  server.registerTool(
    'get_task',
    { description: 'Details of a task: status, judge verdict, the agent\'s summary and outputs. Use to report results accurately.', inputSchema: z.object({ task: z.string().describe('task id') }) },
    handle(async ({ task }) => taskDetail(task)),
  );

  server.registerTool(
    'stop_agent',
    { description: 'Stop or pause an agent\'s current task.', inputSchema: z.object({ agent: z.string().describe('agent id'), mode: z.enum(['stop', 'pause']) }) },
    handle(async ({ agent, mode }) => {
      const t = await stopAgentWork(agent, mode);
      return t ? `${mode === 'stop' ? 'Stopped' : 'Paused'} "${t.title}"` : 'Nothing running for that agent.';
    }),
  );

  server.registerTool(
    'set_today',
    {
      description: 'Set the founder\'s list for today: ONLY things they must personally do (max ~5), each short and concrete. Optional one-line note shown on Home.',
      inputSchema: z.object({ items: z.array(z.object({ title: z.string(), focus: z.string().optional(), minutes: z.number().optional() })), note: z.string().optional() }),
    },
    handle(async ({ items, note }) => {
      await setToday(items, note ?? null);
      await activity('Updated today');
      return 'Today updated.';
    }),
  );

  server.registerTool(
    'create_decision',
    {
      description: 'Ask the founder to choose something that genuinely needs their judgment. Tiny: title, your recommendation, why (1–2 lines), 2–4 options.',
      inputSchema: z.object({
        title: z.string(),
        recommendation: z.string(),
        why: z.string(),
        options: z.array(z.object({ id: z.string().optional(), label: z.string(), description: z.string().optional() })).min(2).max(4),
        focus: z.string().optional(),
        details: z.string().optional(),
      }),
    },
    handle(async (d) => {
      const decision = await createDecision({ kind: 'question', ...d });
      await addMessageRef(ctx.messageId, { kind: 'decision', id: decision.id });
      return `Decision shown to the founder (${decision.id}).`;
    }),
  );

  server.registerTool(
    'update_focus',
    {
      description: 'Rename, re-explain, change kind, or pause/resume/complete an existing focus. New focuses go through propose_plan.',
      inputSchema: z.object({
        focus: z.string(),
        name: z.string().optional(),
        why: z.string().optional(),
        kind: z.enum(['main', 'supporting', 'continuous', 'goal', 'idea', 'experiment']).optional(),
        status: z.enum(['active', 'paused', 'done']).optional(),
      }),
    },
    handle(async ({ focus, ...data }) => {
      const f = await focusByKeyOrId(focus);
      if (!f) throw new ValidationError(`Unknown focus "${focus}"`);
      await db.focus.update({ where: { id: f.id }, data });
      bus.invalidate('focuses', 'home', 'nav');
      return 'Focus updated.';
    }),
  );

  server.registerTool(
    'remember',
    {
      description: 'Save something durable about the founder or their work (fact, preference, decision, context, note). Not for chit-chat. Never store secrets.',
      inputSchema: z.object({ kind: MemoryKind, content: z.string(), focus: z.string().optional() }),
    },
    handle(async ({ kind, content, focus }) => {
      const f = await focusByKeyOrId(focus);
      const res = await remember({ kind, content, source: 'noor', focusId: f?.id ?? null });
      await activity('Saved to memory');
      return res.updated ? 'Updated an existing memory.' : 'Saved.';
    }),
  );

  server.registerTool(
    'search_memory',
    { description: 'Search what Opervio remembers.', inputSchema: z.object({ query: z.string(), focus: z.string().optional() }) },
    handle(async ({ query, focus }) => {
      const f = await focusByKeyOrId(focus);
      const hits = await searchMemory(query, { focusId: f?.id, limit: 10 });
      return hits.map((h) => ({ kind: h.kind, content: clip(h.content, 400), saved: new Date(h.createdAt).toISOString().slice(0, 10) }));
    }),
  );

  server.registerTool(
    'create_routine',
    {
      description:
        'Recurring work. kind: "reminder" (notify founder + add to today, needs message), "noor" (you get a prompt at that time, e.g. daily plan — needs message), "task" (a specialist runs a task — needs agent + task). schedule: 5-field cron in the founder\'s local time, e.g. "0 8 * * *".',
      inputSchema: z.object({
        title: z.string(),
        schedule: z.string(),
        kind: z.enum(['reminder', 'noor', 'task']),
        focus: z.string().optional(),
        message: z.string().optional(),
        agent: AgentInput.optional(),
        task: TaskInput.optional(),
      }),
    },
    handle(async (r) => {
      const routine = await createRoutine(r);
      await activity(`Scheduled ${routine.title}`);
      return { id: routine.id, nextRunAt: routine.nextRunAt };
    }),
  );

  server.registerTool(
    'log_metric',
    { description: 'Record a number over time (e.g. fitness.workouts = 1, income.month = 1200). Pages can chart metrics.', inputSchema: z.object({ key: MetricKey, value: z.number(), note: z.string().optional(), focus: z.string().optional() }) },
    handle(async ({ key, value, note, focus }) => {
      const f = await focusByKeyOrId(focus);
      await logMetric(key, value, { note, focusId: f?.id ?? null });
      bus.invalidate(`metric:${key}`, 'home');
      return 'Logged.';
    }),
  );
}
