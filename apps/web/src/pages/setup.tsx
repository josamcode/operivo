import { ALWAYS_ASK_OPTIONS, SetupInput, type Language } from '@opervio/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { NoorMark } from '@/components/app/primitives';
import { useUi } from '@/components/app/ui-state';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Draft = Omit<SetupInput, 'links'> & { links: { github: string; website: string; social: string } };

const COPY = {
  en: {
    name: 'Hi, I’m Noor. I’ll run things with you. What should I call you?',
    work: 'What do you do?',
    workHint: 'One or two lines is plenty.',
    plate: 'What’s on your plate right now?',
    plateHint: 'Work, money, clients, content, learning, health — say it the way you’d say it to a friend. I’ll organize it.',
    platePh: 'I build software, I want more clients, I’m making content, I want to learn AI properly and get back to the gym…',
    time: 'Realistically, how much time can you give each day?',
    links: 'Anything public I can learn from?',
    linksHint: 'Optional. Your GitHub, website or a social profile.',
    style: 'How should I talk to you?',
    autonomy: 'And how much should the team run on its own?',
    approvals: 'What should I always check with you first?',
    approvalsHint: 'Everything else — research, drafts, files, analysis — just gets done.',
    next: 'Continue',
    back: 'Back',
    skip: 'Skip',
    finish: 'Meet Noor',
    short: 'Short and direct',
    natural: 'Natural',
    detailed: 'More detail',
    ask_more: 'Check with me more',
    balanced: 'Balanced',
    autonomous: 'Run with it',
    times: ['1–2 hours', '3–4 hours', '5–6 hours', 'Full-time'],
    other: 'Something else…',
  },
  ar: {
    name: 'أهلاً، أنا نور. هنمشي الدنيا مع بعض. أناديك بإيه؟',
    work: 'بتشتغل في إيه؟',
    workHint: 'سطر أو اتنين كفاية.',
    plate: 'إيه اللي على دماغك دلوقتي؟',
    plateHint: 'شغل، فلوس، عملاء، محتوى، تعلم، صحة — قولها زي ما بتحكي لصاحبك، وأنا هرتبها.',
    platePh: 'أنا جرجس. عندي شغل برمجة، عايز أجيب عملاء، أعمل محتوى، أجهز كورسات، أتعلم، أرجع الجيم، وأنظم حياتي بدل ما أفضل مشتت.',
    time: 'بصراحة، تقدر تدي كام ساعة في اليوم؟',
    links: 'في حاجة عامة أقدر أتعلم منها عنك؟',
    linksHint: 'اختياري. GitHub أو موقعك أو بروفايل سوشيال.',
    style: 'تحب أكلمك إزاي؟',
    autonomy: 'والفريق يشتغل لوحده قد إيه؟',
    approvals: 'إيه الحاجات اللي لازم أرجعلك فيها قبل ما نعملها؟',
    approvalsHint: 'أي حاجة تانية — بحث، مسودات، ملفات، تحليل — بتتعمل على طول.',
    next: 'كمّل',
    back: 'رجوع',
    skip: 'تخطي',
    finish: 'يلا نبدأ',
    short: 'قصير ومباشر',
    natural: 'طبيعي',
    detailed: 'بتفاصيل أكتر',
    ask_more: 'ارجعلي أكتر',
    balanced: 'متوازن',
    autonomous: 'اشتغلوا براحتكم',
    times: ['ساعة لساعتين', '٣–٤ ساعات', '٥–٦ ساعات', 'متفرغ'],
    other: 'حاجة تانية…',
  },
};

const ASK_AR: Record<string, string> = {
  spend_money: 'صرف فلوس',
  send_messages: 'إرسال رسايل باسمي',
  publish: 'نشر أي حاجة للعامة',
  delete: 'مسح ملفات أو بيانات',
  production: 'تعديلات على production',
  commitments: 'أي التزام مع عملاء أو شركاء',
};

