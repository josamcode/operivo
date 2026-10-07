import { zodResolver } from '@hookform/resolvers/zod';
import { ALWAYS_ASK_OPTIONS, Autonomy, CommStyle, EFFORT_LABEL, Language, type AiSettings, type RoleDefaults, type SettingsDTO, type ToolSettings } from '@opervio/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Check, Loader2, RefreshCw, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { TopBar } from '@/components/app/app-shell';
import { AutoDir, Chip } from '@/components/app/primitives';
import { SimpleSelect } from '@/components/app/simple-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { ago } from '@/lib/format';
import { useMemories, useSettings } from '@/lib/queries';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'ai', label: 'AI' },
  { id: 'tools', label: 'Tools' },
  { id: 'routines', label: 'Routines' },
  { id: 'memory', label: 'Memory' },
] as const;
type Tab = (typeof TABS)[number]['id'];

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-border py-4 last:border-0 md:grid-cols-[240px_1fr] md:gap-6">
      <div>
        <p className="text-[13px] font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-[12px] text-ink-3">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const ProfileForm = z.object({
  name: z.string().trim().min(1).max(60),
  language: Language,
  work: z.string().max(1000),
  timeAvailable: z.string().max(200),
  commStyle: CommStyle,
  autonomy: Autonomy,
  alwaysAsk: z.array(z.string()),
  timezone: z.string().max(60),
  links: z.object({ github: z.string().optional(), website: z.string().optional(), social: z.string().optional() }),
});
type ProfileForm = z.infer<typeof ProfileForm>;

