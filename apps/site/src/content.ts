/**
 * Landing-page copy. Every claim here maps to something Opervio actually does today
 * (see apps/server and packages/contracts) — keep it that way when editing.
 */

export type CharacterId = 'noor' | 'youssef' | 'hana' | 'omar' | 'karim' | 'judge' | 'prompt';

export type TeamMember = {
  id: CharacterId;
  name: string;
  role: string;
  /** Specialists are hired by Noor per job and named on the spot; these names are examples. */
  example?: boolean;
  description: string;
  accent: string;
};

export const TEAM: TeamMember[] = [
  {
    id: 'noor',
    name: 'Noor',
    role: 'Chief of Staff',
    description:
      'Your one point of contact. Noor turns what you tell her into a plan, builds your pages, starts the specialists, and keeps a short list of what only you can do today.',
    accent: '#3987e5',
  },
  {
    id: 'youssef',
    name: 'Youssef',
    role: 'Lead Researcher',
    example: true,
    description:
      'Researches markets, competitors and leads in your own Chrome, in his own tabs — and saves what he finds as records you can sort and track.',
    accent: '#1baf7a',
  },
  {
    id: 'hana',
    name: 'Hana',
    role: 'Content Writer',
    example: true,
    description:
      'Drafts posts, articles, scripts and documents using what Opervio remembers about you, and hands back real files rather than chat replies.',
    accent: '#eb6834',
  },
  {
    id: 'omar',
    name: 'Omar',
    role: 'Data Analyst',
    example: true,
    description:
      'Works in a ready-made Python environment — pandas, charts, spreadsheets, PDFs — turning raw numbers into tables and charts you can read.',
    accent: '#8b5cf6',
  },
  {
    id: 'karim',
    name: 'Karim',
    role: 'Software Engineer',
    example: true,
    description:
      'Does software work in your own projects with Claude Code or Codex. Changes are saved as diffs; pushing to main or deploying waits for you.',
    accent: '#f59e0b',
  },
  {
    id: 'judge',
    name: 'Result Judge',
    role: 'Quality Check',
    description:
      'Checks every result before it counts as done. Missing files or unmet criteria go straight back to the agent with focused feedback.',
    accent: '#e5484d',
  },
  {
    id: 'prompt',
    name: 'Prompt Engineer',
    role: 'Task Briefing',
    description:
      'Sharpens every task brief — role, objective, context, success criteria and stop conditions — before a specialist starts work.',
    accent: '#14b8c4',
  },
];

export const NAV_LINKS = [
  { href: '#workflows', label: 'Workflows' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
] as const;

export const SETUP_COMMANDS = [
  { cmd: 'pnpm install', note: 'Install dependencies' },
  { cmd: 'pnpm db:up', note: 'Local Postgres in Docker' },
  { cmd: 'pnpm db:migrate', note: 'Create the database' },
  { cmd: 'pnpm app', note: 'Serve Opervio on localhost:4100' },
] as const;

export const APP_URL = 'http://localhost:4100';

/**
 * Where Noor's orb sits in the hero art (fractions of the 2748×1498 image), so the page can lay a breathing glow
 * over it. The image's object-position is set in CSS per viewport shape (see .hero-img). Set to null to disable.
 */
export const HERO_ORB: { image: { w: number; h: number }; point: { x: number; y: number }; radius: number } | null = {
  image: { w: 2748, h: 1498 },
  point: { x: 0.6444, y: 0.4485 },
  radius: 54,
};
