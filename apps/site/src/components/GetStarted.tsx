import { Check, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { APP_URL, SETUP_COMMANDS, type CharacterId } from '../content';
import { Art, Logo, Reveal } from './ui';

function Terminal() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SETUP_COMMANDS.map((c) => c.cmd).join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d12]/90 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)] backdrop-blur">
      <div className="flex items-center gap-1.5 border-b border-white/[0.07] px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="ml-2 text-[12px] text-white/55">In the Opervio folder</span>
        <button
          type="button"
          onClick={copy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/12 px-2.5 py-1 text-[12px] text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <span className="sr-only" aria-live="polite">
          {copied ? 'Commands copied to clipboard' : ''}
        </span>
      </div>
      <ol className="space-y-2 px-4 py-4 font-mono text-[13px] md:px-5 md:text-[14px]">
        {SETUP_COMMANDS.map((c) => (
          <li key={c.cmd} className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-white/90">
              <span className="text-[#7fb0f0] select-none">$ </span>
              {c.cmd}
            </span>
            <span className="text-[12px] text-white/50"># {c.note}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const LINEUP: { id: CharacterId; cls: string; delay: string }[] = [
  { id: 'hana', cls: 'left-[2%] h-[64%] z-10', delay: '0s' },
  { id: 'youssef', cls: 'left-[17%] h-[72%] z-20', delay: '-1.2s' },
  { id: 'karim', cls: 'right-[17%] h-[72%] z-20', delay: '-2.6s' },
  { id: 'omar', cls: 'right-[2%] h-[64%] z-10', delay: '-3.8s' },
  { id: 'noor', cls: 'left-1/2 -translate-x-1/2 h-[86%] z-30', delay: '-0.6s' },
];

function Lineup() {
  return (
    <div className="relative mx-auto aspect-[1.3] w-full max-w-[560px]">
      <div aria-hidden className="absolute inset-x-[8%] top-[18%] bottom-[8%] rounded-full bg-[radial-gradient(closest-side,rgb(57_135_229/0.45),transparent)] blur-2xl" />
      <div aria-hidden className="absolute inset-x-[6%] bottom-[2%] h-[12%] rounded-[100%] bg-black/60 blur-xl" />
      {LINEUP.map((c) => (
        <div key={c.id} className={`absolute bottom-[4%] ${c.cls}`}>
          <div className="float-y h-full" style={{ animationDelay: c.delay }}>
            <Art
              base={`cut-${c.id}`}
              alt=""
              sizes="(max-width: 767px) 40vw, 260px"
              loading="lazy"
              fallback="transparent"
              className="h-full w-auto max-w-none object-contain drop-shadow-[0_20px_30px_rgb(0_0_0/0.5)]"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GetStarted() {
  return (
    <section
      id="get-started"
      aria-labelledby="cta-title"
      className="relative overflow-hidden pt-20 pb-16 md:pt-24 md:pb-20"
      style={{ background: 'linear-gradient(180deg, #000 0%, #050a14 35%, #0b1a33 100%)' }}
    >
      <div className="shell grid items-center gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-10">
        <Reveal>
          <h2 id="cta-title" className="t-display max-w-[560px]">
            Your AI team is ready when you are.
          </h2>
          <p className="t-lead mt-6 max-w-[520px]">
            Opervio runs on your own computer with the Claude Code or Codex subscription you already have. Four commands and Noor is waiting for
            you.
          </p>
          <div className="mt-8 max-w-[560px]">
            <Terminal />
          </div>
          <p className="mt-4 max-w-[560px] text-[13px] leading-relaxed text-white/55">
            Needs Node 22+, pnpm, Docker and a signed-in Claude Code or Codex CLI. On Windows, <code className="text-white/70">scripts\start.ps1</code>{' '}
            does all four steps.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={APP_URL} className="btn btn-primary" target="_blank" rel="noreferrer">
              Open Opervio
              <ExternalLink aria-hidden size={16} />
            </a>
            <span className="text-[14px] text-white/50">Already running? It lives at localhost:4100.</span>
          </div>
        </Reveal>
        <Reveal delay={0.12} y={40}>
          <Lineup />
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  const links = [
    ['AI team', '#team'],
    ['Workflows', '#workflows'],
    ['How it works', '#how-it-works'],
    ['Features', '#features'],
    ['Install', '#get-started'],
  ] as const;
  return (
    <footer className="border-t border-white/[0.08] bg-[#08111f]">
      <div className="shell flex flex-col gap-6 py-9 md:flex-row md:items-center md:justify-between">
        <a href="#top" aria-label="Back to top" className="inline-flex w-fit rounded-lg">
          <Logo />
        </a>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {links.map(([label, href]) => (
              <li key={label}>
                <a href={href} className="text-[14px] text-white/65 transition-colors hover:text-white">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="shell flex flex-col gap-2 border-t border-white/[0.06] py-5 text-[12.5px] text-white/55 sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} Opervio · You're the founder. Your AI team handles the work.</span>
        <span>Runs on your machine. Your files stay in ~/Opervio.</span>
      </div>
    </footer>
  );
}
