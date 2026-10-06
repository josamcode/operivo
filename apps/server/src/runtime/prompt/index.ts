import { CollectionDef, collectionsUsed, PageSpec, type CompiledPrompt, type ProviderId } from '@opervio/contracts';
import { db } from '../../db';
import type { Agent, Focus, Founder, Task } from '../../generated/prisma/client';
import { log } from '../../log';
import { getAiSettings } from '../../settings';
import { venvPython } from '../../tools/python';
import { compileSkeleton, operatingRules, renderPrompt, type BrowserAccess } from './compile';
import { retrieveContext } from './context';
import { engineerPrompt, mergeEngineered } from './engineer';
import { interpretTask, type Interpretation } from './interpret';

export interface CompileInput {
  task: Task;
  agent: Agent;
  focus: Focus | null;
  founder: Founder;
  workdir: string;
  provider: ProviderId;
  attempt: number;
  browser: BrowserAccess;
}

/**
 * Task Interpreter → Context Retriever → Prompt Compiler (skeleton) → Prompt Engineer (low effort).
 * The engineer is an optimization: if it fails or is slow, the skeleton alone is a good prompt.
 */
export async function compilePrompt(input: CompileInput): Promise<{ prompt: CompiledPrompt; interp: Interpretation }> {
  const interp = interpretTask(input.task);
  const context = await retrieveContext({ ...input, interp });
  const page = input.focus ? await db.page.findUnique({ where: { focusId: input.focus.id } }) : null;
  const spec = page ? PageSpec.safeParse(page.spec) : null;
  const keys = spec?.success ? collectionsUsed(spec.data) : [];
  const collections = keys.length
    ? (await db.collection.findMany({ where: { key: { in: keys } } })).map((c) => {
        const def = CollectionDef.parse(c.def);
        return { key: def.key, title: def.title, fields: def.fields.map((f) => `${f.key}:${f.type}${f.options ? `(${f.options.join('|')})` : ''}`) };
      })
    : [];
  let skeleton = compileSkeleton({
    task: input.task,
    agent: input.agent,
    focus: input.focus,
    founder: input.founder,
    interp,
    context,
    provider: input.provider,
    workdir: input.workdir,
    pythonPath: venvPython(),
    browser: input.browser,
    collections,
  });
  let engineerNote: string | undefined;
  const ai = await getAiSettings();
  const eng = await engineerPrompt(skeleton, { title: input.task.title, taskType: interp.taskType, complexity: interp.complexity, attempt: input.attempt }, ai.engineer);
  if (eng) {
    skeleton = mergeEngineered(skeleton, eng.data, input.task.successCriteria);
    engineerNote = `Optimized by ${eng.provider} · ${eng.model} · ${eng.effort}`;
  } else {
    engineerNote = 'Prompt Engineer unavailable — using the compiled skeleton';
    log.info({ task: input.task.id }, 'prompt engineer skipped');
  }
  const prompt: CompiledPrompt = {
    ...skeleton,
    engineerNote,
    text: renderPrompt(skeleton, input.task.title, input.workdir),
    systemText: operatingRules(input.workdir),
  };
  return { prompt, interp };
}
