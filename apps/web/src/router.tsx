import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import type { DrawerSearch } from './components/app/ui-state';
import { AppShell } from './components/app/app-shell';
import { NoorMark } from './components/app/primitives';
import { applyLanguage, lang } from './lib/i18n';
import { useBootstrap } from './lib/queries';
import { DynamicPage } from './pages/dynamic-page';
import { HomePage } from './pages/home';
import { OutputsPage } from './pages/outputs';
import { SettingsPage } from './pages/settings';
import { SetupPage } from './pages/setup';

function Root() {
  const { data, isLoading, error } = useBootstrap();
  if (isLoading) {
    return (
      <div className="grid h-dvh place-items-center bg-canvas">
        <NoorMark size={28} live />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="grid h-dvh place-items-center bg-canvas p-6 text-center">
        <div className="space-y-2">
          <p className="text-[15px] font-medium">Opervio’s server isn’t reachable.</p>
          <p className="text-[13px] text-ink-3">Start it with “pnpm dev” (or “pnpm start”) and reload this page.</p>
        </div>
      </div>
    );
  }
  // The interface follows the founder's language: Arabic → full right-to-left Egyptian Arabic UI.
  applyLanguage(data.founder?.language === 'ar' ? 'ar' : 'en');
  if (!data.setupComplete) return <SetupPage />;
  return (
    <AppShell key={lang()}>
      <Outlet />
    </AppShell>
  );
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

const rootRoute = createRootRoute({
  component: Root,
  validateSearch: (s: Record<string, unknown>): DrawerSearch & { tab?: string } => ({
    agent: str(s.agent),
    output: str(s.output),
    decision: str(s.decision),
    tab: str(s.tab),
  }),
});

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/p/$slug', component: DynamicPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/outputs', component: OutputsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsPage }),
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
