import { z } from 'zod';
import { Effort, Language, ProviderId } from './common';

export const CommStyle = z.enum(['short', 'natural', 'detailed']);
export type CommStyle = z.infer<typeof CommStyle>;

export const Autonomy = z.enum(['ask_more', 'balanced', 'autonomous']);
export type Autonomy = z.infer<typeof Autonomy>;

export const ALWAYS_ASK_OPTIONS = [
  { id: 'spend_money', label: 'Spending money' },
  { id: 'send_messages', label: 'Sending messages in my name' },
  { id: 'publish', label: 'Publishing anything publicly' },
  { id: 'delete', label: 'Deleting files or data' },
  { id: 'production', label: 'Production deploys or changes' },
  { id: 'commitments', label: 'Commitments to clients or partners' },
] as const;
export const AlwaysAsk = z.enum(ALWAYS_ASK_OPTIONS.map((o) => o.id) as [string, ...string[]]);

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((s) => s === '' || /^https?:\/\/\S+$/i.test(s) || /^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(s), 'Enter a link')
  .optional();

export const SetupInput = z.object({
  language: Language,
  name: z.string().trim().min(1, 'Your name').max(60),
  work: z.string().trim().min(2, 'A few words is enough').max(1000),
  plate: z.string().trim().min(5, 'Tell Noor what is on your plate').max(4000),
  timeAvailable: z.string().trim().min(1).max(200),
  links: z.object({
    github: optionalUrl,
    website: optionalUrl,
    social: optionalUrl,
  }),
  commStyle: CommStyle,
  autonomy: Autonomy,
  alwaysAsk: z.array(AlwaysAsk),
  timezone: z.string().max(60).optional(),
});
export type SetupInput = z.infer<typeof SetupInput>;

/** Which model/provider/effort a kind of work uses. Founder-overridable in Settings. */
export const RoleDefaults = z.object({
  provider: z.union([ProviderId, z.literal('auto')]),
  model: z.string().max(60),
  effort: Effort,
});
export type RoleDefaults = z.infer<typeof RoleDefaults>;

export const AI_ROLES = ['noor', 'specialist', 'coding', 'engineer', 'judge'] as const;
export type AiRole = (typeof AI_ROLES)[number];

export const AiSettings = z.object({
  noor: RoleDefaults,
  specialist: RoleDefaults,
  coding: RoleDefaults,
  engineer: RoleDefaults,
  judge: RoleDefaults,
  maxConcurrentAgents: z.number().int().min(1).max(8),
  maxCorrections: z.number().int().min(0).max(4),
});
export type AiSettings = z.infer<typeof AiSettings>;

/**
 * your-chrome: agents work in the founder's own Chrome (their tabs and sign-ins) through the
 * Claude in Chrome extension. separate: an isolated Playwright window (opt-in).
 */
export const BrowserMode = z.enum(['your-chrome', 'separate']);
export type BrowserMode = z.infer<typeof BrowserMode>;

export const ToolSettings = z.object({
  browserMode: BrowserMode,
  browserChannel: z.enum(['chrome', 'msedge', 'chromium']),
  browserHeadless: z.boolean(),
  workspaceDir: z.string().max(400),
});
export type ToolSettings = z.infer<typeof ToolSettings>;

export const DEFAULT_AI_SETTINGS: AiSettings = {
  noor: { provider: 'claude', model: 'sonnet', effort: 'medium' },
  specialist: { provider: 'claude', model: 'sonnet', effort: 'auto' },
  coding: { provider: 'auto', model: 'default', effort: 'high' },
  engineer: { provider: 'claude', model: 'haiku', effort: 'low' },
  judge: { provider: 'claude', model: 'sonnet', effort: 'low' },
  maxConcurrentAgents: 3,
  maxCorrections: 2,
};
