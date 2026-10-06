export const clip = (s: string | null | undefined, n: number) => {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
};

/** Short human label for a tool invocation — shown as live activity, never raw logs. */
export function describeTool(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const host = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };
  const file = (p: string) => p.split(/[\\/]/).pop() || p;
  const cmd = str(i.command).replace(/\s+/g, ' ');
  if (name.startsWith('mcp__playwright__')) {
    const action = name.replace('mcp__playwright__browser_', '').replace(/_/g, ' ');
    if (str(i.url)) return `Browsing ${host(str(i.url))}`;
    return `Browser · ${action}`;
  }
  if (name.startsWith('mcp__opervio__')) return '';
  switch (name) {
    case 'WebSearch':
      return `Searching “${clip(str(i.query), 60)}”`;
    case 'WebFetch':
      return `Reading ${host(str(i.url))}`;
    case 'Read':
      return `Reading ${file(str(i.file_path))}`;
    case 'Write':
      return `Writing ${file(str(i.file_path))}`;
    case 'Edit':
    case 'MultiEdit':
      return i.changes ? 'Editing files' : `Editing ${file(str(i.file_path))}`;
    case 'Glob':
    case 'Grep':
      return 'Searching files';
    case 'Bash':
    case 'PowerShell':
    case 'shell': {
      if (/\bpython(3|\.exe)?\b|\.venv/.test(cmd)) return 'Running Python';
      if (/\b(npm|pnpm|yarn|vitest|jest|pytest)\b.*\btest/.test(cmd) || /\b(vitest|jest|pytest)\b/.test(cmd)) return 'Running tests';
      if (/\bgit\s+commit\b/.test(cmd)) return 'Committing changes';
      if (/\bgit\b/.test(cmd)) return 'Checking Git';
      if (/\b(npm|pnpm|yarn)\s+(i|install|add)\b|\bpip\s+install\b|\buv\s+(pip|add)\b/.test(cmd)) return 'Installing dependencies';
      return `Running ${clip(cmd.split(' ').slice(0, 3).join(' '), 40)}`;
    }
    // Internal bookkeeping of the provider CLI — not meaningful activity.
    case 'TodoWrite':
    case 'ToolSearch':
    case 'Skill':
    case 'ExitPlanMode':
    case 'BashOutput':
    case 'KillShell':
      return '';
    case 'Task':
    case 'Agent':
      return 'Delegating a sub-task';
    default:
      return clip(name.replace(/^mcp__\w+__/, '').replace(/_/g, ' '), 40);
  }
}

/** Groups tool names into the families shown on agent cards (Browser, Python, Terminal…). */
export function toolFamily(name: string, input?: unknown): string | null {
  const cmd = String(((input ?? {}) as Record<string, unknown>).command ?? '');
  if (name.startsWith('mcp__playwright__')) return 'Browser';
  if (name === 'WebSearch' || name === 'WebFetch') return 'Web';
  if (name === 'mcp__opervio__run_python' || /\bpython|\.venv/.test(cmd)) return 'Python';
  if (/\bgit\b/.test(cmd)) return 'Git';
  if (name === 'Bash' || name === 'PowerShell' || name === 'shell') return 'Terminal';
  if (['Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep', 'NotebookEdit'].includes(name)) return 'Files';
  if (name.startsWith('mcp__opervio__')) return null;
  return null;
}
