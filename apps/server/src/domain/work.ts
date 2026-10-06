import { AgentSpec, formatZodError, slugify, TaskSpec } from '@opervio/contracts';
import fs from 'fs-extra';
import { join } from 'node:path';
import { bus } from '../bus';
import { db } from '../db';
import { cancelTask, enqueueTask } from '../runtime/queue';
import { getToolSettings } from '../settings';
import { ValidationError } from './pages';

export async function focusByKeyOrId(ref: string | null | undefined) {
  if (!ref) return null;
  return db.focus.findFirst({ where: { OR: [{ id: ref }, { key: ref }, { name: { equals: ref, mode: 'insensitive' } }] } });
}

/** Task working directory: a real project path for coding, otherwise a tidy folder per focus/task. */
export async function taskWorkdir(task: { id: string; title: string; workdir: string | null }, focusKey: string | null) {
  if (task.workdir && (await fs.pathExists(task.workdir))) return task.workdir;
  const tools = await getToolSettings();
  const dir = join(tools.workspaceDir, focusKey ?? 'general', `${slugify(task.title).slice(0, 40)}-${task.id.slice(-6)}`);
  await fs.ensureDir(dir);
  return dir;
}

/**
 * Creates (or reuses, by name within the focus) a specialist and gives it a task.
 * No approvals: spawning agents is normal internal work.
 */
export async function spawnAgent(input: { agent: unknown; task: unknown; focus?: string | null; routineId?: string }) {
  const agentSpec = AgentSpec.safeParse(input.agent);
  if (!agentSpec.success) throw new ValidationError(formatZodError(agentSpec.error, 'agent'));
  const taskSpec = TaskSpec.safeParse(input.task);
  if (!taskSpec.success) throw new ValidationError(formatZodError(taskSpec.error, 'task'));
  const focus = await focusByKeyOrId(input.focus);
  if (input.focus && !focus) throw new ValidationError(`Unknown focus "${input.focus}"`);

  const a = agentSpec.data;
  const t = taskSpec.data;
  let agent = await db.agent.findFirst({ where: { name: { equals: a.name, mode: 'insensitive' }, focusId: focus?.id ?? null } });
  if (agent && agent.status === 'working') {
    throw new ValidationError(`${agent.name} is busy. Use a different name, or wait for the current task to finish.`);
  }
  agent = agent
    ? await db.agent.update({
        where: { id: agent.id },
        data: { role: a.role, objective: t.objective, provider: a.provider ?? agent.provider, model: a.model ?? agent.model, effort: a.effort ?? agent.effort, status: 'idle' },
      })
    : await db.agent.create({
        data: {
          name: a.name,
          role: a.role,
          objective: t.objective,
          provider: a.provider ?? 'auto',
          model: a.model ?? 'default',
          effort: a.effort ?? 'auto',
          focusId: focus?.id ?? null,
        },
      });
  const task = await db.task.create({
    data: {
      title: t.title,
      objective: t.objective,
      taskType: t.taskType,
      deliverable: t.deliverable,
      successCriteria: t.successCriteria,
      expectedOutputs: t.expectedOutputs ?? [],
      effort: t.effort ?? a.effort ?? 'auto',
      workdir: t.workdir ?? null,
      agentId: agent.id,
      focusId: focus?.id ?? null,
      routineId: input.routineId ?? null,
    },
  });
  bus.invalidate('agents', 'tasks', 'home', 'nav');
  enqueueTask(task.id);
  return { agent, task };
}

export async function stopAgentWork(agentId: string, mode: 'stop' | 'pause') {
  const task = await db.task.findFirst({ where: { agentId, status: { in: ['queued', 'running'] } }, orderBy: { createdAt: 'desc' } });
  if (!task) return null;
  await cancelTask(task.id, mode);
  return task;
}

export async function resumeTask(taskId: string, followUp?: string) {
  const task = await db.task.update({
    where: { id: taskId },
    data: { status: 'queued', followUp: followUp ?? undefined },
  });
  await db.agent.update({ where: { id: task.agentId }, data: { status: 'idle' } });
  bus.invalidate('agents', 'tasks', 'home');
  enqueueTask(task.id);
  return task;
}

/** Founder override of provider/model/effort for an agent's next runs. */
export async function updateAgentSettings(agentId: string, data: { provider?: string; model?: string; effort?: string }) {
  const agent = await db.agent.update({ where: { id: agentId }, data });
  bus.invalidate('agents', `agent:${agentId}`, 'home');
  return agent;
}
