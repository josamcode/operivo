import { isRtlUi, locale, t, trActivity } from '@/lib/i18n';
import type { AgentDTO, FocusSummaryDTO, HomeDTO } from '@opervio/contracts';
import { EFFORT_LABEL } from '@opervio/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowUp, CheckCircle2, FolderOpen, Users } from 'lucide-react';
import { useCallback, useState } from 'react';
import { axisBase, EChart, tooltipBase, type ChartTheme } from '@/components/app/chart';
import { TopBar } from '@/components/app/app-shell';
import { pageIcon } from '@/components/app/page-icon';
import { AgentAvatar, AutoDir, Chip, EmptyState, FileGlyph, Meta, NoorMark, Panel, PanelHeader, ProgressBar, StatusPill } from '@/components/app/primitives';
import { useDrawers, useUi } from '@/components/app/ui-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { ago, greeting } from '@/lib/format';
import { useHome, useSendToNoor } from '@/lib/queries';
import { cn } from '@/lib/utils';

function AskBar({ lang }: { lang: 'ar' | 'en' }) {
  const [text, setText] = useState('');
  const send = useSendToNoor();
  const { setNoorOpen } = useUi();
  const submit = () => {
    if (!text.trim()) return;
    send.mutate(text.trim());
    setText('');
    setNoorOpen(true);
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface py-2 ps-3 pe-2 shadow-md focus-within:border-brand/40 focus-within:ring-4 focus-within:ring-ring/15">
      <NoorMark size={24} live={send.isPending} />
      <input
        dir="auto"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && submit()}
        placeholder={t('Tell Noor what you need…')}
        className="h-9 min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-ink-3"
      />
      <Button size="icon" className="rounded-xl" disabled={!text.trim()} onClick={submit} aria-label={t('Send to Noor')}>
        <ArrowUp />
      </Button>
    </div>
  );
}

