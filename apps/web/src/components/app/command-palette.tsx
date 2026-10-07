import type { ArtifactDTO } from '@opervio/contracts';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Brain, FolderOpen, House, MessageSquare, Moon, Plus, Settings } from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/components/ui/command';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useAgents, useBootstrap } from '@/lib/queries';
import { pageIcon } from './page-icon';
import { AgentAvatar, FileGlyph, NoorMark } from './primitives';
import { useDrawers, useUi } from './ui-state';

interface SearchResult {
  outputs: ArtifactDTO[];
  agents: { id: string; name: string; role: string; status: string }[];
  memories: { id: string; kind: string; content: string }[];
}

/** Ctrl+K: the fastest way to Noor, any page, any output, any agent, or memory. */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, askNoor, toggleNoor } = useUi();
  const [q, setQ] = useState('');
  const query = useDeferredValue(q.trim());
  const navigate = useNavigate();
  const { openAgent, openOutput } = useDrawers();
  const { data: boot } = useBootstrap();
  const { data: agents = [] } = useAgents();
  const { toggle } = useTheme();
  const { data: found } = useQuery({
    queryKey: ['search', query],
    queryFn: () => api.get<SearchResult>(`/api/search?q=${encodeURIComponent(query)}`),
    enabled: paletteOpen && query.length >= 2,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleNoor();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, setPaletteOpen, toggleNoor]);

  useEffect(() => {
    if (!paletteOpen) setQ('');
  }, [paletteOpen]);

  const run = (fn: () => void) => {
    setPaletteOpen(false);
    fn();
  };

  return (
    <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen} title="Command palette" description="Search Opervio or ask Noor" className="sm:max-w-[620px]">
      <Command shouldFilter loop>
        <CommandInput dir="auto" value={q} onValueChange={setQ} placeholder="Ask Noor, open a page, find an output…" />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>Nothing found. Press Enter on “Ask Noor” to ask her instead.</CommandEmpty>
          <CommandGroup heading="Noor">
            <CommandItem value={`ask noor ${q}`} onSelect={() => run(() => askNoor(q))} forceMount>
              <NoorMark size={16} />
              {q ? (
                <span className="truncate">
                  Ask Noor: <span dir="auto">“{q}”</span>
                </span>
              ) : (
                'Ask Noor'
              )}
              <CommandShortcut>Ctrl J</CommandShortcut>
            </CommandItem>
            <CommandItem value="create new focus area" onSelect={() => run(() => askNoor('I want to add a new focus: '))}>
              <Plus /> Create a new focus
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Go to">
            <CommandItem value="home" onSelect={() => run(() => void navigate({ to: '/' }))}>
              <House /> Home
            </CommandItem>
            {boot?.nav.map((n) => {
              const Icon = pageIcon(n.icon);
              return (
                <CommandItem key={n.slug} value={`open ${n.title}`} onSelect={() => run(() => void navigate({ to: '/p/$slug', params: { slug: n.slug } }))}>
                  <Icon /> <span dir="auto">{n.title}</span>
                </CommandItem>
              );
            })}
            <CommandItem value="outputs files" onSelect={() => run(() => void navigate({ to: '/outputs' }))}>
              <FolderOpen /> Outputs
            </CommandItem>
            <CommandItem value="settings" onSelect={() => run(() => void navigate({ to: '/settings' }))}>
              <Settings /> Settings
            </CommandItem>
          </CommandGroup>
          {agents.length > 0 && (
            <CommandGroup heading="Agents">
              {agents.slice(0, 8).map((a) => (
                <CommandItem key={a.id} value={`show ${a.name} ${a.role}`} onSelect={() => run(() => openAgent(a.id))}>
                  <AgentAvatar name={a.name} size={18} />
                  {a.name}
                  <span className="text-ink-3">{a.role}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {found && found.outputs.length > 0 && (
            <CommandGroup heading="Outputs">
              {found.outputs.map((o) => (
                <CommandItem key={o.id} value={`output ${o.title} ${o.fileName} ${query}`} onSelect={() => run(() => openOutput(o.id))}>
                  <FileGlyph type={o.type} size={18} className="rounded-sm border-0 bg-transparent" />
                  <span dir="auto" className="truncate">
                    {o.title}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {found && found.memories.length > 0 && (
            <CommandGroup heading="Memory">
              {found.memories.map((m) => (
                <CommandItem key={m.id} value={`memory ${m.content} ${query}`} onSelect={() => run(() => void navigate({ to: '/settings', search: { tab: 'memory' } as never }))}>
                  <Brain />
                  <span dir="auto" className="truncate text-ink-2">
                    {m.content}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Preferences">
            <CommandItem value="toggle theme dark light" onSelect={() => run(toggle)}>
              <Moon /> Toggle light / dark
            </CommandItem>
            <CommandItem value="search memory" onSelect={() => run(() => void navigate({ to: '/settings', search: { tab: 'memory' } as never }))}>
              <MessageSquare /> Search memory
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
