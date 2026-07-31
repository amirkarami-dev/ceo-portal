import { Input, Space, Typography, theme } from "antd";
import { CheckCircleFilled, ExclamationCircleFilled, LoadingOutlined } from "@ant-design/icons";
import { useRoomPerson } from "../../lib/queries";
import { toAsciiDigits } from "../../lib/types";
import { ApiError } from "../../lib/api";

/**
 * A کد ملی box that shows whose it is.
 *
 * The API refuses any presenter or invite that is not a real کد ملی in the organisation's directory —
 * so a plain ten-digit input would be a slow way to discover a typo, one failed save at a time. This
 * asks the moment ten digits are present and shows the name underneath.
 *
 * The check is a convenience, never the gate. The server looks the person up again on save, so a
 * stale or skipped lookup here cannot let a bad code through.
 */
export function PersonField({
  value,
  onChange,
  placeholder,
  disabled,
  autoFocus,
}: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const { token } = theme.useToken();
  const code = (value ?? "").trim();
  const { data, error, isFetching } = useRoomPerson(code);

  const resolved = code.length === 10 && data ? data.fullName : null;

  return (
    <Space direction="vertical" size={2} style={{ width: "100%" }}>
      <Input
        className="mono"
        value={value}
        // Persian digits are normal to type on an Iranian keyboard and the API compares کد ملی
        // exactly, so «۵۵۵…» must become "555…" before it is ever sent.
        onChange={(e) => onChange?.(toAsciiDigits(e.target.value).replace(/\D/g, "").slice(0, 10))}
        placeholder={placeholder ?? "کد ملی (۱۰ رقم)"}
        disabled={disabled}
        autoFocus={autoFocus}
        maxLength={10}
        inputMode="numeric"
        allowClear
      />

      {code.length === 10 && (
        <Typography.Text style={{ fontSize: 12 }}>
          {isFetching ? (
            <Space size={4}>
              <LoadingOutlined />
              <span style={{ color: token.colorTextSecondary }}>در حال بررسی…</span>
            </Space>
          ) : resolved ? (
            <Space size={4}>
              <CheckCircleFilled style={{ color: token.colorSuccess }} />
              <span>{resolved}</span>
            </Space>
          ) : (
            <Space size={4}>
              <ExclamationCircleFilled style={{ color: token.colorError }} />
              <span style={{ color: token.colorError }}>
                {error instanceof ApiError ? error.message : "این کد ملی شناخته نشد"}
              </span>
            </Space>
          )}
        </Typography.Text>
      )}
    </Space>
  );
}
