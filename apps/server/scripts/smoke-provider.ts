import { z } from 'zod';
import { completeJson, providerStatus } from '../src/providers/registry';

console.log(await providerStatus(true));
const t0 = Date.now();
const res = await completeJson({
  defaults: { provider: (process.argv[2] as 'claude' | 'codex') ?? 'claude', model: process.argv[3] ?? 'haiku', effort: 'low' },
  system: 'You are a terse assistant. Answer only with the requested JSON.',
  prompt: 'Return {"ok": true, "word": "<a single word meaning light in Arabic, transliterated>"}',
  schema: z.object({ ok: z.boolean(), word: z.string() }),
  timeoutMs: 120000,
});
console.log(JSON.stringify(res), `${Date.now() - t0}ms`);
process.exit(0);
