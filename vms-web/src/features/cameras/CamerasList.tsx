import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntApp, Badge, Button, Card, Popconfirm, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import { DeleteOutlined, EditOutlined, PlayCircleOutlined, PlusOutlined, StopOutlined } from "@ant-design/icons";
import { PageHeader } from "../../components/PageHeader";
import { useCameras, useCities, useDeleteCamera, useSetCameraActive } from "../../lib/queries";
import type { CameraListItem } from "../../lib/types";
import { ApiError } from "../../lib/api";

const { Text } = Typography;

const ALL = "__all__";

/** «۲ ساعت پیش», or «هرگز» when the sweep has never reached it. */
function lastSeen(value: string | null): { label: string; tone: "success" | "warning" | "default" } {
  if (!value) return { label: "هنوز بررسی نشده", tone: "default" };

  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 10) return { label: "چند دقیقه پیش", tone: "success" };
  if (minutes < 60) return { label: `${minutes} دقیقه پیش`, tone: "warning" };

  const hours = Math.round(minutes / 60);
  if (hours < 24) return { label: `${hours} ساعت پیش`, tone: "warning" };
  return { label: `${Math.round(hours / 24)} روز پیش`, tone: "warning" };
}

export function CamerasList() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [city, setCity] = useState<string>(ALL);

  const cities = useCities();
  const cameras = useCameras(city === ALL ? undefined : city);
  const setActive = useSetCameraActive();
  const remove = useDeleteCamera();

  const fail = (e: unknown) => message.error(e instanceof ApiError ? e.message : "انجام نشد");

  const columns = [
    {
      title: "نام",
      dataIndex: "name",
      render: (_: unknown, row: CameraListItem) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.name}</Text>
          {/* The go2rtc stream name. Shown because it is what appears in the gateway's logs, and an
              admin chasing a dead tile needs to match the two up. */}
          <Text type="secondary" style={{ fontSize: 12 }} code>
            {row.streamKey}
          </Text>
        </Space>
      ),
    },
    { title: "شهر", dataIndex: "cityName", render: (v: string) => <Tag>{v}</Tag> },
    {
      title: "آدرس",
      render: (_: unknown, row: CameraListItem) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {row.host}:{row.rtspPort} · کانال {row.channel}
        </Text>
      ),
    },
    {
      title: "جریان اصلی",
      render: (_: unknown, row: CameraListItem) =>
        row.mainStreamId === null ? (
          <Tooltip title="پهنای باند محل دوربین اجازهٔ پخش جریان اصلی را نمی‌دهد؛ فقط زیرجریان قابل تماشاست">
            <Tag>ندارد</Tag>
          </Tooltip>
        ) : (
          <Tag color="blue">ids={row.mainStreamId}</Tag>
        ),
    },
    {
      title: "آخرین اتصال",
      render: (_: unknown, row: CameraListItem) => {
        const s = lastSeen(row.lastSeenUtc);
        return (
          <Space size={6}>
            <Badge status={s.tone === "success" ? "success" : s.tone === "warning" ? "warning" : "default"} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {s.label}
            </Text>
          </Space>
        );
      },
    },
    {
      title: "وضعیت",
      render: (_: unknown, row: CameraListItem) =>
        row.isActive ? <Tag color="green">فعال</Tag> : <Tag>غیرفعال</Tag>,
    },
    {
      title: "",
      align: "end" as const,
      render: (_: unknown, row: CameraListItem) => (
        <Space size={4}>
          <Tooltip title={row.isActive ? "غیرفعال کردن" : "فعال کردن"}>
            <Button
              size="small"
              type="text"
              icon={row.isActive ? <StopOutlined /> : <PlayCircleOutlined />}
              onClick={() =>
                setActive.mutate(
                  { id: row.id, isActive: !row.isActive },
                  { onError: fail },
                )
              }
            />
          </Tooltip>
          <Tooltip title="ویرایش">
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => navigate(`/admin/${row.id}`)} />
          </Tooltip>
          <Popconfirm
            title="این دوربین حذف شود؟"
            description="نام پخش آن دیگر استفاده نخواهد شد."
            okText="حذف"
            cancelText="انصراف"
            onConfirm={() => remove.mutate(row.id, { onError: fail })}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="مدیریت دوربین‌ها"
        subtitle="افزودن دوربین و تعیین شهر آن"
        extra={
          <Space wrap>
            <Select
              value={city}
              onChange={setCity}
              style={{ minWidth: 160 }}
              options={[
                { label: "همهٔ شهرها", value: ALL },
                ...(cities.data ?? []).map((c) => ({ label: `${c.name} (${c.cameraCount})`, value: c.code })),
              ]}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/admin/new")}>
              دوربین تازه
            </Button>
          </Space>
        }
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          loading={cameras.isPending}
          dataSource={cameras.data ?? []}
          columns={columns}
          pagination={false}
          // Without this a table with seven columns crushes itself on a phone instead of scrolling.
          scroll={{ x: "max-content" }}
        />
      </Card>
    </>
  );
}
