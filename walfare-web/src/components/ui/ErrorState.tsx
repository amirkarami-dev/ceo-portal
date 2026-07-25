import { Button, Result } from "antd";
import type { ReactNode } from "react";
import { errorMessage } from "@/api/client";

export interface ErrorStateProps {
  title?: ReactNode;
  /** Explicit detail text. Ignored when `error` is given. */
  detail?: ReactNode;
  /** The thrown value (usually an ApiError) — the message is derived from it. */
  error?: unknown;
  onRetry?: () => void;
}

export function ErrorState({ title = "خطایی رخ داد", detail, error, onRetry }: ErrorStateProps) {
  const subTitle = error !== undefined && error !== null ? errorMessage(error) : detail;
  return (
    <Result
      status="error"
      title={title}
      subTitle={subTitle}
      extra={onRetry ? <Button onClick={onRetry}>تلاش دوباره</Button> : undefined}
    />
  );
}