function Profile({ s }: { s: SettingsDTO }) {
  const qc = useQueryClient();
  const { pref, setPref } = useTheme();
  const form = useForm<ProfileForm>({ resolver: zodResolver(ProfileForm), defaultValues: { ...s.founder } });
  const save = form.handleSubmit(async (v) => {
    await api.put('/api/settings/founder', v);
    await qc.invalidateQueries({ queryKey: ['settings'] });
    await qc.invalidateQueries({ queryKey: ['bootstrap'] });
    toast.success('Profile saved');
    form.reset(v);
  });
  const ask = form.watch('alwaysAsk');
  return (
    <form onSubmit={save}>
      <Row label="Name">
        <Input {...form.register('name')} className="max-w-sm" />
      </Row>
      <Row label="Language" hint="Noor talks to you in this language.">
        <SimpleSelect
          value={form.watch('language')}
          onChange={(v) => form.setValue('language', v as 'ar' | 'en', { shouldDirty: true })}
          options={[
            { value: 'en', label: 'English' },
            { value: 'ar', label: 'العربية (مصري)' },
          ]}
        />
      </Row>
      <Row label="What you do">
        <Textarea dir="auto" {...form.register('work')} className="max-w-xl" />
      </Row>
      <Row label="Realistic time" hint="What you can actually give per day or week.">
        <Input dir="auto" {...form.register('timeAvailable')} className="max-w-sm" />
      </Row>
      <Row label="How Noor talks">
        <SimpleSelect
          value={form.watch('commStyle')}
          onChange={(v) => form.setValue('commStyle', v as ProfileForm['commStyle'], { shouldDirty: true })}
          options={[
            { value: 'short', label: 'Short' },
            { value: 'natural', label: 'Natural' },
            { value: 'detailed', label: 'Detailed' },
          ]}
        />
      </Row>
      <Row label="Autonomy" hint="How much the team runs on its own.">
        <SimpleSelect
          value={form.watch('autonomy')}
          onChange={(v) => form.setValue('autonomy', v as ProfileForm['autonomy'], { shouldDirty: true })}
          options={[
            { value: 'ask_more', label: 'Check with me more' },
            { value: 'balanced', label: 'Balanced' },
            { value: 'autonomous', label: 'Run with it' },
          ]}
        />
      </Row>
      <Row label="Always ask me before" hint="Everything else is normal work and never needs approval.">
        <div className="grid gap-2 sm:grid-cols-2">
          {ALWAYS_ASK_OPTIONS.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                className="size-4 accent-[var(--brand)]"
                checked={ask.includes(o.id)}
                onChange={(e) => form.setValue('alwaysAsk', e.target.checked ? [...ask, o.id] : ask.filter((a) => a !== o.id), { shouldDirty: true })}
              />
              {o.label}
            </label>
          ))}
        </div>
      </Row>
      <Row label="Links" hint="Public profiles your team can learn from.">
        <div className="grid max-w-xl gap-2">
          <Input placeholder="GitHub" {...form.register('links.github')} />
          <Input placeholder="Website" {...form.register('links.website')} />
          <Input placeholder="Social profile" {...form.register('links.social')} />
        </div>
      </Row>
      <Row label="Timezone">
        <Input {...form.register('timezone')} className="max-w-sm" />
      </Row>
      <Row label="Appearance">
        <SimpleSelect
          value={pref}
          onChange={(v) => setPref(v as 'light' | 'dark' | 'system')}
          options={[
            { value: 'system', label: 'Match system' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Row>
      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={!form.formState.isDirty || form.formState.isSubmitting}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

const ROLES: { id: keyof Omit<AiSettings, 'maxConcurrentAgents' | 'maxCorrections'>; label: string; hint: string }[] = [
  { id: 'noor', label: 'Noor', hint: 'Your main AI — conversation and planning.' },
  { id: 'specialist', label: 'Specialists', hint: 'Research, writing, content, analysis.' },
  { id: 'coding', label: 'Coding', hint: 'Software work in your projects.' },
  { id: 'engineer', label: 'Prompt Engineer', hint: 'Sharpens each task prompt. Fast and cheap.' },
  { id: 'judge', label: 'Result Judge', hint: 'Checks outcomes before anything is called done.' },
];

function Ai({ s }: { s: SettingsDTO }) {
  const qc = useQueryClient();
  const [ai, setAi] = useState(s.ai);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => setAi(s.ai), [s.ai]);
  const save = async (next: AiSettings) => {
    setAi(next);
    try {
      await api.put('/api/settings/ai', next);
      await qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Saved');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };
  const setRole = (role: (typeof ROLES)[number]['id'], patch: Partial<RoleDefaults>) => void save({ ...ai, [role]: { ...ai[role], ...patch } });
  const providerFor = (p: RoleDefaults['provider']) => s.providers.find((x) => x.id === (p === 'auto' ? 'claude' : p));

  return (
    <div>
      <Row label="Providers" hint="Opervio drives the CLIs you are already signed in to.">
        <div className="grid gap-2 sm:grid-cols-2">
          {s.providers.map((p) => (
            <div key={p.id} className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-3">
              {p.available ? <Check className="mt-0.5 size-4 text-positive" /> : <TriangleAlert className="mt-0.5 size-4 text-warning" />}
              <div className="min-w-0">
                <p className="text-[13px] font-medium">{p.label}</p>
                <p className="truncate text-[12px] text-ink-3">{p.available ? `Version ${p.version}` : (p.error ?? 'Not found')}</p>
                <p className="text-[11.5px] text-ink-3">Effort: {p.efforts.map((e) => EFFORT_LABEL[e]).join(', ')}</p>
              </div>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="mt-2"
          onClick={async () => {
            setRefreshing(true);
            await api.post('/api/settings/providers/refresh');
            await qc.invalidateQueries({ queryKey: ['settings'] });
            setRefreshing(false);
          }}
        >
          <RefreshCw className={cn(refreshing && 'animate-spin')} /> Check again
        </Button>
      </Row>
      {ROLES.map((r) => {
        const v = ai[r.id];
        const prov = providerFor(v.provider);
        return (
          <Row key={r.id} label={r.label} hint={r.hint}>
            <div className="flex flex-wrap gap-2">
              <SimpleSelect
                ariaLabel={`${r.label} provider`}
                value={v.provider}
                onChange={(p) => setRole(r.id, { provider: p as RoleDefaults['provider'], model: 'default' })}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'claude', label: 'Claude Code' },
                  { value: 'codex', label: 'Codex' },
                ]}
              />
              <SimpleSelect
                ariaLabel={`${r.label} model`}
                value={v.model}
                onChange={(m) => setRole(r.id, { model: m })}
                options={[{ value: 'default', label: 'Default model' }, ...(prov?.models ?? []).filter((m) => m.id !== 'default').map((m) => ({ value: m.id, label: m.label })), ...(prov?.models.some((m) => m.id === v.model) || v.model === 'default' ? [] : [{ value: v.model, label: v.model }])]}
              />
              <SimpleSelect
                ariaLabel={`${r.label} effort`}
                value={v.effort}
                onChange={(e) => setRole(r.id, { effort: e as RoleDefaults['effort'] })}
                options={['auto', ...(prov?.efforts ?? ['low', 'medium', 'high', 'xhigh'])].map((e) => ({ value: e, label: `Effort: ${EFFORT_LABEL[e as keyof typeof EFFORT_LABEL]}` }))}
              />
            </div>
          </Row>
        );
      })}
      <Row label="Agents at once" hint="How many specialists can work in parallel.">
        <SimpleSelect value={String(ai.maxConcurrentAgents)} onChange={(v) => void save({ ...ai, maxConcurrentAgents: Number(v) })} options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))} />
      </Row>
      <Row label="Correction rounds" hint="If the judge finds work incomplete, the same agent gets focused feedback this many times.">
        <SimpleSelect value={String(ai.maxCorrections)} onChange={(v) => void save({ ...ai, maxCorrections: Number(v) })} options={[0, 1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))} />
      </Row>
    </div>
  );
}

