import { execa } from 'execa';
import { log } from '../log';
import type { ProviderEvent, ProviderRun } from './types';

/** Minimal push → async-iterator bridge. */
export class AsyncQueue<T> implements AsyncIterable<T> {
  private items: T[] = [];
  private waiters: ((r: IteratorResult<T>) => void)[] = [];
  private closed = false;

  push(item: T) {
    if (this.closed) return;
    const w = this.waiters.shift();
    if (w) w({ value: item, done: false });
    else this.items.push(item);
  }

  close() {
    this.closed = true;
    for (const w of this.waiters.splice(0)) w({ value: undefined as never, done: true });
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.items.length) return Promise.resolve({ value: this.items.shift()!, done: false });
        if (this.closed) return Promise.resolve({ value: undefined as never, done: true });
        return new Promise((resolve) => this.waiters.push(resolve));
      },
    };
  }
}

export async function killTree(pid: number | undefined) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') await execa('taskkill', ['/pid', String(pid), '/T', '/F'], { reject: false, windowsHide: true });
    else process.kill(-pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}

export interface SpawnJsonlOptions {
  file: string;
  args: string[];
  cwd: string;
  input: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Translate one parsed stdout JSON line into zero or more provider events. */
  parse: (line: Record<string, unknown>) => ProviderEvent[];
  /** Called once the process exits; may synthesize a final result if the CLI didn't emit one. */
  onExit?: (code: number | undefined, stderr: string) => ProviderEvent[];
}

/** Spawns a CLI that prints JSONL on stdout, feeding the prompt over stdin (no command-line length limits). */
export function spawnJsonl(opts: SpawnJsonlOptions): ProviderRun {
  const queue = new AsyncQueue<ProviderEvent>();
  const sub = execa(opts.file, opts.args, {
    cwd: opts.cwd,
    input: opts.input,
    env: { ...opts.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    extendEnv: true,
    buffer: false,
    reject: false,
    windowsHide: true,
    stripFinalNewline: false,
  });

  let stderr = '';
  let cancelled = false;
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    void killTree(sub.pid);
  };
  opts.signal?.addEventListener('abort', cancel, { once: true });
  const timer = opts.timeoutMs ? setTimeout(cancel, opts.timeoutMs) : null;

  sub.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stderr = (stderr + text).slice(-8000);
    queue.push({ type: 'stderr', text });
  });

  let buffer = '';
  sub.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const raw = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!raw.startsWith('{')) continue;
      try {
        for (const ev of opts.parse(JSON.parse(raw))) queue.push(ev);
      } catch (err) {
        log.debug({ err, raw: raw.slice(0, 200) }, 'unparseable provider line');
      }
    }
  });

  void sub.then((res) => {
    if (timer) clearTimeout(timer);
    const tail = buffer.trim();
    if (tail.startsWith('{')) {
      try {
        for (const ev of opts.parse(JSON.parse(tail))) queue.push(ev);
      } catch {
        /* ignore */
      }
    }
    const code = typeof res.exitCode === 'number' ? res.exitCode : undefined;
    for (const ev of opts.onExit?.(cancelled ? -1 : code, stderr) ?? []) queue.push(ev);
    queue.close();
  });

  return { events: queue, cancel };
}
