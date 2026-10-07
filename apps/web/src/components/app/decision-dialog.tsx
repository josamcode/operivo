import { t } from '@/lib/i18n';
import type { DecisionDTO } from '@opervio/contracts';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useDecision, useResolveDecision } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { PlanCard } from '../noor/plan-card';
import { AgentAvatar, AutoDir, Markdown, Meta } from './primitives';
import { useDrawers } from './ui-state';

/** Decision UI stays tiny: what to choose, the recommendation, why, options. Details on demand. */
export function DecisionBody({ d, onDone }: { d: DecisionDTO; onDone?: () => void }) {
  const resolve = useResolveDecision();
  const [note, setNote] = useState('');
  const [details, setDetails] = useState(false);
  const options = d.options.length ? d.options : [{ id: 'ok', label: t('OK') }];
  const pick = (choice: string) =>
    resolve.mutate(
      { id: d.id, choice, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(t('Sent'));
          onDone?.();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );

  return (
    <div className="space-y-4">
      {d.recommendation && (
        <div className="space-y-0.5">
          <p className="text-[11.5px] font-medium text-ink-3">{t('Recommendation')}</p>
          <AutoDir as="p" block text={d.recommendation} className="text-[13.5px]" />
        </div>
      )}
      {d.why && (
        <div className="space-y-0.5">
          <p className="text-[11.5px] font-medium text-ink-3">{t('Why')}</p>
          <AutoDir as="p" block text={d.why} className="text-[13px] text-ink-2" />
        </div>
      )}
      {d.details && (
        <div>
          <button type="button" onClick={() => setDetails(!details)} className="flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink-2">
            <ChevronRight className={cn('size-3.5 transition-transform rtl:-scale-x-100', details && 'rotate-90 rtl:-rotate-90')} /> {t('Details')}
          </button>
          {details && <Markdown className="mt-2 max-h-60 overflow-y-auto text-[12.5px] text-ink-2">{d.details}</Markdown>}
        </div>
      )}
      {d.status === 'open' ? (
        <>
          <Textarea dir="auto" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Add a note (optional)')} className="min-h-14 text-[13px]" />
          <div className="flex flex-wrap gap-2">
            {options.map((o, i) => (
              <Button key={o.id} size="sm" variant={i === 0 ? 'default' : 'outline'} disabled={resolve.isPending} onClick={() => pick(o.id)} title={o.description}>
                <bdi>{t(o.label)}</bdi>
              </Button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-[12.5px] text-ink-3">
          {t('Decided: {choice}', { choice: t(options.find((o) => o.id === d.choice)?.label ?? d.choice ?? '') })}
          {d.note && (
            <>
              {' — '}
              <bdi>{d.note}</bdi>
            </>
          )}
        </p>
      )}
    </div>
  );
}

export function DecisionDialog() {
  const { decisionId, close } = useDrawers();
  const { data: d } = useDecision(decisionId);
  return (
    <Dialog open={Boolean(decisionId)} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-[520px] sm:max-w-[520px]">
        {d && (
          <>
            <DialogHeader>
              <DialogTitle className="text-[15px] leading-snug">
                <AutoDir text={d.title} />
              </DialogTitle>
              {d.agent && (
                <DialogDescription className="flex items-center gap-1.5 text-[12.5px]">
                  <AgentAvatar name={d.agent.name} size={16} />
                  <Meta parts={[t('Asked by {name}', { name: d.agent.name }), d.focus?.name]} />
                </DialogDescription>
              )}
            </DialogHeader>
            {d.kind === 'plan' ? <PlanCard decisionId={d.id} /> : <DecisionBody d={d} onDone={close} />}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
