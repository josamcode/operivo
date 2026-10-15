import * as motion from 'motion/react-m';
import { ArrowRight } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { HERO_ORB } from '../content';

const EASE = [0.22, 1, 0.36, 1] as const;
const rise = (delay: number) => ({
  initial: { opacity: 0, y: 26 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 1, ease: EASE, delay },
});

/** Where a point of an object-fit: cover image lands inside its box. */
function coverPoint(box: DOMRect, img: { w: number; h: number }, pos: { x: number; y: number }, pt: { x: number; y: number }) {
  const scale = Math.max(box.width / img.w, box.height / img.h);
  const dw = img.w * scale;
  const dh = img.h * scale;
  return { left: (box.width - dw) * pos.x + pt.x * dw, top: (box.height - dh) * pos.y + pt.y * dh, scale };
}

/** Hero art lives in public/hero with stable names; index.html preloads and pre-paints it before React runs. */
const HERO_WIDE = { src: '/hero/hero-2100.webp', srcSet: '/hero/hero-1400.webp 1400w, /hero/hero-2100.webp 2100w, /hero/hero-2748.webp 2748w' };
const HERO_TALL = { srcSet: '/hero/hero-m-480.webp 480w, /hero/hero-m-690.webp 690w' };
const HERO_ALT = "Noor, Opervio's AI chief of staff, waving hello in a sunlit studio office while a small orb of blue light floats above her hand";

function HeroArt() {
  const box = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const [own, setOwn] = useState(false);
  const [orb, setOrb] = useState<{ left: number; top: number; size: number } | null>(null);

  // Adopt the pre-painted <picture> from index.html: the image the visitor already sees becomes the hero image.
  useLayoutEffect(() => {
    const pic = document.getElementById('hero-picture');
    if (pic && slot.current) slot.current.appendChild(pic);
    else setOwn(true);
    document.getElementById('prepaint')?.remove();
  }, []);

  // Keep a soft, breathing light on Noor's orb (the desktop art only; mobile uses a different crop).
  useLayoutEffect(() => {
    const el = box.current;
    const cfg = HERO_ORB;
    if (!el || !cfg) return;
    const place = () => {
      const img = el.querySelector('img');
      if (!img || window.innerWidth < 768) return setOrb(null);
      // object-position comes from CSS (it changes with the viewport's shape)
      const [px, py] = getComputedStyle(img).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
      const p = coverPoint(el.getBoundingClientRect(), cfg.image, { x: px, y: py }, cfg.point);
      setOrb({ left: p.left, top: p.top, size: cfg.radius * 2 * p.scale });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [own]);

  return (
    <div ref={box} className="hero-drift absolute inset-0">
      <div ref={slot} className="absolute inset-0" />
      {own && (
        <picture>
          <source media="(max-width: 767px)" srcSet={HERO_TALL.srcSet} sizes="100vw" />
          <img
            src={HERO_WIDE.src}
            srcSet={HERO_WIDE.srcSet}
            sizes="(min-aspect-ratio: 11/6) 100vw, 184vh"
            alt={HERO_ALT}
            fetchPriority="high"
            className="hero-img absolute inset-0 h-full w-full object-cover"
          />
        </picture>
      )}
      {orb && (
        <span
          aria-hidden
          className="orb-glow pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-screen"
          style={{
            left: orb.left,
            top: orb.top,
            width: orb.size * 3.2,
            height: orb.size * 3.2,
            background: 'radial-gradient(closest-side, rgb(120 180 255 / 0.55), rgb(57 135 229 / 0.22) 45%, transparent)',
          }}
        />
      )}
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate flex min-h-[640px] flex-col overflow-hidden md:h-[100svh] md:max-h-[1100px] md:min-h-[680px]">
      {/* On phones the art box follows the viewport, not the copy, so Noor stays framed above the headline. */}
      <motion.div
        className="absolute inset-x-0 top-0 -z-10 h-[78svh] min-h-[520px] overflow-hidden md:inset-0 md:h-auto md:min-h-0"
        initial={{ scale: 1.04 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.6, ease: EASE }}
      >
        <HeroArt />
        <div
          aria-hidden
          className="absolute inset-0 md:hidden"
          style={{ backgroundImage: 'linear-gradient(#000 0%, rgb(0 0 0 / 0) 14%), linear-gradient(rgb(0 0 0 / 0) 42%, rgb(0 0 0 / 0.8) 72%, #000 96%)' }}
        />
      </motion.div>
      {/* Same three-layer falloff as the reference: top fade, bottom fade, diagonal shade behind the copy. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 hidden md:block"
        style={{
          backgroundImage:
            'linear-gradient(#000 2%, rgb(0 0 0 / 0) 21%), linear-gradient(rgb(0 0 0 / 0) 64%, #000 98%), linear-gradient(225deg, rgb(0 0 0 / 0) 33%, rgb(0 0 0 / 0.8) 65%, #000 82%)',
        }}
      />

      <div className="shell flex flex-1 flex-col justify-end pt-[50svh] pb-14 md:pt-[72px] md:pb-[clamp(56px,11vh,120px)]">
        <h1 id="hero-title" className="t-display max-w-[660px]">
          <motion.span className="block" {...rise(0.25)}>
            You're the founder.
          </motion.span>
          <motion.span className="block" {...rise(0.38)}>
            Your AI team handles the&nbsp;work.
          </motion.span>
        </h1>
        <motion.p className="t-lead mt-6 max-w-[600px] !text-white/70" {...rise(0.55)}>
          Meet your AI-powered company. Tell Noor, your chief of staff, what you're working toward — she plans it, puts specialist agents to
          work, has every result checked, and brings you only the decisions that need you.
        </motion.p>
        <motion.div className="mt-9 flex flex-wrap items-center gap-3" {...rise(0.7)}>
          <a href="#get-started" className="btn btn-primary group">
            Get Opervio
            <ArrowRight aria-hidden size={18} className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </a>
          <a href="#how-it-works" className="btn btn-ghost">
            See how it works
          </a>
        </motion.div>
        <motion.p className="mt-6 text-[14px] text-white/55" {...rise(0.82)}>
          Runs on your own computer · Works with your Claude Code or Codex sign-in
        </motion.p>
      </div>
    </section>
  );
}
