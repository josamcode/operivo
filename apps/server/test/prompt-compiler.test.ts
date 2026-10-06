import { CompiledPrompt } from '@opervio/contracts';
import { describe, expect, it } from 'vitest';
import { compileSkeleton, operatingRules, renderPrompt, type SkeletonInput } from '../src/runtime/prompt/compile';
import { mergeEngineered } from '../src/runtime/prompt/engineer';
import { interpretTask } from '../src/runtime/prompt/interpret';

const task = {
  title: 'Find qualified clinic leads',
  objective: 'Produce 20 genuinely qualified prospects for the clinic web app offer.',
  taskType: 'lead_research',
  deliverable: 'qualified-leads.xlsx with one row per lead',
  successCriteria: ['20 qualified leads with evidence of fit', 'Each lead has a contact route'],
  expectedOutputs: [] as string[],
};

const input = (over: Partial<SkeletonInput> = {}): SkeletonInput => ({
  task,
  agent: { name: 'Youssef', role: 'Lead Researcher' },
  focus: { name: 'Clients', why: 'Income first.' },
  founder: { name: 'Gerges', language: 'ar', alwaysAsk: ['send_messages', 'spend_money'], autonomy: 'balanced' },
  interp: interpretTask(task),
  context: [{ source: 'founder', label: 'Founder', content: 'Name: Gerges', reason: 'Who the work is for' }],
  provider: 'claude',
  workdir: 'C:/Opervio/workspace/clients/find-leads',
  pythonPath: 'C:/Opervio/python/.venv/Scripts/python.exe',
  ...over,
});

describe('Task Interpreter', () => {
  it('infers deliverable type, tools needed and complexity', () => {
    const i = interpretTask(task);
    expect(i.taskType).toBe('lead_research');
    expect(i.expectedOutputs).toContain('xlsx');
    expect(i.needs.browser).toBe(true);
    expect(i.needs.python).toBe(true);
    expect(i.needs.records).toBe(true);
    expect(interpretTask({ ...task, taskType: 'writing', title: 'Quick draft', deliverable: 'week-1 plan', objective: 'A short simple draft plan.' }).complexity).toBe(1);
    expect(interpretTask({ ...task, taskType: 'coding', deliverable: 'fix', objective: 'Fix login bug' }).needs.code).toBe(true);
  });
});

describe('Prompt Compiler output contract', () => {
  it('produces every required section, task-specific and inspectable', () => {
    const sk = compileSkeleton(input());
    const text = renderPrompt(sk, task.title, input().workdir);
    const prompt = CompiledPrompt.parse({ ...sk, text, systemText: operatingRules(input().workdir) });
    for (const heading of ['## Role', '## Objective', '## Why', '## Context', '## Available tools', '## Instructions', '## Deliverables', '## Success criteria', '## Constraints', '## Stop / escalation']) {
      expect(prompt.text).toContain(heading);
    }
    expect(prompt.role).toContain('Youssef');
    expect(prompt.role).toContain('Lead Researcher');
    expect(prompt.instructions.join(' ')).toMatch(/evidence of fit/);
    expect(prompt.deliverables.some((d) => d.includes('.xlsx'))).toBe(true);
    expect(prompt.tools.map((t) => t.id)).toEqual(expect.arrayContaining(['browser', 'python', 'opervio', 'files']));
  });

  it('keeps the founder’s original success criteria verbatim (they are the judge’s contract)', () => {
    const sk = compileSkeleton(input());
    expect(sk.successCriteria.slice(0, 2)).toEqual(task.successCriteria);
  });

  it('encodes standing permissions, freshness and language rules as constraints', () => {
    const c = compileSkeleton(input()).constraints.join('\n');
    expect(c).toMatch(/sending messages/);
    expect(c).toMatch(/spending money/);
    expect(c).not.toMatch(/publishing anything/);
    expect(c).toMatch(/stale knowledge/);
    expect(c).toMatch(/Egyptian Arabic/);
  });

  it('describes the founder’s own Chrome, and leaves the browser out when the provider cannot drive it', () => {
    const own = compileSkeleton(input({ browser: 'your-chrome' })).tools.find((t) => t.id === 'browser');
    expect(own?.label).toMatch(/own Chrome/);
    expect(own?.usage).toMatch(/never read, navigate, type into or close tabs you did not open/);
    expect(compileSkeleton(input({ browser: 'none' })).tools.some((t) => t.id === 'browser')).toBe(false);
  });

  it('ties the agent to the collections its focus page displays, so results update the page', () => {
    const sk = compileSkeleton(input({ collections: [{ key: 'leads', title: 'Leads', fields: ['name:text', 'stage:status(prospect|qualified)'] }] }));
    expect(sk.instructions.join('\n')).toMatch(/"leads" collection.*upsert_records/);
    expect(sk.successCriteria).toContain('Every result item is recorded in the "leads" collection.');
  });

  it('only includes context it was given (never the whole database)', () => {
    const sk = compileSkeleton(input());
    expect(sk.context).toHaveLength(1);
    expect(renderPrompt(sk, task.title, 'x')).toContain('### Founder');
  });

  it('merges Prompt Engineer output without dropping original criteria or safety constraints', () => {
    const sk = compileSkeleton(input());
    const merged = mergeEngineered(
      sk,
      {
        scope: 'Clinics in Cairo with 2–20 staff and no online booking.',
        approach: ['Check existing leads', 'Search clinic directories'],
        successCriteria: ['20 leads', 'Each lead has a URL you visited'],
        deliverables: ['qualified-leads.xlsx: company, why it fits, evidence URL, contact route, next action'],
        constraints: ['Skip hospital chains'],
        stopConditions: ['Stop at 20 qualified leads'],
        relevantTools: ['browser', 'python'],
        avoid: ['Generic market reports'],
      },
      task.successCriteria,
    );
    expect(merged.engineered).toBe(true);
    expect(merged.successCriteria.slice(0, 2)).toEqual(task.successCriteria);
    expect(merged.successCriteria).toContain('Each lead has a URL you visited');
    expect(merged.constraints).toEqual(expect.arrayContaining([...sk.constraints, 'Skip hospital chains']));
    expect(merged.instructions[0]).toContain('Clinics in Cairo');
    expect(merged.tools[0].id).toBe('browser');
    expect(merged.avoid).toEqual(['Generic market reports']);
  });
});
