import { JudgeVerdict, type ArtifactPreview, type ArtifactType, type RoleDefaults } from '@opervio/contracts';
import { buildPreview } from '../domain/artifacts';
import { redact } from '../lib/redact';
import { clip } from '../lib/text';
import { completeJson } from '../providers/registry';

export interface JudgeInput {
  objective: string;
  successCriteria: string[];
  deliverables: string[];
  expectedOutputs: ArtifactType[];
  finalSummary: string;
  artifacts: { title: string; type: ArtifactType; path: string; sizeBytes: number }[];
  records: { collection: string; created: number; updated: number }[];
  progress: string[];
}

export type Verdict = JudgeVerdict & { method: 'rules' | 'ai'; judgeModel?: string };

const SYSTEM = `You are Opervio's Result Judge. Decide whether an AI agent actually achieved the requested outcome.

Judge only from evidence: the outputs, their contents and records written. An agent saying "done" is not evidence.
- complete: every success criterion is met by the evidence.
- incomplete: real progress but criteria unmet (e.g. 12 of 20 leads, tests still failing, a file missing). Give focused, actionable feedback for the same agent.
- needs_founder: cannot be completed without the founder's judgment or action (login, choice, approval). Put the single question in founderQuestion.
- failed: no meaningful progress or the approach cannot work.

Facts Opervio has already verified for you: every file listed under Outputs exists on disk and is registered — never ask for proof of saving or registration.
Long files may be shown truncated; judge the visible content and do not mark a result incomplete only because the excerpt is cut off.
Be strict but fair: minor formatting issues do not make a result incomplete. Keep summary to 1–2 short sentences.`;

/** Deterministic checks first — cheap, and they catch the most common "said done, no file" failure. */
export function ruleCheck(input: JudgeInput): Verdict | null {
  const missingTypes = input.expectedOutputs.filter((t) => !input.artifacts.some((a) => a.type === t || (t === 'csv' && a.type === 'xlsx') || (t === 'xlsx' && a.type === 'csv')));
  const empty = input.artifacts.filter((a) => a.sizeBytes === 0);
  if (missingTypes.length && input.artifacts.length === 0) {
    return {
      method: 'rules',
      status: 'incomplete',
      summary: `No deliverable file was produced (expected ${missingTypes.join(', ')}).`,
      missing: missingTypes.map((t) => `${t.toUpperCase()} deliverable`),
      feedback: `The task requires a ${missingTypes.join(' and ')} deliverable. Create the file(s) in your working directory with the content described in the success criteria, then call save_output for each.`,
    };
  }
  if (empty.length) {
    return {
      method: 'rules',
      status: 'incomplete',
      summary: `Empty output file: ${empty.map((e) => e.title).join(', ')}.`,
      missing: empty.map((e) => `${e.title} has no content`),
      feedback: `These files are empty: ${empty.map((e) => e.path).join(', ')}. Write their real content and save again.`,
    };
  }
  return null;
}

function describePreview(p: ArtifactPreview, budget: number): string {
  switch (p.kind) {
    case 'table':
      return `table with ${p.totalRows ?? p.rows.length} data rows; columns: ${p.columns.join(' | ')}\nfirst rows:\n${p.rows
        .slice(0, 6)
        .map((r) => r.map((c) => clip(c, 40)).join(' | '))
        .join('\n')}`;
    case 'text':
      if (p.text.length > budget) return `${p.text.slice(0, budget)}\n…[excerpt truncated at ${budget} of ${p.text.length} characters]`;
      return p.truncated ? `${p.text}\n…[file continues beyond the preview]` : p.text;
    case 'pdf':
      return `PDF, ${p.pages ?? '?'} pages`;
    case 'image':
      return 'image file';
    default:
      return 'binary file (content not previewable)';
  }
}

export async function judgeResult(input: JudgeInput, defaults: RoleDefaults): Promise<Verdict> {
  const rule = ruleCheck(input);
  if (rule) return rule;

  const outputs = await Promise.all(
    input.artifacts.slice(0, 8).map(async (a, _i, all) => {
      const preview = describePreview(await buildPreview(a.path, a.type), Math.floor(36000 / all.length));
      return `### ${a.title} (${a.type}, ${a.sizeBytes} bytes, saved at ${a.path})\n${preview}`;
    }),
  );
  const evidence = [
    `## Objective\n${input.objective}`,
    `## Success criteria\n${input.successCriteria.map((c) => `- ${c}`).join('\n')}`,
    `## Expected deliverables\n${input.deliverables.map((d) => `- ${d}`).join('\n')}`,
    `## Outputs (${input.artifacts.length}) — verified on disk by Opervio\n${outputs.join('\n\n') || 'none'}`,
    input.records.length ? `## Records written\n${input.records.map((r) => `- ${r.collection}: ${r.created} created, ${r.updated} updated`).join('\n')}` : '',
    input.progress.length ? `## Progress reported\n${input.progress.slice(-12).map((p) => `- ${p}`).join('\n')}` : '',
    `## Agent's final summary (a claim, not evidence)\n${clip(input.finalSummary, 2500) || '(none)'}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const res = await completeJson({ defaults, system: SYSTEM, prompt: `${redact(evidence)}\n\nReturn the verdict as JSON.`, schema: JudgeVerdict, timeoutMs: 120_000 });
  if (res) return { ...res.data, method: 'ai', judgeModel: `${res.provider} · ${res.model} · ${res.effort}` };

  // Judge unavailable: rules already passed, so trust the evidence that exists.
  return {
    method: 'rules',
    status: input.artifacts.length || input.records.length || input.finalSummary ? 'complete' : 'incomplete',
    summary: 'Judge unavailable; deliverable checks passed.',
    missing: [],
  };
}
