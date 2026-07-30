import { useState } from "react";
import { App as AntApp, Avatar, Button, Space, Typography, Upload, theme } from "antd";
import { DeleteOutlined, LoadingOutlined, UploadOutlined, UserOutlined } from "@ant-design/icons";
import { ApiError, mediaUrl, uploadImage } from "../../lib/api";

/** What the server accepts. Kept in step with ElectionMedia.AllowedTypes. */
const ACCEPTED = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Picks a candidate photo, uploads it to object storage, and holds the returned path.
 *
 * Value is the stored path (`/api/ElectionMedia/….jpg`) — the same string the form already submitted
 * when this was a text box, so nothing downstream changes.
 *
 * The preview is a circle at the size the ballot uses, next to the initial that shows when there is no
 * photo. That pairing is the point: the admin sees what a voter will see, including the fact that
 * leaving it empty is a perfectly good outcome rather than a broken one.
 */
export function PhotoField({
  value,
  onChange,
  disabled,
  fallbackName,
}: {
  value?: string;
  onChange?: (v: string | null) => void;
  disabled?: boolean;
  /** Used for the initial shown when there is no photo. */
  fallbackName?: string;
}) {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const [busy, setBusy] = useState(false);

  const initial = fallbackName?.trim().charAt(0) || "؟";

  const upload = async (file: File) => {
    // Checked here as well as on the server: a 2 MB limit is worth catching before spending the
    // upload, and the server's answer would arrive after a long wait on a slow connection.
    if (file.size > MAX_BYTES) {
      message.error("حجم تصویر باید کمتر از ۲ مگابایت باشد");
      return;
    }

    setBusy(true);
    try {
      const media = await uploadImage(file);
      onChange?.(media.url);
      message.success("تصویر بارگذاری شد");
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : "بارگذاری تصویر انجام نشد");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Space align="center" size={12}>
      <Avatar
        size={56}
        src={value ? mediaUrl(value) : undefined}
        icon={!value && !fallbackName ? <UserOutlined /> : undefined}
        style={{
          background: value ? undefined : token.colorFillSecondary,
          color: token.colorTextSecondary,
          fontSize: 20,
          flex: "0 0 auto",
        }}
      >
        {!value && fallbackName ? initial : null}
      </Avatar>

      <Space direction="vertical" size={2}>
        <Space size={6}>
          <Upload
            accept={ACCEPTED}
            showUploadList={false}
            disabled={disabled || busy}
            // Return false so AntD never performs its own request — the file goes through
            // uploadImage(), which attaches the bearer token.
            beforeUpload={(file) => {
              void upload(file as File);
              return false;
            }}
          >
            <Button
              size="small"
              icon={busy ? <LoadingOutlined /> : <UploadOutlined />}
              disabled={disabled || busy}
            >
              {value ? "تغییر تصویر" : "انتخاب تصویر"}
            </Button>
          </Upload>

          {value && (
            <Button
              size="small"
              danger
              type="text"
              icon={<DeleteOutlined />}
              disabled={disabled || busy}
              // Clears the reference only. The object stays in storage: an election that has already
              // opened is frozen, and deleting a file a published ballot still points at would break
              // the card for every voter.
              onClick={() => onChange?.(null)}
            >
              حذف
            </Button>
          )}
        </Space>

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          اختیاری — PNG، JPG یا WebP، حداکثر ۲ مگابایت.
          {!value && " بدون تصویر، حرف اول نام نمایش داده می‌شود."}
        </Typography.Text>
      </Space>
    </Space>
  );
}
