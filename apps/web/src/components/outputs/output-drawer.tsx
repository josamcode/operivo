import { endSide, t } from '@/lib/i18n';
import type { ArtifactDetailDTO } from '@opervio/contracts';
import { Download, ExternalLink, FolderSearch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { api } from '@/lib/api';
import { ago, bytes } from '@/lib/format';
import { useOutput } from '@/lib/queries';
import { AutoDir, FileGlyph, fileMeta, Markdown, Meta } from '../app/primitives';
import { useDrawers } from '../app/ui-state';

const LANG: Record<string, string> = { ts: 'ts', tsx: 'tsx', js: 'js', jsx: 'jsx', py: 'python', json: 'json', diff: 'diff', html: 'html', css: 'css', sql: 'sql', sh: 'bash', ps1: 'powershell', yml: 'yaml', yaml: 'yaml', md: 'markdown' };

function CodeView({ code, lang }: { code: string; lang: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void import('shiki')
      .then(({ codeToHtml }) => codeToHtml(code, { lang: LANG[lang] ?? 'text', themes: { light: 'github-light', dark: 'github-dark-dimmed' }, defaultColor: false }))
      .then((h) => alive && setHtml(h))
      .catch(() => alive && setHtml(null));
    return () => {
      alive = false;
    };
  }, [code, lang]);
  if (!html) return <pre className="overflow-auto rounded-lg border border-border bg-sunken p-3 text-[12px] whitespace-pre-wrap">{code}</pre>;
  // Shiki output is generated from escaped tokens — safe to inject.
  return <div className="shiki-wrap overflow-auto rounded-lg border border-border text-[12px]" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Preview({ a }: { a: ArtifactDetailDTO }) {
  const p = a.preview;
  const fileUrl = `/api/outputs/${a.id}/file`;
  if (!a.exists) return <p className="text-[13px] text-ink-3">{t('This file was moved or deleted on disk.')}</p>;
  switch (p.kind) {
    case 'table':
      return (
        <div className="space-y-2">
          <p className="text-[12px] text-ink-3">
            <Meta
              parts={[p.sheet, t('{n} rows', { n: p.totalRows ?? p.rows.length }), p.rows.length < (p.totalRows ?? 0) ? t('showing first {n}', { n: p.rows.length }) : null]}
            />
          </p>
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-[12.5px]">
              <thead className="sticky top-0 bg-surface-2">
                <tr>
                  {p.columns.map((c, i) => (
                    <th key={i} dir="auto" className="border-b border-border px-2.5 py-2 text-start font-medium whitespace-nowrap text-ink-2">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.rows.map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {r.map((c, j) => (
                      <td key={j} dir="auto" className="max-w-[280px] truncate px-2.5 py-1.5 align-top" title={c}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    case 'text':
      if (a.type === 'md') return <Markdown className="text-[13.5px]">{p.text}</Markdown>;
      if (a.type === 'txt' || a.type === 'docx') return <AutoDir as="div" text={p.text} className="text-[13px] leading-relaxed whitespace-pre-wrap" />;
      return <CodeView code={p.text} lang={p.language ?? a.type} />;
    case 'image':
      return <img src={fileUrl} alt={a.title} className="max-h-[70vh] rounded-lg border border-border bg-surface-2 object-contain" />;
    case 'pdf':
      return <iframe title={a.title} src={fileUrl} className="h-[70vh] w-full rounded-lg border border-border bg-white" />;
    default:
      return <p className="text-[13px] text-ink-3">{t('No preview for {type} files. Open it to view.', { type: t(fileMeta(a.type).label) })}</p>;
  }
}

export function OutputDrawer() {
  const { outputId, close, openAgent } = useDrawers();
  const { data: a } = useOutput(outputId);
  const run = async (action: 'open' | 'reveal') => {
    try {
      await api.post(`/api/outputs/${outputId}/${action}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };
  return (
    <Sheet open={Boolean(outputId)} onOpenChange={(o) => !o && close()}>
      <SheetContent side={endSide()} resizable={{ id: 'output', defaultWidth: 760 }} className="w-full gap-0 bg-surface p-0 sm:max-w-[760px]">
        {a ? (
          <>
            <SheetHeader className="flex-row items-start gap-3 px-5 pt-5 pb-3">
              <FileGlyph type={a.type} size={40} />
              <div className="min-w-0 pe-8">
                <SheetTitle className="text-[16px] font-semibold tracking-[-0.01em]">
                  <AutoDir text={a.title} />
                </SheetTitle>
                <SheetDescription className="text-[12.5px]">
                  <Meta parts={[t(fileMeta(a.type).label), bytes(a.sizeBytes), ago(a.createdAt)]} />
                  {a.agent && (
                    <>
                      {' · '}
                      {t('by')}{' '}
                      <button type="button" className="underline-offset-2 hover:underline" onClick={() => openAgent(a.agent!.id)}>
                        <bdi>{a.agent.name}</bdi>
                      </button>
                    </>
                  )}
                  {a.focus && (
                    <>
                      {' · '}
                      <bdi>{a.focus.name}</bdi>
                    </>
                  )}
                </SheetDescription>
              </div>
            </SheetHeader>
            <div className="flex flex-wrap gap-2 border-b border-border px-5 pb-3">
              <Button size="sm" onClick={() => void run('open')}>
                <ExternalLink /> {t('Open')}
              </Button>
              <Button size="sm" variant="outline" nativeButton={false} render={<a href={`/api/outputs/${a.id}/file?download=1`} />}>
                <Download /> {t('Download')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void run('reveal')}>
                <FolderSearch /> {t('Show in folder')}
              </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {a.summary && <AutoDir as="p" block text={a.summary} className="text-[13px] text-ink-2" />}
              <Preview a={a} />
              <p className="text-[11.5px] break-all text-ink-3" dir="ltr">
                {a.path}
              </p>
            </div>
          </>
        ) : (
          <SheetHeader className="p-5">
            <SheetTitle className="text-[15px]">{t('Loading…')}</SheetTitle>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}
