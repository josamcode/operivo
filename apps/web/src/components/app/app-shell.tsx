import { useNavigate } from '@tanstack/react-router';
import { Bell, Menu } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useMediaQuery } from '@/hooks/use-media-query';
import { endSide, startSide, t, trActivity } from '@/lib/i18n';
import { api } from '@/lib/api';
import { ago } from '@/lib/format';
import { onNotification } from '@/lib/live';
import { useBootstrap, useMessages, useNotifications } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { AgentDrawer } from '../agents/agent-drawer';
import { DockedNoorPanel, NoorPanel } from '../noor/noor-panel';
import { OutputDrawer } from '../outputs/output-drawer';
import { CommandPalette } from './command-palette';
import { DecisionDialog } from './decision-dialog';
import { AutoDir, NoorMark } from './primitives';
import { Sidebar } from './sidebar';
import { DOCKED_NOOR, useUi } from './ui-state';

function Notifications() {
  const { data: boot } = useBootstrap();
  const { data = [], refetch } = useNotifications();
  const navigate = useNavigate();
  const unread = boot?.unreadNotifications ?? 0;
  useEffect(() => onNotification(() => void refetch()), [refetch]);
  return (
    <Popover onOpenChange={(o) => o && unread && void api.post('/api/notifications/read')}>
      <PopoverTrigger className="relative grid size-8 place-items-center rounded-md text-ink-2 hover:bg-muted hover:text-foreground" aria-label={t('Notifications')}>
        <Bell className="size-4" strokeWidth={1.75} />
        {unread > 0 && <span className="absolute end-1.5 top-1.5 size-1.5 rounded-full bg-brand" />}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="border-b border-border px-3.5 py-2.5 text-[13px] font-medium">{t('Notifications')}</div>
        <div className="max-h-[420px] overflow-y-auto">
          {data.length === 0 && <p className="px-3.5 py-6 text-[12.5px] text-ink-3">{t('Nothing yet. You’ll hear about decisions, finished work and anything that needs you.')}</p>}
          {data.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => n.link && void navigate({ to: '.', search: Object.fromEntries(new URLSearchParams(n.link.replace(/^.*\?/, ''))) as never })}
              className="flex w-full flex-col gap-0.5 border-b border-border px-3.5 py-2.5 text-start last:border-0 hover:bg-muted/60"
            >
              <span className="flex items-center gap-2">
                {!n.readAt && <span className="size-1.5 shrink-0 rounded-full bg-brand" />}
                <AutoDir text={trActivity(n.title)} className="truncate text-[13px] font-medium" />
                <span className="ms-auto shrink-0 text-[11px] text-ink-3">{ago(n.createdAt)}</span>
              </span>
              {n.body && <AutoDir as="p" text={n.body} className="line-clamp-2 text-[12px] text-ink-2" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TopBar({ title, children }: { title?: ReactNode; children?: ReactNode }) {
  const { noorOpen, toggleNoor } = useUi();
  const { data: messages = [] } = useMessages();
  const live = messages.some((m) => m.status === 'streaming');
  const [menu, setMenu] = useState(false);
  return (
    <div className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-canvas/85 px-4 backdrop-blur-md lg:px-6">
      <button type="button" className="grid size-8 place-items-center rounded-md text-ink-2 hover:bg-muted lg:hidden" onClick={() => setMenu(true)} aria-label={t('Menu')}>
        <Menu className="size-4" />
      </button>
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side={startSide()} className="w-60 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">{t('Navigation')}</SheetTitle>
          <Sidebar className="w-full border-0" onNavigate={() => setMenu(false)} />
        </SheetContent>
      </Sheet>
      <div dir="auto" className="ui-align min-w-0 truncate text-[13.5px] font-medium">
        {title}
      </div>
      <div className="ms-auto flex shrink-0 items-center gap-1">
        {children}
        <Notifications />
        {!noorOpen && (
          <button
            type="button"
            onClick={toggleNoor}
            className="ms-1 flex h-8 items-center gap-2 rounded-full border border-border bg-surface ps-1.5 pe-3 text-[13px] font-medium whitespace-nowrap shadow-xs transition-colors hover:border-border-strong"
          >
            <NoorMark size={20} live={live} />
            {t('Ask Noor')}
            <kbd className="hidden text-[10.5px] font-normal text-ink-3 sm:inline" dir="ltr">
              Ctrl J
            </kbd>
          </button>
        )}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { noorOpen, setNoorOpen } = useUi();
  const wide = useMediaQuery(DOCKED_NOOR);

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <Sidebar className="hidden lg:flex" />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</main>
      {wide ? (
        noorOpen && <DockedNoorPanel />
      ) : (
        <Sheet open={noorOpen} onOpenChange={setNoorOpen}>
          <SheetContent
            side={endSide()}
            resizable={{ id: 'noor-sheet', defaultWidth: 420, minWidth: 340 }}
            className="w-full p-0 sm:max-w-[420px]"
            showCloseButton={false}
            // Opening Noor means "I want to say something": land in the composer (touch keeps the keyboard closed).
            initialFocus={(type) => (type === 'touch' ? true : document.getElementById('noor-input'))}
          >
            <SheetTitle className="sr-only">{t('Noor')}</SheetTitle>
            <NoorPanel className={cn('w-full border-0')} />
          </SheetContent>
        </Sheet>
      )}
      <CommandPalette />
      <AgentDrawer />
      <OutputDrawer />
      <DecisionDialog />
    </div>
  );
}
