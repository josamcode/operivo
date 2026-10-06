import type { ArtifactPreview, ArtifactType } from '@opervio/contracts';
import ExcelJS from 'exceljs';
import fg from 'fast-glob';
import fs from 'fs-extra';
import mammoth from 'mammoth';
import { basename, extname, isAbsolute, resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { bus } from '../bus';
import { db, Prisma } from '../db';
import { log } from '../log';
import { redact } from '../lib/redact';

const EXT: Record<string, ArtifactType> = {
  '.pdf': 'pdf',
  '.xlsx': 'xlsx',
  '.xlsm': 'xlsx',
  '.xls': 'xlsx',
  '.csv': 'csv',
  '.tsv': 'csv',
  '.pptx': 'pptx',
  '.docx': 'docx',
  '.md': 'md',
  '.markdown': 'md',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.gif': 'image',
  '.svg': 'image',
  '.json': 'json',
  '.html': 'html',
  '.htm': 'html',
  '.txt': 'txt',
  '.diff': 'diff',
  '.patch': 'diff',
};
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.sql', '.sh', '.ps1', '.go', '.rs', '.java', '.cs', '.css', '.yml', '.yaml', '.toml', '.ipynb']);

export function detectType(path: string): ArtifactType {
  const ext = extname(path).toLowerCase();
  if (EXT[ext]) return EXT[ext];
  if (CODE_EXT.has(ext)) return 'code';
  return 'other';
}

export const humanTitle = (path: string) =>
  basename(path, extname(path))
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());

export async function registerArtifact(input: {
  path: string;
  title?: string;
  summary?: string | null;
  agentId?: string | null;
  taskId?: string | null;
  runId?: string | null;
  focusId?: string | null;
  baseDir?: string;
}) {
  const path = isAbsolute(input.path) ? resolve(input.path) : resolve(input.baseDir ?? process.cwd(), input.path);
  const stat = await fs.stat(path).catch(() => null);
  if (!stat || !stat.isFile()) throw new Error(`File not found: ${path}. Save the file first, then register it.`);
  const data = {
    title: (input.title?.trim() || humanTitle(path)).slice(0, 120),
    type: detectType(path),
    sizeBytes: stat.size,
    summary: input.summary ? redact(input.summary).slice(0, 600) : null,
    preview: Prisma.DbNull,
    agentId: input.agentId ?? null,
    taskId: input.taskId ?? null,
    runId: input.runId ?? null,
    focusId: input.focusId ?? null,
  };
  const existing = await db.artifact.findUnique({ where: { path } });
  const artifact = existing
    ? await db.artifact.update({
        where: { path },
        data: { ...data, summary: data.summary ?? existing.summary, title: input.title ? data.title : existing.title },
      })
    : await db.artifact.create({ data: { ...data, path } });
  bus.invalidate('outputs', 'home', `artifact:${artifact.id}`);
  return { artifact, created: !existing };
}

const IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.venv/**',
  '**/__pycache__/**',
  '**/.*',
  '**/*.tmp',
  '**/~$*',
  '**/playwright-mcp/**',
  // Agents' scratch space is not a deliverable.
  '**/{tmp,temp,scratch,cache,.cache,work,raw}/**',
];
/** Auto-pickup is conservative: documents founders open. Data dumps (json, txt…) need an explicit save_output. */
const DELIVERABLE_EXT = ['xlsx', 'xlsm', 'csv', 'pptx', 'docx', 'pdf', 'md', 'png', 'jpg', 'jpeg', 'webp', 'svg', 'html'];

