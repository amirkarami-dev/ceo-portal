import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";
import type { LogsFilter, MunReportLogPageDto, MunRunDetailDto, MunSyncRunDto, MunWorkerType } from "./types";

/** Polls fast (5s) so the dashboard reads as "live"; TanStack Query pauses polling while the tab is hidden. */
export function useRuns() {
  return useQuery({
    queryKey: ["mun-runs"],
    queryFn: () => apiGet<MunSyncRunDto[]>("/api/MunSanandaj/Runs"),
    refetchInterval: (query) => (query.state.data?.some((r) => r.status === "Running") ? 5_000 : 30_000),
  });
}

export function useRunDetail(runId: string | undefined) {
  return useQuery({
    queryKey: ["mun-run", runId],
    queryFn: () => apiGet<MunRunDetailDto>(`/api/MunSanandaj/Runs/${runId}`),
    enabled: !!runId,
    refetchInterval: (query) => (query.state.data?.run.status === "Running" ? 5_000 : false),
  });
}

export function useTriggerRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workerType: MunWorkerType) => apiPost<MunSyncRunDto>(`/api/MunSanandaj/Runs/${workerType}/trigger`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mun-runs"] }),
  });
}

export function useLogs(filter: LogsFilter) {
  const params = new URLSearchParams();
  if (filter.workerType) params.set("workerType", filter.workerType);
  if (filter.status) params.set("status", filter.status);
  if (filter.peygiri) params.set("peygiri", filter.peygiri);
  if (filter.projectNo) params.set("projectNo", filter.projectNo);
  params.set("page", String(filter.page ?? 1));
  params.set("pageSize", String(filter.pageSize ?? 50));

  return useQuery({
    queryKey: ["mun-logs", filter],
    queryFn: () => apiGet<MunReportLogPageDto>(`/api/MunSanandaj/Logs?${params.toString()}`),
  });
}
