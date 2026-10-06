import type { ConcreteEffort } from '@opervio/contracts';
import { join } from 'node:path';
import { bus } from '../bus';
import { config } from '../config';
import { db } from '../db';
import { getFounder } from '../domain/founder';
import { searchMemory } from '../domain/memory';
import { clip, describeTool } from '../lib/text';
import { log } from '../log';
import { issueToken, mcpUrl, policyUrl, revokeToken } from '../mcp/tokens';
import { pickProvider } from '../providers/registry';
import { getAiSettings } from '../settings';
import { hookPaths } from '../tools/hook';
import { noorSystemPrompt } from './prompt';
import { noorState } from './state';

/** Noor turns run one at a time so the conversation stays coherent. */
let chain: Promise<unknown> = Promise.resolve();
const running = new Map<string, AbortController>();

function transcript(messages: { role: string; content: string }[]) {
  return messages
    .filter((m) => m.content.trim())
    .map((m) => `${m.role === 'founder' ? 'Founder' : m.role === 'noor' ? 'Noor' : 'Opervio'}: ${clip(m.content, 1500)}`)
    .join('\n\n');
}

async function runTurn(noorMessageId: string, input: { text: string; kind: 'founder' | 'system' }) {
  const founder = await getFounder();
  if (!founder) return;
  const ai = await getAiSettings();
  const abort = new AbortController();
  running.set(noorMessageId, abort);
  let content = '';
  let blockEnded = false;
  let lastSave = 0;
  const save = async (force = false) => {
    if (!force && Date.now() - lastSave < 600) return;
    lastSave = Date.now();
    await db.message.update({ where: { id: noorMessageId }, data: { content } });
  };

  const token = issueToken({ role: 'noor', messageId: noorMessageId });
  try {
    const provider = await pickProvider(ai.noor.provider);
    const effort: ConcreteEffort = ai.noor.effort === 'auto' ? 'medium' : ai.noor.effort;
    const model = ai.noor.provider === provider.id || ai.noor.provider === 'auto' ? ai.noor.model : 'default';

    const history = await db.message.findMany({ where: { id: { not: noorMessageId } }, orderBy: { createdAt: 'desc' }, take: 24 });
    const prior = history.reverse();
    const last = prior.at(-1);
    const earlier = input.kind === 'founder' && last?.role === 'founder' ? prior.slice(0, -1) : prior;
    const memories = (await searchMemory(input.text, { limit: 6 })).map((m) => `[${m.kind}] ${clip(m.content, 240)}`);
    const system = noorSystemPrompt(founder, await noorState({ detailed: true }), memories);
    const prompt = [
      earlier.length ? `## Conversation so far\n${transcript(earlier)}` : '',
      input.kind === 'founder' ? `## Founder's new message\n${input.text}` : `## Opervio event (not typed by the founder)\n${input.text}`,
      'Reply to the founder now. Use tools when they help; keep the reply itself short.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const handle = provider.run({
      prompt,
      systemPrompt: system,
      model,
      effort,
      cwd: config.paths.home,
      scratchDir: join(config.paths.runtime, 'scratch'),
      mcpServers: [{ name: 'opervio', type: 'http', url: mcpUrl(token) }],
      builtinTools: provider.id === 'claude' ? ['WebSearch', 'WebFetch', 'Read', 'Glob', 'Grep'] : 'default',
      hookSettingsPath: hookPaths().settings,
      env: { OPERVIO_POLICY_URL: policyUrl(token) },
      sandbox: 'read-only',
      timeoutMs: 10 * 60_000,
      signal: abort.signal,
    });

    let errorText: string | null = null;
    for await (const ev of handle.events) {
      if (ev.type === 'text-delta') {
        const piece = blockEnded && content ? `\n\n${ev.text}` : ev.text;
        blockEnded = false;
        content += piece;
        bus.emitEvent({ type: 'message.delta', messageId: noorMessageId, text: piece });
        await save();
      } else if (ev.type === 'text') {
        if (provider.id !== 'claude') {
          const piece = content ? `\n\n${ev.text}` : ev.text;
          content += piece;
          bus.emitEvent({ type: 'message.delta', messageId: noorMessageId, text: piece });
        }
        blockEnded = true;
      } else if (ev.type === 'tool') {
        const label = describeTool(ev.name, ev.input);
        if (label) {
          const msg = await db.message.findUnique({ where: { id: noorMessageId } });
          await db.message.update({ where: { id: noorMessageId }, data: { activity: [...(msg?.activity ?? []), label] } });
          bus.emitEvent({ type: 'message.activity', messageId: noorMessageId, label });
        }
      } else if (ev.type === 'result') {
        if (ev.isError) errorText = ev.text;
        else if (!content.trim() && ev.text) content = ev.text;
      }
    }
    if (errorText && !content.trim()) {
      content = founder.language === 'ar' ? `معرفتش أكمل دلوقتي: ${clip(errorText, 300)}` : `I couldn't finish that: ${clip(errorText, 300)}`;
      await db.message.update({ where: { id: noorMessageId }, data: { content, status: 'error' } });
    } else {
      await db.message.update({ where: { id: noorMessageId }, data: { content: content.trim(), status: 'done' } });
    }
  } catch (err) {
    log.error({ err }, 'noor turn failed');
    await db.message.update({
      where: { id: noorMessageId },
      data: { content: content || `Noor is unavailable: ${(err as Error).message}`, status: 'error' },
    });
  } finally {
    running.delete(noorMessageId);
    revokeToken(token);
    bus.invalidate('messages', 'home');
  }
}

function enqueueTurn(noorMessageId: string, input: { text: string; kind: 'founder' | 'system' }) {
  chain = chain.then(() => runTurn(noorMessageId, input)).catch((err) => log.error({ err }, 'noor chain error'));
}

/** Founder → Noor. Returns immediately; the reply streams over SSE. */
export async function sendToNoor(text: string) {
  const founderMsg = await db.message.create({ data: { role: 'founder', content: text.slice(0, 8000) } });
  const noorMsg = await db.message.create({ data: { role: 'noor', content: '', status: 'streaming' } });
  bus.invalidate('messages');
  enqueueTurn(noorMsg.id, { text, kind: 'founder' });
  return { founderMessageId: founderMsg.id, noorMessageId: noorMsg.id };
}

/** Opervio → Noor (routines, decision follow-ups). Optionally shows the founder's words in the thread. */
export async function noorSystemTurn(instruction: string, opts: { visibleText?: string; label?: string } = {}) {
  if (opts.visibleText) await db.message.create({ data: { role: 'founder', content: opts.visibleText } });
  else if (opts.label) await db.message.create({ data: { role: 'system', content: opts.label } });
  const noorMsg = await db.message.create({ data: { role: 'noor', content: '', status: 'streaming' } });
  bus.invalidate('messages');
  enqueueTurn(noorMsg.id, { text: instruction, kind: 'system' });
  return noorMsg.id;
}

export function cancelNoor(messageId: string) {
  running.get(messageId)?.abort();
}
