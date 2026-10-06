import type { AgentDetailDTO, RunEventDTO, RunProgress } from '@opervio/contracts';
import { EFFORT_LABEL } from '@opervio/contracts';
import { useQueryClient } from '@tanstack/react-query';
import {
  CircleAlert,
  CircleCheck,
  FileText,
  Flag,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  ScanEye,
  ShieldAlert,
  Sparkles,
  Square,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useNow } from '@/hooks/use-now';
import { api } from '@/lib/api';
import { ago, elapsed } from '@/lib/format';
import { useAgent, useRun, useSettings } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { AgentAvatar, AutoDir, Chip, FileGlyph, Markdown, ProgressBar, StatusPill } from '../app/primitives';
import { SimpleSelect } from '../app/simple-select';
import { useDrawers } from '../app/ui-state';
import { PromptInspector } from './prompt-inspector';

const EVENT_ICON: Record<string, { icon: LucideIcon; className: string }> = {
  status: { icon: Flag, className: 'text-ink-3' },
  progress: { icon: Gauge, className: 'text-brand' },
  tool: { icon: Wrench, className: 'text-ink-3' },
  file: { icon: FileText, className: 'text-positive' },
  judge: { icon: ScanEye, className: 'text-brand' },
  error: { icon: CircleAlert, className: 'text-destructive' },
  blocked: { icon: ShieldAlert, className: 'text-warning' },
  note: { icon: Sparkles, className: 'text-ink-3' },
  text: { icon: Sparkles, className: 'text-ink-3' },
};