function Tools({ s }: { s: SettingsDTO }) {
  const qc = useQueryClient();
  const [tools, setTools] = useState<ToolSettings>(s.tools);
  useEffect(() => setTools(s.tools), [s.tools]);
  const save = async (next: ToolSettings) => {
    setTools(next);
    await api.put('/api/settings/tools', next);
    await qc.invalidateQueries({ queryKey: ['settings'] });
    toast.success('Saved');
  };
  const py = s.toolStatus.python;
  return (
    <div>
      <Row label="Browser" hint="Where agents browse the web for you.">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { id: 'your-chrome', title: 'Your Chrome', body: 'Agents work in the Chrome you already use — your tabs and sign-ins — through the Claude in Chrome extension. They open their own tabs and leave yours alone.' },
                { id: 'separate', title: 'Separate window', body: 'Agents use their own isolated browser window, without access to your tabs or sessions.' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => void save({ ...tools, browserMode: m.id })}
                className={cn('rounded-lg border p-3 text-start transition-colors', tools.browserMode === m.id ? 'border-foreground bg-surface' : 'border-border bg-surface-2 hover:border-border-strong')}
              >
                <span className="flex items-center gap-2 text-[13px] font-medium">
                  <span className={cn('grid size-3.5 place-items-center rounded-full border', tools.browserMode === m.id ? 'border-brand' : 'border-border-strong')}>
                    {tools.browserMode === m.id && <span className="size-1.5 rounded-full bg-brand" />}
                  </span>
                  {m.title}
                </span>
                <span className="mt-1 block text-[12px] text-ink-3">{m.body}</span>
              </button>
            ))}
          </div>
          {tools.browserMode === 'your-chrome' ? (
            <p className="text-[12.5px] text-ink-3">
              Keep Chrome open with the Claude in Chrome extension signed in. The first time an agent acts on a site, Chrome asks you to approve it — Opervio notifies you when an agent is waiting. Browser tasks run on Claude, since Codex can’t drive your Chrome.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <SimpleSelect
                value={tools.browserChannel}
                onChange={(v) => void save({ ...tools, browserChannel: v as ToolSettings['browserChannel'] })}
                options={[
                  { value: 'chrome', label: 'Google Chrome' },
                  { value: 'msedge', label: 'Microsoft Edge' },
                  { value: 'chromium', label: 'Chromium' },
                ]}
              />
              <label className="flex items-center gap-2 text-[13px]">
                <Switch checked={!tools.browserHeadless} onCheckedChange={(v) => void save({ ...tools, browserHeadless: !v })} />
                Show the window while agents work
              </label>
            </div>
          )}
        </div>
      </Row>
      <Row label="Python" hint="An isolated environment agents use for data, spreadsheets, documents and charts.">
        <div className="space-y-2">
          <p className="text-[13px]">
            {py.available ? `Python ${py.version}` : 'Python not found'}
            {py.venv ? ' · environment ready' : ' · environment not created'}
          </p>
          {py.packages.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {py.packages.map((p) => (
                <Chip key={p}>{p}</Chip>
              ))}
            </div>
          )}
          {py.error && <p className="text-[12px] text-destructive">{py.error}</p>}
          <Button
            size="sm"
            variant="outline"
            disabled={py.installing || !py.available}
            onClick={async () => {
              await api.post('/api/tools/python/install');
              await qc.invalidateQueries({ queryKey: ['settings'] });
              toast('Installing Python packages in the background…');
            }}
          >
            {py.installing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {py.venv ? 'Repair / update' : 'Set up environment'}
          </Button>
        </div>
      </Row>
      <Row label="Git">
        <p className="text-[13px]">{s.toolStatus.git.available ? `Git ${s.toolStatus.git.version}` : 'Git not found'}</p>
      </Row>
      <Row label="Workspace" hint="Where agents keep their working files and deliverables.">
        <Input defaultValue={tools.workspaceDir} onBlur={(e) => e.target.value !== tools.workspaceDir && void save({ ...tools, workspaceDir: e.target.value })} className="max-w-xl font-mono text-[12.5px]" />
      </Row>
    </div>
  );
}

