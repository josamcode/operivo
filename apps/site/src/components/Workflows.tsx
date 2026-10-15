import type { ReactNode } from 'react';
import type { CharacterId } from '../content';
import { AnalysisCard, LeadsBoard, PlanCard } from './mockups';
import { Art, Parallax, Reveal, SectionHeading } from './ui';

function Character({ id, alt, className }: { id: CharacterId; alt: string; className: string }) {
  return (
    <Art
      base={`cut-${id}`}
      alt={alt}
      sizes="(max-width: 767px) 50vw, 300px"
      loading="lazy"
      fallback="transparent"
      className={`pointer-events-none absolute z-20 w-auto object-contain drop-shadow-[0_24px_30px_rgb(0_0_0/0.35)] transition-transform duration-700 ease-[var(--ease-out-quint)] group-hover:-translate-y-2 ${className}`}
    />
  );
}

function CardText({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="relative z-10">
      <h3 className="t-h3 max-w-[420px]">{title}</h3>
      <p className="mt-4 max-w-[400px] text-[16px] leading-[1.55] text-white/75 md:text-[17px]">{children}</p>
    </div>
  );
}

export function Workflows() {
  return (
    <section id="workflows" aria-labelledby="workflows-title" className="relative py-20">
      <div className="shell">
        <SectionHeading
          id="workflows-title"
          title={
            <>
              Your company runs on AI.
              <br className="hidden sm:block" /> You still call the shots.
            </>
          }
          lead="Talk to Noor the way you'd brief a chief of staff. She turns goals into plans, hands each job to the right specialist, and brings the finished work back — checked, filed and on the right page."
        />

        <div className="mx-auto mt-12 grid max-w-[1024px] grid-cols-1 gap-6 md:mt-14 md:grid-cols-2 md:gap-10">
          <Reveal className="md:col-span-2">
            <article className="glow-card glow-card--blue group grid min-h-[460px] transition-transform duration-500 hover:-translate-y-1 md:grid-cols-[1fr_1.05fr]">
              <div className="p-7 md:flex md:flex-col md:justify-center md:p-10 md:pr-4">
                <CardText title="Noor, turn this goal into a plan">
                  Say what you're working toward. Noor proposes focuses, pages, the specialists to hire and your part for today — nothing is
                  created until you confirm.
                </CardText>
              </div>
              <div className="relative h-[460px] md:h-auto">
                <div className="absolute bottom-0 left-5 w-[280px] translate-y-4 sm:w-[300px] md:left-2 md:w-[318px] md:translate-y-10">
                  <Parallax>
                    <PlanCard />
                  </Parallax>
                </div>
                <Character
                  id="noor"
                  alt="Noor holding her orb of light"
                  className="right-[-18px] bottom-[-130px] h-[400px] md:right-[-6px] md:bottom-[-170px] md:h-[540px]"
                />
              </div>
            </article>
          </Reveal>

          <Reveal delay={0.08}>
            <article className="glow-card glow-card--green group flex min-h-[490px] flex-col transition-transform duration-500 hover:-translate-y-1">
              <div className="p-7 md:p-9">
                <CardText title="Youssef, find our first leads">
                  Specialists research in your own Chrome, in their own tabs, and save what they find as records Noor puts on your pages.
                </CardText>
              </div>
              <div className="relative mt-auto h-[250px]">
                <div className="absolute bottom-0 left-6 w-[270px] translate-y-8 md:left-8 md:w-[290px]">
                  <Parallax>
                    <LeadsBoard />
                  </Parallax>
                </div>
                <Character id="youssef" alt="Youssef with his tablet" className="right-[-16px] bottom-[-120px] h-[360px] md:right-[-10px] md:bottom-[-140px] md:h-[420px]" />
              </div>
            </article>
          </Reveal>

          <Reveal delay={0.16}>
            <article className="glow-card glow-card--violet group flex min-h-[490px] flex-col transition-transform duration-500 hover:-translate-y-1">
              <div className="p-7 md:p-9">
                <CardText title="Omar, what do last month's numbers say?">
                  Analysis runs in an isolated Python environment — pandas, charts, spreadsheets — and lands on your pages as tables and charts.
                </CardText>
              </div>
              <div className="relative mt-auto h-[250px]">
                <div className="absolute bottom-0 left-6 w-[270px] translate-y-8 md:left-8 md:w-[290px]">
                  <Parallax>
                    <AnalysisCard />
                  </Parallax>
                </div>
                <Character id="omar" alt="Omar presenting a floating chart" className="right-[-16px] bottom-[-120px] h-[360px] md:right-[-10px] md:bottom-[-140px] md:h-[420px]" />
              </div>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
