import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { ProviderId } from '@opervio/contracts';
import fs from 'fs-extra';
import { join } from 'node:path';
import { AsyncQueue } from './process';
import type { ProviderAdapter, ProviderEvent, ProviderRunOptions } from './types';

/**
 * Test-only provider (OPERVIO_FAKE_PROVIDERS=1). It behaves like a tiny scripted model but calls
 * Opervio's real MCP endpoint, so end-to-end tests exercise the actual tool path without
 * spending Claude/Codex quota.
 */
const FAKE_PLAN = {
  summary: 'Clients first, learning alongside.',
  focuses: [
    {
      key: 'clients',
      name: 'Clients',
      kind: 'main',
      why: 'Income depends on a steady pipeline.',
      collections: [
        {
          key: 'leads',
          title: 'Leads',
          titleField: 'company',
          statusField: 'stage',
          fields: [
            { key: 'company', label: 'Company', type: 'text' },
            { key: 'stage', label: 'Stage', type: 'status', options: ['found', 'qualified', 'contacted'] },
            { key: 'website', label: 'Website', type: 'url' },
          ],
        },
      ],
      page: {
        title: 'Clients',
        icon: 'briefcase',
        sections: [
          { type: 'hero', summary: 'Build a steady pipeline.' },
          {
            type: 'kpis',
            items: [
              { label: 'Leads', compute: { source: { kind: 'records', collection: 'leads' }, op: 'count' } },
              { label: 'Qualified', compute: { source: { kind: 'records', collection: 'leads', where: { stage: 'qualified' } }, op: 'count' } },
            ],
          },
          { type: 'kanban', source: { kind: 'records', collection: 'leads' }, groupBy: 'stage' },
          { type: 'agents', width: 'half' },
          { type: 'outputs', width: 'half' },
        ],
      },
    },
    { key: 'learning', name: 'Learning', kind: 'continuous', why: 'Learn AI 45 minutes a day.' },
  ],
  agents: [
    {
      name: 'Youssef',
      role: 'Lead Researcher',
      focus: 'clients',
      task: {
        title: 'Find first leads',
        objective: 'Find 2 qualified leads for the founder’s web development offer.',
        taskType: 'lead_research',
        deliverable: 'leads.md listing the leads',
        successCriteria: ['2 leads recorded'],
        expectedOutputs: ['md'],
      },
    },
  ],
  today: [{ title: 'Call one past client', focus: 'clients', minutes: 15 }],
  confirmMessage: 'Moving. Youssef is on it.',
};

async function mcpCall(url: string, tool: string, args: Record<string, unknown>) {
  const client = new Client({ name: 'opervio-fake', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  try {
    return await client.callTool({ name: tool, arguments: args });
  } finally {
    await client.close();
  }
}

async function script(opts: ProviderRunOptions, push: (e: ProviderEvent) => void) {
  push({ type: 'session', sessionId: `fake-${Date.now()}`, model: 'fake-model' });
  const opervio = opts.mcpServers?.find((s) => s.name === 'opervio');
  const url = opervio?.type === 'http' ? opervio.url : null;
  const props = (opts.jsonSchema?.properties ?? {}) as Record<string, unknown>;

  if ('status' in props && 'missing' in props) {
    const data = { status: 'complete', summary: 'Deliverable present and matches the criteria.', missing: [] };
    return push({ type: 'result', text: JSON.stringify(data), structured: data, isError: false, costUsd: 0 });
  }
  if ('scope' in props && 'approach' in props) {
    const data = {
      scope: 'Produce exactly what the objective asks, nothing more.',
      approach: ['Check existing data first', 'Do the work', 'Save and register the deliverable'],
      successCriteria: ['Deliverable saved and registered'],
      deliverables: ['The requested file'],
      constraints: [],
      stopConditions: ['Stop when the deliverable is saved'],
      relevantTools: ['opervio', 'files'],
      avoid: ['Long reports'],
    };
    return push({ type: 'result', text: JSON.stringify(data), structured: data, isError: false, costUsd: 0 });
  }

  if (opts.systemPrompt?.includes('You are Noor')) {
    if (url && /First conversation after setup|clients/i.test(opts.prompt)) {
      push({ type: 'tool', name: 'mcp__opervio__propose_plan', input: {} });
      await mcpCall(url, 'propose_plan', FAKE_PLAN);
      const text = 'Clients come first; learning runs alongside. Confirm or adjust?';
      push({ type: 'text-delta', text });
      push({ type: 'text', text });
      return push({ type: 'result', text, isError: false, costUsd: 0 });
    }
    const text = 'Got it.';
    push({ type: 'text-delta', text });
    return push({ type: 'result', text, isError: false, costUsd: 0 });
  }

  // Specialist: progress → structured records → real file → register it.
  if (url) {
    await mcpCall(url, 'report_progress', { label: 'Searching directories', current: 1, total: 2 });
    if (/lead/i.test(opts.prompt)) {
      await mcpCall(url, 'upsert_records', {
        collection: 'leads',
        records: [
          { key: 'acme.example', data: { company: 'Acme Clinic', stage: 'qualified', website: 'https://acme.example' } },
          { key: 'nile.example', data: { company: 'Nile Dental', stage: 'found', website: 'https://nile.example' } },
        ],
      });
    }
    const file = join(opts.cwd, 'leads.md');
    await fs.outputFile(file, '# Leads\n\n| Company | Stage |\n|---|---|\n| Acme Clinic | qualified |\n| Nile Dental | found |\n');
    push({ type: 'tool', name: 'Write', input: { file_path: file } });
    await mcpCall(url, 'save_output', { path: file, title: 'First leads', summary: '2 leads' });
    await mcpCall(url, 'report_progress', { label: 'Leads saved', current: 2, total: 2 });
  }
  const text = 'Found 2 leads and saved leads.md.';
  push({ type: 'text', text });
  push({ type: 'result', text, isError: false, costUsd: 0 });
}

export function fakeProvider(id: ProviderId): ProviderAdapter {
  return {
    id,
    label: id === 'claude' ? 'Claude Code (test)' : 'Codex (test)',
    efforts: ['low', 'medium', 'high', 'xhigh'],
    models: [{ id: 'default', label: 'Default' }],
    detect: async () => ({ available: true, version: 'test', error: null }),
    run(opts) {
      const queue = new AsyncQueue<ProviderEvent>();
      void script(opts, (e) => queue.push(e))
        .catch((err) => queue.push({ type: 'result', text: String(err), isError: true }))
        .finally(() => queue.close());
      return { events: queue, cancel: () => queue.close() };
    },
  };
}
