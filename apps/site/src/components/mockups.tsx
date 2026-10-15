/**
 * Faithful slices of Opervio's real UI (dark theme), rebuilt in HTML so they stay crisp at any size.
 * Wording mirrors the app; record values are illustrative.
 */
import {
  BookOpen,
  Check,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Folder,
  Globe,
  Search,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NoorMark } from './ui';

const hue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

/** The app's agent monogram: first letter on a quiet tint derived from the name. */
export function Monogram({ name, size = 22, working = false }: { name: string; size?: number; working?: boolean }) {
  const h = hue(name);
  return (
    <span
      aria-hidden
      className="relative inline-grid shrink-0 place-items-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `oklch(0.32 0.045 ${h})`, color: `oklch(0.86 0.06 ${h})` }}
    >
      {name[0]}
      {working && <span className="live-dot absolute -right-0.5 -bottom-0.5 size-2 rounded-full border-2 border-[#16191f] bg-[#3fb984]" />}
    </span>
  );
}

function Chip({ children, tone = 'brand' }: { children: ReactNode; tone?: 'brand' | 'muted' | 'positive' }) {
  const cls =
    tone === 'brand'
      ? 'bg-[#3987e5]/15 text-[#7fb0f0]'
      : tone === 'positive'
        ? 'bg-[#3fb984]/15 text-[#3fb984]'
        : 'bg-white/[0.07] text-white/60';
  return <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ${cls}`}>{children}</span>;
}

export function AppWindow({ children, title, className = '' }: { children: ReactNode; title?: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[14px] border border-white/10 bg-[#0f1115] text-[#ecedef] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)] ${className}`}>
      <div className="flex h-8 items-center gap-1.5 border-b border-white/[0.06] bg-[#16191f] px-3">
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        {title && <span className="ml-2 truncate text-[11px] text-white/55">{title}</span>}
      </div>
      {children}
    </div>
  );
}

/** Noor's plan card — nothing is created until the founder confirms. */
export function PlanCard({ className = '' }: { className?: string }) {
  return (
    <div className={`widget-dark p-4 text-[12.5px] ${className}`}>
      <div className="flex items-center gap-2">
        <NoorMark size={18} />
        <span className="font-medium">Noor</span>
        <span className="text-white/55">Chief of staff</span>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/55">
        <Check size={12} aria-hidden /> Prepared a plan for you to confirm
      </p>
      <p className="mt-1.5 leading-snug text-white/85">Clients come first; learning runs alongside. Confirm or adjust?</p>
      <div className="mt-3 space-y-2.5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
        <div className="flex gap-2.5">
          <Target size={14} className="mt-0.5 shrink-0 text-white/50" aria-hidden />
          <div>
            <div className="flex items-center gap-1.5 font-medium">
              Clients <Chip>Main focus</Chip>
            </div>
            <div className="text-white/50">Income depends on a steady pipeline.</div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <BookOpen size={14} className="mt-0.5 shrink-0 text-white/50" aria-hidden />
          <div>
            <div className="flex items-center gap-1.5 font-medium">
              Learning <Chip tone="muted">Continuous</Chip>
            </div>
            <div className="text-white/50">Learn AI 45 minutes a day.</div>
          </div>
        </div>
        <div className="border-t border-white/[0.06] pt-2.5">
          <div className="text-[10.5px] text-white/55">Starts working on</div>
          <div className="mt-1.5 flex items-center gap-2">
            <Monogram name="Youssef" size={20} />
            <span className="font-medium">Youssef</span>
            <span className="text-white/55">Lead Researcher</span>
          </div>
          <div className="mt-0.5 pl-7 text-white/50">Find first leads</div>
        </div>
        <div className="border-t border-white/[0.06] pt-2.5">
          <div className="text-[10.5px] text-white/55">Your part today</div>
          <div className="mt-1.5 flex items-center gap-2 text-white/80">
            <span className="size-3.5 rounded-[4px] border border-white/30" /> Call one past client
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-black">
          <Check size={12} aria-hidden /> Confirm and start
        </span>
        <span className="rounded-lg px-2.5 py-1.5 text-[11.5px] text-white/70">Adjust</span>
      </div>
    </div>
  );
}

