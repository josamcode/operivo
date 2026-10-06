import type {
  AgentStatus,
  ArtifactType,
  ConcreteEffort,
  Effort,
  FocusKind,
  Language,
  MemoryKind,
  ProviderId,
  RunStatus,
  TaskStatus,
  TaskType,
} from './common';
import type { Aggregate, DataSource, PageSpec } from './page';
import type { CompiledPrompt, JudgeVerdict } from './prompt';
import type { CollectionDef, FieldDef } from './records';
import type { AiSettings, Autonomy, CommStyle, ToolSettings } from './setup';

export interface FounderDTO {
  id: string;
  name: string;
  language: Language;
  work: string;
  timeAvailable: string;
  links: { github?: string; website?: string; social?: string };
  commStyle: CommStyle;
  autonomy: Autonomy;
  alwaysAsk: string[];
  timezone: string;
}

export interface BootstrapDTO {
  setupComplete: boolean;
  founder: FounderDTO | null;
  nav: NavItemDTO[];
  unreadNotifications: number;
}

export interface NavItemDTO {
  slug: string;
  title: string;
  icon: string;
  focusKind: FocusKind | null;
  activeAgents: number;
}

export interface FocusDTO {
  id: string;
  key: string;
  name: string;
  kind: FocusKind;
  why: string;
  cadence: string | null;
  status: 'active' | 'paused' | 'done';
  pageSlug: string | null;
  icon: string | null;
}

export interface PageDTO {
  id: string;
  slug: string;
  title: string;
  icon: string;
  description: string | null;
  focus: FocusDTO | null;
  spec: PageSpec;
  collections: CollectionDef[];
  updatedAt: string;
}

export interface RunProgress {
  label: string;
  current?: number;
  total?: number;
}

export interface RunBriefDTO {
  id: string;
  status: RunStatus;
  provider: ProviderId;
  model: string;
  effort: ConcreteEffort;
  attempt: number;
  startedAt: string;
  finishedAt: string | null;
  progress: RunProgress | null;
  lastActivity: string | null;
  costUsd: number | null;
}

export interface AgentDTO {
  id: string;
  name: string;
  role: string;
  provider: ProviderId | 'auto';
  model: string;
  effort: Effort;
  status: AgentStatus;
  focus: { id: string; name: string; pageSlug: string | null } | null;
  createdAt: string;
  task: TaskBriefDTO | null;
  run: RunBriefDTO | null;
  stats: { done: number; outputs: number };
}

