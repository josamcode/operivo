import { describe, expect, it } from 'vitest';
import {
  applyPageOps,
  CollectionDef,
  collectionsUsed,
  PageSpec,
  PlanProposal,
  recordSchema,
  resolveEffort,
  SECTION_TYPES,
  withSectionIds,
} from '../src';

const clientsPage = {
  title: 'Clients',
  icon: 'briefcase',
  sections: [
    {
      type: 'kpis',
      items: [
        { label: 'Prospects', compute: { source: { kind: 'records', collection: 'leads' }, op: 'count' } },
        { label: 'Qualified', compute: { source: { kind: 'records', collection: 'leads', where: { stage: 'qualified' } }, op: 'count' } },
      ],
    },
    { type: 'kanban', source: { kind: 'records', collection: 'leads' }, groupBy: 'stage' },
    { type: 'outputs', layout: 'grid' },
  ],
};

describe('page grammar', () => {
  it('accepts a page composed from registry primitives', () => {
    const parsed = PageSpec.parse(clientsPage);
    expect(parsed.sections).toHaveLength(3);
    expect(collectionsUsed(parsed)).toEqual(['leads']);
  });

  it('covers the full component registry', () => {
    for (const t of ['hero', 'kpis', 'metric', 'sparkline', 'line', 'bar', 'funnel', 'progress', 'table', 'kanban', 'timeline', 'calendar', 'list', 'agents', 'activity', 'decisions', 'outputs', 'markdown', 'tabs', 'filters']) {
      expect(SECTION_TYPES).toContain(t);
    }
  });

  it('rejects unknown section types, arbitrary styling and unknown icons', () => {
    expect(PageSpec.safeParse({ ...clientsPage, sections: [{ type: 'iframe', url: 'x' }] }).success).toBe(false);
    expect(PageSpec.safeParse({ ...clientsPage, sections: [{ type: 'markdown', content: 'hi', style: { color: 'red' } }] }).success).toBe(false);
    expect(PageSpec.safeParse({ ...clientsPage, sections: [{ type: 'markdown', content: 'hi', className: 'bg-pink-500' }] }).success).toBe(false);
    expect(PageSpec.safeParse({ ...clientsPage, icon: 'skull-and-crossbones' }).success).toBe(false);
  });

  it('requires KPI values to be static or computed', () => {
    const bad = { ...clientsPage, sections: [{ type: 'kpis', items: [{ label: 'Nothing' }] }] };
    expect(PageSpec.safeParse(bad).success).toBe(false);
  });

  it('applies AI page operations and re-validates', () => {
    const page = withSectionIds(PageSpec.parse(clientsPage));
    const next = applyPageOps(page, [
      { op: 'rename', title: 'Clients & Income' },
      { op: 'add_section', section: { type: 'markdown', content: 'Offer: **web apps for clinics**' }, index: 0 },
      { op: 'move_section', id: 'outputs-1', index: 1 },
      { op: 'update_section', id: 'kanban-1', patch: { columns: ['found', 'qualified', 'contacted'] } },
      { op: 'remove_section', id: 'kpis-1' },
    ]);
    expect(next.title).toBe('Clients & Income');
    expect(next.sections.map((s) => s.type)).toEqual(['markdown', 'outputs', 'kanban']);
    expect(() => applyPageOps(page, [{ op: 'update_section', id: 'kanban-1', patch: { groupBy: 42 } }])).toThrow(/Invalid section/);
    expect(() => applyPageOps(page, [{ op: 'remove_section', id: 'nope' }])).toThrow(/No section/);
  });

  it('assigns unique ids including nested tab sections', () => {
    const spec = withSectionIds(
      PageSpec.parse({
        title: 'Learning',
        icon: 'graduation-cap',
        sections: [
          { type: 'markdown', content: 'a' },
          { type: 'tabs', tabs: [{ label: 'A', sections: [{ type: 'markdown', content: 'b' }] }, { label: 'B', sections: [{ type: 'outputs' }] }] },
        ],
      }),
    );
    const tabs = spec.sections[1];
    expect(spec.sections[0].id).toBe('markdown-1');
    expect(tabs.type === 'tabs' && tabs.tabs[0].sections[0].id).toBe('markdown-2');
  });
});

describe('records', () => {
  const leads = CollectionDef.parse({
    key: 'leads',
    title: 'Leads',
    titleField: 'company',
    statusField: 'stage',
    fields: [
      { key: 'company', label: 'Company', type: 'text' },
      { key: 'stage', label: 'Stage', type: 'status', options: ['found', 'qualified', 'contacted'] },
      { key: 'employees', label: 'Employees', type: 'number' },
      { key: 'website', label: 'Website', type: 'url' },
      { key: 'tags', label: 'Tags', type: 'tags' },
    ],
  });

  it('validates records against the collection definition', () => {
    const schema = recordSchema(leads);
    expect(schema.parse({ company: 'Acme', stage: 'qualified', employees: '40', tags: 'clinic, cairo' })).toEqual({
      company: 'Acme',
      stage: 'qualified',
      employees: 40,
      tags: ['clinic', 'cairo'],
    });
    expect(schema.safeParse({ company: 'Acme', stage: 'won' }).success).toBe(false);
    expect(schema.safeParse({ company: 'Acme', website: 'not a url' }).success).toBe(false);
    expect(schema.safeParse({ company: 'Acme', surprise: true }).success).toBe(false);
    expect(schema.safeParse({ stage: 'found' }).success).toBe(false);
  });

  it('rejects broken collection definitions', () => {
    expect(CollectionDef.safeParse({ key: 'x', title: 'X', titleField: 'name', fields: [{ key: 'title', label: 'T', type: 'text' }] }).success).toBe(false);
    expect(CollectionDef.safeParse({ key: 'x', title: 'X', titleField: 's', fields: [{ key: 's', label: 'S', type: 'status' }] }).success).toBe(false);
  });
});

describe('plan proposal', () => {
  it('requires agents and today items to reference proposed focuses', () => {
    const base = {
      summary: 'Clients first.',
      focuses: [{ key: 'clients', name: 'Clients', kind: 'main', why: 'Income first', page: clientsPage }],
      confirmMessage: 'Starting.',
    };
    expect(PlanProposal.safeParse(base).success).toBe(true);
    const bad = {
      ...base,
      agents: [
        {
          name: 'Youssef',
          role: 'Lead Researcher',
          focus: 'fitness',
          task: { title: 'Find leads', objective: 'Find 20 qualified leads', taskType: 'lead_research', deliverable: 'xlsx', successCriteria: ['20 leads'] },
        },
      ],
    };
    expect(PlanProposal.safeParse(bad).success).toBe(false);
  });
});

describe('effort', () => {
  it('respects explicit effort and clamps to provider support', () => {
    expect(resolveEffort('high', { taskType: 'general' })).toBe('high');
    expect(resolveEffort('xhigh', { taskType: 'general' }, ['low', 'medium', 'high'])).toBe('high');
  });
  it('auto considers task type, complexity, risk and failures', () => {
    expect(resolveEffort('auto', { taskType: 'writing' })).toBe('medium');
    expect(resolveEffort('auto', { taskType: 'writing', complexity: 1 })).toBe('low');
    expect(resolveEffort('auto', { taskType: 'coding', complexity: 3 })).toBe('xhigh');
    expect(resolveEffort('auto', { taskType: 'research', previousFailures: 1 })).toBe('high');
    expect(resolveEffort(undefined, { taskType: 'coding', risky: true, complexity: 3 })).toBe('xhigh');
  });
});
