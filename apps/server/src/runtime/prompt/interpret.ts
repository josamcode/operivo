import type { ArtifactType, TaskType } from '@opervio/contracts';

export interface TaskInput {
  title: string;
  objective: string;
  taskType: string;
  deliverable: string;
  successCriteria: string[];
  expectedOutputs: string[];
}

export interface Interpretation {
  taskType: TaskType;
  complexity: 1 | 2 | 3;
  expectedOutputs: ArtifactType[];
  needs: { web: boolean; browser: boolean; python: boolean; code: boolean; records: boolean };
  /** Text used to retrieve relevant memories/outputs. */
  searchText: string;
}

const OUTPUT_HINTS: [RegExp, ArtifactType][] = [
  [/\b(xlsx|excel|spreadsheet|workbook)\b|شيت|اكسل/i, 'xlsx'],
  [/\bcsv\b/i, 'csv'],
  [/\b(pptx|powerpoint|presentation|slides?|deck)\b|عرض تقديمي/i, 'pptx'],
  [/\b(docx|word document|word file)\b/i, 'docx'],
  [/\bpdf\b/i, 'pdf'],
  [/\b(chart|graph|plot|infographic|png|image)\b/i, 'image'],
];

const BASE_COMPLEXITY: Record<TaskType, 1 | 2 | 3> = {
  general: 1,
  planning: 1,
  writing: 2,
  learning: 1,
  content: 2,
  research: 2,
  lead_research: 2,
  analysis: 2,
  design: 2,
  coding: 2,
};

/** Task Interpreter: objective, task type, complexity and expected deliverable — deterministic and fast. */
export function interpretTask(task: TaskInput): Interpretation {
  const taskType = (task.taskType in BASE_COMPLEXITY ? task.taskType : 'general') as TaskType;
  const text = `${task.title}\n${task.objective}\n${task.deliverable}`;
  const explicit = task.expectedOutputs.filter(Boolean) as ArtifactType[];
  const inferred = OUTPUT_HINTS.filter(([re]) => re.test(`${task.deliverable} ${task.title}`)).map(([, t]) => t);
  let expectedOutputs = [...new Set([...explicit, ...inferred])];
  if (!expectedOutputs.length && taskType !== 'coding' && /\b(script|plan|curriculum|report|brief|notes|outline|guide|list|summary|schedule)s?\b|خطة|منهج|سكريبت|تقرير/i.test(task.deliverable)) {
    expectedOutputs = ['md'];
  }

  let complexity: number = BASE_COMPLEXITY[taskType];
  if (task.successCriteria.length > 4 || task.objective.length > 700 || /\b(comprehensive|end-to-end|complex|full|entire|migrate|architecture)\b/i.test(text)) complexity++;
  if (/\b(quick|simple|short|small|draft|tiny|brief)\b/i.test(text)) complexity--;
  complexity = Math.max(1, Math.min(3, complexity));

  const needsBrowser =
    taskType === 'lead_research' ||
    /\b(linkedin|instagram|tiktok|facebook|twitter|x\.com|gmail|login|sign in|portal|form|dashboard|upload|book|apply|website)\b|لينكدان|انستجرام|تيك توك|موقع/i.test(text);
  const needsPython =
    expectedOutputs.some((t) => ['xlsx', 'csv', 'pptx', 'docx', 'pdf', 'image'].includes(t)) ||
    /\b(analy[sz]e|analysis|dataset|csv|excel|chart|statistic|forecast)\b/i.test(text);

  return {
    taskType,
    complexity: complexity as 1 | 2 | 3,
    expectedOutputs,
    needs: {
      web: taskType !== 'coding' || /\b(docs?|documentation|api|library|research)\b/i.test(text),
      browser: needsBrowser,
      python: needsPython,
      code: taskType === 'coding',
      records: taskType === 'lead_research' || /\b(leads?|prospects?|pipeline|tracker|list of|scripts|lessons|workouts|contacts)\b|عملاء|ليدز/i.test(text),
    },
    searchText: `${task.title} ${task.objective}`.slice(0, 1200),
  };
}
