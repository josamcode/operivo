import type { SectionOf } from '@opervio/contracts';
import { EFFORT_LABEL } from '@opervio/contracts';
import { useMemo } from 'react';
import { ago, plural } from '@/lib/format';
import { useAgents, useData, useDecisions, useOutputs } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { AgentAvatar, AutoDir, FileGlyph, fileMeta, ProgressBar, StatusPill } from '../app/primitives';
import { useDrawers } from '../app/ui-state';
import { usePageCtx } from './context';
import { Frame } from './sections-basic';
import { Empty } from './sections-shared';

export function AgentsSection({ s }: { s: SectionOf<'agents'> }) {
  const { focusId } = usePageCtx();
  const { data: all = [] } = useAgents();
  const { openAgent } = useDrawers();
  const agents = useMemo(() => (s.scope === 'all' || !focusId ? all : all.filter((a) => a.focus?.id === focusId)), [all, focusId, s.scope]);
  return (
    <Frame title={s.title ?? 'Team'} description={s.description} bare>
      {agents.length === 0 ? (
        <div className="px-4 pb-4">
          <Empty text="No specialists on this yet. Noor brings them in when they help." />
        </div>
      ) : (
        <div className="px-2 pb-2">
          {agents.map((a) => {
            const working = a.status === 'working';
            const p = a.run?.progress;
            return (
              <button key={a.id} type="button" onClick={() => openAgent(a.id)} className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-start hover:bg-muted/50">
                <AgentAvatar name={a.name} size={30} working={working} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium">{a.name}</span>
                    <span className="truncate text-[12px] text-ink-3">{a.role}</span>
                    <span className="ms-auto">
                      <StatusPill status={a.status} />
                    </span>
                  </div>
                  {a.task && <AutoDir as="p" text={working && a.run?.lastActivity ? a.run.lastActivity : a.task.title} className="mt-0.5 truncate text-[12.5px] text-ink-2" />}
                  {working && p?.total ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <ProgressBar value={p.current ?? 0} max={p.total} />
                      <span className="num shrink-0 text-[11.5px] text-ink-3">
                        {p.current ?? 0}/{p.total}
                      </span>
                    </div>
                  ) : null}
                  {a.run && (
                    <p className="mt-0.5 text-[11.5px] text-ink-3">
                      {a.run.provider === 'claude' ? 'Claude' : 'Codex'} · {EFFORT_LABEL[a.run.effort]}
                      {a.stats.outputs ? ` · ${plural(a.stats.outputs, 'output')}` : ''}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Frame>
  );
}

export function ActivitySection({ s }: { s: SectionOf<'activity'> }) {
  const { focusId } = usePageCtx();
  const { openAgent } = useDrawers();
  const { data } = useData({ kind: 'activity', scope: s.scope, limit: s.limit ?? 12 }, focusId);
  const rows = data?.rows ?? [];
  return (
    <Frame title={s.title ?? 'Activity'} description={s.description}>
      {rows.length === 0 ? (
        <Empty text="Activity shows up here while agents work." />
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => typeof r.agentId === 'string' && openAgent(r.agentId)} className="flex w-full items-start gap-2.5 text-start">
                <AgentAvatar name={String(r.agent)} size={20} />
                <div className="min-w-0 flex-1">
                  <AutoDir as="p" text={String(r.label)} className="text-[12.5px] leading-snug" />
                  <p className="text-[11px] text-ink-3">
                    {String(r.agent)} · {ago(String(r.ts))}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

export function DecisionsSection({ s }: { s: SectionOf<'decisions'> }) {
  const { focusId } = usePageCtx();
  const { data: all = [] } = useDecisions();
  const { openDecision } = useDrawers();
  const items = all.filter((d) => d.kind !== 'plan' && (s.scope === 'all' || !focusId || d.focus?.id === focusId));
  return (
    <Frame title={s.title ?? 'Needs you'} description={s.description} bare>
      {items.length === 0 ? (
        <div className="px-4 pb-4">
          <Empty text="Nothing needs you here." />
        </div>
      ) : (
        <div className="px-2 pb-2">
          {items.map((d) => (
            <button key={d.id} type="button" onClick={() => openDecision(d.id)} className="flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-start hover:bg-muted/50">
              <span className="flex items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full bg-warning" />
                <AutoDir text={d.title} className="truncate text-[13px] font-medium" />
              </span>
              {d.recommendation && <AutoDir as="p" text={d.recommendation} className="line-clamp-1 ps-3.5 text-[12px] text-ink-3" />}
            </button>
          ))}
        </div>
      )}
    </Frame>
  );
}

export function OutputsSection({ s }: { s: SectionOf<'outputs'> }) {
  const { focusId } = usePageCtx();
  const { data: all = [] } = useOutputs(s.scope === 'all' || !focusId ? {} : { focusId });
  const { openOutput } = useDrawers();
  const items = all.filter((o) => !s.types || s.types.includes(o.type)).slice(0, s.limit ?? 12);
  const grid = (s.layout ?? 'grid') === 'grid';
  return (
    <Frame title={s.title ?? 'Outputs'} description={s.description} bare={!grid}>
      {items.length === 0 ? (
        <div className={cn(!grid && 'px-4 pb-4')}>
          <Empty text="Files your team produces for this area show up here." />
        </div>
      ) : grid ? (
        <div className="@container">
        <div className="grid grid-cols-1 gap-2 @md:grid-cols-2 @3xl:grid-cols-3">
          {items.map((o) => (
            <button key={o.id} type="button" onClick={() => openOutput(o.id)} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-2.5 text-start transition-colors hover:border-border-strong hover:bg-surface">
              <FileGlyph type={o.type} size={34} className="bg-surface" />
              <div className="min-w-0">
                <AutoDir as="p" text={o.title} className="truncate text-[13px] font-medium" />
                <p className="truncate text-[11.5px] text-ink-3">
                  {fileMeta(o.type).label}
                  {o.agent ? ` · ${o.agent.name}` : ''} · {ago(o.createdAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
        </div>
      ) : (
        <div className="px-2 pb-2">
          {items.map((o) => (
            <button key={o.id} type="button" onClick={() => openOutput(o.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-start hover:bg-muted/50">
              <FileGlyph type={o.type} size={28} />
              <AutoDir text={o.title} className="min-w-0 flex-1 truncate text-[13px] font-medium" />
              <span className="shrink-0 text-[11.5px] text-ink-3">{ago(o.createdAt)}</span>
            </button>
          ))}
        </div>
      )}
    </Frame>
  );
}
