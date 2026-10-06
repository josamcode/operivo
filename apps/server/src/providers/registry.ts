import { type ConcreteEffort, type ProviderId, type RoleDefaults, type TaskType } from '@opervio/contracts';
import { join } from 'node:path';
import { z } from 'zod';
import { config } from '../config';
import { log } from '../log';
import { claudeProvider } from './claude';
import { codexProvider } from './codex';
import { fakeProvider } from './fake';
import type { ProviderAdapter, ProviderStatus } from './types';

const adapters: Record<ProviderId, ProviderAdapter> = config.fakeProviders
  ? { claude: fakeProvider('claude'), codex: fakeProvider('codex') }
  : { claude: claudeProvider, codex: codexProvider };

export const getProvider = (id: ProviderId) => adapters[id];
export const allProviders = () => Object.values(adapters);

let cache: { at: number; status: Record<ProviderId, ProviderStatus> } | null = null;

export async function providerStatus(force = false): Promise<Record<ProviderId, ProviderStatus>> {
  if (!force && cache && Date.now() - cache.at < 5 * 60_000) return cache.status;
  const [claude, codex] = await Promise.all([adapters.claude.detect(), adapters.codex.detect()]);
  cache = { at: Date.now(), status: { claude, codex } };
  return cache.status;
}

/** Resolves `auto` to a concrete available provider. Coding prefers Codex, everything else Claude. */
export async function pickProvider(pref: ProviderId | 'auto', taskType?: TaskType): Promise<ProviderAdapter> {
  const status = await providerStatus();
  if (pref !== 'auto' && status[pref].available) return adapters[pref];
  const order: ProviderId[] = taskType === 'coding' ? ['codex', 'claude'] : ['claude', 'codex'];
  if (pref !== 'auto') order.unshift(pref);
  const id = order.find((p) => status[p].available);
  if (!id) throw new Error('No AI provider is available. Install and sign in to Claude Code or Codex.');
  return adapters[id];
}

export const scratchDir = () => join(config.paths.runtime, 'scratch');

/** Pulls the first JSON object out of free text (fallback when a provider ignores the schema). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object in response');
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * A short, tool-less structured call (Prompt Engineer, Result Judge).
 * Returns null on any failure so callers can fall back deterministically.
 */
export async function completeJson<T>(opts: {
  defaults: RoleDefaults;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  timeoutMs?: number;
}): Promise<{ data: T; provider: ProviderId; model: string; effort: ConcreteEffort; costUsd?: number } | null> {
  try {
    const provider = await pickProvider(opts.defaults.provider);
    const effort = (opts.defaults.effort === 'auto' ? 'low' : opts.defaults.effort) as ConcreteEffort;
    const model = provider.id === opts.defaults.provider || opts.defaults.provider === 'auto' ? opts.defaults.model : 'default';
    const jsonSchema = z.toJSONSchema(opts.schema, { target: 'draft-7' }) as Record<string, unknown>;
    const run = provider.run({
      prompt: opts.prompt,
      systemPrompt: opts.system,
      model,
      effort,
      cwd: scratchDir(),
      scratchDir: scratchDir(),
      builtinTools: 'none',
      jsonSchema,
      sandbox: 'read-only',
      timeoutMs: opts.timeoutMs ?? 150_000,
    });
    for await (const ev of run.events) {
      if (ev.type !== 'result') continue;
      if (ev.isError) throw new Error(ev.text);
      const raw = ev.structured ?? extractJson(ev.text);
      const parsed = opts.schema.safeParse(raw);
      if (!parsed.success) throw new Error(`Schema mismatch: ${parsed.error.issues[0]?.message}`);
      return { data: parsed.data, provider: provider.id, model, effort, costUsd: ev.costUsd };
    }
    throw new Error('Provider ended without a result');
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'structured AI call failed');
    return null;
  }
}
