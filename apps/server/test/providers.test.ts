import { describe, expect, it } from 'vitest';
import { claudeArgs, claudeMcpConfig, parseClaudeLine } from '../src/providers/claude';
import { codexArgs, codexMcpOverrides, parseCodexLine } from '../src/providers/codex';
import { extractJson } from '../src/providers/registry';
import type { ProviderRunOptions } from '../src/providers/types';

const base: ProviderRunOptions = {
  prompt: 'do it',
  effort: 'high',
  cwd: 'D:/work',
  scratchDir: 'D:/tmp',
  builtinTools: 'default',
  model: 'sonnet',
};

describe('Claude Code adapter', () => {
  it('builds a non-interactive streaming invocation with effort, model, MCP and the policy hook', () => {
    const args = claudeArgs({ ...base, hookSettingsPath: 'hooks.json', resumeSessionId: 'abc' }, { mcpConfig: 'mcp.json', appendSystemPrompt: 'rules.md' });
    expect(args).toEqual(expect.arrayContaining(['-p', '--output-format', 'stream-json', '--effort', 'high', '--model', 'sonnet', '--strict-mcp-config', '--mcp-config', 'mcp.json', '--settings', 'hooks.json', '--resume', 'abc', '--append-system-prompt-file', 'rules.md']));
    expect(args).toContain('bypassPermissions');
  });

  it('drives the founder’s own Chrome only when asked (no new browser profile)', () => {
    const own = claudeArgs({ ...base, browser: 'your-chrome' }, {});
    expect(own).toContain('--chrome');
    expect(own).not.toContain('--no-chrome');
    expect(claudeArgs(base, {})).toContain('--no-chrome');
  });

  it('omits the model flag for the default model and disables tools for reasoning-only calls', () => {
    const args = claudeArgs({ ...base, model: 'default', builtinTools: 'none', jsonSchema: { type: 'object' } }, {});
    expect(args).not.toContain('--model');
    expect(args.join(' ')).toContain('--tools ');
    expect(args).toContain('--json-schema');
  });

  it('writes MCP server config for HTTP and stdio servers', () => {
    expect(
      claudeMcpConfig([
        { name: 'opervio', type: 'http', url: 'http://127.0.0.1:4100/mcp/t' },
        { name: 'playwright', type: 'stdio', command: 'node', args: ['cli.js'] },
      ]),
    ).toEqual({
      mcpServers: {
        opervio: { type: 'http', url: 'http://127.0.0.1:4100/mcp/t' },
        playwright: { type: 'stdio', command: 'node', args: ['cli.js'], env: {} },
      },
    });
  });

  it('parses stream-json into provider events and ignores subagent traffic', () => {
    expect(parseClaudeLine({ type: 'system', subtype: 'init', session_id: 's1', model: 'claude-sonnet-5-5' })).toEqual([{ type: 'session', sessionId: 's1', model: 'claude-sonnet-5-5' }]);
    expect(parseClaudeLine({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi' } } })).toEqual([{ type: 'text-delta', text: 'Hi' }]);
    expect(
      parseClaudeLine({ type: 'assistant', message: { content: [{ type: 'text', text: 'Searching' }, { type: 'tool_use', id: 't1', name: 'WebSearch', input: { query: 'x' } }] } }),
    ).toEqual([
      { type: 'text', text: 'Searching' },
      { type: 'tool', id: 't1', name: 'WebSearch', input: { query: 'x' } },
    ]);
    expect(parseClaudeLine({ type: 'assistant', parent_tool_use_id: 'p', message: { content: [{ type: 'text', text: 'sub' }] } })).toEqual([]);
    expect(parseClaudeLine({ type: 'result', subtype: 'success', is_error: false, result: 'Done', session_id: 's1', total_cost_usd: 0.02, structured_output: { ok: true } })).toEqual([
      { type: 'result', text: 'Done', structured: { ok: true }, costUsd: 0.02, isError: false, sessionId: 's1' },
    ]);
    expect(parseClaudeLine({ type: 'result', subtype: 'error_max_turns', is_error: false, result: '' })[0]).toMatchObject({ type: 'result', isError: true });
  });
});

describe('Codex adapter', () => {
  it('maps effort, sandbox and MCP servers onto config overrides and reads the prompt from stdin', () => {
    const args = codexArgs({ ...base, model: 'gpt-5.5', mcpServers: [{ name: 'opervio', type: 'http', url: 'http://127.0.0.1:4100/mcp/t' }] }, {});
    const joined = args.join(' ');
    expect(args.slice(0, 2)).toEqual(['exec', '--json']);
    expect(joined).toContain('model_reasoning_effort="high"');
    expect(joined).toContain('-m gpt-5.5');
    expect(joined).toContain('sandbox_mode="workspace-write"');
    expect(joined).toContain('mcp_servers.opervio.url="http://127.0.0.1:4100/mcp/t"');
    expect(args.at(-1)).toBe('-');
  });

  it('resumes a thread with exec resume <id>', () => {
    const args = codexArgs({ ...base, resumeSessionId: 'thread-1' }, {});
    expect(args.slice(0, 2)).toEqual(['exec', 'resume']);
    expect(args.at(-2)).toBe('thread-1');
  });

  it('escapes Windows paths for TOML', () => {
    const o = codexMcpOverrides([{ name: 'pw', type: 'stdio', command: 'C:\\node.exe', args: ['C:\\x\\cli.js'] }]).join(' ');
    expect(o).toContain('mcp_servers.pw.command="C:/node.exe"');
    expect(o).toContain('mcp_servers.pw.args=["C:/x/cli.js"]');
  });

  it('parses exec --json events without exposing reasoning', () => {
    const st = { lastMessage: '' };
    expect(parseCodexLine({ type: 'thread.started', thread_id: 'th' }, st)).toEqual([{ type: 'session', sessionId: 'th' }]);
    expect(parseCodexLine({ type: 'item.completed', item: { type: 'reasoning', text: 'secret thoughts' } }, st)).toEqual([]);
    expect(parseCodexLine({ type: 'item.started', item: { id: 'i1', type: 'command_execution', command: 'npm test' } }, st)).toEqual([{ type: 'tool', id: 'i1', name: 'shell', input: { command: 'npm test' } }]);
    expect(parseCodexLine({ type: 'item.started', item: { id: 'i2', type: 'mcp_tool_call', server: 'opervio', tool: 'save_output', arguments: { path: 'a.md' } } }, st)[0]).toMatchObject({ name: 'mcp__opervio__save_output' });
    parseCodexLine({ type: 'item.completed', item: { type: 'agent_message', text: 'All done' } }, st);
    expect(parseCodexLine({ type: 'turn.completed', usage: {} }, st)).toEqual([{ type: 'result', text: 'All done', isError: false }]);
    expect(parseCodexLine({ type: 'turn.failed', error: { message: 'quota' } }, st)).toEqual([{ type: 'result', text: 'quota', isError: true }]);
  });
});

describe('structured output fallback', () => {
  it('extracts JSON from fenced or chatty text', () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('result: {"status":"complete","missing":[]} thanks')).toEqual({ status: 'complete', missing: [] });
    expect(() => extractJson('no json here')).toThrow();
  });
});
