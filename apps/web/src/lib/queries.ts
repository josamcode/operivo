import type {
  AgentDetailDTO,
  AgentDTO,
  Aggregate,
  ArtifactDetailDTO,
  ArtifactDTO,
  BootstrapDTO,
  DataResult,
  DataSource,
  DecisionDTO,
  HomeDTO,
  MemoryDTO,
  MessageDTO,
  NotificationDTO,
  PageDTO,
  RunDTO,
  SeriesResult,
  SettingsDTO,
} from '@opervio/contracts';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const useBootstrap = () => useQuery({ queryKey: ['bootstrap'], queryFn: () => api.get<BootstrapDTO>('/api/bootstrap') });
export const useHome = () => useQuery({ queryKey: ['home'], queryFn: () => api.get<HomeDTO>('/api/home') });
export const usePage = (slug: string) => useQuery({ queryKey: ['page', slug], queryFn: () => api.get<PageDTO>(`/api/pages/${slug}`) });
export const useMessages = () => useQuery({ queryKey: ['messages'], queryFn: () => api.get<MessageDTO[]>('/api/messages?limit=80') });
export const useAgents = () => useQuery({ queryKey: ['agents'], queryFn: () => api.get<AgentDTO[]>('/api/agents') });
export const useAgent = (id: string | null | undefined) =>
  useQuery({ queryKey: ['agent', id], queryFn: () => api.get<AgentDetailDTO>(`/api/agents/${id}`), enabled: Boolean(id) });
export const useRun = (id: string | null | undefined) => useQuery({ queryKey: ['run', id], queryFn: () => api.get<RunDTO>(`/api/runs/${id}`), enabled: Boolean(id) });
export const useOutputs = (params: { q?: string; type?: string; focusId?: string } = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return useQuery({ queryKey: ['outputs', params], queryFn: () => api.get<ArtifactDTO[]>(`/api/outputs${qs ? `?${qs}` : ''}`), placeholderData: keepPreviousData });
};
export const useOutput = (id: string | null | undefined) =>
  useQuery({ queryKey: ['output', id], queryFn: () => api.get<ArtifactDetailDTO>(`/api/outputs/${id}`), enabled: Boolean(id) });
export const useDecisions = () => useQuery({ queryKey: ['decisions'], queryFn: () => api.get<DecisionDTO[]>('/api/decisions') });
export const useDecision = (id: string | null | undefined) =>
  useQuery({ queryKey: ['decision', id], queryFn: () => api.get<DecisionDTO>(`/api/decisions/${id}`), enabled: Boolean(id) });
export const useNotifications = () => useQuery({ queryKey: ['notifications'], queryFn: () => api.get<NotificationDTO[]>('/api/notifications') });
export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => api.get<SettingsDTO>('/api/settings') });
export const useMemories = (q?: string) =>
  useQuery({ queryKey: ['memories', q ?? ''], queryFn: () => api.get<MemoryDTO[]>(`/api/memories${q ? `?q=${encodeURIComponent(q)}` : ''}`) });

export const useData = (source: DataSource, focusId: string | null | undefined) =>
  useQuery({
    queryKey: ['data', focusId ?? null, source],
    queryFn: () => api.post<DataResult>('/api/data', { focusId, source }),
    placeholderData: keepPreviousData,
  });

export const useAggregate = (aggregate: Aggregate | undefined, focusId: string | null | undefined) =>
  useQuery({
    queryKey: ['aggregate', focusId ?? null, aggregate],
    queryFn: () => api.post<{ value: number | null }>('/api/data/aggregate', { focusId, aggregate }),
    enabled: Boolean(aggregate),
  });

export const useMetric = (key: string | undefined, range: string = '30d') =>
  useQuery({ queryKey: ['metric', key, range], queryFn: () => api.get<SeriesResult>(`/api/metrics/${key}?range=${range}`), enabled: Boolean(key) });

export function useSendToNoor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.post<{ founderMessageId: string; noorMessageId: string }>('/api/messages', { text }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
  });
}

export function useResolveDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; choice: string; note?: string }) => api.post(`/api/decisions/${v.id}/resolve`, { choice: v.choice, note: v.note }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['decisions'] });
      void qc.invalidateQueries({ queryKey: ['home'] });
      void qc.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}
