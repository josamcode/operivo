import type { ConcreteEffort, ProviderId } from '@opervio/contracts';

export type McpServerSpec =
  | { name: string; type: 'http'; url: string }
  | { name: string; type: 'stdio'; command: string; args: string[]; env?: Record<string, string> };

/** The whole provider contract. Everything provider-specific stays inside the adapter. */
export interface ProviderRunOptions {
  prompt: string;
  /** Replaces the provider's default system prompt (used for Noor). */
  systemPrompt?: string;
  /** Appended to the provider's default agentic system prompt (used for specialists). */
  appendSystemPrompt?: string;
  model?: string;
  effort: ConcreteEffort;
  cwd: string;
  mcpServers?: McpServerSpec[];
  /** Built-in tool set: none (pure reasoning call) or the provider's full default set. */
  builtinTools: 'none' | 'default' | string[];
  disallowedTools?: string[];
  resumeSessionId?: string;
  /** JSON Schema for a structured final answer. */
  jsonSchema?: Record<string, unknown>;
  /** Claude-only: settings file that installs the PreToolUse policy hook. */
  hookSettingsPath?: string;
  addDirs?: string[];
  /** Codex sandbox; Claude is gated by the policy hook instead. */
  sandbox?: 'read-only' | 'workspace-write' | 'full';
  timeoutMs?: number;
  signal?: AbortSignal;
  env?: Record<string, string>;
  /** Directory for temp files the adapter needs (mcp config, prompt files). */
  scratchDir: string;
}

export type ProviderEvent =
  | { type: 'session'; sessionId: string; model?: string }
  | { type: 'text-delta'; text: string }
  | { type: 'text'; text: string }
  | { type: 'tool'; id?: string; name: string; input: unknown }
  | { type: 'tool-result'; id?: string; isError: boolean; output: string }
  | { type: 'result'; text: string; structured?: unknown; costUsd?: number; isError: boolean; sessionId?: string }
  | { type: 'stderr'; text: string };

export interface ProviderRun {
  events: AsyncIterable<ProviderEvent>;
  cancel(): void;
  pid?: number;
}

export interface ProviderStatus {
  available: boolean;
  version: string | null;
  error: string | null;
}

export interface ProviderAdapter {
  id: ProviderId;
  label: string;
  efforts: ConcreteEffort[];
  models: { id: string; label: string }[];
  detect(): Promise<ProviderStatus>;
  run(opts: ProviderRunOptions): ProviderRun;
}