function Routines({ s }: { s: SettingsDTO }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['settings'] });
  if (!s.routines.length) return <p className="py-6 text-[13px] text-ink-3">No routines yet. Ask Noor for things like a daily plan or a weekly content review.</p>;
  return (
    <div>
      {s.routines.map((r) => (
        <div key={r.id} className="flex items-center gap-4 border-b border-border py-3 last:border-0">
          <Switch
            checked={r.enabled}
            onCheckedChange={async (v) => {
              await api.patch(`/api/routines/${r.id}`, { enabled: v });
              await refresh();
            }}
          />
          <div className="min-w-0 flex-1">
            <AutoDir as="p" text={r.title} className="text-[13.5px] font-medium" />
            <p className="text-[12px] text-ink-3">
              {r.kind === 'reminder' ? 'Reminder' : r.kind === 'noor' ? 'Noor' : 'Agent task'} · <code>{r.schedule}</code>
              {r.focus ? ` · ${r.focus.name}` : ''}
              {r.nextRunAt && r.enabled ? ` · next ${new Date(r.nextRunAt).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
            </p>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Delete routine"
            onClick={async () => {
              await api.del(`/api/routines/${r.id}`);
              await refresh();
            }}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
    </div>
  );
}

function Memory() {
  const [q, setQ] = useState('');
  const { data = [], refetch } = useMemories(q.trim().length >= 2 ? q.trim() : undefined);
  return (
    <div className="space-y-3 pt-2">
      <Input dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search memory" className="max-w-sm" />
      {data.length === 0 && <p className="text-[13px] text-ink-3">{q ? 'Nothing matches.' : 'Noor and the team save durable facts and preferences here as you work together.'}</p>}
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {data.map((m) => (
          <li key={m.id} className="flex items-start gap-3 px-4 py-3">
            <Chip className="mt-0.5">{m.kind}</Chip>
            <div className="min-w-0 flex-1">
              <AutoDir as="p" text={m.content} className="text-[13px]" />
              <p className="text-[11.5px] text-ink-3">
                {m.source} · {ago(m.createdAt)}
              </p>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Forget"
              onClick={async () => {
                await api.del(`/api/memories/${m.id}`);
                await refetch();
              }}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SettingsPage() {
  const search = useSearch({ strict: false }) as { tab?: Tab };
  const navigate = useNavigate();
  const tab: Tab = TABS.some((t) => t.id === search.tab) ? (search.tab as Tab) : 'profile';
  const { data: s } = useSettings();
  return (
    <>
      <TopBar title="Settings" />
      <div className="mx-auto w-full max-w-[980px] space-y-5 px-4 py-8 lg:px-8">
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.025em]">Settings</h1>
        <div className="flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void navigate({ to: '/settings', search: { tab: t.id } as never })}
              className={cn('-mb-px border-b-2 px-3 py-2 text-[13px]', tab === t.id ? 'border-foreground font-medium' : 'border-transparent text-ink-3 hover:text-ink-2')}
            >
              {t.label}
            </button>
          ))}
        </div>
        {!s ? (
          <p className="text-[13px] text-ink-3">Loading…</p>
        ) : (
          <div className="rounded-xl border border-border bg-surface px-5 shadow-sm">
            {tab === 'profile' && <Profile s={s} />}
            {tab === 'ai' && <Ai s={s} />}
            {tab === 'tools' && <Tools s={s} />}
            {tab === 'routines' && <Routines s={s} />}
            {tab === 'memory' && <Memory />}
          </div>
        )}
      </div>
    </>
  );
}
