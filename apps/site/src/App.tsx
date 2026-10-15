import { domAnimation, LazyMotion, MotionConfig } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import type { CharacterId } from './content';
import { Capabilities } from './components/Capabilities';
import { Footer, GetStarted } from './components/GetStarted';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { Nav } from './components/Nav';
import { Team } from './components/Team';
import { Workflows } from './components/Workflows';

const SECTIONS = 5; // below-the-fold sections mounted after the hero

/**
 * Mount the sections below the hero one idle slot at a time, so the first paint isn't one long task.
 * A deep link (#team, #features…) mounts everything at once so the browser can scroll to it.
 */
function useProgressiveMount() {
  const [stage, setStage] = useState(() => (window.location.hash.length > 1 ? SECTIONS : 0));
  useEffect(() => {
    if (stage >= SECTIONS) return;
    const next = () => setStage((s) => s + 1);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(next, { timeout: 400 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(next, 60); // Safari has no requestIdleCallback
    return () => clearTimeout(id);
  }, [stage]);
  // In-page navigation before everything has mounted: mount the rest at once, then go to the target.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    const all = () => {
      setPending(window.location.hash);
      setStage(SECTIONS);
    };
    window.addEventListener('hashchange', all);
    return () => window.removeEventListener('hashchange', all);
  }, []);
  useEffect(() => {
    if (!pending || stage < SECTIONS) return;
    document.getElementById(pending.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    setPending(null);
  }, [pending, stage]);
  return stage;
}

function Slot({ on, minHeight, children }: { on: boolean; minHeight: number; children: ReactNode }) {
  return on ? <>{children}</> : <div aria-hidden style={{ minHeight }} />;
}

export function App() {
  const [teamTarget, setTeamTarget] = useState<{ id: CharacterId; nonce: number }>();
  const stage = useProgressiveMount();
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <Nav
          onPickMember={(id) => {
            setTeamTarget({ id, nonce: Date.now() });
          }}
        />
        <main id="main">
          <Hero />
          <Slot on={stage >= 1} minHeight={1300}>
            <Team target={teamTarget} />
          </Slot>
          <Slot on={stage >= 2} minHeight={1400}>
            <Workflows />
          </Slot>
          <Slot on={stage >= 3} minHeight={800}>
            <HowItWorks />
          </Slot>
          <Slot on={stage >= 4} minHeight={1200}>
            <Capabilities />
          </Slot>
          <Slot on={stage >= 5} minHeight={850}>
            <GetStarted />
          </Slot>
        </main>
        {stage >= SECTIONS && <Footer />}
      </MotionConfig>
    </LazyMotion>
  );
}
