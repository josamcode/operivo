import { AnimatePresence, useInView, useReducedMotion } from 'motion/react';
import * as motion from 'motion/react-m';
import { useEffect, useRef, useState } from 'react';
import { AppWindow } from './mockups';
import { Art, Reveal, SectionHeading } from './ui';

const STEPS = [
  {
    title: 'Tell Noor about your work',
    body: "Eight quick questions: what you do, what's on your plate, how much time you have, and what she must always check with you first.",
    shot: 'ui-setup',
    alt: "Opervio setup asking “What's on your plate right now?”",
    url: 'localhost:4100 · Setup',
  },
  {
    title: 'Confirm her plan',
    body: 'Noor proposes focuses, pages and the specialists to hire. Confirm it or tell her what to adjust — nothing is created before you say so.',
    shot: 'ui-plan',
    alt: "Noor's proposed plan with Confirm and start and Adjust buttons",
    url: 'localhost:4100 · Home',
  },
  {
    title: 'Watch the work happen',
    body: 'Each specialist gets a compiled brief and reports live as they browse, write files and run Python. The Result Judge checks every result before it counts.',
    shot: 'ui-agent',
    alt: "A specialist's live activity ending in “Result verified”",
    url: 'localhost:4100 · Clients',
  },
  {
    title: 'Decide only what matters',
    body: 'Home shows just your part — today’s to-dos, questions and approvals. Everything else keeps moving without you.',
    shot: 'ui-home',
    alt: "Opervio home with today's to-dos, the team and verified outputs",
    url: 'localhost:4100 · Home',
  },
] as const;

const DURATION = 6500;

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const inView = useInView(wrap, { amount: 0.4 });
  const reduce = useReducedMotion();
  const running = inView && !paused && !reduce;

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => setActive((a) => (a + 1) % STEPS.length), DURATION);
    return () => window.clearTimeout(t);
  }, [running, active]);

  return (
    <section id="how-it-works" aria-labelledby="how-title" className="relative py-20">
      <div className="shell">
        <SectionHeading
          id="how-title"
          title="From a goal to finished work"
          lead="Getting started takes minutes. Answer a few questions, confirm Noor's plan, and your team gets to work — no workflows to build."
        />

        <div
          ref={wrap}
          className="mx-auto mt-12 grid max-w-[1180px] items-center gap-10 md:mt-14 lg:grid-cols-[1.25fr_1fr] lg:gap-16"
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          <Reveal y={36} className="[perspective:1600px]">
            <div className="transition-transform duration-700 ease-[var(--ease-out-quint)] lg:[transform:rotateY(9deg)_rotateX(3deg)] lg:hover:[transform:rotateY(0deg)_rotateX(0deg)]">
              <AppWindow title={STEPS[active].url} className="relative">
                <div className="relative aspect-[1440/900] bg-[#0f1115]">
                  <AnimatePresence initial={false}>
                    <motion.div
                      key={active}
                      className="absolute inset-0"
                      initial={{ opacity: 0, scale: 1.015 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                    >
                      <Art
                        base={STEPS[active].shot}
                        alt={STEPS[active].alt}
                        sizes="(max-width: 1023px) 92vw, 660px"
                        className="h-full w-full object-cover object-top"
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </AppWindow>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <ol className="border-t border-white/12">
              {STEPS.map((s, i) => {
                const on = i === active;
                return (
                  <li key={s.title} className="border-b border-white/12">
                    <button
                      type="button"
                      onClick={() => setActive(i)}
                      aria-expanded={on}
                      aria-controls={`step-${i}`}
                      className="flex w-full items-baseline gap-4 py-5 text-left"
                    >
                      <span className={`w-6 shrink-0 text-[17px] tabular-nums transition-colors ${on ? 'text-white' : 'text-white/50'}`}>{i + 1}</span>
                      <span
                        className={`font-medium tracking-[-0.03em] transition-all duration-300 ${
                          on ? 'text-[24px] leading-[1.2] text-white md:text-[28px]' : 'text-[17px] text-white/70 hover:text-white'
                        }`}
                      >
                        {s.title}
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {on && (
                        <motion.div
                          id={`step-${i}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="pb-5 pl-10 text-[15px] leading-[1.55] text-white/65">{s.body}</p>
                          <div className="mb-[-1px] ml-10 h-px overflow-hidden bg-white/10">
                            <motion.div
                              key={`${i}-${running}`}
                              className="h-full origin-left bg-[#3987e5]"
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: running ? 1 : 0 }}
                              transition={{ duration: running ? DURATION / 1000 : 0, ease: 'linear' }}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ol>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
