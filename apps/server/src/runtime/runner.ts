import { resolveEffort, type ArtifactType, type CompiledPrompt, type JudgeVerdict } from '@opervio/contracts';
import chokidar from 'chokidar';
import fs from 'fs-extra';
import { basename, join } from 'node:path';
import { simpleGit } from 'simple-git';
import { bus } from '../bus';
import { config } from '../config';
import { db, Prisma } from '../db';
import { registerArtifact, scanWorkspace } from '../domain/artifacts';
import { createDecision } from '../domain/decisions';
import { requireFounder } from '../domain/founder';
import { remember } from '../domain/memory';
import { notify } from '../domain/notify';
import { taskWorkdir } from '../domain/work';
import { describeTool, toolFamily, clip } from '../lib/text';
import { log } from '../log';
import { issueToken, mcpUrl, policyUrl, revokeToken } from '../mcp/tokens';
import { pickProvider } from '../providers/registry';
import type { McpServerSpec, ProviderEvent } from '../providers/types';
import { getAiSettings, getToolSettings } from '../settings';
import { playwrightMcpServer } from '../tools/browser';
import { hookPaths } from '../tools/hook';
import { runEvent, runState, stateFor } from './events';
import { judgeResult } from './judge';
import { compilePrompt } from './prompt';
import type { BrowserAccess } from './prompt/compile';
import { interpretTask } from './prompt/interpret';
import { cancelMode, enqueueTask } from './queue';

const CODEX_FALLBACK_MODEL = process.env.OPERVIO_CODEX_FALLBACK_MODEL || 'gpt-5.5';
const RUN_TIMEOUT_MS = Number(process.env.OPERVIO_RUN_TIMEOUT_MIN || 60) * 60_000;
const DELIVERABLE = /\.(xlsx|xls|csv|pptx|docx|pdf|md|png|jpe?g|webp|svg|json|html|txt)$/i;

const followUpMessage = (followUp: string) =>
  `Continue the same task.\n\n${followUp}\n\nWhen finished, make sure every deliverable is saved and registered with save_output, then give your short final summary.`;

async function gitHead(dir: string) {
  try {
    if (!(await fs.pathExists(join(dir, '.git')))) return null;
    return (await simpleGit(dir).revparse(['HEAD'])).trim();
  } catch {
    return null;
  }
}

/** Coding work: the deliverable is the change itself — saved as a patch outside the founder's repo. */
async function captureDiff(dir: string, startHead: string, meta: { taskId: string; runId: string; agentId: string; focusId: string | null; title: string }) {
  const git = simpleGit(dir);
  const diff = await git.diff([startHead]);
  if (!diff.trim()) return null;
  const stat = await git.diff(['--shortstat', startHead]);
  const commits = await git.log({ from: startHead, to: 'HEAD' }).catch(() => ({ all: [] as { hash: string; message: string }[] }));
  const out = join(config.paths.home, 'outputs', 'diffs', `${meta.taskId.slice(-6)}-${meta.runId.slice(-6)}.diff`);
  await fs.outputFile(out, diff);
  const summary = [stat.trim(), ...commits.all.map((c) => `${c.hash.slice(0, 7)} ${c.message}`)].filter(Boolean).join('\n');
  const { title, ...ids } = meta;
  return (await registerArtifact({ path: out, title: `Changes — ${title}`, summary, ...ids })).artifact;
}

