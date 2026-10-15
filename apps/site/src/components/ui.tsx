import { useReducedMotion, useScroll, useTransform } from 'motion/react';
import * as motion from 'motion/react-m';
import { useRef, type CSSProperties, type ImgHTMLAttributes, type ReactNode } from 'react';
import { responsive } from '../lib/img';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fade-and-rise as the element scrolls into view (transform is dropped under reduced motion). */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Drifts its content upward a little as it scrolls through the viewport. */
export function Parallax({ children, distance = 48, className }: { children: ReactNode; distance?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance / 2]);
  const still = useReducedMotion();
  return (
    <motion.div ref={ref} style={still ? undefined : { y }} className={className}>
      {children}
    </motion.div>
  );
}

export function SectionHeading({
  title,
  lead,
  id,
  className = '',
}: {
  title: ReactNode;
  lead?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <Reveal className={`mx-auto max-w-[768px] text-center ${className}`}>
      <h2 id={id} className="t-h2">
        {title}
      </h2>
      {lead && <p className="t-lead mx-auto mt-4 max-w-[640px]">{lead}</p>}
    </Reveal>
  );
}

/** Noor's light — the Opervio mark: a blue orb with a white core. */
export function NoorMark({ size = 22, live = false, className = '' }: { size?: number; live?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`relative inline-grid shrink-0 place-items-center rounded-full ${live ? 'orb-live' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        background:
          'radial-gradient(circle at 35% 30%, color-mix(in oklch, #3987e5 55%, white) 0%, #3987e5 55%, color-mix(in oklch, #3987e5 70%, black) 100%)',
      }}
    >
      <span className="rounded-full bg-white/95" style={{ width: size * 0.32, height: size * 0.32 }} />
    </span>
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <NoorMark size={22} />
      <span className="text-[21px] font-medium tracking-[-0.04em]">Opervio</span>
    </span>
  );
}

type ArtProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & {
  base: string;
  alt: string;
  sizes: string;
  /** Shown when the asset is missing (never in a finished build). */
  fallback?: string;
};

/** Responsive art image from src/assets/img; renders a soft gradient block if the file is missing. */
export function Art({ base, alt, sizes, fallback = '#1f2937', className = '', style, ...rest }: ArtProps) {
  const img = responsive(base);
  if (!img) {
    return (
      <span
        role="img"
        aria-label={alt}
        className={`block ${className}`}
        style={{ background: `radial-gradient(120% 80% at 50% 30%, ${fallback}, #0a0a0a)`, ...style }}
      />
    );
  }
  return <img src={img.src} srcSet={img.srcSet} sizes={sizes} alt={alt} className={className} style={style} decoding="async" {...rest} />;
}
