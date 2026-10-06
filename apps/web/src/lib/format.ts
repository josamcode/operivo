import { formatDistanceToNowStrict } from 'date-fns';

export const ago = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 45) return 'just now';
  return `${formatDistanceToNowStrict(d)} ago`;
};

export function elapsed(fromIso: string, toIso?: string | null) {
  const ms = (toIso ? new Date(toIso).getTime() : Date.now()) - new Date(fromIso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatNumber(v: unknown, format?: 'number' | 'percent' | 'currency' | 'duration', unit?: string) {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  let out: string;
  switch (format) {
    case 'percent':
      out = `${(n <= 1 && n >= -1 ? n * 100 : n).toFixed(0)}%`;
      break;
    case 'currency':
      out = n.toLocaleString(undefined, { maximumFractionDigits: 0 });
      break;
    case 'duration':
      out = n >= 60 ? `${Math.floor(n / 60)}h ${Math.round(n % 60)}m` : `${Math.round(n)}m`;
      break;
    default:
      out = Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
  return unit ? `${out} ${unit}` : out;
}

const RTL = /[֐-ࣿ]/;
export const isRtl = (s: string | null | undefined) => Boolean(s && RTL.test(s.slice(0, 200)));

export function greeting(lang: 'ar' | 'en', name: string) {
  const h = new Date().getHours();
  if (lang === 'ar') return h < 12 ? `صباح الخير يا ${name}` : `مساء الخير يا ${name}`;
  const part = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${name}`;
}