function Activity({ events, live }: { events: RunEventDTO[]; live: boolean }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && live) el.scrollTop = el.scrollHeight;
  }, [events.length, live]);
  if (!events.length) return <p className="text-[12.5px] text-ink-3">No activity yet.</p>;
  return (
    <ol ref={ref} className="max-h-72 space-y-0 overflow-y-auto pe-1">
      {events.map((e, i) => {
        const m = EVENT_ICON[e.kind] ?? EVENT_ICON.note;
        const last = i === events.length - 1;
        return (
          <li key={e.id} className="relative flex gap-2.5 pb-2.5">
            {!last && <span className="absolute start-[7px] top-5 bottom-0 w-px bg-border" />}
            <m.icon className={cn('relative mt-0.5 size-3.5 shrink-0', m.className, last && live && 'animate-pulse')} strokeWidth={2} />
            <AutoDir text={e.label} className={cn('min-w-0 flex-1 text-[12.5px] leading-snug', e.kind === 'judge' || e.kind === 'progress' ? 'text-foreground' : 'text-ink-2')} />
            <span className="num shrink-0 text-[11px] text-ink-3">{new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-[12px] font-medium text-ink-3">{title}</h3>
        <div className="ms-auto">{aside}</div>
      </div>
      {children}
    </section>
  );
}

function RunControls({ agent }: { agent: AgentDetailDTO }) {
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const provider = settings?.providers.find((p) => p.id === (agent.provider === 'auto' ? agent.run?.provider : agent.provider));
  const update = async (patch: Record<string, string>) => {
    await api.patch(`/api/agents/${agent.id}`, patch);
    await qc.invalidateQueries({ queryKey: ['agent', agent.id] });
    toast('Saved — applies to the next run');
  };
  const efforts = ['auto', ...(provider?.efforts ?? ['low', 'medium', 'high', 'xhigh'])];
  return (
    <div className="grid grid-cols-3 gap-2">
      <label className="space-y-1">
        <span className="text-[11.5px] text-ink-3">Provider</span>
        <SimpleSelect
          className="w-full"
          value={agent.provider}
          onChange={(v) => void update({ provider: v })}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'claude', label: 'Claude Code' },
            { value: 'codex', label: 'Codex' },
          ]}
        />
      </label>
      <label className="space-y-1">
        <span className="text-[11.5px] text-ink-3">Model</span>
        <SimpleSelect
          className="w-full"
          value={agent.model}
          onChange={(v) => void update({ model: v })}
          options={[{ value: 'default', label: 'Default' }, ...(provider?.models.filter((m) => m.id !== 'default').map((m) => ({ value: m.id, label: m.label })) ?? [])]}
        />
      </label>
      <label className="space-y-1">
        <span className="text-[11.5px] text-ink-3">Effort</span>
        <SimpleSelect className="w-full" value={agent.effort} onChange={(v) => void update({ effort: v })} options={efforts.map((e) => ({ value: e, label: EFFORT_LABEL[e as keyof typeof EFFORT_LABEL] }))} />
      </label>
    </div>
  );
}

function AgentBody({ agent }: { agent: AgentDetailDTO }) {
  const { data: run } = useRun(agent.latestRun?.id);
  const { openOutput } = useDrawers();
  const [inspect, setInspect] = useState(false);
  const qc = useQueryClient();
  const live = agent.status === 'working';
  useNow(live ? 1000 : null);
  const task = agent.tasks[0];
  const progress = (run?.progress ?? agent.run?.progress) as RunProgress | null;

  const act = async (path: string, body: unknown, msg: string) => {
    try {
      await api.post(`/api/agents/${agent.id}/${path}`, body);
      toast(msg);
      await qc.invalidateQueries({ queryKey: ['agent', agent.id] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-6">
        {run && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip>{run.provider === 'claude' ? 'Claude Code' : 'Codex'}</Chip>
            <Chip>{run.model}</Chip>
            <Chip tone="info">Effort · {EFFORT_LABEL[run.effort]}</Chip>
            {run.toolsUsed.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
            <span className="num ms-auto text-[12px] text-ink-3">
              {elapsed(run.startedAt, run.finishedAt)}
              {run.costUsd ? ` · $${run.costUsd.toFixed(2)}` : ''}
            </span>
          </div>
        )}

        {task && (
          <Section title="Task" aside={<StatusPill status={task.status} />}>
            <AutoDir as="p" text={task.title} className="text-[14px] font-medium" />
            <AutoDir as="p" text={task.objective} className="text-[13px] leading-relaxed text-ink-2" />
            {live && progress && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[12.5px]">
                  <AutoDir text={progress.label} />
                  {progress.total ? (
                    <span className="num text-ink-3">
                      {progress.current ?? 0}/{progress.total}
                    </span>
                  ) : null}
                </div>
                {progress.total ? <ProgressBar value={progress.current ?? 0} max={progress.total} /> : null}
              </div>
            )}
          </Section>
        )}

        {run?.verdict && (
          <Section title="Result check" aside={<StatusPill status={run.verdict.status} />}>
            <AutoDir as="p" text={run.verdict.summary} className="text-[13px] leading-relaxed" />
            {run.verdict.missing.length > 0 && (
              <ul className="space-y-1 text-[12.5px] text-ink-2">
                {run.verdict.missing.map((m, i) => (
                  <li key={i} className="flex gap-1.5">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" /> <AutoDir text={m} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        <Section title="Live activity">{run ? <Activity events={run.events} live={live} /> : <p className="text-[12.5px] text-ink-3">Starting…</p>}</Section>

        {run && run.outputs.length > 0 && (
          <Section title="Outputs">
            <div className="space-y-1">
              {run.outputs.map((o) => (
                <button key={o.id} type="button" onClick={() => openOutput(o.id)} className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-start hover:bg-muted">
                  <FileGlyph type={o.type} size={28} />
                  <div className="min-w-0">
                    <AutoDir as="p" text={o.title} className="truncate text-[13px] font-medium" />
                    <p className="truncate text-[11.5px] text-ink-3">{o.fileName}</p>
                  </div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {run?.result && !live && (
          <Section title={`${agent.name}'s summary`}>
            <Markdown className="text-[13px] text-ink-2">{run.result}</Markdown>
          </Section>
        )}

        <Section title="Provider, model and effort">
          <RunControls agent={agent} />
        </Section>

        {agent.tasks.length > 1 && (
          <Section title="Earlier tasks">
            <ul className="space-y-1.5">
              {agent.tasks.slice(1, 8).map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-[12.5px]">
                  <AutoDir text={t.title} className="truncate text-ink-2" />
                  <span className="ms-auto shrink-0 text-ink-3">{ago(t.updatedAt)}</span>
                  <StatusPill status={t.status} />
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-2 px-5 py-3">
        <Button size="sm" variant="outline" disabled={!run?.prompt} onClick={() => setInspect(true)}>
          <ScanEye /> View effective prompt
        </Button>
        <div className="ms-auto flex gap-2">
          {live ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => void act('stop', { mode: 'pause' }, 'Paused')}>
                <Pause /> Pause
              </Button>
              <Button size="sm" variant="destructive" onClick={() => void act('stop', { mode: 'stop' }, 'Stopped')}>
                <Square /> Stop
              </Button>
            </>
          ) : agent.status === 'waiting' || agent.status === 'failed' || agent.status === 'stopped' ? (
            <Button size="sm" onClick={() => void act('resume', {}, 'Resumed')}>
              <Play /> Resume
            </Button>
          ) : agent.status === 'done' ? (
            <Button size="sm" variant="ghost" onClick={() => void act('resume', {}, 'Running again')}>
              <RotateCcw /> Run again
            </Button>
          ) : agent.status === 'idle' && task?.status === 'queued' ? (
            <span className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
              <CircleCheck className="size-3.5" /> Queued — starts when a slot frees up
            </span>
          ) : null}
        </div>
      </footer>
      {run && <PromptInspector run={run} open={inspect} onOpenChange={setInspect} />}
    </div>
  );
}

export function AgentDrawer() {
  const { agentId, close } = useDrawers();
  const { data: agent } = useAgent(agentId);
  return (
    <Sheet open={Boolean(agentId)} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="w-full gap-0 bg-surface p-0 sm:max-w-[560px]">
        {agent ? (
          <>
            <SheetHeader className="flex-row items-center gap-3 px-5 pt-5 pb-4">
              <AgentAvatar name={agent.name} size={40} working={agent.status === 'working'} />
              <div className="min-w-0">
                <SheetTitle className="text-[16px] font-semibold tracking-[-0.01em]">{agent.name}</SheetTitle>
                <SheetDescription className="text-[13px]">
                  {agent.role}
                  {agent.focus ? ` · ${agent.focus.name}` : ''}
                </SheetDescription>
              </div>
              <StatusPill status={agent.status} className="ms-auto me-8" />
            </SheetHeader>
            <AgentBody agent={agent} />
          </>
        ) : (
          <SheetHeader className="p-5">
            <SheetTitle className="text-[15px]">Loading…</SheetTitle>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}
