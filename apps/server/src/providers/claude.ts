import { execa } from 'execa';
import fs from 'fs-extra';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import { spawnJsonl } from './process';
import type { McpServerSpec, ProviderAdapter, ProviderEvent, ProviderRunOptions } from './types';

const BIN = process.env.OPERVIO_CLAUDE_BIN || 'claude';

export function claudeMcpConfig(servers: McpServerSpec[]) {
  return {
    mcpServers: Object.fromEntries(
      servers.map((s) =>
        s.type === 'http'
          ? [s.name, { type: 'http', url: s.url }]
          : [s.name, { type: 'stdio', command: s.command, args: s.args, env: s.env ?? {} }],
      ),
    ),
  };
}

/** Builds CLI arguments. Files for long prompts/config are written by the caller-provided paths. */
export function claudeArgs(
  opts: ProviderRunOptions,
  files: { mcpConfig?: string; systemPrompt?: string; appendSystemPrompt?: string },
): string[] {
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages'];
  args.push('--effort', opts.effort);
  if (opts.model && opts.model !== 'default') args.push('--model', opts.model);
  // Agents never block on permission prompts; safety comes from the PreToolUse policy hook.
  args.push('--permission-mode', 'bypassPermissions');
  // Isolate from the founder's global Claude Code customizations; project settings still apply.
  args.push('--setting-sources', 'project,local', '--no-chrome');
  args.push('--strict-mcp-config');
  if (files.mcpConfig) args.push('--mcp-config', files.mcpConfig);
  if (opts.builtinTools === 'none') args.push('--tools', '');
  else if (Array.isArray(opts.builtinTools)) args.push('--tools', opts.builtinTools.join(','));
  if (opts.disallowedTools?.length) args.push('--disallowedTools', opts.disallowedTools.join(','));
  if (files.systemPrompt) args.push('--system-prompt-file', files.systemPrompt);
  if (files.appendSystemPrompt) args.push('--append-system-prompt-file', files.appendSystemPrompt);
  if (opts.resumeSessionId) args.push('--resume', opts.resumeSessionId);
  if (opts.jsonSchema) args.push('--json-schema', JSON.stringify(opts.jsonSchema));
  if (opts.hookSettingsPath) args.push('--settings', opts.hookSettingsPath);
  for (const d of opts.addDirs ?? []) args.push('--add-dir', d);
  return args;
}

const toolResultText = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((c) => (c && typeof c === 'object' && 'text' in c ? String((c as { text: unknown }).text) : '')).join('\n');
  }
  return '';
};

/** Translates one stream-json line into provider events. Subagent traffic is ignored. */
export function parseClaudeLine(line: Record<string, unknown>): ProviderEvent[] {
  const type = line.type;
  if (line.parent_tool_use_id) return [];
  if (type === 'system' && line.subtype === 'init' && typeof line.session_id === 'string') {
    return [{ type: 'session', sessionId: line.session_id, model: typeof line.model === 'string' ? line.model : undefined }];
  }
  if (type === 'stream_event') {
    const ev = line.event as { type?: string; delta?: { type?: string; text?: string } } | undefined;
    if (ev?.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
      return [{ type: 'text-delta', text: ev.delta.text }];
    }
    return [];
  }
  if (type === 'assistant') {
    const content = ((line.message as { content?: unknown[] })?.content ?? []) as Record<string, unknown>[];
    const out: ProviderEvent[] = [];
    for (const block of content) {
      if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) out.push({ type: 'text', text: block.text });
      if (block.type === 'tool_use') out.push({ type: 'tool', id: String(block.id ?? ''), name: String(block.name), input: block.input });
    }
    return out;
  }
  if (type === 'user') {
    const content = ((line.message as { content?: unknown[] })?.content ?? []) as Record<string, unknown>[];
    return content
      .filter((b) => b.type === 'tool_result')
      .map((b) => ({ type: 'tool-result' as const, id: String(b.tool_use_id ?? ''), isError: Boolean(b.is_error), output: toolResultText(b.content).slice(0, 4000) }));
  }
  if (type === 'result') {
    return [
      {
        type: 'result',
        text: typeof line.result === 'string' ? line.result : '',
        structured: line.structured_output,
        costUsd: typeof line.total_cost_usd === 'number' ? line.total_cost_usd : undefined,
        isError: Boolean(line.is_error) || (typeof line.subtype === 'string' && line.subtype !== 'success'),
        sessionId: typeof line.session_id === 'string' ? line.session_id : undefined,
      },
    ];
  }
  return [];
}

export const claudeProvider: ProviderAdapter = {
  id: 'claude',
  label: 'Claude Code',
  efforts: ['low', 'medium', 'high', 'xhigh'],
  models: [
    { id: 'default', label: 'Default' },
    { id: 'fable', label: 'Fable' },
    { id: 'opus', label: 'Opus' },
    { id: 'sonnet', label: 'Sonnet' },
    { id: 'haiku', label: 'Haiku' },
  ],

  async detect() {
    try {
      const res = await execa(BIN, ['--version'], { timeout: 20000, windowsHide: true, reject: false });
      if (res.exitCode !== 0) return { available: false, version: null, error: String(res.stderr || 'claude --version failed').slice(0, 300) };
      return { available: true, version: String(res.stdout).trim().split(/\s/)[0] ?? null, error: null };
    } catch (err) {
      return { available: false, version: null, error: (err as Error).message.slice(0, 300) };
    }
  },

  run(opts) {
    fs.ensureDirSync(opts.scratchDir);
    const id = nanoid(8);
    const files: { mcpConfig?: string; systemPrompt?: string; appendSystemPrompt?: string } = {};
    if (opts.mcpServers?.length) {
      files.mcpConfig = join(opts.scratchDir, `mcp-${id}.json`);
      fs.writeJsonSync(files.mcpConfig, claudeMcpConfig(opts.mcpServers));
    }
    if (opts.systemPrompt) {
      files.systemPrompt = join(opts.scratchDir, `system-${id}.md`);
      fs.writeFileSync(files.systemPrompt, opts.systemPrompt);
    }
    if (opts.appendSystemPrompt) {
      files.appendSystemPrompt = join(opts.scratchDir, `append-${id}.md`);
      fs.writeFileSync(files.appendSystemPrompt, opts.appendSystemPrompt);
    }
    let sawResult = false;
    return spawnJsonl({
      file: BIN,
      args: claudeArgs(opts, files),
      cwd: opts.cwd,
      input: opts.prompt,
      env: { ...opts.env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' },
      timeoutMs: opts.timeoutMs,
      signal: opts.signal,
      parse: (line) => {
        const evs = parseClaudeLine(line);
        if (evs.some((e) => e.type === 'result')) sawResult = true;
        return evs;
      },
      onExit: (code, stderr) =>
        sawResult
          ? []
          : [
              {
                type: 'result',
                isError: true,
                text: code === -1 ? 'Cancelled' : `Claude Code exited (${code ?? '?'}): ${stderr.trim().slice(-600)}`,
              },
            ],
    });
  },
};
