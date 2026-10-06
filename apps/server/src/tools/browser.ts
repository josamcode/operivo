import fs from 'fs-extra';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { chromium, type BrowserContext } from 'playwright';
import { config } from '../config';
import { log } from '../log';
import type { McpServerSpec } from '../providers/types';
import { getToolSettings } from '../settings';

/**
 * General-purpose browser for agents: Microsoft's Playwright MCP server, visible by default.
 * Each agent gets its own isolated window seeded with the founder's signed-in sessions
 * (storage state exported from Opervio's browser profile). Credentials never enter AI context.
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
  if (await fs.pathExists(config.paths.storageState)) args.push('--storage-state', config.paths.storageState);
  if (tools.browserHeadless) args.push('--headless');
  return { name: 'playwright', type: 'stdio', command: process.execPath, args };
}

let signInContext: BrowserContext | null = null;

export const signInOpen = () => Boolean(signInContext);
export const signedIn = () => fs.pathExistsSync(config.paths.storageState);

/**
 * Opens Opervio's persistent browser profile so the founder can sign in to sites themselves.
 * When the window closes, the sessions are exported for agents.
 */
export async function openSignInBrowser(url = 'https://accounts.google.com') {
  if (signInContext) return;
  const tools = await getToolSettings();
  await fs.ensureDir(config.paths.browserProfile);
  const channel = tools.browserChannel === 'chromium' ? undefined : tools.browserChannel;
  signInContext = await chromium.launchPersistentContext(config.paths.browserProfile, { channel, headless: false, viewport: null });
  const page = signInContext.pages()[0] ?? (await signInContext.newPage());
  await page.goto(url).catch(() => {});
  signInContext.on('close', () => {
    signInContext = null;
    void exportStorageState();
  });
}

export async function exportStorageState() {
  const tools = await getToolSettings();
  const channel = tools.browserChannel === 'chromium' ? undefined : tools.browserChannel;
  let ctx: BrowserContext | null = null;
  try {
    ctx = await chromium.launchPersistentContext(config.paths.browserProfile, { channel, headless: true });
    await ctx.storageState({ path: config.paths.storageState });
    log.info('browser sessions exported for agents');
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'could not export browser sessions');
  } finally {
    await ctx?.close().catch(() => {});
  }
}