function Today({ home }: { home: HomeDTO }) {
  const qc = useQueryClient();
  const { askNoor } = useUi();
  const { today } = home;
  const ar = home.founder.language === 'ar';
  const toggle = async (id: string, done: boolean) => {
    qc.setQueryData<HomeDTO>(['home'], (h) => h && { ...h, today: { ...h.today, items: h.today.items.map((i) => (i.id === id ? { ...i, done } : i)) } });
    await api.post(`/api/today/${id}`, { done });
  };
  const left = today.items.filter((i) => !i.done).length;
  return (
    <Panel className="lg:col-span-5">
      <PanelHeader title={t('Today')} meta={today.items.length ? t('{n} left', { n: left }) : undefined} />
      {today.items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={t('Nothing on your plate yet')}
          hint={t('Noor fills this with only what you personally need to do.')}
          action={
            <Button size="sm" variant="outline" onClick={() => askNoor(ar ? 'رتبلي يومي النهارده' : 'Plan my day')}>
              {t('Plan my day')}
            </Button>
          }
        />
      ) : (
        <div className="px-2 pb-3">
          {today.note && <AutoDir as="p" block text={today.note} className="px-2 pb-2 text-[13px] text-ink-2" />}
          <ul>
            {today.items.map((i) => (
              <li key={i.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
                  <input type="checkbox" checked={i.done} onChange={(e) => void toggle(i.id, e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
                  <span className={cn('flex-1 text-[14px] leading-snug', i.done && 'text-ink-3 line-through decoration-ink-4')}>
                    <bdi>{i.title}</bdi>
                  </span>
                  {i.minutes ? (
                    <span className="num shrink-0 text-[12px] text-ink-3">{t('{n}m', { n: i.minutes })}</span>
                  ) : null}
                  {i.focus && (
                    <Chip className="shrink-0">
                      <bdi>{i.focus.name}</bdi>
                    </Chip>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function AgentRow({ a }: { a: AgentDTO }) {
  const { openAgent } = useDrawers();
  const p = a.run?.progress;
  const working = a.status === 'working';
  return (
    <button type="button" onClick={() => openAgent(a.id)} className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-start hover:bg-muted/60">
      <AgentAvatar name={a.name} size={32} working={working} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <bdi className="text-[13.5px] font-medium">{a.name}</bdi>
          <span dir="auto" className="truncate text-[12.5px] text-ink-3 ui-align">{a.role}</span>
          <span className="ms-auto shrink-0">{working ? p?.total ? <span className="num text-[12.5px] font-medium" dir="ltr">
                {p.current ?? 0}/{p.total}
              </span> : null : <StatusPill status={a.status} />}</span>
        </div>
        {a.task && <AutoDir as="p" text={working && a.run?.lastActivity ? trActivity(a.run.lastActivity) : a.task.title} className={cn('truncate text-[12.5px]', working ? 'text-foreground' : 'text-ink-2')} />}
        {working && p?.total ? <ProgressBar value={p.current ?? 0} max={p.total} className="mt-1.5" /> : null}
        {a.run && (
          <Meta
            className="block text-[11.5px] text-ink-3"
            parts={[a.run.provider === 'claude' ? 'Claude' : 'Codex', t(EFFORT_LABEL[a.run.effort]), !working && a.run.finishedAt ? ago(a.run.finishedAt) : null]}
          />
        )}
      </div>
    </button>
  );
}

function LiveAgents({ home }: { home: HomeDTO }) {
  const { askNoor } = useUi();
  return (
    <Panel className="lg:col-span-7">
      <PanelHeader title={t('Team')} meta={home.counts.activeAgents ? t('{n} working', { n: home.counts.activeAgents }) : undefined} />
      {home.agents.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('No one is working yet')}
          hint={t('Tell Noor what you need. She brings in specialists — researchers, writers, engineers — only when they help.')}
          action={
            <Button size="sm" variant="outline" onClick={() => askNoor()}>
              {t('Talk to Noor')}
            </Button>
          }
        />
      ) : (
        <div className={cn('grid grid-cols-1 gap-x-2 px-2 pb-2', home.agents.length > 3 && '2xl:grid-cols-2')}>
          {home.agents.slice(0, 8).map((a) => (
            <AgentRow key={a.id} a={a} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function FocusTile({ f }: { f: FocusSummaryDTO }) {
  const Icon = pageIcon(f.icon);
  const body = (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-ink-2" strokeWidth={1.75} />
        <AutoDir text={f.name} className="truncate text-[14px] font-semibold tracking-[-0.01em]" />
        {f.kind === 'main' && <Chip tone="info">{t('Priority')}</Chip>}
        {f.activeAgents > 0 && <span className="live-dot ms-auto size-1.5 rounded-full bg-positive" />}
      </div>
      {f.headline.length > 0 ? (
        <div className="flex gap-5">
          {f.headline.map((h) => (
            <div key={h.label} className="min-w-0">
              <p className="num text-[22px] leading-none font-semibold tracking-[-0.02em]">{h.value}</p>
              <AutoDir as="p" text={h.label} className="mt-1 truncate text-[11.5px] text-ink-3" />
            </div>
          ))}
        </div>
      ) : (
        <AutoDir as="p" text={f.why} className="line-clamp-2 text-[12.5px] text-ink-2" />
      )}
      <p className="mt-auto text-[11.5px] text-ink-3">
        {[
          f.activeAgents ? t('{n} working', { n: f.activeAgents }) : null,
          f.doneTasks ? t('{n} done', { n: f.doneTasks }) : null,
          f.outputs ? t(f.outputs === 1 ? '{n} output' : '{n} outputs', { n: f.outputs }) : null,
        ]
          .filter(Boolean)
          .join(' · ') || t('Getting started')}
      </p>
    </div>
  );
  return f.pageSlug ? (
    <Link to="/p/$slug" params={{ slug: f.pageSlug }} className="block transition-colors hover:bg-muted/50">
      {body}
    </Link>
  ) : (
    body
  );
}

function Focuses({ home }: { home: HomeDTO }) {
  const { askNoor } = useUi();
  return (
    <Panel className="overflow-hidden lg:col-span-8">
      <PanelHeader title={t('Focuses')} />
      {home.focuses.length === 0 ? (
        <EmptyState
          title={t('No focuses yet')}
          hint={t('Once you and Noor agree on what matters, each area gets its own page here.')}
          action={
            <Button size="sm" variant="outline" onClick={() => askNoor()}>
              {t('Talk to Noor')}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-2">
          {home.focuses.map((f) => (
            <div key={f.id} className="bg-surface">
              <FocusTile f={f} />
            </div>
          ))}
          {home.focuses.length % 2 === 1 && <div className="hidden bg-surface sm:block" />}
        </div>
      )}
    </Panel>
  );
}

function NeedsYou({ home }: { home: HomeDTO }) {
  const { openDecision } = useDrawers();
  return (
    <Panel className="lg:col-span-4">
      <PanelHeader title={t('Needs you')} meta={home.decisions.length || undefined} />
      {home.decisions.length === 0 ? (
        <p className="px-4 pb-4 text-[13px] text-ink-3">{t('Nothing needs you right now.')}</p>
      ) : (
        <div className="px-2 pb-2">
          {home.decisions.map((d) => (
            <button key={d.id} type="button" onClick={() => openDecision(d.id)} className="flex w-full flex-col gap-0.5 rounded-lg px-2 py-2.5 text-start hover:bg-muted/60">
              <span className="flex items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full bg-warning" />
                <AutoDir text={d.title} className="truncate text-[13.5px] font-medium" />
              </span>
              {d.recommendation && <AutoDir as="p" text={d.recommendation} className="line-clamp-2 ps-3.5 text-[12.5px] text-ink-2" />}
              <Meta className="ps-3.5 text-[11.5px] text-ink-3" parts={[d.agent?.name, ago(d.createdAt)]} />
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

function RecentOutputs({ home }: { home: HomeDTO }) {
  const { openOutput } = useDrawers();
  return (
    <Panel className="lg:col-span-7">
      <PanelHeader
        title={t('Recent outputs')}
        actions={
          <Link to="/outputs" className="rounded-md px-2 py-1 text-[12.5px] text-ink-3 hover:bg-muted hover:text-foreground">
            {t('All outputs')}
          </Link>
        }
      />
      {home.outputs.length === 0 ? (
        <EmptyState icon={FolderOpen} title={t('No files yet')} hint={t('Spreadsheets, scripts, decks and documents your team produces land here.')} />
      ) : (
        <div className="px-2 pb-2">
          {home.outputs.slice(0, 6).map((o) => (
            <button key={o.id} type="button" onClick={() => openOutput(o.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-start hover:bg-muted/60">
              <FileGlyph type={o.type} size={30} />
              <div className="min-w-0 flex-1">
                <AutoDir as="p" text={o.title} className="truncate text-[13.5px] font-medium" />
                <Meta className="block truncate text-[11.5px] text-ink-3" parts={[o.fileName, o.agent?.name, o.focus?.name]} />
              </div>
              <span className="shrink-0 text-[11.5px] text-ink-3">{ago(o.createdAt)}</span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Progress({ home }: { home: HomeDTO }) {
  const days = home.progress;
  const hasData = days.some((d) => d.tasksDone || d.outputs);
  const option = useCallback(
    (th: ChartTheme) => ({
      grid: { left: 4, right: 4, top: 30, bottom: 4, containLabel: true },
      legend: { top: 0, ...(isRtlUi() ? { right: 0 } : { left: 0 }), itemWidth: 10, itemHeight: 10, icon: 'roundRect', textStyle: { color: th.ink2, fontSize: 11.5 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: th.grid, opacity: 0.6 } }, ...tooltipBase(th) },
      xAxis: { type: 'category', data: days.map((d) => d.date.slice(5)), ...axisBase(th), splitLine: { show: false }, axisLabel: { ...axisBase(th).axisLabel, interval: 2 } },
      yAxis: { type: 'value', minInterval: 1, ...axisBase(th) },
      series: [
        { name: t('Tasks done'), type: 'bar', data: days.map((d) => d.tasksDone), itemStyle: { color: th.series[0], borderRadius: [4, 4, 0, 0] }, barGap: '15%', barMaxWidth: 12 },
        { name: t('Outputs'), type: 'bar', data: days.map((d) => d.outputs), itemStyle: { color: th.series[1], borderRadius: [4, 4, 0, 0] }, barMaxWidth: 12 },
      ],
    }),
    [days],
  );
  return (
    <Panel className="lg:col-span-5">
      <PanelHeader title={t('Progress')} meta={t('last 14 days')} />
      {hasData ? (
        <div className="px-4 pb-3">
          <EChart option={option} height={190} />
        </div>
      ) : (
        <p className="px-4 pb-4 text-[13px] text-ink-3">{t('Shows real completed work and outputs as they happen — nothing to chart yet.')}</p>
      )}
    </Panel>
  );
}

export function HomePage() {
  const { data: home, isLoading } = useHome();
  return (
    <>
      <TopBar title={t('Home')} />
      <div className="mx-auto w-full max-w-[1320px] space-y-6 px-4 py-8 lg:px-8">
        {isLoading || !home ? (
          <div className="space-y-4">
            <Skeleton className="h-9 w-80" />
            <Skeleton className="h-14 w-full rounded-2xl" />
            <div className="grid gap-4 lg:grid-cols-12">
              <Skeleton className="h-56 lg:col-span-5" />
              <Skeleton className="h-56 lg:col-span-7" />
            </div>
          </div>
        ) : (
          <>
            <header className="space-y-1">
              <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.025em]">
                {greeting(home.founder.language, home.founder.name)}
              </h1>
              <p className="num text-[13.5px] text-ink-2">
                {new Date().toLocaleDateString(locale(), { weekday: 'long', month: 'long', day: 'numeric' })}
                {home.counts.activeAgents ? ` · ${t('{n} working now', { n: home.counts.activeAgents })}` : ''}
                {home.counts.tasksDoneThisWeek ? ` · ${t('{n} done this week', { n: home.counts.tasksDoneThisWeek })}` : ''}
                {home.counts.outputsThisWeek ? ` · ${t(home.counts.outputsThisWeek === 1 ? '{n} new file' : '{n} new files', { n: home.counts.outputsThisWeek })}` : ''}
              </p>
            </header>
            <AskBar lang={home.founder.language} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <Today home={home} />
              <LiveAgents home={home} />
              <Focuses home={home} />
              <NeedsYou home={home} />
              <RecentOutputs home={home} />
              <Progress home={home} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
