import { useParams } from '@tanstack/react-router';
import { PencilLine } from 'lucide-react';
import { TopBar } from '@/components/app/app-shell';
import { pageIcon } from '@/components/app/page-icon';
import { AutoDir, Chip } from '@/components/app/primitives';
import { useUi } from '@/components/app/ui-state';
import { PageRenderer } from '@/components/registry/page-renderer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePage } from '@/lib/queries';

const KIND: Record<string, string> = { main: 'Priority', supporting: 'Supporting', continuous: 'Continuous', goal: 'Goal', idea: 'Idea', experiment: 'Experiment' };

export function DynamicPage() {
  const { slug } = useParams({ from: '/p/$slug' });
  const { data: page, isLoading, error } = usePage(slug);
  const { askNoor } = useUi();
  const Icon = pageIcon(page?.icon);

  return (
    <>
      <TopBar title={page ? <AutoDir text={page.title} /> : ''}>
        {page && (
          <Button size="sm" variant="ghost" onClick={() => askNoor(`On the ${page.title} page, `)}>
            <PencilLine /> Change this page
          </Button>
        )}
      </TopBar>
      <div className="mx-auto w-full max-w-[1320px] px-4 py-8 lg:px-8">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error || !page ? (
          <p className="text-[13.5px] text-ink-3">This page doesn’t exist anymore.</p>
        ) : (
          <div className="space-y-6">
            <header className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl border border-border bg-surface shadow-xs">
                  <Icon className="size-[18px] text-ink-2" strokeWidth={1.75} />
                </span>
                <AutoDir as="h1" text={page.title} className="text-[26px] leading-tight font-semibold tracking-[-0.025em]" />
                {page.focus && <Chip tone={page.focus.kind === 'main' ? 'info' : 'neutral'}>{KIND[page.focus.kind] ?? page.focus.kind}</Chip>}
              </div>
              {page.description && <AutoDir as="p" text={page.description} className="max-w-[72ch] text-[14px] text-ink-2" />}
            </header>
            <PageRenderer page={page} />
          </div>
        )}
      </div>
    </>
  );
}