export async function runTask(taskId: string, signal: AbortSignal) {
  const task = await db.task.findUniqueOrThrow({ where: { id: taskId }, include: { agent: true, focus: true } });
  const agent = task.agent;
  const founder = await requireFounder();
  const ai = await getAiSettings();
  const role = task.taskType === 'coding' ? ai.coding : ai.specialist;

  const interp = interpretTask(task);
  const toolSettings = await getToolSettings();
  const yourChrome = toolSettings.browserMode === 'your-chrome';
  const provider = await pickProvider((agent.provider !== 'auto' ? agent.provider : role.provider) as 'claude' | 'codex' | 'auto', task.taskType as never, {
    needsYourChrome: yourChrome && interp.needs.browser,
  });
  // Browser access for this run: the founder's own Chrome (Claude only), or an opt-in separate window.
  const browser: BrowserAccess = yourChrome ? (provider.id === 'claude' ? 'your-chrome' : 'none') : 'separate';
  let model = agent.model !== 'default' ? agent.model : role.provider === provider.id ? role.model : 'default';
  const previousRuns = await db.run.findMany({ where: { taskId }, orderBy: { startedAt: 'desc' } });
  const failures = previousRuns.filter((r) => ['incomplete', 'failed'].includes((r.verdict as JudgeVerdict | null)?.status ?? '')).length;
  const requested = agent.effort !== 'auto' ? agent.effort : task.effort !== 'auto' ? task.effort : role.effort;
  const effort = resolveEffort(requested as never, { taskType: interp.taskType, complexity: interp.complexity, previousFailures: failures }, provider.efforts);
  const attempt = previousRuns.length + 1;

  const workdir = await taskWorkdir(task, task.focus?.key ?? null);
  await db.task.update({ where: { id: taskId }, data: { status: 'running', attempts: { increment: 1 }, startedAt: task.startedAt ?? new Date(), workdir } });
  await db.agent.update({ where: { id: agent.id }, data: { status: 'working' } });
  const run = await db.run.create({ data: { taskId, agentId: agent.id, attempt, provider: provider.id, model, effort, status: 'preparing' } });
  bus.invalidate('agents', 'tasks', 'home', 'nav', `agent:${agent.id}`);
  const ev = (kind: Parameters<typeof runEvent>[2], label: string, detail?: unknown) => runEvent(run.id, agent.id, kind, label, detail);

  // Continue the provider session when this run applies judge feedback or a founder answer.
  const prev = previousRuns.find((r) => r.sessionId && r.provider === provider.id);
  const followUp = task.followUp;
  const resume = followUp && prev?.sessionId ? prev.sessionId : undefined;

  await ev('status', followUp ? 'Applying feedback' : attempt === 1 ? 'Preparing instructions' : 'Resuming after a restart');
  let compiled: CompiledPrompt;
  if (resume && prev?.prompt) {
    compiled = prev.prompt as unknown as CompiledPrompt;
  } else {
    compiled = (await compilePrompt({ task, agent, focus: task.focus, founder, workdir, provider: provider.id, attempt, browser })).prompt;
    if (followUp) compiled = { ...compiled, text: `${compiled.text}\n\n## Note from the previous attempt\n${followUp}` };
  }
  const promptText = resume ? followUpMessage(followUp!) : compiled.text;
  const shownPrompt = resume ? { ...compiled, text: `${compiled.text}\n\n---\n## Follow-up (same session)\n${followUp}` } : compiled;
  await db.run.update({ where: { id: run.id }, data: { prompt: shownPrompt as unknown as Prisma.InputJsonValue, status: 'running' } });
  await db.task.update({ where: { id: taskId }, data: { followUp: null } });

  const token = issueToken({ role: 'agent', runId: run.id, taskId, agentId: agent.id, focusId: task.focusId, workdir });
  const servers: McpServerSpec[] = [{ name: 'opervio', type: 'http', url: mcpUrl(token) }];
  if (browser === 'separate') servers.push(await playwrightMcpServer(workdir));
  const startHead = interp.needs.code ? await gitHead(workdir) : null;
  const startedAt = new Date();

  const watcher = chokidar.watch(workdir, {
    ignoreInitial: true,
    depth: 3,
    ignored: (p) => /node_modules|[\\/]\.git|\.venv|[\\/]\.opervio|[\\/]\.browser|__pycache__/.test(p),
    awaitWriteFinish: { stabilityThreshold: 700 },
  });
  watcher.on('add', (p) => {
    if (DELIVERABLE.test(p)) void ev('file', `Created ${basename(p)}`, { path: p });
  });

  await ev('status', `Working · ${provider.label} · ${effort}`, { provider: provider.id, model, effort });
  let result: Extract<ProviderEvent, { type: 'result' }> | null = null;
  let finalText = '';
  let sessionId: string | null = null;
  const tools = new Set<string>();
  let lastLabel = '';
  const toolNames = new Map<string, string>();
  let chromeNoticeSent = false;
  /** Claude in Chrome asks the founder before acting on a site — make that visible instead of a silent stall. */
  const chromeNotice = async (output: string) => {
    if (chromeNoticeSent) return;
    const notConnected = /not connected|no (browser|chrome)|extension (is )?not|couldn.t connect|unable to connect/i.test(output);
    const needsOk = /permission|approve|not allowed|denied by user|grant/i.test(output);
    if (!notConnected && !needsOk) return;
    chromeNoticeSent = true;
    const label = notConnected ? 'Chrome isn’t connected — open Chrome with the Claude extension' : 'Waiting for your OK in Chrome';
    await ev('note', label);
    await notify(
      'action',
      notConnected ? `${agent.name} can’t reach your Chrome` : `${agent.name} needs your OK in Chrome`,
      notConnected ? 'Open Chrome (with the Claude in Chrome extension signed in) so the agent can use your browser.' : 'Approve the Claude in Chrome prompt in your browser so the work can continue.',
      `?agent=${agent.id}`,
    );
  };

  const execute = async (useModel: string) => {
    result = null;
    const handle = provider.run({
      prompt: promptText,
      appendSystemPrompt: compiled.systemText,
      model: useModel,
      effort,
      cwd: workdir,
      mcpServers: servers,
      browser: browser === 'your-chrome' ? 'your-chrome' : undefined,
      builtinTools: 'default',
      resumeSessionId: resume,
      hookSettingsPath: hookPaths().settings,
      sandbox: 'workspace-write',
      addDirs: [join(config.paths.home, 'outputs')],
      timeoutMs: RUN_TIMEOUT_MS,
      signal,
      env: { OPERVIO_POLICY_URL: policyUrl(token) },
      scratchDir: join(config.paths.runtime, 'scratch'),
    });
    if (handle.pid) await db.run.update({ where: { id: run.id }, data: { pid: handle.pid } });
    for await (const e of handle.events) {
      if (e.type === 'session') {
        sessionId = e.sessionId;
        if (e.model) await db.run.update({ where: { id: run.id }, data: { model: e.model, sessionId: e.sessionId } });
        else await db.run.update({ where: { id: run.id }, data: { sessionId: e.sessionId } });
      } else if (e.type === 'tool-result') {
        if (e.id && toolNames.get(e.id)?.startsWith('mcp__claude-in-chrome__') && (e.isError || /permission|approve|connect/i.test(e.output))) await chromeNotice(e.output);
      } else if (e.type === 'tool') {
        if (e.id) toolNames.set(e.id, e.name);
        const family = toolFamily(e.name, e.input);
        if (family && !tools.has(family)) {
          tools.add(family);
          await db.run.update({ where: { id: run.id }, data: { toolsUsed: [...tools] } });
        }
        const label = describeTool(e.name, e.input);
        if (label && label !== lastLabel) {
          lastLabel = label;
          await ev('tool', label, { tool: e.name });
        }
      } else if (e.type === 'text') {
        finalText = e.text;
      } else if (e.type === 'result') {
        result = e;
        if (e.text) finalText = e.text;
        if (e.sessionId) sessionId = e.sessionId;
        if (e.costUsd !== undefined) await db.run.update({ where: { id: run.id }, data: { costUsd: { increment: e.costUsd } } });
      }
    }
  };

  try {
    await db.run.update({ where: { id: run.id }, data: { costUsd: 0 } });
    await execute(model);
    const r = result as Extract<ProviderEvent, { type: 'result' }> | null;
    if (r?.isError && provider.id === 'codex' && model === 'default' && /newer version of Codex|not supported/i.test(r.text) && !signal.aborted) {
      model = CODEX_FALLBACK_MODEL;
      await db.run.update({ where: { id: run.id }, data: { model } });
      await ev('note', `Codex CLI can't use the configured model — continuing with ${model}`);
      await execute(model);
    }
  } finally {
    await watcher.close();
    revokeToken(token);
  }

  const res = result as Extract<ProviderEvent, { type: 'result' }> | null;
  const finish = (data: Prisma.RunUpdateInput) =>
    db.run.update({ where: { id: run.id }, data: { finishedAt: new Date(), sessionId, result: clip(finalText, 8000), toolsUsed: [...tools], ...data } });

  // Founder stopped or paused the agent.
  if (signal.aborted) {
    const mode = cancelMode(taskId) ?? 'stop';
    await finish({ status: 'cancelled' });
    await db.task.update({ where: { id: taskId }, data: { status: mode === 'pause' ? 'waiting' : 'cancelled' } });
    await db.agent.update({ where: { id: agent.id }, data: { status: mode === 'pause' ? 'waiting' : 'stopped' } });
    await ev('status', mode === 'pause' ? 'Paused by founder' : 'Stopped by founder');
    runState.delete(run.id);
    bus.invalidate('agents', 'tasks', 'home', 'nav');
    return;
  }

  if (!res || res.isError) {
    const message = clip(res?.text || 'The provider ended without a result', 600);
    await finish({ status: 'failed', error: message });
    await db.task.update({ where: { id: taskId }, data: { status: 'failed', summary: message, finishedAt: new Date() } });
    await db.agent.update({ where: { id: agent.id }, data: { status: 'failed' } });
    await ev('error', 'Run failed', { message });
    await notify('failed', `${agent.name} stopped: ${task.title}`, message, `?agent=${agent.id}`);
    runState.delete(run.id);
    bus.invalidate('agents', 'tasks', 'home', 'nav');
    return;
  }

  // Outputs: register files the agent created but didn't register; capture code changes.
  const meta = { agentId: agent.id, taskId, runId: run.id, focusId: task.focusId };
  if (startHead) {
    await captureDiff(workdir, startHead, { ...meta, title: task.title }).catch((err) => log.warn({ err }, 'diff capture failed'));
  } else {
    await scanWorkspace(workdir, startedAt, meta);
  }
  const artifacts = await db.artifact.findMany({ where: { taskId } });
  const state = stateFor(run.id);

  // Judge.
  await db.run.update({ where: { id: run.id }, data: { status: 'judging' } });
  await ev('status', 'Checking the result');
  const openQuestions = await db.decision.count({ where: { taskId, status: 'open', createdAt: { gte: startedAt } } });
  const verdict = openQuestions
    ? { status: 'needs_founder' as const, summary: 'Waiting for the founder’s answer.', missing: [], method: 'rules' as const }
    : await judgeResult(
        {
          objective: task.objective,
          successCriteria: compiled.successCriteria,
          deliverables: compiled.deliverables,
          expectedOutputs: interp.expectedOutputs as ArtifactType[],
          finalSummary: finalText,
          artifacts: artifacts.map((a) => ({ title: a.title, type: a.type as ArtifactType, path: a.path, sizeBytes: a.sizeBytes })),
          records: [...state.records.entries()].map(([collection, c]) => ({ collection, ...c })),
          progress: state.progress,
        },
        ai.judge,
      );
  runState.delete(run.id);
  await finish({ status: 'done', verdict: verdict as unknown as Prisma.InputJsonValue });
  const judgeLabel = { complete: 'Result verified', incomplete: 'Incomplete', needs_founder: 'Needs the founder', failed: 'Failed' }[verdict.status];
  await ev('judge', `${judgeLabel} — ${clip(verdict.summary, 140)}`, verdict);

  const verdictJson = verdict as unknown as Prisma.InputJsonValue;
  const link = `?agent=${agent.id}`;
  switch (verdict.status) {
    case 'complete': {
      await db.task.update({ where: { id: taskId }, data: { status: 'done', verdict: verdictJson, summary: clip(finalText, 2000), finishedAt: new Date() } });
      const more = await db.task.count({ where: { agentId: agent.id, status: { in: ['queued', 'running'] } } });
      await db.agent.update({ where: { id: agent.id }, data: { status: more ? 'idle' : 'done' } });
      await notify('completed', `${agent.name} finished: ${task.title}`, verdict.summary, link);
      if (compiled.engineered && compiled.instructions.length > 1) {
        await remember({
          kind: 'approach',
          content: `${interp.taskType} — "${task.title}": ${compiled.instructions.slice(0, 3).join(' ')}`,
          source: `agent:${agent.name}`,
          focusId: task.focusId,
        }).catch(() => {});
      }
      break;
    }
    case 'incomplete': {
      const corrections = previousRuns.filter((r) => (r.verdict as JudgeVerdict | null)?.status === 'incomplete').length + 1;
      if (corrections <= ai.maxCorrections && verdict.feedback) {
        await db.task.update({ where: { id: taskId }, data: { status: 'queued', verdict: verdictJson, followUp: `Result check: ${verdict.summary}\nWhat is missing: ${verdict.missing.join('; ') || '—'}\nFeedback: ${verdict.feedback}` } });
        await db.agent.update({ where: { id: agent.id }, data: { status: 'idle' } });
        bus.invalidate('agents', 'tasks', 'home');
        enqueueTask(taskId);
      } else {
        await db.task.update({ where: { id: taskId }, data: { status: 'waiting', verdict: verdictJson, summary: clip(finalText, 2000) } });
        await db.agent.update({ where: { id: agent.id }, data: { status: 'waiting' } });
        await notify('action', `${agent.name} couldn’t fully finish: ${task.title}`, verdict.summary, link);
      }
      break;
    }
    case 'needs_founder': {
      if (!openQuestions && verdict.founderQuestion) {
        await createDecision({ kind: 'question', title: verdict.founderQuestion, why: verdict.summary, agentId: agent.id, taskId, focus: task.focusId });
      }
      await db.task.update({ where: { id: taskId }, data: { status: 'waiting', verdict: verdictJson } });
      await db.agent.update({ where: { id: agent.id }, data: { status: 'waiting' } });
      break;
    }
    case 'failed': {
      await db.task.update({ where: { id: taskId }, data: { status: 'failed', verdict: verdictJson, summary: clip(finalText, 2000), finishedAt: new Date() } });
      await db.agent.update({ where: { id: agent.id }, data: { status: 'failed' } });
      await notify('failed', `${agent.name} failed: ${task.title}`, verdict.summary, link);
      break;
    }
  }
  bus.invalidate('agents', 'tasks', 'home', 'nav', 'outputs', `agent:${agent.id}`);
}

