import type { CompiledPrompt, RunDTO } from '@opervio/contracts';
import { EFFORT_LABEL } from '@opervio/contracts';
import { ChevronRight, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Chip, Markdown } from '../app/primitives';

const SOURCE_LABEL: Record<string, string> = {
  founder: 'Founder',
  focus: 'Focus',
  memory: 'Memory',
  output: 'Outputs',
  record: 'Records',
  approach: 'Past approach',
  project: 'Project',
  task: 'Earlier attempt',
  decision: 'Decision',
};

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11.5px] font-medium text-ink-3">{label}</p>
      <div className="text-[13px]">{children}</div>
    </div>
  );
}

function ContextSource({ item }: { item: CompiledPrompt['context'][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-surface">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start gap-2 px-2.5 py-2 text-start">
        <ChevronRight className={cn('mt-0.5 size-3.5 shrink-0 text-ink-3 transition-transform', open && 'rotate-90')} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12.5px] font-medium">{item.label}</span>
            <Chip className="h-4 px-1 text-[10.5px]">{SOURCE_LABEL[item.source] ?? item.source}</Chip>
          </div>
          <p className="text-[12px] text-ink-3">{item.reason}</p>
        </div>
      </button>
      {open && <pre dir="auto" className="mx-2.5 mb-2.5 max-h-56 overflow-auto rounded-md bg-sunken p-2 text-[11.5px] whitespace-pre-wrap text-ink-2">{item.content}</pre>}
    </div>
  );
}

/** "What exactly was this agent told?" — every run is fully inspectable. */
export function PromptInspector({ run, open, onOpenChange }: { run: RunDTO; open: boolean; onOpenChange: (v: boolean) => void }) {
  const p = run.prompt;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(860px,92vh)] w-[min(1180px,96vw)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-[15px]">Effective prompt</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Exactly what the agent received for attempt {run.attempt}. {p?.engineerNote}
          </DialogDescription>
        </DialogHeader>
        {!p ? (
          <p className="p-6 text-[13px] text-ink-3">The prompt is still being prepared.</p>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[340px_1fr]">
            <div className="min-h-0 space-y-4 overflow-y-auto border-border bg-surface-2 p-5 md:border-e">
              <div className="grid grid-cols-3 gap-3">
                <Meta label="Provider">{run.provider === 'claude' ? 'Claude Code' : 'Codex'}</Meta>
                <Meta label="Model">
                  <span className="break-all">{run.model}</span>
                </Meta>
                <Meta label="Effort">{EFFORT_LABEL[run.effort]}</Meta>
              </div>
              <Meta label="Role">{p.role}</Meta>
              <Meta label={`Context sources (${p.context.length})`}>
                <div className="space-y-1.5">
                  {p.context.map((c, i) => (
                    <ContextSource key={i} item={c} />
                  ))}
                </div>
              </Meta>
              <Meta label="Allowed tools">
                <div className="flex flex-wrap gap-1">
                  {p.tools.map((t) => (
                    <Chip key={t.id} title={t.usage}>
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </Meta>
              <Meta label="Expected output">
                <ul className="list-disc space-y-0.5 ps-4 text-ink-2">
                  {p.deliverables.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </Meta>
              <Meta label="Success criteria (the judge checks these)">
                <ul className="list-disc space-y-0.5 ps-4 text-ink-2">
                  {p.successCriteria.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </Meta>
            </div>
            <Tabs defaultValue="prompt" className="flex min-h-0 flex-col gap-0">
              <div className="flex items-center gap-2 border-b border-border px-5 py-2">
                <TabsList>
                  <TabsTrigger value="prompt">Task prompt</TabsTrigger>
                  <TabsTrigger value="system">Operating rules</TabsTrigger>
                </TabsList>
                <button
                  type="button"
                  className="ms-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-ink-2 hover:bg-muted"
                  onClick={() => {
                    void navigator.clipboard.writeText(p.text);
                    toast.success('Prompt copied');
                  }}
                >
                  <Copy className="size-3.5" /> Copy
                </button>
              </div>
              <TabsContent value="prompt" className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <Markdown className="max-w-[78ch] text-[13px]">{p.text}</Markdown>
              </TabsContent>
              <TabsContent value="system" className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <Markdown className="max-w-[78ch] text-[13px]">{p.systemText}</Markdown>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
