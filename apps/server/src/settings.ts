import { AiSettings, DEFAULT_AI_SETTINGS, ToolSettings, type AiRole, type RoleDefaults } from '@opervio/contracts';
import { existsSync } from 'node:fs';
import { config } from './config';
import { db } from './db';

const detectChannel = (): ToolSettings['browserChannel'] => {
  if (process.platform !== 'win32') return 'chrome';
  const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`];
  return chrome.some((p) => existsSync(p)) ? 'chrome' : 'msedge';
};

export const defaultToolSettings = (): ToolSettings => ({
  browserChannel: detectChannel(),
  browserHeadless: false,
  workspaceDir: config.paths.workspace,
});

export async function getAiSettings(): Promise<AiSettings> {
  const row = await db.setting.findUnique({ where: { key: 'ai' } });
  const parsed = AiSettings.safeParse({ ...DEFAULT_AI_SETTINGS, ...((row?.value as object) ?? {}) });
  return parsed.success ? parsed.data : DEFAULT_AI_SETTINGS;
}

export async function setAiSettings(value: AiSettings) {
  const data = AiSettings.parse(value);
  await db.setting.upsert({ where: { key: 'ai' }, create: { key: 'ai', value: data }, update: { value: data } });
  return data;
}

export async function getToolSettings(): Promise<ToolSettings> {
  const row = await db.setting.findUnique({ where: { key: 'tools' } });
  const parsed = ToolSettings.safeParse({ ...defaultToolSettings(), ...((row?.value as object) ?? {}) });
  return parsed.success ? parsed.data : defaultToolSettings();
}

export async function setToolSettings(value: ToolSettings) {
  const data = ToolSettings.parse(value);
  await db.setting.upsert({ where: { key: 'tools' }, create: { key: 'tools', value: data }, update: { value: data } });
  return data;
}

export async function roleDefaults(role: AiRole): Promise<RoleDefaults> {
  return (await getAiSettings())[role];
}
