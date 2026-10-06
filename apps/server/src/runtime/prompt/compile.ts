import type { CompiledPrompt, ContextItem, ProviderId, ToolInfo } from '@opervio/contracts';
import type { Interpretation } from './interpret';

export interface SkeletonInput {
  task: { title: string; objective: string; deliverable: string; successCriteria: string[] };
  agent: { name: string; role: string };
  focus: { name: string; why: string } | null;
  founder: { name: string; language: string; alwaysAsk: string[]; autonomy: string };
  interp: Interpretation;
  context: ContextItem[];
  provider: ProviderId;
  workdir: string;
  pythonPath: string;
  browserSignedIn: boolean;
}

const ASK_LABEL: Record<string, string> = {
  spend_money: 'spending money',
  send_messages: 'sending messages or emails in the founder’s name',
  publish: 'publishing anything publicly',
  delete: 'deleting files or data',
  production: 'production deploys or changes',
  commitments: 'making commitments to clients or partners',
};

/** Outcome-oriented guidance per kind of work. Short on purpose — the agent reasons better than a script. */
const APPROACH: Record<string, string[]> = {
  lead_research: [
    'Before searching, check the existing records and outputs listed in Context so you do not duplicate work.',
    'A lead counts only if it matches the qualification criteria and you have concrete evidence of fit (a URL you actually visited).',
    'For each qualified lead capture: organization, why it fits, evidence, contact route, recommended next action.',
    'Store leads as structured records (define_collection / upsert_records) so the founder’s page updates live, then build the file deliverable from them.',
  ],
  research: ['Prefer primary, current sources; record the URL for every important claim.', 'Separate facts (with evidence) from your judgment.'],
  content: [
    'Ground every recommendation in evidence: real examples, competitor content, or the founder’s own public content.',
    'Produce material the founder can use directly (record, post, send) — not generic advice.',
  ],
  writing: ['Write in the founder’s voice and language, ready to use with minimal editing.'],
  coding: [
    'Inspect the project and existing uncommitted changes first; never discard or overwrite unrelated work.',
    'Make the smallest correct change, run the relevant tests, and iterate until they pass.',
    'Work on a branch and commit with a clear message when the change is complete.',
  ],
  analysis: ['Use Python for data work. Show the actual numbers. Save charts as PNG files when they help.'],
  learning: ['Fit the founder’s current level and realistic time. Small units, concrete exercises, clear sequencing.'],
  planning: ['Plans must fit the founder’s realistic available time. Concrete next actions over vague goals.'],
  design: ['Follow any existing brand/design references in Context. Deliver real files, not descriptions.'],
  general: [],
};

export function availableTools(i: SkeletonInput): ToolInfo[] {
  const tools: ToolInfo[] = [];
  if (i.interp.needs.web) tools.push({ id: 'web', label: 'Web search & fetch', usage: 'Search the web and read pages for research.' });
  tools.push({
    id: 'browser',
    label: 'Browser (Playwright, visible Chrome)',
    usage: `Navigate, read, click, fill forms, download/upload, screenshots, save pages as PDF via the playwright tools. ${
      i.browserSignedIn ? 'The founder’s signed-in sessions are loaded.' : 'No signed-in sessions yet — if a site needs login, ask_founder to sign in via Opervio Settings → Browser.'
    } Never type passwords.`,
  });
  tools.push({
    id: 'files',
    label: 'Files & terminal',
    usage: `Full file system and ${process.platform === 'win32' ? 'PowerShell (WSL available)' : 'shell'} access, Git and installed CLIs. Working directory: ${i.workdir}`,
  });
  tools.push({
    id: 'python',
    label: 'Python',
    usage: `Isolated env: ${i.pythonPath} (pandas, numpy, openpyxl, matplotlib, Pillow, python-docx, python-pptx, PyMuPDF). Run scripts with it or use the run_python tool. Use it when it is the best tool (data, spreadsheets, documents, charts) — not for everything.`,
  });
  tools.push({
    id: 'opervio',
    label: 'Opervio',
    usage:
      'report_progress (short milestones), save_output (register every deliverable file), define_collection / upsert_records / query_records (structured data that powers the founder’s pages), remember / search_memory, add_page_section, request_approval (consequential actions), ask_founder (only for judgment you cannot research).',
  });
  if (i.interp.needs.code) {
    tools.push({ id: 'coding', label: 'Coding', usage: 'Read/edit code, run tests and builds, use Git. Commit on a branch when the change is done.' });
  }
  return tools;
}

