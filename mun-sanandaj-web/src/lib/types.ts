export type MunWorkerType = "SaveEngineerReport" | "SaveEngMap";
export type MunRunStatus = "Running" | "Completed" | "Failed";
export type MunLogStatus = "Success" | "Failed";

export interface MunSyncRunDto {
  runId: string;
  workerType: MunWorkerType;
  startedAt: string;
  completedAt: string | null;
  status: MunRunStatus;
  totalRows: number;
  successCount: number;
  failedCount: number;
  triggeredBy: "Timer" | "Manual";
  triggeredByUser: string | null;
}

export interface MunReportLogDto {
  id: number;
  peygiri: string;
  projectNo: string;
  reqId: string;
  nosazi: string | null;
  status: MunLogStatus;
  attemptNumber: number;
  remoteSubmissionId: string | null;
  errorMessage: string | null;
  createdEngineerCodes: string | null;
  startedAt: string;
  completedAt: string;
}

export interface MunRunDetailDto {
  run: MunSyncRunDto;
  logs: MunReportLogDto[];
}

export interface MunReportLogPageDto {
  items: MunReportLogDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LogsFilter {
  workerType?: MunWorkerType;
  status?: MunLogStatus;
  peygiri?: string;
  projectNo?: string;
  page?: number;
  pageSize?: number;
}

export const RUN_STATUS_LABEL: Record<MunRunStatus, string> = {
  Running: "در حال اجرا",
  Completed: "تکمیل‌شده",
  Failed: "ناموفق",
};

export const LOG_STATUS_LABEL: Record<MunLogStatus, string> = {
  Success: "موفق",
  Failed: "ناموفق",
};