export interface TaskBriefDTO {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface TaskDTO {
  id: string;
  title: string;
  objective: string;
  taskType: TaskType;
  deliverable: string;
  successCriteria: string[];
  expectedOutputs: ArtifactType[];
  status: TaskStatus;
  agent: { id: string; name: string; role: string } | null;
  focus: { id: string; name: string } | null;
  attempts: number;
  summary: string | null;
  verdict: JudgeVerdict | null;
  createdAt: string;
  updatedAt: string;
}

export type RunEventKind = 'status' | 'progress' | 'tool' | 'text' | 'file' | 'judge' | 'error' | 'blocked' | 'note';

export interface RunEventDTO {
  id: string;
  runId: string;
  ts: string;
  kind: RunEventKind;
  label: string;
  detail: unknown;
}

export interface RunDTO extends RunBriefDTO {
  taskId: string;
  agentId: string;
  prompt: CompiledPrompt | null;
  result: string | null;
  error: string | null;
  verdict: JudgeVerdict | null;
  toolsUsed: string[];
  events: RunEventDTO[];
  outputs: ArtifactDTO[];
}

export interface AgentDetailDTO extends AgentDTO {
  objective: string;
  tasks: TaskDTO[];
  runs: RunBriefDTO[];
  latestRun: RunDTO | null;
}

export type ArtifactPreview =
  | { kind: 'table'; columns: string[]; rows: string[][]; totalRows?: number; sheet?: string }
  | { kind: 'text'; text: string; language?: string; truncated?: boolean }
  | { kind: 'image' }
  | { kind: 'pdf'; pages?: number }
  | { kind: 'none' };

export interface ArtifactDTO {
  id: string;
  title: string;
  type: ArtifactType;
  path: string;
  fileName: string;
  sizeBytes: number;
  summary: string | null;
  agent: { id: string; name: string } | null;
  task: { id: string; title: string } | null;
  focus: { id: string; name: string; pageSlug: string | null } | null;
  createdAt: string;
  exists: boolean;
}

export interface ArtifactDetailDTO extends ArtifactDTO {
  preview: ArtifactPreview;
}

export interface DecisionOption {
  id: string;
  label: string;
  description?: string;
}

export interface DecisionDTO {
  id: string;
  kind: 'plan' | 'approval' | 'question';
  title: string;
  recommendation: string | null;
  why: string | null;
  options: DecisionOption[];
  details: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  choice: string | null;
  note: string | null;
  payload: unknown;
  agent: { id: string; name: string } | null;
  focus: { id: string; name: string } | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface MemoryDTO {
  id: string;
  kind: MemoryKind;
  content: string;
  source: string;
  scope: string;
  focus: { id: string; name: string } | null;
  createdAt: string;
}

export type MessageRef =
  | { kind: 'decision'; id: string }
  | { kind: 'page'; slug: string; title: string }
  | { kind: 'agent'; id: string; name: string }
  | { kind: 'output'; id: string; title: string };

export interface MessageDTO {
  id: string;
  role: 'founder' | 'noor' | 'system';
  content: string;
  status: 'streaming' | 'done' | 'error';
  activity: string[];
  refs: MessageRef[];
  createdAt: string;
}

export interface TodayItemDTO {
  id: string;
  title: string;
  minutes: number | null;
  done: boolean;
  focus: { id: string; name: string } | null;
}

export interface TodayDTO {
  date: string;
  note: string | null;
  items: TodayItemDTO[];
}

export interface NotificationDTO {
  id: string;
  kind: 'action' | 'decision' | 'completed' | 'failed' | 'reminder';
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface RoutineDTO {
  id: string;
  title: string;
  schedule: string;
  kind: 'reminder' | 'noor' | 'task';
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  focus: { id: string; name: string } | null;
}

export interface ProviderStatusDTO {
  id: ProviderId;
  label: string;
  available: boolean;
  version: string | null;
  error: string | null;
  efforts: ConcreteEffort[];
  models: { id: string; label: string }[];
}

export interface ToolStatusDTO {
  browser: { channel: string; available: boolean; signedIn: boolean; signInOpen: boolean };
  python: { available: boolean; version: string | null; venv: boolean; packages: string[]; installing: boolean; error: string | null };
  git: { available: boolean; version: string | null };
  workspaceDir: string;
}

export interface SettingsDTO {
  founder: FounderDTO;
  ai: AiSettings;
  tools: ToolSettings;
  providers: ProviderStatusDTO[];
  toolStatus: ToolStatusDTO;
  routines: RoutineDTO[];
}

export interface FocusSummaryDTO extends FocusDTO {
  headline: { label: string; value: string }[];
  activeAgents: number;
  openTasks: number;
  doneTasks: number;
  outputs: number;
}

export interface HomeDTO {
  founder: FounderDTO;
  today: TodayDTO;
  agents: AgentDTO[];
  focuses: FocusSummaryDTO[];
  decisions: DecisionDTO[];
  outputs: ArtifactDTO[];
  progress: { date: string; tasksDone: number; outputs: number }[];
  counts: { activeAgents: number; tasksDoneThisWeek: number; outputsThisWeek: number };
}

/** Every data source resolves into the same tabular shape so every section can render any source. */
export interface DataRow {
  id: string;
  _kind: 'record' | 'task' | 'output' | 'agent' | 'decision' | 'memory' | 'activity' | 'metric';
  [field: string]: unknown;
}

export interface DataResult {
  fields: FieldDef[];
  rows: DataRow[];
  titleField: string;
  statusField?: string;
  dateField?: string;
  collection?: CollectionDef;
  missing?: string;
}

export interface DataQuery {
  focusId?: string | null;
  source: DataSource;
}

export interface AggregateQuery {
  focusId?: string | null;
  aggregate: Aggregate;
}

export interface SeriesResult {
  points: { t: string; v: number }[];
  latest: number | null;
}

export type ServerEvent =
  | { type: 'invalidate'; keys: string[] }
  | { type: 'message.delta'; messageId: string; text: string }
  | { type: 'message.activity'; messageId: string; label: string }
  | { type: 'run.event'; runId: string; agentId: string; event: RunEventDTO }
  | { type: 'notification'; notification: NotificationDTO };