const dedupe = (lines: string[]) => {
  const seen = new Set<string>();
  return lines.filter((l) => {
    const k = l.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

export function universalConstraints(i: SkeletonInput): string[] {
  const asks = i.founder.alwaysAsk.map((a) => ASK_LABEL[a]).filter(Boolean);
  return [
    asks.length
      ? `Never do these without founder approval (use request_approval, then continue other work): ${asks.join('; ')}.`
      : 'Consequential external actions (spending money, messaging people, publishing) still need request_approval unless clearly reversible.',
    'Never ask for, read, print or store passwords, API keys or tokens.',
    'Never fabricate data, sources, contacts or results. Mark unknowns explicitly.',
    'Never recommend action from potentially stale knowledge when current state can be verified with available tools.',
    `Founder-facing text in ${i.founder.language === 'ar' ? 'natural Egyptian Arabic' : 'English'}; keep names, URLs and data as they are.`,
  ];
}

export const DEFAULT_STOP = [
  'Stop when every success criterion is met and each deliverable file is saved and registered with save_output.',
  'If one source or approach fails, try another before giving up; stop when reasonable options are exhausted and state exactly what is missing.',
  'If only the founder can decide something (not researchable), call ask_founder, finish everything else you can, then stop.',
];

/** Prompt Compiler: stable skeleton. Deterministic, testable, and fully inspectable. */
export function compileSkeleton(i: SkeletonInput): Omit<CompiledPrompt, 'text' | 'systemText'> {
  const outputs = i.interp.expectedOutputs;
  const deliverables = dedupe([
    i.task.deliverable,
    ...outputs.map((t) => `A real .${t === 'image' ? 'png' : t} file saved in the working directory and registered with save_output`),
  ]);
  const role = `You are ${i.agent.name}, acting as ${i.agent.role} for ${i.founder.name}${i.focus ? ` on "${i.focus.name}"` : ''}.`;
  return {
    role,
    objective: i.task.objective,
    why: i.focus ? `${i.focus.why}` : `Requested by ${i.founder.name} through Noor, their chief of staff.`,
    context: i.context,
    tools: availableTools(i),
    instructions: [...(APPROACH[i.interp.taskType] ?? []), ...(i.interp.needs.records && i.interp.taskType !== 'lead_research' ? ['If the result is a list of items the founder will track, store them as structured records (define_collection / upsert_records).'] : [])],
    deliverables,
    successCriteria: dedupe([...i.task.successCriteria, ...(outputs.length ? ['Every deliverable file exists, opens correctly and is registered with save_output.'] : [])]),
    constraints: universalConstraints(i),
    stopConditions: DEFAULT_STOP,
    avoid: [],
    engineered: false,
  };
}

const bullets = (lines: string[]) => lines.map((l) => `- ${l}`).join('\n');

export function renderPrompt(p: Omit<CompiledPrompt, 'text' | 'systemText'>, title: string, workdir: string): string {
  const sections = [
    `# Task: ${title}`,
    `## Role\n${p.role}`,
    `## Objective\n${p.objective}`,
    `## Why\n${p.why}`,
    `## Context\n${p.context.map((c) => `### ${c.label}\n${c.content}`).join('\n\n')}`,
    `## Available tools\n${p.tools.map((t) => `- **${t.label}** — ${t.usage}`).join('\n')}`,
    p.instructions.length ? `## Instructions\n${bullets(p.instructions)}` : '',
    `## Deliverables\n${bullets(p.deliverables)}`,
    `## Success criteria\n${bullets(p.successCriteria)}`,
    `## Constraints\n${bullets(p.constraints)}`,
    p.avoid.length ? `## Do not waste time on\n${bullets(p.avoid)}` : '',
    `## Stop / escalation\n${bullets(p.stopConditions)}`,
    `## Working directory\n${workdir}\nSave every file you create here (subfolders are fine).`,
  ];
  return sections.filter(Boolean).join('\n\n');
}

/** Operating rules appended to the provider's own agentic system prompt. */
export function operatingRules(workdir: string): string {
  return `# Opervio operating rules
You are a specialist agent inside Opervio, the founder's personal operating environment. Noor (the founder's chief of staff) assigned you this task.

- Work autonomously. Research, browsing, reading, analysis, creating files, local reversible edits, tests, drafts and local git branches/commits never need approval.
- Uncertainty: if it is known, act. If you have enough evidence, use best judgment and proceed. If it is unknown but discoverable, research, inspect or experiment first. Only when it truly needs the founder's judgment, call ask_founder.
- Freshness: before acting on anything that could have changed (a project, client, person, file or page), verify its current state with your tools.
- Call report_progress at real milestones with short labels ("Searching clinic directories", "12 candidates found", "Creating XLSX", "Tests 41/68") and current/total when countable. No running commentary.
- Save deliverables as real files under ${workdir} and call save_output for each one.
- Credentials: never request or handle them. Logins happen in the founder's own browser profile.
- Your final message is read by the founder: 3–6 short lines — what you produced, where it is, and anything incomplete. No reasoning transcript.`;
}
