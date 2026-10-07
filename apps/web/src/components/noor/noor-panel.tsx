import type { MessageDTO, MessageRef } from '@opervio/contracts';
import { Link } from '@tanstack/react-router';
import { ArrowUp, Check, FileText, Square, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ResizeHandle } from '@/components/ui/resize-handle';
import { useResizableWidth } from '@/hooks/use-resizable-width';
import { api } from '@/lib/api';
import { endSide, t, trActivity } from '@/lib/i18n';
import { useDecision, useMessages, useSendToNoor } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { AgentAvatar, Markdown, MultilineText, NoorMark } from '../app/primitives';
import { useDrawers, useUi } from '../app/ui-state';
import { PlanCard } from './plan-card';

function RefChip({ r }: { r: MessageRef }) {
  const { openAgent, openOutput } = useDrawers();
  const base = 'inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface px-2 text-[12.5px] text-ink-2 shadow-xs transition-colors hover:text-foreground';
  if (r.kind === 'page')
    return (
      <Link to="/p/$slug" params={{ slug: r.slug }} className={base}>
        <span className="size-1.5 rounded-full bg-brand" />
        <bdi>{r.title}</bdi>
      </Link>
    );
  if (r.kind === 'agent')
    return (
      <button type="button" onClick={() => openAgent(r.id)} className={base}>
        <AgentAvatar name={r.name} size={16} />
        <bdi>{r.name}</bdi>
      </button>
    );
  if (r.kind === 'output')
    return (
      <button type="button" onClick={() => openOutput(r.id)} className={base}>
        <FileText className="size-3.5" /> <bdi>{r.title}</bdi>
      </button>
    );
  return null;
}

function Message({ m }: { m: MessageDTO }) {
  if (m.role === 'system') {
    return <div className="py-1 text-center text-[11.5px] text-ink-3">{m.content}</div>;
  }
  if (m.role === 'founder') {
    return (
      <div className="flex justify-end">
        <MultilineText text={m.content} className="max-w-[85%] rounded-2xl rounded-ee-md bg-muted px-3.5 py-2 text-[13.5px] leading-relaxed text-foreground" />
      </div>
    );
  }
  const streaming = m.status === 'streaming';
  const decisions = m.refs.filter((r) => r.kind === 'decision');
  const chips = m.refs.filter((r) => r.kind !== 'decision');
  return (
    <div className="flex gap-2.5">
      <NoorMark size={20} live={streaming} className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-2.5">
        {m.activity.length > 0 && (
          <ul className="space-y-0.5">
            {m.activity.slice(-6).map((a, i) => (
              <li key={i} className="flex items-center gap-1.5 text-[12px] text-ink-3">
                <Check className="size-3" strokeWidth={2.25} />
                {trActivity(a)}
              </li>
            ))}
          </ul>
        )}
        {m.content ? (
          <Markdown className={cn('text-[13.5px] text-foreground', m.status === 'error' && 'text-destructive')}>{m.content}</Markdown>
        ) : (
          streaming && <span className="text-shimmer text-[13px]">{t('Thinking')}</span>
        )}
        {decisions.map((r) => r.kind === 'decision' && <DecisionRef key={r.id} id={r.id} />)}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((r, i) => (
              <RefChip key={i} r={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Plans render inline as a card; other decisions are a compact link to the decision dialog. */
function DecisionRef({ id }: { id: string }) {
  const { openDecision } = useDrawers();
  const { data } = useDecision(id);
  if (!data) return null;
  if (data.kind === 'plan') return <PlanCard decisionId={id} />;
  return (
    <button type="button" onClick={() => openDecision(id)} className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-start text-[12.5px] shadow-xs hover:border-border-strong">
      <span className="size-1.5 rounded-full bg-warning" />
      <span dir="auto" className="truncate ui-align">{data.title}</span>
      <span className="ms-auto text-ink-3">{data.status === 'open' ? t('Decide') : t('Decided')}</span>
    </button>
  );
}

export function NoorThread() {
  const { data: messages = [] } = useMessages();
  const send = useSendToNoor();
  const { draft, setDraft } = useUi();
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const streaming = messages.find((m) => m.role === 'noor' && m.status === 'streaming');

  const stick = useRef(true);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const inner = el.firstElementChild;
    const pin = () => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    };
    const onScroll = () => {
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    pin();
    el.addEventListener('scroll', onScroll);
    const ro = new ResizeObserver(pin);
    if (inner) ro.observe(inner);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, []);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, messages.at(-1)?.content.length]);

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [draft]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    send.mutate(text);
    setDraft('');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-5 px-4 py-4">
        {messages.length === 0 && (
          <div className="pt-10 text-[13px] text-ink-3">
            <p className="font-medium text-foreground">{t('Tell Noor what’s going on.')}</p>
            <p className="mt-1">{t('Work, clients, content, learning, life — say it the way you’d say it to a friend. She’ll organize it and get the right people working.')}</p>
          </div>
        )}
        {messages.map((m) => (
          <Message key={m.id} m={m} />
        ))}
        </div>
      </div>
      <div className="border-t border-border p-3">
        <div className="rounded-xl border border-border-strong bg-surface shadow-xs focus-within:border-brand/50 focus-within:ring-3 focus-within:ring-ring/30">
          <textarea
            id="noor-input"
            ref={input}
            dir="auto"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={t('Message Noor')}
            className="block max-h-[180px] w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-[13.5px] outline-none placeholder:text-ink-3"
          />
          <div className="flex items-center gap-2 px-2 pb-2">
            <span className="ps-1 text-[11px] text-ink-3">{t('Enter to send · Shift+Enter for a new line')}</span>
            {streaming ? (
              <Button size="icon-sm" variant="secondary" className="ms-auto" onClick={() => api.post(`/api/messages/${streaming.id}/cancel`)} aria-label={t('Stop')}>
                <Square className="size-3" fill="currentColor" />
              </Button>
            ) : (
              <Button size="icon-sm" className="ms-auto" disabled={!draft.trim() || send.isPending} onClick={submit} aria-label={t('Send')}>
                <ArrowUp />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NoorPanel({ className, style, children }: { className?: string; style?: CSSProperties; children?: ReactNode }) {
  const { setNoorOpen } = useUi();
  const { data: messages = [] } = useMessages();
  const live = messages.some((m) => m.status === 'streaming');
  return (
    <aside className={cn('relative flex h-full w-[400px] shrink-0 flex-col border-s border-border bg-surface', className)} style={style} aria-label={t('Noor')}>
      {children}
      <header className="flex h-12 items-center gap-2.5 border-b border-border px-4">
        <NoorMark size={20} live={live} />
        <div className="leading-tight">
          <p className="text-[13.5px] font-semibold">{t('Noor')}</p>
        </div>
        <span className="text-[12px] text-ink-3">{live ? t('working…') : t('Chief of staff')}</span>
        <button type="button" onClick={() => setNoorOpen(false)} className="ms-auto grid size-7 place-items-center rounded-md text-ink-3 hover:bg-muted hover:text-foreground" aria-label={t('Close Noor')}>
          <X className="size-4" />
        </button>
      </header>
      <NoorThread />
    </aside>
  );
}

/** Docked beside the page on wide screens; drag its left edge to resize. Always leaves the sidebar plus a usable page. */
export function DockedNoorPanel() {
  const size = useResizableWidth({ id: 'noor', defaultWidth: 400, minWidth: 340, maxWidth: 820, reserve: 240 + 560 });
  return (
    <NoorPanel style={{ width: size.width }} className={cn(size.dragging && 'select-none')}>
      <ResizeHandle side={endSide()} size={size} />
    </NoorPanel>
  );
}
