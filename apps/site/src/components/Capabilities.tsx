import type { ReactNode } from 'react';
import { AlwaysAskWidget, ApprovalWidget, JudgeWidget, LocalWidget, MEMORIES, RosterWidget } from './mockups';
import { Art, Reveal, SectionHeading } from './ui';

function Panel({ title, children, widget, className = '', delay = 0 }: { title: string; children: ReactNode; widget: ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal delay={delay} className={className}>
      <article className="panel flex h-full flex-col p-7 md:p-8">
        <h3 className="text-[19px] leading-snug font-semibold tracking-[-0.02em]">{title}</h3>
        <p className="t-body mt-2.5">{children}</p>
        <div className="mt-6 flex flex-1 flex-col justify-end">{widget}</div>
      </article>
    </Reveal>
  );
}

function MemoryChip({ kind, text }: { kind: string; text: string }) {
  return (
    <div className="rounded-xl border border-white/[0.09] bg-[#1d1d1f]/90 px-3.5 py-2.5 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.8)] backdrop-blur">
      <div className="text-[10.5px] font-medium tracking-[0.08em] text-[#7fb0f0] uppercase">{kind}</div>
      <div className="mt-0.5 text-[13px] leading-snug break-words text-white/85">{text}</div>
    </div>
  );
}

/** Memories fan out from Noor, the way context fans out to each task. */
function MemoryDiagram() {
  const left = MEMORIES.filter((m) => m.side === 'l');
  const right = MEMORIES.filter((m) => m.side === 'r');
  return (
    <div className="relative mt-6">
      {/* Connector lines (desktop). */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 hidden h-full w-full md:block" viewBox="0 0 100 100" preserveAspectRatio="none">
        {[18, 50, 82].map((y) => (
          <g key={y} fill="none" stroke="rgb(127 176 240 / 0.35)" strokeWidth="0.25" vectorEffect="non-scaling-stroke">
            <path d={`M 31 ${y} C 38 ${y}, 38 50, 44 50`} vectorEffect="non-scaling-stroke" />
            <path d={`M 69 ${y} C 62 ${y}, 62 50, 56 50`} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
      <div className="relative grid items-center gap-5 md:grid-cols-[1fr_auto_1fr] md:gap-10">
        <div className="hidden gap-3 md:grid">
          {left.map((m) => (
            <MemoryChip key={m.text} kind={m.kind} text={m.text} />
          ))}
        </div>
        <div className="mx-auto">
          <div className="relative size-[170px] md:size-[200px]">
            <div aria-hidden className="absolute inset-[-18%] rounded-full bg-[radial-gradient(closest-side,rgb(57_135_229/0.35),transparent)]" />
            <Art
              base="bust-noor"
              alt="Noor, lit by her orb of light"
              sizes="200px"
              loading="lazy"
              fallback="#1d3557"
              className="relative h-full w-full rounded-full object-cover"
              style={{ maskImage: 'radial-gradient(closest-side, #000 72%, transparent)' }}
            />
          </div>
        </div>
        <div className="hidden gap-3 md:grid">
          {right.map((m) => (
            <MemoryChip key={m.text} kind={m.kind} text={m.text} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5 md:hidden">
          {MEMORIES.map((m) => (
            <MemoryChip key={m.text} kind={m.kind} text={m.text} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Capabilities() {
  return (
    <section id="features" aria-labelledby="features-title" className="relative py-20">
      <div className="shell">
        <SectionHeading
          id="features-title"
          title="Built to run your business"
          lead="An operating system around powerful agents: shared memory, real tools, checked results — and you in control of everything that matters."
        />

        <div className="mx-auto mt-12 grid max-w-[1280px] grid-cols-1 gap-5 md:mt-14 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          <Reveal className="md:col-span-2">
            <article className="panel relative h-full overflow-hidden p-7 md:p-8">
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[260px] bg-[radial-gradient(60%_100%_at_50%_0%,rgb(57_135_229/0.14),transparent)]" />
              <h3 className="relative text-[19px] leading-snug font-semibold tracking-[-0.02em]">Company memory that compounds</h3>
              <p className="t-body relative mt-2.5 max-w-[620px]">
                Opervio remembers facts, preferences, decisions and approaches that worked — and gives each agent only what's relevant to its task.
                Search it or make it forget anything, any time.
              </p>
              <MemoryDiagram />
            </article>
          </Reveal>

          <Panel
            delay={0.08}
            title="You approve what matters"
            widget={
              <div className="space-y-3">
                <AlwaysAskWidget />
                <ApprovalWidget />
              </div>
            }
          >
            Routine work never waits on you. Spending, publishing, messages in your name, deletes and production deploys wait for your yes — you pick the list.
          </Panel>

          <Panel title="Checked before it counts" widget={<JudgeWidget />}>
            The Result Judge verifies every deliverable against its success criteria. If something's missing, the agent gets focused feedback and
            another round.
          </Panel>

          <Panel delay={0.08} title="One conversation, a whole team" widget={<RosterWidget />}>
            Noor runs up to eight specialists at once, each with a compiled brief, the right tools and a live activity feed you can open anytime.
          </Panel>

          <Panel delay={0.16} title="Runs on your computer" widget={<LocalWidget />} className="md:col-span-2 lg:col-span-1">
            Your files stay in ~/Opervio and the server only answers on localhost. Agents use your own Claude Code or Codex sign-in.
          </Panel>
        </div>
      </div>
    </section>
  );
}
