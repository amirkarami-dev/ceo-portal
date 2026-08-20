import { useRef, useState } from "react";
import { Alert, Button, Drawer, Empty, Popconfirm, Space, Typography, theme } from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  FileOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { ApiError } from "../../lib/api";
import {
  useDeleteRoomFile,
  useDownloadRoomFile,
  useRoomFiles,
  useUploadRoomFile,
} from "../../lib/queries";
import { MAX_FILE_BYTES, fileSize, type RoomFile } from "../../lib/types";

const WHEN = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeZone: "Asia/Tehran" });

/**
 * Every control here is at least this tall.
 *
 * 44px is the touch-target floor, and an icon-only button is exactly the control that gets shipped at
 * 32px and then mis-tapped on a phone — next to a delete button, which makes a mis-tap expensive.
 */
const TAP = 44;

/**
 * The Persian sentence for a failure, whatever kind it was.
 *
 * `error instanceof ApiError` alone is not enough here. A phone that loses its connection makes
 * `fetch` reject with a plain `TypeError`, which is not an `ApiError` — so a panel that only rendered
 * `ApiError` would answer a tapped download with absolutely nothing, and the person would tap again.
 * Measured, not guessed: with the API stopped, pressing دریافت produced zero alerts.
 *
 * The raw message is only shown for an `ApiError`, because only those are written for a person to
 * read; a `TypeError`'s message is "Failed to fetch".
 */
function reason(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return error.message;
  return "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.";
}

/**
 * The handouts attached to one meeting.
 *
 * Reading is open to anyone who may be in the meeting; adding and removing follow the same rule as the
 * microphone, which the server decides and sends as `canManage`. That flag only shapes what is drawn —
 * every request is checked again on the server, and a person who edited it out of the response would
 * get the same Persian refusal from the endpoint.
 *
 * There is no motion inside this panel. The drawer is already sliding in; a staggered list arriving on
 * top of that is two moving things in one view, and the second one only makes the first harder to read.
 */
export function RoomFilesPanel({
  roomId,
  roomName,
  canManage,
  open,
  onClose,
}: {
  roomId: number;
  roomName: string;
  canManage: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const { token } = theme.useToken();
  const { data, isLoading, error } = useRoomFiles(roomId, open);
  const upload = useUploadRoomFile(roomId);
  const remove = useDeleteRoomFile(roomId);
  const download = useDownloadRoomFile();

  const pickerRef = useRef<HTMLInputElement | null>(null);
  const [tooBig, setTooBig] = useState<string | null>(null);

  const files = data ?? [];

  /**
   * Closing clears every failure this panel is holding.
   *
   * Without it the errors outlive the visit: close the panel after a failed upload, come back later,
   * and «فایل اضافه نشد» is still sitting there about a file the person has already walked away from.
   * The Drawer calls this for the X, the mask and Escape alike, so one place covers every way out.
   */
  const close = () => {
    upload.reset();
    remove.reset();
    download.reset();
    setTooBig(null);
    onClose();
  };

  const pick = (file: File | undefined) => {
    if (!file) return;

    // Refused here first, with the SERVER'S sentence. Sending it anyway would mean waiting out the
    // whole upload on a phone connection to be told what we already knew before it started.
    if (file.size > MAX_FILE_BYTES) {
      setTooBig("حجم فایل بیش از حد مجاز است (حداکثر ۲۰ مگابایت)");
      return;
    }

    setTooBig(null);
    upload.mutate(file);
  };

  return (
    <Drawer
      title="فایل‌های جلسه"
      placement="left"
      open={open}
      onClose={close}
      // A fixed width would overflow a 375px phone and give the page a sideways scroll.
      width="min(400px, 100%)"
      styles={{ body: { paddingTop: 12 } }}
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
        {roomName}
      </Typography.Paragraph>

      {canManage && (
        <>
          <input
            ref={pickerRef}
            type="file"
            hidden
            onChange={(e) => {
              pick(e.target.files?.[0]);
              // Cleared so that picking the SAME file again still fires `change`. Without this, a
              // failed upload cannot be retried from the picker.
              e.target.value = "";
            }}
          />
          <Button
            icon={<UploadOutlined />}
            block
            loading={upload.isPending}
            onClick={() => pickerRef.current?.click()}
            style={{ height: TAP, marginBottom: 12 }}
          >
            افزودن فایل
          </Button>
        </>
      )}

      {tooBig && (
        <Alert type="error" showIcon message={tooBig} style={{ marginBottom: 12 }} />
      )}

      {upload.error != null && (
        <Alert
          type="error"
          showIcon
          message="فایل اضافه نشد"
          description={reason(upload.error)}
          style={{ marginBottom: 12 }}
        />
      )}

      {remove.error != null && (
        <Alert
          type="error"
          showIcon
          message="فایل حذف نشد"
          description={reason(remove.error)}
          style={{ marginBottom: 12 }}
        />
      )}

      {download.error != null && (
        <Alert
          type="error"
          showIcon
          message="فایل دریافت نشد"
          description={reason(download.error)}
          style={{ marginBottom: 12 }}
        />
      )}

      {isLoading && <Typography.Text type="secondary">در حال بارگذاری…</Typography.Text>}

      {/* `error && !files.length`, not `error` alone: react-query keeps the last good data and still
          sets `error` when a BACKGROUND refetch fails, so gating on the error by itself would replace
          a working list with a warning the moment the network hiccuped. */}
      {error && files.length === 0 && (
        <Alert
          type="warning"
          showIcon
          message="فهرست فایل‌ها بارگذاری نشد"
          description={reason(error)}
        />
      )}

      {!isLoading && !error && files.length === 0 && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            canManage
              ? "هنوز فایلی اضافه نشده است. با دکمهٔ بالا فایل اضافه کنید."
              : "برای این جلسه فایلی گذاشته نشده است."
          }
        />
      )}

      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        {files.map((file: RoomFile) => (
          <div
            key={file.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: 10,
              borderRadius: 10,
              background: token.colorFillQuaternary,
            }}
          >
            <FileOutlined style={{ color: token.colorTextSecondary }} />

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* A file name can be one long unbroken word; without this it pushes the buttons out
                  of the drawer instead of wrapping. */}
              <div style={{ fontSize: 13, overflowWrap: "anywhere" }}>{file.fileName}</div>
              <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
                {fileSize(file.sizeBytes)} — {WHEN.format(new Date(file.uploadedAtUtc))}
              </div>
            </div>

            <Button
              type="text"
              icon={<DownloadOutlined />}
              aria-label={`دریافت ${file.fileName}`}
              loading={download.isPending && download.variables?.id === file.id}
              onClick={() => download.mutate(file)}
              style={{ width: TAP, height: TAP, flex: "none" }}
            />

            {canManage && (
              <Popconfirm
                title="این فایل حذف شود؟"
                description="پس از حذف قابل بازیابی نیست."
                okText="حذف"
                okButtonProps={{ danger: true }}
                cancelText="انصراف"
                onConfirm={() => remove.mutate(file.id)}
              >
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={`حذف ${file.fileName}`}
                  loading={remove.isPending && remove.variables === file.id}
                  style={{ width: TAP, height: TAP, flex: "none" }}
                />
              </Popconfirm>
            )}
          </div>
        ))}
      </Space>
    </Drawer>
  );
}