/** A focus page Noor built: structured records an agent filled in from the web. */
export function LeadsBoard({ className = '' }: { className?: string }) {
  const cols = [
    { name: 'found', n: 1, items: [{ t: 'Nile Dental', u: 'nile.example' }] },
    { name: 'qualified', n: 1, items: [{ t: 'Acme Clinic', u: 'acme.example' }] },
    { name: 'contacted', n: 0, items: [] },
  ];
  return (
    <div className={`widget-dark overflow-hidden text-[12px] ${className}`}>
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[#16191f] px-3 py-2">
        <Globe size={13} className="text-white/55" aria-hidden />
        <span className="truncate text-[11px] text-white/55">Youssef · Searching directories 1/2</span>
        <span className="live-dot ml-auto size-1.5 shrink-0 rounded-full bg-[#3fb984]" />
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold tracking-[-0.02em]">Clients</span>
          <Chip>Priority</Chip>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {[
            ['Leads', '2'],
            ['Qualified', '1'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-2">
              <div className="text-[10.5px] text-white/55">{k}</div>
              <div className="text-[18px] leading-tight font-semibold">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {cols.map((c) => (
            <div key={c.name} className="min-h-[84px] rounded-lg border border-white/[0.07] bg-white/[0.02] p-1.5">
              <div className="mb-1.5 flex items-center gap-1 px-0.5 text-[10.5px] text-white/55">
                {c.name} <span className="text-white/45">{c.n}</span>
              </div>
              {c.items.map((it) => (
                <div key={it.t} className="rounded-md border border-white/[0.08] bg-[#1b1f26] px-1.5 py-1.5">
                  <div className="truncate text-[11px] font-medium">{it.t}</div>
                  <div className="mt-0.5 flex items-center gap-0.5 truncate text-[10px] text-[#7fb0f0]">
                    {it.u} <ExternalLink size={9} aria-hidden />
                  </div>
                </div>
              ))}
              {!c.items.length && <div className="px-0.5 pt-3 text-center text-[10px] text-white/25">Empty</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Analysis output: a chart section on a page plus the spreadsheet it came from. */
export function AnalysisCard({ className = '' }: { className?: string }) {
  const bars = [38, 52, 46, 61, 58, 74, 69, 88];
  return (
    <div className={`widget-dark p-3.5 text-[12px] ${className}`}>
      <div className="flex items-center justify-between">
        <span className="font-medium">Revenue by month</span>
        <Chip tone="muted">last 8 months</Chip>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-[22px] font-semibold tracking-[-0.02em]">+31%</span>
        <span className="text-[11px] text-[#3fb984]">vs. previous period</span>
      </div>
      <div className="mt-3 flex h-[92px] items-end gap-1.5 border-b border-white/[0.08] pb-px">
        {bars.map((b, i) => (
          <span
            key={i}
            className="flex-1 rounded-t-[3px]"
            style={{ height: `${b}%`, background: i === bars.length - 1 ? '#3987e5' : 'rgb(57 135 229 / 0.38)' }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-2">
        <FileSpreadsheet size={14} className="text-[#3fb984]" aria-hidden />
        <span className="truncate">revenue-analysis.xlsx</span>
        <span className="ml-auto shrink-0 text-[10.5px] text-white/55">Omar · just now</span>
      </div>
    </div>
  );
}

/* ——— Light widgets for the feature panels ——— */

const JUDGE_STATES = [
  { text: 'Checking the result…', cls: 'text-black/50', badge: null },
  { text: 'Incomplete · feedback sent (round 1 of 2)', cls: 'text-[#b8750d]', badge: null },
  { text: 'Working on the feedback…', cls: 'text-black/50', badge: null },
  { text: 'Result verified', cls: 'text-[#1a8a5c]', badge: 'Done' },
] as const;

/** The judge loop, live: check → focused feedback → fix → verified. */
function JudgeCycle() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.6 });
  const reduce = useReducedMotion();
  const [i, setI] = useState(1);
  useEffect(() => {
    if (!inView || reduce) return;
    const t = window.setTimeout(() => setI((n) => (n + 1) % JUDGE_STATES.length), i === 3 ? 3200 : 1900);
    return () => window.clearTimeout(t);
  }, [i, inView, reduce]);
  const st = JUDGE_STATES[i];
  return (
    <div ref={ref} className="widget flex items-center gap-2.5 px-3 py-2.5">
      <Monogram name="Hana" size={24} working={i === 0 || i === 2} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">Launch post draft</div>
        <div key={i} className={`animate-[fade-in_0.4s_ease-out] truncate text-[11px] ${st.cls}`}>
          {st.badge && <CheckCircle2 size={11} className="mr-1 inline align-[-1px]" aria-hidden />}
          {st.text}
        </div>
      </div>
      {st.badge && <span className="rounded-full bg-[#1a8a5c]/10 px-2 py-0.5 text-[10.5px] font-medium text-[#1a8a5c]">{st.badge}</span>}
    </div>
  );
}

export function JudgeWidget() {
  return (
    <div className="space-y-2.5 text-[12.5px]">
      <JudgeCycle />
      <div className="widget flex items-center gap-2.5 px-3 py-2.5">
        <Monogram name="Youssef" size={24} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">Find first leads</div>
          <div className="flex items-center gap-1 text-[11px] text-[#1a8a5c]">
            <CheckCircle2 size={11} aria-hidden /> Result verified
          </div>
        </div>
        <span className="rounded-full bg-[#1a8a5c]/10 px-2 py-0.5 text-[10.5px] font-medium text-[#1a8a5c]">Done</span>
      </div>
    </div>
  );
}

export function AlwaysAskWidget() {
  const items = ['Spending money', 'Sending messages in my name', 'Publishing anything publicly', 'Production deploys or changes'];
  return (
    <div className="widget p-3 text-[12.5px]">
      <div className="px-1 pb-2 text-[11px] font-medium text-black/45">Always check with me first</div>
      <ul className="space-y-1">
        {items.map((t) => (
          <li key={t} className="flex items-center gap-2 rounded-lg px-1 py-1">
            <span className="grid size-4 place-items-center rounded-[4px] bg-[#2a78d6] text-white">
              <Check size={11} strokeWidth={3} aria-hidden />
            </span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ApprovalWidget() {
  return (
    <div className="widget flex items-center gap-2.5 px-3 py-2.5 text-[12.5px]">
      <Monogram name="Karim" size={26} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">Push fix to main</div>
        <div className="flex items-center gap-1 text-[11px] text-[#b8750d]">
          <span className="size-1.5 rounded-full bg-[#c98500]" /> Needs you
        </div>
      </div>
      <span className="rounded-full bg-black px-3 py-1 text-[11.5px] font-medium text-white">Approve</span>
    </div>
  );
}

export function RosterWidget() {
  const rows = [
    { n: 'Youssef', r: 'Lead Researcher', s: 'Searching directories · 2/3', live: true },
    { n: 'Hana', r: 'Content Writer', s: 'Writing launch-post.md', live: true },
    { n: 'Omar', r: 'Data Analyst', s: 'Running Python · pandas', live: true },
  ];
  return (
    <div className="widget divide-y divide-black/[0.06] text-[12.5px]">
      {rows.map((r) => (
        <div key={r.n} className="flex items-center gap-2.5 px-3 py-2.5">
          <Monogram name={r.n} size={24} />
          <div className="min-w-0 flex-1">
            <div className="truncate">
              <span className="font-medium">{r.n}</span> <span className="text-black/45">{r.r}</span>
            </div>
            <div className="truncate text-[11px] text-black/50">{r.s}</div>
          </div>
          <span className="live-dot size-1.5 shrink-0 rounded-full bg-[#1a8a5c]" />
        </div>
      ))}
    </div>
  );
}

export function LocalWidget() {
  const rows: [ReactNode, string, string][] = [
    [<Folder key="w" size={13} aria-hidden />, 'workspace/', 'agent work'],
    [<FileText key="o" size={13} aria-hidden />, 'outputs/', 'your files'],
    [<Search key="p" size={13} aria-hidden />, 'python/.venv', 'isolated'],
    [<ShieldCheck key="l" size={13} aria-hidden />, 'logs/', 'secrets redacted'],
  ];
  return (
    <div className="widget p-3 font-mono text-[12px]">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="font-sans text-[11px] font-medium text-black/45">~/Opervio</span>
        <span className="rounded-full bg-[#2a78d6]/10 px-2 py-0.5 font-sans text-[10.5px] font-medium text-[#1c5cab]">localhost:4100</span>
      </div>
      {rows.map(([icon, p, note]) => (
        <div key={p} className="flex items-center gap-2 rounded-md px-1 py-1 text-black/80">
          <span className="text-black/40">{icon}</span>
          {p}
          <span className="ml-auto font-sans text-[10.5px] text-black/40">{note}</span>
        </div>
      ))}
    </div>
  );
}

export const MEMORIES = [
  { kind: 'Fact', text: 'The studio builds websites for clinics', side: 'l' },
  { kind: 'Preference', text: 'Short updates, in English', side: 'l' },
  { kind: 'Decision', text: 'Clients come first this month', side: 'l' },
  { kind: 'Approach', text: 'Qualify leads from two sources', side: 'r' },
  { kind: 'Context', text: 'Available 3–4 hours a day', side: 'r' },
  { kind: 'Note', text: 'Acme Clinic asked for a quote', side: 'r' },
] as const;
