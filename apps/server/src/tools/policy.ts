/**
 * Tool-use policy. Routine work (reading, research, files, tests, local git) is never gated.
 * Three outcomes:
 *  - allow: normal work
 *  - ask:   consequential — needs the founder unless they gave standing permission
 *  - deny:  system-critical destruction or credential access — never allowed for agents
 */

export type PolicyAction = 'allow' | 'ask' | 'deny';
export type AskCategory = 'production' | 'delete' | 'publish' | 'send_messages' | 'spend_money';

export interface PolicyDecision {
  action: PolicyAction;
  reason?: string;
  category?: AskCategory;
}

export interface ToolUse {
  tool: string;
  input: Record<string, unknown>;
}

const allow: PolicyDecision = { action: 'allow' };

// Files that hold secrets. Templates (.env.example etc.) are fine.
const SECRET_FILE = [
  /(^|[\\/])\.env(\.(?!example\b|sample\b|template\b|dist\b)[\w.-]+)?$/i,
  /(^|[\\/])\.ssh[\\/](id_[\w.-]+|[\w.-]*_key)(?!\.pub)$/i,
  /(^|[\\/])\.aws[\\/]credentials$/i,
  /(^|[\\/])\.claude[\\/]\.credentials\.json$/i,
  /(^|[\\/])\.codex[\\/]auth\.json$/i,
  /(^|[\\/])\.git-credentials$/i,
  /(^|[\\/])\.npmrc$/i,
  /(^|[\\/])\.pypirc$/i,
  /(^|[\\/])\.netrc$/i,
  /(^|[\\/])(Login Data|Cookies|Web Data)$/i,
  /storage-state\.json$/i,
  /\.(pem|p12|pfx|key|keystore|jks)$/i,
];

const SYSTEM_PATH = [
  /^[a-z]:[\\/](windows|program files( \(x86\))?|programdata|system volume information)([\\/]|$)/i,
  /^\/(etc|usr|bin|sbin|boot|sys|proc|System|Library)([\/]|$)/,
];

