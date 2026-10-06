/**
 * Removes secret values from text before it is stored, shown in the UI or passed to an AI.
 * Conservative by design: it is fine to over-redact a log line, never fine to leak a key.
 */

const PATTERNS: [RegExp, string | ((...m: string[]) => string)][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[redacted private key]'],
  [/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g, '[redacted key]'],
  [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g, '[redacted token]'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/g, '[redacted token]'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '[redacted key]'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, '[redacted token]'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, '[redacted key]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[redacted jwt]'],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{16,}/g, (_m, kind) => `${kind} [redacted]`],
  [/\b([a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:)([^@\s/]+)(@)/gi, (_m, a, _p, c) => `${a}****${c}`],
  [
    /\b((?:[A-Z0-9_]*_)?(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key)[A-Z0-9_]*)(\s*[:=]\s*)(["']?)([^\s"',;]{6,})\3/gi,
    (_m, key, sep, q) => `${key}${sep}${q}[redacted]${q}`,
  ],
];

export function redact(text: string): string {
  if (!text) return text;
  let out = text;
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep as never);
  return out;
}

/** Redacts every string inside a JSON-ish value. */
export function redactDeep<T>(value: T): T {
  if (typeof value === 'string') return redact(value) as T;
  if (Array.isArray(value)) return value.map(redactDeep) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactDeep(v)])) as T;
  }
  return value;
}
