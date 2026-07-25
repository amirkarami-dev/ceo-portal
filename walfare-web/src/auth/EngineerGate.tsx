import { Button, Result, Skeleton, Space } from "antd";
import { Outlet, useNavigate } from "react-router-dom";
import { ApiError } from "@/api/client";
import { walfareApi } from "@/api/walfareApi";
import { queryKeys, useApiQuery } from "@/query";
import { useAuth } from "./useAuth";
import { ErrorState } from "@/components/ui";

/**
 * True when the API said "this account has no engineer record": a 400 whose validation error
 * sits on NationalCode. Checked precisely so a network blip is NOT reported as "not an engineer".
 */
function isNotEngineerError(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 400) return false;
  return Object.keys(err.problem?.errors ?? {}).some((k) =>
    k.toLowerCase().endsWith("nationalcode"),
  );
}

/**
 * Guards the engineer-facing pages. Welfare tickets are issued against the org membership
 * record, which is looked up by the account's کد ملی — so a staff account (username = "admin1")
 * has no engineer record and can never complete a booking. Say so up front instead of letting
 * the engineer flow dead-end with a 400 at reserve time.
 */
export function EngineerGate() {
  const navigate = useNavigate();
  const { isAdmin, logout } = useAuth();
  const me = useApiQuery(queryKeys.me.get(), walfareApi.me);

  if (me.isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;

  if (isNotEngineerError(me.error)) {
    return (
      <Result
        status="info"
        title="این حساب، حساب مهندس نیست"
        subTitle="رزرو خدمات رفاهی فقط با حساب مهندس (ورود با کد ملی و کد پیامکی) امکان‌پذیر است؛ برای این حساب پرونده عضویتی در سازمان یافت نشد."
        extra={
          <Space wrap>
            {isAdmin ? (
              <Button type="primary" onClick={() => navigate("/admin")}>
                رفتن به بخش مدیریت
              </Button>
            ) : null}
            <Button onClick={logout}>ورود با کد ملی</Button>
          </Space>
        }
      />
    );
  }

  if (me.error) {
    return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;
  }

  return <Outlet />;
}