const STEPS = ['language', 'name', 'work', 'plate', 'time', 'links', 'style', 'approvals'] as const;
type Step = (typeof STEPS)[number];

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-10 rounded-xl border px-4 text-[14px] transition-colors',
        selected ? 'border-foreground bg-foreground text-background' : 'border-border-strong bg-surface hover:border-ink-3',
      )}
    >
      {children}
    </button>
  );
}

export function SetupPage() {
  const qc = useQueryClient();
  const { setNoorOpen } = useUi();
  const [i, setI] = useState(0);
  const [customTime, setCustomTime] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [d, setD] = useState<Draft>({
    language: 'en',
    name: '',
    work: '',
    plate: '',
    timeAvailable: '',
    links: { github: '', website: '', social: '' },
    commStyle: 'short',
    autonomy: 'balanced',
    alwaysAsk: ALWAYS_ASK_OPTIONS.map((o) => o.id),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const step: Step = STEPS[i];
  const t = COPY[d.language];
  const rtl = d.language === 'ar';
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, [i, customTime]);

  const valid: Record<Step, boolean> = {
    language: true,
    name: d.name.trim().length > 0,
    work: d.work.trim().length >= 2,
    plate: d.plate.trim().length >= 5,
    time: d.timeAvailable.trim().length > 0,
    links: true,
    style: true,
    approvals: true,
  };

  const next = async () => {
    if (!valid[step]) return;
    if (i < STEPS.length - 1) return setI(i + 1);
    const parsed = SetupInput.safeParse(d);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Check your answers');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/setup', parsed.data);
      setNoorOpen(true);
      await qc.invalidateQueries({ queryKey: ['bootstrap'] });
      if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
    } catch (err) {
      toast.error((err as Error).message);
      setSubmitting(false);
    }
  };

  const enter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void next();
    }
  };

  const question: Record<Step, { q: string; hint?: string }> = {
    language: { q: 'Which language should we talk in? · نتكلم بأنهي لغة؟' },
    name: { q: t.name },
    work: { q: t.work, hint: t.workHint },
    plate: { q: t.plate, hint: t.plateHint },
    time: { q: t.time },
    links: { q: t.links, hint: t.linksHint },
    style: { q: t.style },
    approvals: { q: t.approvals, hint: t.approvalsHint },
  };

  const field = 'w-full rounded-xl border border-border-strong bg-surface px-4 text-[15px] shadow-xs outline-none placeholder:text-ink-3 focus:border-brand/50 focus:ring-4 focus:ring-ring/20';

  return (
    <div className="flex min-h-dvh flex-col bg-canvas" dir={rtl ? 'rtl' : 'ltr'}>
      <div className="h-0.5 bg-border">
        <div className="h-full bg-brand transition-[width] duration-500" style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} />
      </div>
      <header className="flex items-center gap-2 px-6 py-5" dir="ltr">
        <NoorMark size={18} />
        <span className="text-[15px] font-semibold tracking-[-0.02em]">Opervio</span>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 pt-[9vh] pb-16">
        <div className="w-full max-w-[600px]">
          {/* CSS entrance only: content is never gated on an animation finishing. */}
          <div key={step} className="animate-in fade-in slide-in-from-bottom-1 space-y-6 duration-300 motion-reduce:animate-none">
              <div className="flex gap-3.5">
                <NoorMark size={28} live={submitting} className="mt-0.5" />
                <div className="space-y-1.5">
                  <h1 className="text-[22px] leading-snug font-semibold tracking-[-0.02em]">{question[step].q}</h1>
                  {question[step].hint && <p className="text-[14px] text-ink-2">{question[step].hint}</p>}
                </div>
              </div>

              <div className="space-y-4 ps-[42px]">
                {step === 'language' && (
                  <div className="flex gap-2">
                    {(['en', 'ar'] as Language[]).map((l) => (
                      <Choice key={l} selected={d.language === l} onClick={() => setD({ ...d, language: l })}>
                        {l === 'en' ? 'English' : 'العربية'}
                      </Choice>
                    ))}
                  </div>
                )}
                {step === 'name' && <input ref={inputRef} dir="auto" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} onKeyDown={enter} className={cn(field, 'h-12')} />}
                {step === 'work' && (
                  <textarea ref={inputRef} dir="auto" rows={2} value={d.work} onChange={(e) => setD({ ...d, work: e.target.value })} onKeyDown={enter} className={cn(field, 'resize-none py-3')} />
                )}
                {step === 'plate' && (
                  <textarea
                    ref={inputRef}
                    dir="auto"
                    rows={6}
                    value={d.plate}
                    placeholder={t.platePh}
                    onChange={(e) => setD({ ...d, plate: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && void next()}
                    className={cn(field, 'resize-none py-3 leading-relaxed')}
                  />
                )}
                {step === 'time' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {t.times.map((tm) => (
                        <Choice
                          key={tm}
                          selected={!customTime && d.timeAvailable === tm}
                          onClick={() => {
                            setCustomTime(false);
                            setD({ ...d, timeAvailable: tm });
                          }}
                        >
                          {tm}
                        </Choice>
                      ))}
                      <Choice selected={customTime} onClick={() => setCustomTime(true)}>
                        {t.other}
                      </Choice>
                    </div>
                    {customTime && <input ref={inputRef} dir="auto" autoFocus value={d.timeAvailable} onChange={(e) => setD({ ...d, timeAvailable: e.target.value })} onKeyDown={enter} className={cn(field, 'h-11')} />}
                  </div>
                )}
                {step === 'links' && (
                  <div className="grid gap-2" dir="ltr">
                    {(['github', 'website', 'social'] as const).map((k, idx) => (
                      <input
                        key={k}
                        ref={idx === 0 ? inputRef : undefined}
                        value={d.links[k]}
                        placeholder={k === 'github' ? 'github.com/you' : k === 'website' ? 'yoursite.com' : 'linkedin.com/in/you'}
                        onChange={(e) => setD({ ...d, links: { ...d.links, [k]: e.target.value } })}
                        onKeyDown={enter}
                        className={cn(field, 'h-11 text-[14px]')}
                      />
                    ))}
                  </div>
                )}
                {step === 'style' && (
                  <div className="space-y-5">
                    <div className="flex flex-wrap gap-2">
                      {(['short', 'natural', 'detailed'] as const).map((s) => (
                        <Choice key={s} selected={d.commStyle === s} onClick={() => setD({ ...d, commStyle: s })}>
                          {t[s]}
                        </Choice>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <p className="text-[15px] font-medium">{t.autonomy}</p>
                      <div className="flex flex-wrap gap-2">
                        {(['ask_more', 'balanced', 'autonomous'] as const).map((s) => (
                          <Choice key={s} selected={d.autonomy === s} onClick={() => setD({ ...d, autonomy: s })}>
                            {t[s]}
                          </Choice>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {step === 'approvals' && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ALWAYS_ASK_OPTIONS.map((o) => {
                      const on = d.alwaysAsk.includes(o.id);
                      return (
                        <label key={o.id} className={cn('flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[14px] transition-colors', on ? 'border-ink-3 bg-surface' : 'border-border bg-surface-2 text-ink-2')}>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) => setD({ ...d, alwaysAsk: e.target.checked ? [...d.alwaysAsk, o.id] : d.alwaysAsk.filter((a) => a !== o.id) })}
                            className="size-4 accent-[var(--brand)]"
                          />
                          {rtl ? ASK_AR[o.id] : o.label}
                        </label>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  {i > 0 && (
                    <Button variant="ghost" onClick={() => setI(i - 1)} disabled={submitting}>
                      {rtl ? <ArrowRight /> : <ArrowLeft />} {t.back}
                    </Button>
                  )}
                  <Button className="ms-auto h-10 rounded-xl px-5 text-[14px]" disabled={!valid[step] || submitting} onClick={() => void next()}>
                    {submitting && <Loader2 className="animate-spin" />}
                    {i === STEPS.length - 1 ? t.finish : step === 'links' && !d.links.github && !d.links.website && !d.links.social ? t.skip : t.next}
                    {!submitting && (rtl ? <ArrowLeft /> : <ArrowRight />)}
                  </Button>
                </div>
              </div>
          </div>
        </div>
      </main>
    </div>
  );
}
