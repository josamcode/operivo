import { EventEmitter } from 'node:events';
import type { ServerEvent } from '@opervio/contracts';

/** In-process event bus → SSE. The UI uses `invalidate` keys to refetch TanStack Query caches. */
class Bus extends EventEmitter {
  private pending = new Set<string>();
  private timer: NodeJS.Timeout | null = null;

  emitEvent(event: ServerEvent) {
    this.emit('event', event);
  }

  /** Coalesces invalidations into one event per ~120ms so bursts of DB writes don't flood the UI. */
  invalidate(...keys: string[]) {
    keys.forEach((k) => this.pending.add(k));
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      const keys = [...this.pending];
      this.pending.clear();
      if (keys.length) this.emitEvent({ type: 'invalidate', keys });
    }, 120);
  }
}

export const bus = new Bus();
bus.setMaxListeners(100);
