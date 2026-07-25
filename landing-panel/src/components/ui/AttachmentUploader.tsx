import { useRef, useState } from "react";
import { App, Button, List, Space, Tooltip, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import {
  DeleteOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileUnknownOutlined,
  FileWordOutlined,
  PaperClipOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import { errorMessage, mediaUrl } from "@/api/client";
import { mediaApi } from "@/api/endpoints";
import type { NewsAttachment } from "@/api/types";

/** Matches the API: pdf/doc/docx/xls/xlsx + images, 20 MB. */
const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif";

function iconFor(contentType: string, fileName: string): ReactNode {
  const t = (contentType || "").toLowerCase();
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (t.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext))
    return <FileImageOutlined style={{ color: "#0284c7" }} />;
  if (t.includes("pdf") || ext === "pdf") return <FilePdfOutlined style={{ color: "#dc2626" }} />;
  if (t.includes("word") || ["doc", "docx"].includes(ext))
    return <FileWordOutlined style={{ color: "#2563eb" }} />;
  if (t.includes("excel") || t.includes("spreadsheet") || ["xls", "xlsx"].includes(ext))
    return <FileExcelOutlined style={{ color: "#16a34a" }} />;
  return <FileUnknownOutlined />;
}

/** Persian-digit size, e.g. "۲٫۴ مگابایت". */
function formatSize(bytes: number): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت`;
  const kb = Math.max(1, Math.round(bytes / 1024));
  return `${kb.toLocaleString("fa-IR")} کیلوبایت`;
}

export interface AttachmentUploaderProps {
  value?: NewsAttachment[];
  onChange?: (value: NewsAttachment[]) => void;
  disabled?: boolean;
}

/**
 * Multi-file picker for news attachments. Uploads each file itself (POST /media) and keeps only
 * the returned reference, so the form value is a plain array that drops into
 * `<Form.Item name="attachments">`. List order is the display order on the site.
 */
export function AttachmentUploader({ value, onChange, disabled }: AttachmentUploaderProps) {
  const { message } = App.useApp();
  const [uploading, setUploading] = useState(0);

  const items = value ?? [];

  // Picking several files fires beforeUpload once per file, all closing over the SAME `value`.
  // Appending via a ref keeps every file instead of letting the last upload win.
  const latest = useRef<NewsAttachment[]>(items);
  latest.current = items;

  const push = (added: NewsAttachment) => {
    const next = [...latest.current, added];
    latest.current = next;
    onChange?.(next);
  };

  const removeAt = (index: number) => {
    const next = latest.current.filter((_, i) => i !== index);
    latest.current = next;
    onChange?.(next);
  };

  const beforeUpload: UploadProps["beforeUpload"] = async (file) => {
    if (file.size > MAX_BYTES) {
      message.error(`«${file.name}» بزرگ‌تر از ۲۰ مگابایت است`);
      return Upload.LIST_IGNORE;
    }
    setUploading((n) => n + 1);
    try {
      const result = await mediaApi.upload(file as File);
      push({
        url: result.url,
        fileName: result.originalName || file.name,
        contentType: result.contentType || file.type,
        sizeBytes: result.sizeBytes || file.size,
      });
      message.success(`«${file.name}» افزوده شد`);
    } catch (err) {
      message.error(errorMessage(err, `بارگذاری «${file.name}» ناموفق بود`));
    } finally {
      setUploading((n) => n - 1);
    }
    // We upload ourselves; never let AntD's XHR run.
    return Upload.LIST_IGNORE;
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={10}>
      <Upload
        accept={ACCEPT}
        multiple
        showUploadList={false}
        disabled={disabled || uploading > 0}
        beforeUpload={beforeUpload}
      >
        <Button icon={<UploadOutlined />} loading={uploading > 0} disabled={disabled}>
          {uploading > 0 ? `در حال بارگذاری (${uploading})…` : "افزودن پیوست"}
        </Button>
      </Upload>

      {items.length > 0 ? (
        <List
          size="small"
          bordered
          dataSource={items}
          renderItem={(a, index) => (
            <List.Item
              actions={[
                <Tooltip title="حذف پیوست" key="remove">
                  <Button
                    type="text"
                    danger
                    aria-label={`حذف ${a.fileName}`}
                    icon={<DeleteOutlined />}
                    disabled={disabled}
                    onClick={() => removeAt(index)}
                  />
                </Tooltip>,
              ]}
            >
              <List.Item.Meta
                avatar={iconFor(a.contentType, a.fileName)}
                title={
                  <a href={mediaUrl(a.url)} target="_blank" rel="noreferrer">
                    {a.fileName}
                  </a>
                }
                description={
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {formatSize(a.sizeBytes)}
                  </Typography.Text>
                }
              />
            </List.Item>
          )}
        />
      ) : (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          <PaperClipOutlined /> پیوستی افزوده نشده است — PDF / Word / Excel / تصویر، حداکثر ۲۰ مگابایت
        </Typography.Text>
      )}
    </Space>
  );
}
