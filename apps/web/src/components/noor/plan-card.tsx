import type { DecisionDTO, PlanProposal } from '@opervio/contracts';
import { Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { isRtl } from '@/lib/format';
import { useDecision, useResolveDecision } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { pageIcon } from '../app/page-icon';
import { AgentAvatar, AutoDir, Chip } from '../app/primitives';

const KIND_LABEL: Record<string, string> = {
  main: 'Main focus',
  supporting: 'Supporting',
  continuous: 'Continuous',
  goal: 'Goal',
  idea: 'Idea',
  experiment: 'Experiment',
};

/** Noor's proposed structure. Nothing is created until the founder confirms. */
export function PlanCard({ decisionId }: { decisionId: string }) {
  const { data: d } = useDecision(decisionId);
  if (!d) return <div className="h-24 animate-pulse rounded-xl border border-border bg-surface-2" />;
  return <PlanCardBody d={d} />;
}

function PlanCardBody({ d }: { d: DecisionDTO }) {
  const plan = d.payload as PlanProposal;
  const resolve = useResolveDecision();
  const [adjusting, setAdjusting] = useState(false);
  const [note, setNote] = useState('');
  const open = d.status === 'open';
  const rtl = isRtl(plan.summary);

  return (
    <div className={cn('overflow-hidden rounded-xl border bg-surface shadow-sm', open ? 'border-border-strong' : 'border-border opacity-90')}>
      <div className="space-y-3 px-4 pt-3.5 pb-3" dir={rtl ? 'rtl' : undefined}>
        <div className="space-y-2">
          {plan.focuses.map((f) => {
            const Icon = pageIcon(f.page?.icon);
            return (
              <div key={f.key} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-muted">
                  <Icon className="size-3.5 text-ink-2" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <AutoDir text={f.name} className="text-[13.5px] font-medium" />
                    <Chip tone={f.kind === 'main' ? 'info' : 'neutral'}>{KIND_LABEL[f.kind] ?? f.kind}</Chip>
                  </div>
                  <AutoDir as="p" text={f.why} className="mt-0.5 text-[12.5px] leading-snug text-ink-2" />
                </div>
              </div>
            );
          })}
        </div>

        {plan.agents && plan.agents.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-[12px] font-medium text-ink-3">Starts working on</p>
            <div className="space-y-1.5">
              {plan.agents.map((a) => (
                <div key={a.name} className="flex items-start gap-2.5 text-[12.5px]">
                  <AgentAvatar name={a.name} size={22} className="mt-0.5" />
                  <div className="min-w-0">
                    <p>
                      <span className="font-medium">{a.name}</span> <span className="text-ink-3">{a.role}</span>
                    </p>
                    <AutoDir as="p" text={a.task.title} className="text-ink-2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {plan.today && plan.today.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="mb-1.5 text-[12px] font-medium text-ink-3">Your part today</p>
            <ul className="space-y-1">
              {plan.today.map((t) => (
                <li key={t.title} className="flex items-center gap-2 text-[12.5px]">
                  <span className="size-3.5 shrink-0 rounded-[4px] border border-border-strong" />
                  <AutoDir text={t.title} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border bg-surface-2 px-4 py-2.5">
        {open ? (
          adjusting ? (
            <div className="flex w-full flex-col gap-2">
              <Textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should change?" className="min-h-16 bg-surface text-[13px]" dir="auto" />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setAdjusting(false)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={!note.trim() || resolve.isPending} onClick={() => resolve.mutate({ id: d.id, choice: 'adjust', note })}>
                  Send to Noor
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button size="sm" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: d.id, choice: 'confirm' })}>
                {resolve.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                Confirm and start
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdjusting(true)}>
                Adjust
              </Button>
            </>
          )
        ) : (
          <span className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
            {d.choice === 'confirm' ? (
              <>
                <Check className="size-3.5 text-positive" /> Confirmed
              </>
            ) : d.status === 'dismissed' ? (
              'Replaced by a newer plan'
            ) : (
              'Sent back for changes'
            )}
          </span>
        )}
      </div>
    </div>
  );
}
