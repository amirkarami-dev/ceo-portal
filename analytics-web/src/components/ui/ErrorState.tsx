import { Button, Result } from "antd";
import type { ReactNode } from "react";

export function ErrorState({
  title = "خطایی رخ داد",
  detail,
  onRetry,
}: {
  title?: ReactNode;
  detail?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <Result
      status="error"
      title={title}
      subTitle={detail}
      extra={onRetry ? <Button onClick={onRetry}>تلاش دوباره</Button> : undefined}
    />
  );
}
