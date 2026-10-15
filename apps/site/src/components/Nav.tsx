import { AnimatePresence } from 'motion/react';
import * as motion from 'motion/react-m';
import { ChevronDown, Menu, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { NAV_LINKS, TEAM, type CharacterId } from '../content';
import { Art, Logo } from './ui';

function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [threshold]);
  return scrolled;
}

export function Avatar({ id, size = 36, className = '' }: { id: CharacterId; size?: number; className?: string }) {
  return (
    <Art
      base={`card-${id}`}
      alt=""
      sizes={`${size * 2}px`}
      className={`shrink-0 rounded-full object-cover object-[50%_16%] ${className}`}
      style={{ width: size, height: size }}
      loading="lazy"
    />
  );
}

function TeamMenu({ onPick }: { onPick: (id: CharacterId) => void }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  // A click right after hover-opening should keep the menu open, not toggle it shut.
  const openedByHover = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const hoverOpen = () => {
    window.clearTimeout(closeTimer.current);
    if (!open) openedByHover.current = true;
    setOpen(true);
  };
  const hoverClose = () => {
    closeTimer.current = window.setTimeout(() => {
      openedByHover.current = false;
      setOpen(false);
    }, 140);
  };
  const toggle = () => {
    if (openedByHover.current) {
      openedByHover.current = false;
      setOpen(true);
      return;
    }
    setOpen((o) => !o);
  };

  return (
    <div ref={wrap} className="relative" onPointerEnter={(e) => e.pointerType === 'mouse' && hoverOpen()} onPointerLeave={(e) => e.pointerType === 'mouse' && hoverClose()}>
      <button
        type="button"
        className="flex items-center gap-1 rounded-[9px] px-3.5 py-2 text-[16px] font-medium text-white transition-colors hover:bg-white/10"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggle}
      >
        AI team
        <ChevronDown aria-hidden size={14} className={`opacity-60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute top-full left-1/2 mt-2 w-[540px] -translate-x-1/2 origin-top rounded-2xl border border-white/10 bg-[#121212] p-5 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)]"
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-[11px] font-medium tracking-[0.14em] text-white/55 uppercase">Your AI team</span>
              <a href="#team" onClick={() => setOpen(false)} className="text-[13px] text-brand-ink hover:text-white">
                Meet everyone
              </a>
            </div>
            <ul className="grid grid-cols-2 gap-1">
              {TEAM.map((m) => (
                <li key={m.id}>
                  <a
                    href="#team"
                    onClick={() => {
                      setOpen(false);
                      onPick(m.id);
                    }}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.07] focus-visible:bg-white/[0.07]"
                  >
                    <Avatar id={m.id} size={34} />
                    <span className="min-w-0">
                      <span className="block text-[14px] leading-tight font-medium">{m.name}</span>
                      <span className="block truncate text-[12.5px] text-white/50">{m.role}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileMenu({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (id: CharacterId) => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    panel.current?.querySelector<HTMLElement>('a,button')?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panel}
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-x-0 top-[72px] bottom-0 z-40 overflow-y-auto bg-black px-5 pt-4 pb-10 lg:hidden"
        >
          <nav aria-label="Mobile" className="flex flex-col">
            {[{ href: '#team', label: 'AI team' }, ...NAV_LINKS].map((l, i) => (
              <motion.a
                key={l.href}
                href={l.href}
                onClick={onClose}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i, duration: 0.3 }}
                className="border-b border-white/10 py-4 text-[26px] font-medium tracking-[-0.03em]"
              >
                {l.label}
              </motion.a>
            ))}
          </nav>
          <div className="mt-6 grid grid-cols-4 gap-3">
            {TEAM.slice(0, 4).map((m) => (
              <a
                key={m.id}
                href="#team"
                onClick={() => {
                  onClose();
                  onPick(m.id);
                }}
                className="flex flex-col items-center gap-1.5 text-center text-[12px] text-white/60"
              >
                <Avatar id={m.id} size={52} />
                {m.name}
              </a>
            ))}
          </div>
          <a href="#get-started" onClick={onClose} className="btn btn-primary mt-8 w-full">
            Get Opervio
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Nav({ onPickMember }: { onPickMember: (id: CharacterId) => void }) {
  const scrolled = useScrolled();
  const [menu, setMenu] = useState(false);
  const solid = scrolled || menu;

  // The menu sits outside <header>: the header's backdrop-filter would otherwise become the
  // containing block for the fixed overlay and collapse it to the header's height.
  return (
    <>
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ${
        solid ? 'border-b border-white/[0.07] bg-black/80 backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-black"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 md:px-8 lg:px-12">
        <a href="#top" aria-label="Opervio home" className="rounded-lg">
          <Logo />
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
          <TeamMenu onPick={onPickMember} />
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-[9px] px-3.5 py-2 text-[16px] font-medium text-white transition-colors hover:bg-white/10">
              {l.label}
            </a>
          ))}
          <span aria-hidden className="mx-3 h-6 w-px bg-white/25" />
          <a href="#get-started" className="inline-flex h-[45px] items-center rounded-[11px] bg-[#f8fafc] px-5 text-[16px] font-medium text-[#0f172a] transition-colors hover:bg-white/85">
            Get Opervio
          </a>
        </nav>

        <button
          type="button"
          className="grid size-11 place-items-center rounded-xl border border-white/15 bg-white/[0.08] backdrop-blur-md lg:hidden"
          aria-label={menu ? 'Close menu' : 'Open menu'}
          aria-expanded={menu}
          aria-controls="mobile-menu"
          onClick={() => setMenu((m) => !m)}
        >
          {menu ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
        </button>
      </div>
    </header>
    <MobileMenu open={menu} onClose={() => setMenu(false)} onPick={onPickMember} />
    </>
  );
}
