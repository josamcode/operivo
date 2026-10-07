import { useNavigate, useSearch } from '@tanstack/react-router';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface UiState {
  noorOpen: boolean;
  setNoorOpen: (v: boolean) => void;
  toggleNoor: () => void;
  /** Opens Noor with a draft message (from Home, palette, empty states). */
  askNoor: (draft?: string) => void;
  draft: string;
  setDraft: (v: string) => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
}

const Ctx = createContext<UiState | null>(null);

/** Wide enough to dock Noor beside the page; narrower screens get Noor as a sheet. */
export const DOCKED_NOOR = '(min-width: 1280px)';

export function UiProvider({ children }: { children: ReactNode }) {
  const [noorOpen, setNoorOpenState] = useState(() => {
    if (window.matchMedia?.(DOCKED_NOOR).matches === false) return false;
    try {
      return localStorage.getItem('opervio-noor-open') !== '0';
    } catch {
      return true;
    }
  });
  const [draft, setDraft] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);

  const setNoorOpen = useCallback((v: boolean) => {
    setNoorOpenState(v);
    try {
      localStorage.setItem('opervio-noor-open', v ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<UiState>(
    () => ({
      noorOpen,
      setNoorOpen,
      toggleNoor: () => setNoorOpen(!noorOpen),
      askNoor: (d?: string) => {
        if (d !== undefined) setDraft(d);
        setNoorOpen(true);
        setTimeout(() => document.getElementById('noor-input')?.focus(), 60);
      },
      draft,
      setDraft,
      paletteOpen,
      setPaletteOpen,
    }),
    [noorOpen, setNoorOpen, draft, paletteOpen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUi() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUi outside UiProvider');
  return v;
}

export interface DrawerSearch {
  agent?: string;
  output?: string;
  decision?: string;
}

/** Drawers live in the URL so any page, notification or palette item can open them. */
export function useDrawers() {
  const search = useSearch({ strict: false }) as DrawerSearch;
  const navigate = useNavigate();
  const set = useCallback(
    (patch: DrawerSearch) =>
      void navigate({ to: '.', search: (prev: DrawerSearch) => ({ ...prev, agent: undefined, output: undefined, decision: undefined, ...patch }) as never, replace: false }),
    [navigate],
  );
  return {
    agentId: search.agent ?? null,
    outputId: search.output ?? null,
    decisionId: search.decision ?? null,
    openAgent: (id: string) => set({ agent: id }),
    openOutput: (id: string) => set({ output: id }),
    openDecision: (id: string) => set({ decision: id }),
    close: () => set({}),
  };
}
