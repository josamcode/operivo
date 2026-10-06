import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyInstance } from 'fastify';
import { log } from '../log';
import { registerAgentTools } from './agentTools';
import { registerNoorTools } from './noorTools';
import { resolveToken, type McpContext } from './tokens';

/**
 * Opervio's capabilities exposed to Claude Code / Codex as one MCP server (streamable HTTP, stateless).
 * The URL token decides who is calling (Noor or a specific agent run) and which tools exist.
 */
export function buildMcpServer(ctx: McpContext) {
  const server = new McpServer({ name: 'opervio', version: '0.1.0' }, { capabilities: { tools: {} } });
  if (ctx.role === 'noor') registerNoorTools(server, ctx);
  else registerAgentTools(server, ctx);
  return server;
}

export function registerMcpRoutes(app: FastifyInstance) {
  app.post<{ Params: { token: string } }>('/mcp/:token', async (req, reply) => {
    const ctx = resolveToken(req.params.token);
    if (!ctx) return reply.code(401).send({ error: 'Unknown or expired Opervio token' });
    const server = buildMcpServer(ctx);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    reply.hijack();
    reply.raw.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req.raw, reply.raw, req.body);
    } catch (err) {
      log.error({ err }, 'mcp request failed');
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { 'content-type': 'application/json' });
        reply.raw.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null }));
      }
    }
  });
  const notAllowed = { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null };
  app.get('/mcp/:token', async (_req, reply) => reply.code(405).send(notAllowed));
  app.delete('/mcp/:token', async (_req, reply) => reply.code(405).send(notAllowed));
}
