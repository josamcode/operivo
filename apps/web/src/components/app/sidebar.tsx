import { t } from '@/lib/i18n';
import type { NavItemDTO } from '@opervio/contracts';
import { Link, useRouterState } from '@tanstack/react-router';
import { FolderOpen, House, Moon, Search, Settings, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { useBootstrap } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { pageIcon } from './page-icon';
import { LiveDot, NoorMark } from './primitives';
import { useUi } from './ui-state';

function NavLink({ to, params, icon: Icon, label, active, live }: { to: string; params?: Record<string, string>; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string; active: boolean; live?: boolean }) {
  return (
    <Link
      to={to}
      params={params as never}
      className={cn(
        'group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13.5px] transition-colors',
        active ? 'bg-surface font-medium text-foreground shadow-sm' : 'text-ink-2 hover:bg-surface/60 hover:text-foreground',
      )}
    >
      <Icon className={cn('size-4 shrink-0', active ? 'text-foreground' : 'text-ink-3 group-hover:text-ink-2')} strokeWidth={1.75} />
      <span dir="auto" className="truncate ui-align">{label}</span>
      {live && <LiveDot className="ms-auto" />}
    </Link>
  );
}

export function Sidebar({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const { data } = useBootstrap();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { setPaletteOpen } = useUi();
  const { dark, toggle } = useTheme();
  const nav: NavItemDTO[] = data?.nav ?? [];
  const anyLive = nav.some((n) => n.activeAgents > 0);

  return (
    <aside className={cn('flex h-full w-60 shrink-0 flex-col border-e border-border bg-sidebar', className)} onClick={(e) => (e.target as HTMLElement).closest('a') && onNavigate?.()}>
      <div className="flex h-12 items-center gap-2 px-4">
        <NoorMark size={18} live={anyLive} />
        <span className="text-[15px] font-semibold tracking-[-0.02em]">Opervio</span>
      </div>

      <div className="px-2.5 pb-2">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-surface px-2 text-[13px] text-ink-3 shadow-xs transition-colors hover:text-ink-2"
        >
          <Search className="size-3.5" strokeWidth={2} />
          {t('Search or ask Noor')}
          <kbd className="ms-auto rounded border border-border px-1 text-[10.5px] text-ink-3" dir="ltr">Ctrl K</kbd>
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-1">
        <NavLink to="/" icon={House} label={t('Home')} active={path === '/'} />
        {nav.length > 0 && <div className="mt-3 mb-1 px-2 text-[11.5px] font-medium text-ink-3">{t('Your areas')}</div>}
        {nav.map((n) => (
          <NavLink
            key={n.slug}
            to="/p/$slug"
            params={{ slug: n.slug }}
            icon={pageIcon(n.icon)}
            label={n.title}
            active={path === `/p/${n.slug}`}
            live={n.activeAgents > 0}
          />
        ))}
        <div className="mt-3" />
        <NavLink to="/outputs" icon={FolderOpen} label={t('Outputs')} active={path === '/outputs'} />
        <NavLink to="/settings" icon={Settings} label={t('Settings')} active={path === '/settings'} />
      </nav>

      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <span dir="auto" className="truncate text-[13px] text-ink-2 ui-align">{data?.founder?.name}</span>
        <button type="button" onClick={toggle} className="ms-auto grid size-7 place-items-center rounded-md text-ink-3 hover:bg-surface hover:text-foreground" aria-label={t('Toggle theme')}>
          {dark ? <Sun className="size-4" strokeWidth={1.75} /> : <Moon className="size-4" strokeWidth={1.75} />}
        </button>
      </div>
    </aside>
  );
}
