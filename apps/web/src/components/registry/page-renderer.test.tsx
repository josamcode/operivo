import type { DataResult, PageDTO, PageSpec } from '@opervio/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiProvider } from '../app/ui-state';
import { PageRenderer } from './page-renderer';

const leads: DataResult = {
  fields: [
    { key: 'company', label: 'Company', type: 'text' },
    { key: 'stage', label: 'Stage', type: 'status', options: ['found', 'qualified', 'contacted'] },
    { key: 'website', label: 'Website', type: 'url' },
  ],
  rows: [
    { id: 'r1', _kind: 'record', company: 'Acme Clinic', stage: 'qualified', website: 'https://acme.example' },
    { id: 'r2', _kind: 'record', company: 'Nile Dental', stage: 'found', website: 'https://nile.example' },
  ],
  titleField: 'company',
  statusField: 'stage',
};

beforeEach(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200, headers: { 'content-type': 'application/json' } });
      if (url === '/api/data') {
        const body = JSON.parse(String(init?.body));
        return json(body.source.kind === 'records' ? leads : { fields: [], rows: [], titleField: 'title' });
      }
      if (url === '/api/data/aggregate') return json({ value: 2 });
      return json([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function renderPage(spec: PageSpec) {
  const page: PageDTO = { id: 'p', slug: 'clients', title: spec.title, icon: spec.icon, description: null, focus: null, spec, collections: [], updatedAt: new Date().toISOString() };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute({ component: () => <PageRenderer page={page} /> });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ['/'] }) });
  return render(
    <QueryClientProvider client={qc}>
      <UiProvider>
        <RouterProvider router={router} />
      </UiProvider>
    </QueryClientProvider>,
  );
}

describe('dynamic page renderer', () => {
  it('renders an AI-composed page from registry primitives with live data', async () => {
    renderPage({
      title: 'Clients',
      icon: 'briefcase',
      sections: [
        { id: 'hero-1', type: 'hero', summary: 'Build a **steady** pipeline.' },
        { id: 'kpis-1', type: 'kpis', items: [{ label: 'Leads', compute: { source: { kind: 'records', collection: 'leads' }, op: 'count' } }, { label: 'Calls this week', value: 3, target: 5 }] },
        { id: 'kanban-1', type: 'kanban', title: 'Pipeline', source: { kind: 'records', collection: 'leads' }, groupBy: 'stage' },
        { id: 'table-1', type: 'table', title: 'Qualified', source: { kind: 'records', collection: 'leads', where: { stage: 'qualified' } }, searchable: true },
        { id: 'markdown-1', type: 'markdown', content: 'Offer: <b>raw html is not rendered</b>' },
      ],
    });
    expect(await screen.findByText('steady')).toBeInTheDocument();
    expect(await screen.findByText('Calls this week')).toBeInTheDocument();
    expect(screen.getByText('/ 5')).toBeInTheDocument();
    expect(await screen.findByText('2')).toBeInTheDocument(); // computed KPI

    const pipeline = (await screen.findByText('Pipeline')).closest('section')!;
    expect(within(pipeline).getByText('Qualified')).toBeInTheDocument(); // AI status keys read as labels
    expect(within(pipeline).getByText('Contacted')).toBeInTheDocument(); // empty column from field options
    expect(within(pipeline).getAllByText('Acme Clinic').length).toBeGreaterThan(0);

    const table = (await screen.findByRole('heading', { name: 'Qualified' })).closest('section')!;
    expect(await within(table).findAllByRole('row')).toHaveLength(3); // header + 2 rows (filtering is server-side)
    expect(within(table).getAllByText('acme.example').length).toBe(1);

    expect(screen.queryByText('raw html is not rendered', { selector: 'b' })).toBeNull();
  });

  it('isolates a broken section instead of crashing the page', async () => {
    renderPage({
      title: 'Broken',
      icon: 'layers',
      sections: [{ id: 'x', type: 'kpis', items: null } as never, { id: 'markdown-1', type: 'markdown', content: 'Still here' }],
    });
    expect(await screen.findByText('Still here')).toBeInTheDocument();
    expect(screen.getByText(/couldn’t render/)).toBeInTheDocument();
  });
});
