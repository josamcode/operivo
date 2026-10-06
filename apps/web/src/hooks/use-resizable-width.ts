import { useCallback, useEffect, useRef, useState } from 'react';

export interface ResizableOptions {
  /** Remembers the width per drawer (agent, output, record…). */
  id: string;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
}

const KEY = (id: string) => `opervio-width:${id}`;
/** Always leave a strip of the app visible next to the drawer. */
const VIEWPORT_GUTTER = 96;

/** A width the user can drag, clamped to sensible bounds and remembered across sessions. */
export function useResizableWidth({ id, defaultWidth, minWidth = 380, maxWidth = 1600 }: ResizableOptions) {
  const clamp = useCallback(
    (w: number) => Math.round(Math.max(minWidth, Math.min(w, maxWidth, window.innerWidth - VIEWPORT_GUTTER))),
    [minWidth, maxWidth],
  );
  const [width, setWidthState] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(KEY(id)));
      return clamp(saved > 0 ? saved : defaultWidth);
    } catch {
      return clamp(defaultWidth);
    }
  });
  const latest = useRef(width);
  const [dragging, setDragging] = useState(false);

  const setWidth = useCallback(
    (w: number) => {
      const next = clamp(w);
      latest.current = next;
      setWidthState(next);
      return next;
    },
    [clamp],
  );

  const persist = useCallback(() => {
    try {
      localStorage.setItem(KEY(id), String(latest.current));
    } catch {
      /* private mode */
    }
  }, [id]);

  const reset = useCallback(() => {
    setWidth(defaultWidth);
    try {
      localStorage.removeItem(KEY(id));
    } catch {
      /* private mode */
    }
  }, [defaultWidth, id, setWidth]);

  // Keep the drawer inside the window when the window shrinks.
  useEffect(() => {
    const onResize = () => setWidth(latest.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setWidth]);

  return { width, setWidth, persist, reset, dragging, setDragging, minWidth, maxWidth };
}

export type ResizableWidth = ReturnType<typeof useResizableWidth>;
