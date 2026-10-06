import ExcelJS from 'exceljs';
import fs from 'fs-extra';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/providers/registry', () => ({ completeJson: vi.fn() }));

const { completeJson } = await import('../src/providers/registry');
const { judgeResult, ruleCheck } = await import('../src/runtime/judge');
const { buildPreview, detectType, humanTitle } = await import('../src/domain/artifacts');

const dir = join(tmpdir(), `opervio-test-${Date.now()}`);
const defaults = { provider: 'claude' as const, model: 'sonnet', effort: 'low' as const };

beforeAll(async () => {
  await fs.ensureDir(dir);
  await fs.writeFile(join(dir, 'leads.csv'), 'company,stage\nAcme,qualified\n"Nile, Dental",found\n');
  await fs.writeFile(join(dir, 'plan.md'), '# Week 1\n\n- Day 1');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Leads');
  ws.addRow(['Company', 'Why it fits']);
  for (let i = 0; i < 12; i++) ws.addRow([`Clinic ${i}`, 'No online booking']);
  await wb.xlsx.writeFile(join(dir, 'qualified-leads.xlsx'));
  await fs.writeFile(join(dir, 'empty.md'), '');
});
afterAll(() => fs.remove(dir));

const input = (over = {}) => ({
  objective: 'Find 20 qualified leads',
  successCriteria: ['20 qualified leads'],
  deliverables: ['qualified-leads.xlsx'],
  expectedOutputs: ['xlsx' as const],
  finalSummary: 'Done! Found 20 leads.',
  artifacts: [{ title: 'Qualified leads', type: 'xlsx' as const, path: join(dir, 'qualified-leads.xlsx'), sizeBytes: 9000 }],
  records: [],
  progress: [],
  ...over,
});

describe('Result Judge', () => {
  it('rejects "done" claims without the requested file — no AI call needed', async () => {
    const v = ruleCheck(input({ artifacts: [] }));
    expect(v?.status).toBe('incomplete');
    expect(v?.feedback).toMatch(/xlsx/);
  });

  it('rejects empty deliverables', () => {
    expect(ruleCheck(input({ artifacts: [{ title: 'Empty', type: 'md', path: join(dir, 'empty.md'), sizeBytes: 0 }], expectedOutputs: [] }))?.status).toBe('incomplete');
  });

  it('asks the AI judge with real file evidence and returns its verdict (12 of 20 → incomplete)', async () => {
    vi.mocked(completeJson).mockResolvedValueOnce({
      data: { status: 'incomplete', summary: '12 of 20 leads.', missing: ['8 more qualified leads'], feedback: 'Find 8 more.' },
      provider: 'claude',
      model: 'sonnet',
      effort: 'low',
    });
    const v = await judgeResult(input(), defaults);
    expect(v).toMatchObject({ status: 'incomplete', method: 'ai', missing: ['8 more qualified leads'] });
    const prompt = vi.mocked(completeJson).mock.calls[0][0].prompt;
    expect(prompt).toContain('12 data rows');
    expect(prompt).toContain('Clinic 0');
    expect(prompt).toContain('verified on disk');
  });

  it('falls back to evidence when the judge is unavailable', async () => {
    vi.mocked(completeJson).mockResolvedValueOnce(null);
    expect((await judgeResult(input(), defaults)).status).toBe('complete');
  });
});

describe('Artifacts', () => {
  it('detects types and titles', () => {
    expect(detectType('a/b/Leads.XLSX')).toBe('xlsx');
    expect(detectType('deck.pptx')).toBe('pptx');
    expect(detectType('chart.png')).toBe('image');
    expect(detectType('fix.patch')).toBe('diff');
    expect(detectType('main.py')).toBe('code');
    expect(humanTitle('C:/x/week-1_scripts.md')).toBe('Week 1 scripts');
  });

  it('previews spreadsheets, CSV (with quoted commas) and markdown', async () => {
    const xlsx = await buildPreview(join(dir, 'qualified-leads.xlsx'), 'xlsx');
    expect(xlsx).toMatchObject({ kind: 'table', columns: ['Company', 'Why it fits'], totalRows: 12, sheet: 'Leads' });
    const csv = await buildPreview(join(dir, 'leads.csv'), 'csv');
    expect(csv).toMatchObject({ kind: 'table', columns: ['company', 'stage'], rows: [['Acme', 'qualified'], ['Nile, Dental', 'found']] });
    const md = await buildPreview(join(dir, 'plan.md'), 'md');
    expect(md).toMatchObject({ kind: 'text', text: '# Week 1\n\n- Day 1' });
  });
});
