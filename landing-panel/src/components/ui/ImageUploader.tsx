import { useState } from "react";
import { App, Button, Flex, Input, Space, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import { DeleteOutlined, LoadingOutlined, PictureOutlined, UploadOutlined } from "@ant-design/icons";
import { errorMessage, mediaUrl } from "@/api/client";
import { mediaApi } from "@/api/endpoints";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MAX_BYTES = 5 * 1024 * 1024;

export interface ImageUploaderProps {
  /** Current stored reference: an uploaded "/api/kurdnezam/media/…" URL or a plain site path. */
  value?: string | null;
  /** Fires with the new reference (or undefined when cleared). Form.Item wires this for you. */
  onChange?: (value: string | undefined) => void;
  disabled?: boolean;
  /** Preview height in px. */
  height?: number;
  /**
   * Show the raw path box. OFF by default: uploads now land in object storage under an opaque
   * key like "/api/kurdnezam/media/8675a2b0….jpg", which means nothing to an editor and breaks
   * the image if hand-edited. Turn it on only where someone must paste a legacy "/images/…" path.
   */
  allowPath?: boolean;
  placeholder?: string;
}

/**
 * Upload (POST /api/kurdnezam/media, field "file") and preview.
 * Value semantics are a plain string, so it drops straight into a `<Form.Item name="image">`.
 */
export function ImageUploader({
  value,
  onChange,
  disabled,
  height = 140,
  allowPath = false,
  placeholder = "/images/news/news-1.png",
}: ImageUploaderProps) {
  const { message } = App.useApp();
  const [uploading, setUploading] = useState(false);
  const [broken, setBroken] = useState(false);

  const src = mediaUrl(value);

  const beforeUpload: UploadProps["beforeUpload"] = async (file) => {
    if (file.size > MAX_BYTES) {
      message.error("حجم تصویر باید کمتر از ۵ مگابایت باشد");
      return Upload.LIST_IGNORE;
    }
    setUploading(true);
    try {
      const result = await mediaApi.upload(file as File);
      setBroken(false);
      onChange?.(result.url);
      message.success("تصویر بارگذاری شد");
    } catch (err) {
      message.error(errorMessage(err, "بارگذاری تصویر ناموفق بود"));
    } finally {
      setUploading(false);
    }
    // We upload ourselves; never let AntD's XHR run.
    return Upload.LIST_IGNORE;
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={8}>
      <Flex gap={12} align="flex-start" wrap>
        <div
          style={{
            width: height * 1.4,
            height,
            borderRadius: 8,
            border: "1px dashed var(--ant-color-border)",
            background: "var(--ant-color-fill-quaternary)",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            flex: "none",
          }}
        >
          {uploading ? (
            <LoadingOutlined style={{ fontSize: 22 }} />
          ) : src && !broken ? (
            <img
              src={src}
              alt="پیش‌نمایش تصویر"
              onError={() => setBroken(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Space direction="vertical" align="center" size={2}>
              <PictureOutlined style={{ fontSize: 22, color: "var(--ant-color-text-quaternary)" }} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {src && broken ? "پیش‌نمایش در دسترس نیست" : "بدون تصویر"}
              </Typography.Text>
            </Space>
          )}
        </div>

        <Space direction="vertical" size={8}>
          <Upload
            accept={ACCEPT}
            showUploadList={false}
            maxCount={1}
            disabled={disabled || uploading}
            beforeUpload={beforeUpload}
          >
            <Button icon={<UploadOutlined />} loading={uploading} disabled={disabled}>
              بارگذاری تصویر
            </Button>
          </Upload>
          {value ? (
            <Button
              danger
              type="text"
              icon={<DeleteOutlined />}
              disabled={disabled || uploading}
              onClick={() => {
                setBroken(false);
                onChange?.(undefined);
              }}
            >
              حذف تصویر
            </Button>
          ) : null}
          {/* The raw value is an opaque storage key, so say WHAT is set rather than showing it.
              Matters for legacy "/images/…" images, which this panel cannot preview at all. */}
          {value ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {value.startsWith("/api/")
                ? "✓ تصویر بارگذاری شده است"
                : `فایل سایت: ${value.split("/").pop()}`}
            </Typography.Text>
          ) : null}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            PNG / JPG / WebP / GIF — حداکثر ۲۰ مگابایت
          </Typography.Text>
        </Space>
      </Flex>

      {allowPath ? (
        <Input
          value={value ?? ""}
          disabled={disabled || uploading}
          placeholder={placeholder}
          allowClear
          onChange={(e) => {
            setBroken(false);
            const next = e.target.value;
            onChange?.(next === "" ? undefined : next);
          }}
        />
      ) : null}
    </Space>
  );
}
