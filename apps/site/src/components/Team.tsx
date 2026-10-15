import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TEAM, type CharacterId, type TeamMember } from '../content';
import { Art, Reveal, SectionHeading } from './ui';

const COPIES = 3; // render the roster three times and keep the user in the middle copy → endless loop

function Card({ m, index, clone }: { m: TeamMember; index: number; clone: boolean }) {
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${TEAM.length}: ${m.name}, ${m.role}`}
      aria-hidden={clone || undefined}
      data-member={m.id}
      className="group w-[min(78vw,300px)] shrink-0 snap-center md:w-[340px]"
    >
      <div className="relative aspect-[340/600] overflow-hidden rounded-[16px] bg-[#0d0d0d]">
        <Art
          base={`card-${m.id}`}
          alt={clone ? '' : `${m.name}, ${m.role}`}
          sizes="(max-width: 767px) 78vw, 340px"
          loading="lazy"
          fallback={m.accent}
          className="h-full w-full object-cover transition-transform duration-[900ms] ease-[var(--ease-out-quint)] group-hover:scale-[1.045]"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[16px] ring-1 ring-white/10 ring-inset" />
      </div>
      <h3 className="mt-5 text-[26px] leading-[1.15] font-semibold tracking-[-0.035em] md:text-[30px]">{m.name}</h3>
      <p className="mt-2.5 text-[15px] leading-[1.5] text-white/60">
        <span className="font-medium text-white/90">{m.role}.</span> {m.description}
      </p>
    </div>
  );
}

export function Team({ target }: { target?: { id: CharacterId; nonce: number } }) {
  const track = useRef<HTMLDivElement>(null);
  const settle = useRef<number | undefined>(undefined);
  const [active, setActive] = useState(0);
  const n = TEAM.length;

  const slides = useCallback(() => [...(track.current?.querySelectorAll<HTMLElement>('[data-member]') ?? [])], []);

  const centerOn = useCallback((el: HTMLElement, smooth: boolean) => {
    const t = track.current;
    if (!t) return;
    const left = el.offsetLeft - (t.clientWidth - el.offsetWidth) / 2;
    t.scrollTo({ left, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
  }, []);

  const nearest = useCallback(() => {
    const t = track.current;
    if (!t) return 0;
    const mid = t.scrollLeft + t.clientWidth / 2;
    let best = 0;
    let dist = Infinity;
    slides().forEach((s, i) => {
      const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    return best;
  }, [slides]);

  // Start on Noor in the middle copy.
  useLayoutEffect(() => {
    const first = slides()[n];
    if (first) centerOn(first, false);
  }, [centerOn, n, slides]);

  // Re-centre the current card when the layout changes (rotation, resize).
  const activeRef = useRef(0);
  useEffect(() => {
    let timer: number | undefined;
    let keep: number | null = null;
    const onResize = () => {
      if (keep === null) keep = activeRef.current; // remember before the browser re-snaps
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const el = slides()[n + (keep ?? 0)];
        keep = null;
        if (el) centerOn(el, false);
      }, 150);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(timer);
    };
  }, [centerOn, n, slides]);

  // Where an in-flight smooth scroll is heading, so quick repeated clicks keep stepping.
  const pending = useRef<number | null>(null);

  // Keep the loop seamless: once scrolling settles in an outer copy, jump to the twin in the middle copy.
  const onScroll = () => {
    window.clearTimeout(settle.current);
    const i = nearest();
    activeRef.current = i % n;
    setActive(i % n);
    settle.current = window.setTimeout(() => {
      pending.current = null;
      const idx = nearest();
      if (idx < n || idx >= 2 * n) {
        const twin = slides()[(idx % n) + n];
        if (twin) centerOn(twin, false);
      }
    }, 140);
  };

  const step = (dir: 1 | -1) => {
    const all = slides();
    const idx = Math.max(0, Math.min(all.length - 1, (pending.current ?? nearest()) + dir));
    pending.current = idx;
    centerOn(all[idx], true);
  };

  useEffect(() => {
    if (!target) return;
    const i = TEAM.findIndex((m) => m.id === target.id);
    const el = slides()[n + i];
    if (el) window.setTimeout(() => centerOn(el, true), 450);
  }, [target, centerOn, n, slides]);

  return (
    <section id="team" aria-labelledby="team-title" className="relative py-20">
      <div className="shell">
        <Reveal y={40} className="mx-auto mb-2 w-[230px] md:w-[300px]">
          <div className="float-y">
            <Art
              base="close-noor"
              alt="Noor, your AI chief of staff, lit by her orb of light"
              sizes="(max-width: 767px) 230px, 300px"
              loading="lazy"
              fallback="#1d3557"
              className="aspect-square w-full object-cover"
              style={{ maskImage: 'radial-gradient(closest-side, #000 62%, transparent 100%)' }}
            />
          </div>
        </Reveal>
        <SectionHeading
          id="team-title"
          title={
            <>
              Meet your AI team.
              <br className="hidden sm:block" /> Noor hires the rest.
            </>
          }
          lead="Noor runs the company with you day to day. When work comes in, she brings in the right specialist, gives them the context they need, and has every result checked before it reaches you."
        />
      </div>

      <Reveal className="relative mx-auto mt-12 max-w-[1180px] md:mt-14" y={36}>
        <div
          ref={track}
          role="region"
          aria-roledescription="carousel"
          aria-label="AI team members"
          tabIndex={0}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] md:gap-8 [&::-webkit-scrollbar]:hidden"
          style={{ maskImage: 'linear-gradient(to right, transparent, #000 9%, #000 91%, transparent)' }}
        >
          {Array.from({ length: COPIES }, (_, copy) =>
            TEAM.map((m, i) => <Card key={`${copy}-${m.id}`} m={m} index={i} clone={copy !== 1} />),
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-[calc((min(78vw,300px)*600/340)/2)] flex -translate-y-1/2 justify-between px-3 md:top-[300px] md:px-[max(16px,calc(50%-530px))]">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous team member"
            className="pointer-events-auto grid size-11 place-items-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-md transition hover:scale-105 hover:bg-black/75"
          >
            <ArrowLeft size={20} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next team member"
            className="pointer-events-auto grid size-11 place-items-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-md transition hover:scale-105 hover:bg-black/75"
          >
            <ArrowRight size={20} aria-hidden />
          </button>
        </div>
        <p className="sr-only" aria-live="polite">
          Showing {TEAM[active].name}, {TEAM[active].role}
        </p>
      </Reveal>

      <div className="shell mt-10 flex flex-col items-center gap-4 text-center">
        <a href="#get-started" className="btn btn-primary">
          Get your AI team
        </a>
        <p className="max-w-[560px] text-[13px] leading-relaxed text-white/55">
          Specialists are hired by Noor for each job and named on the spot — Youssef, Hana, Omar and Karim are examples of who you'll meet.
          The Prompt Engineer and Result Judge work behind every task.
        </p>
      </div>
    </section>
  );
}
