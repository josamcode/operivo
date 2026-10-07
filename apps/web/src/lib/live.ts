import type { DataSource, MessageDTO, NotificationDTO, RunDTO, ServerEvent } from '@opervio/contracts';
import type { Query, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { trActivity } from './i18n';

type Listener = (n: NotificationDTO) => void;
const notificationListeners = new Set<Listener>();
export const onNotification = (fn: Listener) => {
  notificationListeners.add(fn);
  return () => {
    notificationListeners.delete(fn);
  };
};

const sourceOf = (q: Query): DataSource | null => {
  const k = q.queryKey;
  if (k[0] === 'data') return (k[2] as DataSource) ?? null;
  if (k[0] === 'aggregate') return ((k[2] as { source?: DataSource })?.source as DataSource) ?? null;
  return null;
};

/** Maps a server invalidation key to the client queries it affects. */
function invalidate(qc: QueryClient, key: string) {
  const [type, id] = key.split(':');
  const bySource = (pred: (s: DataSource) => boolean) =>
    qc.invalidateQueries({
      predicate: (q) => {
        const s = sourceOf(q);
        return Boolean(s && pred(s));
      },
    });
  switch (type) {
    case 'collection':
      void bySource((s) => s.kind === 'records' && s.collection === id);
      break;
    case 'agents':
      void qc.invalidateQueries({ queryKey: ['agents'] });
      void bySource((s) => s.kind === 'agents' || s.kind === 'activity' || s.kind === 'tasks');
      void qc.invalidateQueries({ queryKey: ['nav'] });
      break;
    case 'agent':
      void qc.invalidateQueries({ queryKey: ['agent', id] });
      break;
    case 'run':
      void qc.invalidateQueries({ queryKey: ['run', id] });
      break;
    case 'tasks':
      void bySource((s) => s.kind === 'tasks');
      break;
    case 'outputs':
      void qc.invalidateQueries({ queryKey: ['outputs'] });
      void bySource((s) => s.kind === 'outputs');
      break;
    case 'artifact':
      void qc.invalidateQueries({ queryKey: ['output', id] });
      break;
    case 'decisions':
      void qc.invalidateQueries({ queryKey: ['decisions'] });
      void qc.invalidateQueries({ queryKey: ['decision'] });
      void bySource((s) => s.kind === 'decisions');
      break;
    case 'memories':
      void qc.invalidateQueries({ queryKey: ['memories'] });
      void bySource((s) => s.kind === 'memories');
      break;
    case 'metric':
      void qc.invalidateQueries({ queryKey: ['metric', id] });
      void bySource((s) => s.kind === 'metric' && s.key === id);
      break;
    case 'page':
      void qc.invalidateQueries({ queryKey: ['page', id] });
      break;
    case 'pages':
      void qc.invalidateQueries({ queryKey: ['page'] });
      break;
    case 'nav':
      void qc.invalidateQueries({ queryKey: ['bootstrap'] });
      break;
    default:
      void qc.invalidateQueries({ queryKey: [type] });
  }
}

/** One SSE connection for the whole app. Reconnects automatically (EventSource retry). */
export function connectLive(qc: QueryClient) {
  const es = new EventSource('/api/events');
  es.onmessage = (msg) => {
    let ev: ServerEvent;
    try {
      ev = JSON.parse(msg.data);
    } catch {
      return;
    }
    switch (ev.type) {
      case 'invalidate':
        ev.keys.forEach((k) => invalidate(qc, k));
        break;
      case 'message.delta':
        qc.setQueryData<MessageDTO[]>(['messages'], (old) =>
          old?.map((m) => (m.id === ev.messageId ? { ...m, content: m.content + ev.text } : m)),
        );
        break;
      case 'message.activity':
        qc.setQueryData<MessageDTO[]>(['messages'], (old) =>
          old?.map((m) => (m.id === ev.messageId ? { ...m, activity: [...m.activity, ev.label] } : m)),
        );
        break;
      case 'run.event':
        qc.setQueryData<RunDTO>(['run', ev.runId], (old) =>
          old && !old.events.some((e) => e.id === ev.event.id) ? { ...old, events: [...old.events, ev.event], lastActivity: ev.event.label } : old,
        );
        break;
      case 'notification': {
        const n = ev.notification;
        notificationListeners.forEach((fn) => fn(n));
        if (n.kind === 'decision' || n.kind === 'failed' || n.kind === 'action' || n.kind === 'completed' || n.kind === 'reminder') {
          const opts = { description: n.body ?? undefined, duration: n.kind === 'completed' ? 5000 : 8000 };
          if (n.kind === 'failed') toast.error(trActivity(n.title), opts);
          else if (n.kind === 'completed') toast.success(trActivity(n.title), opts);
          else toast(trActivity(n.title), opts);
        }
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(n.title, { body: n.body ?? undefined, tag: n.id });
        }
        break;
      }
    }
  };
  return () => es.close();
}
