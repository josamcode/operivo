import { nanoid } from 'nanoid';
import { serverUrl } from '../config';

export type McpContext =
  | { role: 'noor'; messageId: string }
  | { role: 'agent'; runId: string; taskId: string; agentId: string; focusId: string | null; workdir: string };

const tokens = new Map<string, McpContext>();

/** Per-run capability tokens: unguessable, scoped to one Noor turn or one agent run. */
export function issueToken(ctx: McpContext) {
  const token = nanoid(40);
  tokens.set(token, ctx);
  return token;
}

export function revokeToken(token: string) {
  // Grace period: the CLI may still flush a last tool call while shutting down.
  setTimeout(() => tokens.delete(token), 10_000).unref();
}

export const resolveToken = (token: string) => tokens.get(token) ?? null;
export const mcpUrl = (token: string) => `${serverUrl()}/mcp/${token}`;
export const policyUrl = (token: string) => `${serverUrl()}/internal/policy/${token}`;
