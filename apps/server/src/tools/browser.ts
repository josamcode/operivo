import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { McpServerSpec } from '../providers/types';
import { getToolSettings } from '../settings';

/**
 * Browsing has two modes (Settings → Tools):
 * - your-chrome (default): Claude Code drives the founder's own Chrome — their tabs and sign-ins —
 *   through the Claude in Chrome extension (`--chrome`). No profile is created; nothing to configure here.
 * - separate (opt-in): Microsoft's Playwright MCP in an isolated, throwaway browser window.
 */
const require = createRequire(import.meta.url);
const playwrightMcpCli = () => join(dirname(require.resolve('@playwright/mcp/package.json')), 'cli.js');

export async function playwrightMcpServer(workdir: string): Promise<McpServerSpec> {
  const tools = await getToolSettings();
  const args = [
    playwrightMcpCli(),
    '--browser',
    tools.browserChannel === 'chromium' ? 'chromium' : tools.browserChannel,
    '--isolated',
    '--output-dir',
    join(workdir, '.browser'),
    '--caps',
    'pdf',
    '--viewport-size',
    '1366,860',
  ];
  if (tools.browserHeadless) args.push('--headless');
  return { name: 'playwright', type: 'stdio', command: process.execPath, args };
}
