import { execa } from 'execa';
import fs from 'fs-extra';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import { spawnJsonl } from './process';
import type { McpServerSpec, ProviderAdapter, ProviderEvent, ProviderRunOptions } from './types';

const BIN = process.env.OPERVIO_CODEX_BIN || 'codex';

/** TOML basic strings share JSON's escaping rules for the characters we emit. */
const toml = (v: string) => JSON.stringify(v.replace(/\\/g, '/'));

export function codexMcpOverrides(servers: McpServerSpec[]): string[] {
  const args: string[] = [];
  for (const s of servers) {
    const key = `mcp_servers.${s.name}`;
    if (s.type === 'http') {
      args.push('-c', `${key}.url=${toml(s.url)}`);
    } else {
      args.push('-c', `${key}.command=${toml(s.command)}`);
      args.push('-c', `${key}.args=[${s.args.map(toml).join(',')}]`);
      for (const [k, v] of Object.entries(s.env ?? {})) args.push('-c', `${key}.env.${k}=${toml(v)}`);
    }
    args.push('-c', `${key}.startup_timeout_sec=30`, '-c', `${key}.tool_timeout_sec=600`);
  }
  return args;
}

export function codexArgs(opts: ProviderRunOptions, files: { outputSchema?: string }): string[] {
  const args = ['exec'];
  if (opts.resumeSessionId) args.push('resume');
  args.push('--json', '--skip-git-repo-check');
  args.push('-c', `model_reasoning_effort=${toml(opts.effort)}`);
  if (opts.model && opts.model !== 'default') args.push('-m', opts.model);
  const sandbox = opts.sandbox ?? 'workspace-write';
  args.push('-c', `sandbox_mode=${toml(sandbox === 'full' ? 'danger-full-access' : sandbox)}`);
  if (sandbox === 'workspace-write') args.push('-c', 'sandbox_workspace_write.network_access=true');
  args.push('-c', 'approval_policy="never"');
  if (!opts.resumeSessionId) for (const d of opts.addDirs ?? []) args.push('--add-dir', d);
  if (opts.builtinTools === 'none') args.push('-c', 'tools.web_search=false');
  else args.push('-c', 'tools.web_search=true');
  args.push(...codexMcpOverrides(opts.mcpServers ?? []));
  if (files.outputSchema) args.push('--output-schema', files.outputSchema);
  if (opts.resumeSessionId) args.push(opts.resumeSessionId);
  args.push('-');
  return args;
}

/** Translates `codex exec --json` events. Reasoning items are never surfaced (no chain-of-thought). */
export function parseCodexLine(line: Record<string, unknown>, state: { lastMessage: string }): ProviderEvent[] {
  const type = line.type as string;
  if (type === 'thread.started' && typeof line.thread_id === 'string') return [{ type: 'session', sessionId: line.thread_id }];
  if (type === 'turn.failed' || type === 'error') {
    const msg = (line.error as { message?: string })?.message ?? (line.message as string) ?? 'Codex error';
    return [{ type: 'result', text: String(msg), isError: true }];
  }
  if (type === 'turn.completed') return [{ type: 'result', text: state.lastMessage, isError: false }];
  if (type !== 'item.started' && type !== 'item.completed') return [];
  const item = (line.item ?? {}) as Record<string, unknown>;
  const id = String(item.id ?? '');
  switch (item.type) {
    case 'agent_message':
      if (type !== 'item.completed') return [];
      state.lastMessage = String(item.text ?? '');
      return [{ type: 'text', text: state.lastMessage }];
    case 'command_execution':
      return type === 'item.started'
        ? [{ type: 'tool', id, name: 'shell', input: { command: item.command } }]
        : [{ type: 'tool-result', id, isError: Number(item.exit_code ?? 0) !== 0, output: String(item.aggregated_output ?? '').slice(-4000) }];
    case 'mcp_tool_call':
      return type === 'item.started'
        ? [{ type: 'tool', id, name: `mcp__${item.server}__${item.tool}`, input: item.arguments }]
        : [{ type: 'tool-result', id, isError: item.status === 'failed', output: JSON.stringify(item.result ?? item.error ?? '').slice(0, 4000) }];
    case 'file_change':
      return type === 'item.completed' ? [{ type: 'tool', id, name: 'Edit', input: { changes: item.changes } }] : [];
    case 'web_search':
      return type === 'item.started' ? [{ type: 'tool', id, name: 'WebSearch', input: { query: item.query } }] : [];
    default:
      return [];
  }
}

export const codexProvider: ProviderAdapter = {
  id: 'codex',
  label: 'Codex',
  efforts: ['low', 'medium', 'high', 'xhigh'],
  models: [
    { id: 'default', label: 'Default (from Codex config)' },
    { id: 'gpt-5.5', label: 'GPT-5.5' },
  ],

  async detect() {
    try {
      const res = await execa(BIN, ['--version'], { timeout: 20000, windowsHide: true, reject: false });
      if (res.exitCode !== 0) return { available: false, version: null, error: String(res.stderr || 'codex --version failed').slice(0, 300) };
      return { available: true, version: String(res.stdout).trim().replace(/^codex-cli\s*/, ''), error: null };
    } catch (err) {
      return { available: false, version: null, error: (err as Error).message.slice(0, 300) };
    }
  },

  run(opts) {
    fs.ensureDirSync(opts.scratchDir);
    const files: { outputSchema?: string } = {};
    if (opts.jsonSchema) {
      files.outputSchema = join(opts.scratchDir, `schema-${nanoid(8)}.json`);
      fs.writeJsonSync(files.outputSchema, opts.jsonSchema);
    }
    // Codex has no system-prompt flag; instructions travel with the prompt.
    const system = [opts.systemPrompt, opts.appendSystemPrompt].filter(Boolean).join('\n\n');
    const input = system ? `<instructions>\n${system}\n</instructions>\n\n${opts.prompt}` : opts.prompt;
    const state = { lastMessage: '' };
    let sawResult = false;
    return spawnJsonl({
      file: BIN,
      args: codexArgs(opts, files),
      cwd: opts.cwd,
      input,
      env: opts.env,
      timeoutMs: opts.timeoutMs,
      signal: opts.signal,
      parse: (line) => {
        const evs = parseCodexLine(line, state);
        const result = evs.find((e) => e.type === 'result');
        if (result && result.type === 'result' && !result.isError && opts.jsonSchema) {
          try {
            result.structured = JSON.parse(result.text);
          } catch {
            /* leave unstructured; caller extracts JSON */
          }
        }
        if (result) sawResult = true;
        return evs;
      },
      onExit: (code, stderr) =>
        sawResult ? [] : [{ type: 'result', isError: true, text: code === -1 ? 'Cancelled' : `Codex exited (${code ?? '?'}): ${stderr.trim().slice(-600)}` }],
    });
  },
};