const isSecretFile = (p: string) => SECRET_FILE.some((re) => re.test(p.trim().replace(/["']/g, '')));
const isSystemPath = (p: string) => SYSTEM_PATH.some((re) => re.test(p.trim().replace(/["']/g, '')));

interface CommandRule {
  re: RegExp;
  decision: PolicyDecision;
}

const deny = (reason: string): PolicyDecision => ({ action: 'deny', reason });
const ask = (category: AskCategory, reason: string): PolicyDecision => ({ action: 'ask', category, reason });

const COMMAND_RULES: CommandRule[] = [
  // System-critical destruction — never.
  { re: /\brm\s+(-[a-z]*r[a-z]*f?|-[a-z]*f[a-z]*r|--recursive)[a-z\s-]*\s+(["']?)(\/|~|\$HOME|\/\*|[a-z]:[\\/]?)\2(\s|$)/i, decision: deny('Recursive delete of a root or home directory') },
  { re: /\b(remove-item|rm|del|rd|rmdir)\b[^|;&\n]*\s(["']?)([a-z]:[\\/]?|[a-z]:[\\/](windows|users)[\\/]?|~|\$env:userprofile)\2(\s|$)[^|;&\n]*(-recurse|\/s)/i, decision: deny('Recursive delete of a drive, Windows or the user profile') },
  { re: /\b(remove-item|rm|del|rd|rmdir)\b[^|;&\n]*(-recurse|\/s)[^|;&\n]*\s(["']?)([a-z]:[\\/]?|[a-z]:[\\/](windows|users)[\\/]?|~|\$env:userprofile)\3(\s|$)/i, decision: deny('Recursive delete of a drive, Windows or the user profile') },
  { re: /\bformat(\.com)?\s+[a-z]:/i, decision: deny('Formatting a drive') },
  { re: /\b(diskpart|mkfs(\.\w+)?|fdisk|bcdedit|vssadmin\s+delete|wbadmin\s+delete|cipher\s+\/w)\b/i, decision: deny('Disk/boot level operation') },
  { re: /\bdd\s+[^\n]*\bof=\/dev\//i, decision: deny('Raw disk write') },
  { re: /\b(shutdown(\.exe)?\s|restart-computer|stop-computer|reboot\b|halt\b)/i, decision: deny('Shutting down or restarting the machine') },
  { re: /\breg(\.exe)?\s+delete\s+hk(lm|ey_local_machine)/i, decision: deny('Deleting machine registry keys') },
  { re: /\bremove-item\b[^\n]*\bhklm:/i, decision: deny('Deleting machine registry keys') },
  { re: /\bchmod\s+-R\s+777\s+\/(\s|$)/i, decision: deny('Opening permissions on the whole filesystem') },
  { re: /:\(\)\s*\{\s*:\|:&\s*\};:/, decision: deny('Fork bomb') },
  // Credential stores — never read secrets into AI context.
  { re: /\b(cmdkey\s+\/list|security\s+find-(generic|internet)-password|get-storedcredential|vaultcmd)\b/i, decision: deny('Reading stored credentials') },
  { re: /\b(printenv|env)\s*$|\bget-childitem\s+env:|\bgci\s+env:|\bdir\s+env:|\bset\s*$/im, decision: deny('Dumping environment variables (may contain secrets)') },

  // Consequential — founder approval unless standing permission.
  { re: /\bgit\s+push\b[^\n]*(\s--force(-with-lease)?\b|\s-f\b)/i, decision: ask('production', 'Force-pushing rewrites shared history') },
  { re: /\bgit\s+push\b[^\n]*\s(origin\s+)?(main|master|production|prod|release)\b/i, decision: ask('production', 'Pushing to a main/production branch') },
  { re: /\b(npm|pnpm|yarn|bun)\s+publish\b|\bdocker\s+push\b|\bcargo\s+publish\b|\btwine\s+upload\b|\bgh\s+release\s+create\b/i, decision: ask('publish', 'Publishing a package or release') },
  { re: /\b(vercel\b[^\n]*--prod|netlify\s+deploy\b[^\n]*--prod|firebase\s+deploy|fly\s+deploy|railway\s+up|terraform\s+(apply|destroy)|kubectl\s+(apply|delete)|heroku\s+[^\n]*deploy)\b/i, decision: ask('production', 'Production deploy or infrastructure change') },
  { re: /\bgh\s+pr\s+merge\b/i, decision: ask('production', 'Merging a pull request') },
  { re: /\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|checkout\s+--\s+\.|restore\s+(--staged\s+)?\.(\s|$)|stash\s+(drop|clear)|branch\s+-D)\b/i, decision: ask('delete', 'Would discard uncommitted or unmerged work') },
  { re: /\b(drop\s+(database|schema|table)|truncate\s+table)\b|\bprisma\s+migrate\s+reset\b|--force-reset\b/i, decision: ask('delete', 'Destroys database data') },
];

export function checkCommand(command: string): PolicyDecision {
  const cmd = command.replace(/\s+/g, ' ');
  for (const rule of COMMAND_RULES) if (rule.re.test(cmd)) return rule.decision;
  // Reading a secret file through the shell.
  const readsFile = /\b(cat|type|get-content|gc|less|more|head|tail|bat|nano|vim?|notepad|copy|cp|xcopy)\b\s+([^|;&\n]+)/gi;
  for (const m of cmd.matchAll(readsFile)) {
    const args = m[2].split(/\s+/).filter((a) => a && !a.startsWith('-'));
    if (args.some(isSecretFile)) return deny('Reading a secrets file. Use .env.example / ask the founder to configure values.');
  }
  return allow;
}

export function checkFileAccess(path: string, mode: 'read' | 'write'): PolicyDecision {
  if (isSecretFile(path)) return deny('Secrets file. Use .env.example or ask the founder to configure values.');
  if (mode === 'write' && isSystemPath(path)) return deny('Writing to a system directory');
  return allow;
}

const SHELL_TOOLS = new Set(['Bash', 'PowerShell', 'shell', 'exec_command']);
const READ_TOOLS = new Set(['Read', 'NotebookRead']);
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

export function checkToolUse(use: ToolUse): PolicyDecision {
  const input = use.input ?? {};
  if (SHELL_TOOLS.has(use.tool) && typeof input.command === 'string') return checkCommand(input.command);
  const path = (input.file_path ?? input.notebook_path ?? input.path) as string | undefined;
  if (typeof path === 'string') {
    if (READ_TOOLS.has(use.tool)) return checkFileAccess(path, 'read');
    if (WRITE_TOOLS.has(use.tool)) return checkFileAccess(path, 'write');
  }
  if ((use.tool === 'Grep' || use.tool === 'Glob') && typeof input.path === 'string' && isSecretFile(input.path)) {
    return deny('Secrets file');
  }
  return allow;
}

/**
 * Applies the founder's standing permissions: an `ask` whose category is NOT in their
 * always-ask list is allowed. `deny` can never be overridden.
 */
export function applyStandingPermissions(decision: PolicyDecision, alwaysAsk: string[]): PolicyDecision {
  if (decision.action !== 'ask' || !decision.category) return decision;
  return alwaysAsk.includes(decision.category) ? decision : allow;
}