/** Picks up deliverable files an agent created in its workspace but forgot to register. */
export async function scanWorkspace(dir: string, since: Date, meta: { agentId: string; taskId: string; runId: string; focusId: string | null }) {
  if (!(await fs.pathExists(dir))) return [];
  const files = await fg(`**/*.{${DELIVERABLE_EXT.join(',')}}`, { cwd: dir, absolute: true, ignore: IGNORE, deep: 4, stats: true });
  const fresh = files.filter((f) => f.stats && f.stats.mtime >= since && f.stats.size > 0).slice(0, 20);
  const out = [];
  for (const f of fresh) {
    const known = await db.artifact.findUnique({ where: { path: resolve(f.path) } });
    if (known) continue;
    try {
      out.push((await registerArtifact({ path: f.path, ...meta })).artifact);
    } catch (err) {
      log.warn({ err, path: f.path }, 'auto-register failed');
    }
  }
  return out;
}

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('text' in o) return String(o.text);
    if ('result' in o) return String(o.result);
    if ('richText' in o && Array.isArray(o.richText)) return o.richText.map((r: { text: string }) => r.text).join('');
    if ('hyperlink' in o) return String(o.hyperlink);
    return '';
  }
  return String(v);
};

function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const MAX_ROWS = 60;
const MAX_TEXT = 24000;

export async function buildPreview(path: string, type: ArtifactType): Promise<ArtifactPreview> {
  try {
    switch (type) {
      case 'csv': {
        const text = (await fs.readFile(path, 'utf8')).replace(/^﻿/, '');
        const rows = parseCsv(text, path.toLowerCase().endsWith('.tsv') ? '\t' : ',');
        return { kind: 'table', columns: rows[0] ?? [], rows: rows.slice(1, MAX_ROWS + 1), totalRows: Math.max(0, rows.length - 1) };
      }
      case 'xlsx': {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(path);
        const ws = wb.worksheets[0];
        if (!ws) return { kind: 'none' };
        const rows: string[][] = [];
        ws.eachRow({ includeEmpty: false }, (r) => {
          if (rows.length > MAX_ROWS) return;
          const values = (r.values as unknown[]).slice(1);
          rows.push(values.map(cell));
        });
        const width = Math.max(...rows.map((r) => r.length), 0);
        const norm = rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''));
        return { kind: 'table', columns: norm[0] ?? [], rows: norm.slice(1), totalRows: Math.max(0, ws.actualRowCount - 1), sheet: ws.name };
      }
      case 'md':
      case 'txt':
      case 'json':
      case 'html':
      case 'code':
      case 'diff': {
        const text = await fs.readFile(path, 'utf8');
        return {
          kind: 'text',
          text: redact(text.slice(0, MAX_TEXT)),
          truncated: text.length > MAX_TEXT,
          language: type === 'code' ? extname(path).slice(1) : type,
        };
      }
      case 'docx': {
        const { value } = await mammoth.extractRawText({ path });
        return { kind: 'text', text: value.slice(0, MAX_TEXT), truncated: value.length > MAX_TEXT, language: 'txt' };
      }
      case 'pdf': {
        const doc = await PDFDocument.load(await fs.readFile(path), { ignoreEncryption: true, updateMetadata: false });
        return { kind: 'pdf', pages: doc.getPageCount() };
      }
      case 'image':
        return { kind: 'image' };
      default:
        return { kind: 'none' };
    }
  } catch (err) {
    log.warn({ err: (err as Error).message, path }, 'preview failed');
    return { kind: 'none' };
  }
}

/** Cached preview; recomputed when the file changes. */
export async function previewFor(id: string): Promise<ArtifactPreview> {
  const a = await db.artifact.findUnique({ where: { id } });
  if (!a) return { kind: 'none' };
  const stat = await fs.stat(a.path).catch(() => null);
  if (!stat) return { kind: 'none' };
  const cached = a.preview as (ArtifactPreview & { _mtime?: number }) | null;
  if (cached && cached._mtime === stat.mtimeMs) {
    const { _mtime, ...rest } = cached;
    return rest as ArtifactPreview;
  }
  const preview = await buildPreview(a.path, a.type as ArtifactType);
  await db.artifact.update({
    where: { id },
    data: { preview: { ...preview, _mtime: stat.mtimeMs } as Prisma.InputJsonValue, sizeBytes: stat.size },
  });
  return preview;
}
