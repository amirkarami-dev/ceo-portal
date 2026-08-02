import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntApp, Badge, Button, Card, Popconfirm, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import { DeleteOutlined, EditOutlined, PlayCircleOutlined, PlusOutlined, StopOutlined } from "@ant-design/icons";
import { PageHeader } from "../../components/PageHeader";
import { useCameras, useCities, useDeleteCamera, useSetCameraActive } from "../../lib/queries";
import type { ColumnsType } from "antd/es/table";
import type { CameraListItem } from "../../lib/types";
import { ApiError } from "../../lib/api";
import { lastSeenInfo } from "../../lib/lastSeen";

const { Text } = Typography;

const ALL = "__all__";

export function CamerasList() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [city, setCity] = useState<string>(ALL);

  const cities = useCities();
  const cameras = useCameras(city === ALL ? undefined : city);
  const setActive = useSetCameraActive();
  const remove = useDeleteCamera();

  const fail = (e: unknown) => message.error(e instanceof ApiError ? e.message : "انجام نشد");

  const columns: ColumnsType<CameraListItem> = [
    {
      title: "نام",
      dataIndex: "name",
      // Bounded, or a long camera name widens the whole table on a phone. max-content sizing is
      // what makes an AntD table grow to fit its longest cell.
      ellipsis: true,
      width: 220,
      render: (_: unknown, row: CameraListItem) => (
        <Space direction="vertical" size={0} style={{ maxWidth: "100%" }}>
          <Text strong ellipsis={{ tooltip: row.name }}>
            {row.name}
          </Text>
          {/* The go2rtc stream name. Shown because it is what appears in the gateway's logs, and an
              admin chasing a dead tile needs to match the two up.
              The city rides along here so the شهر column can be dropped on a phone without losing
              it — seven columns in a 325px window is a table nobody reads. */}
          <Text type="secondary" style={{ fontSize: 12 }}>
            <span style={{ fontFamily: "monospace" }}>{row.streamKey}</span>
            <span className="only-narrow"> · {row.cityName}</span>
            {/* The وضعیت column is hidden below sm. "Active" is the unremarkable default, so only
                the exception needs carrying — an admin scanning a phone has to be able to see that
                a camera is switched off. */}
            {!row.isActive && <span className="only-narrow"> · غیرفعال</span>}
          </Text>
        </Space>
      ),
    },
    {
      title: "شهر",
      dataIndex: "cityName",
      responsive: ["md"],
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: "آدرس",
      responsive: ["lg"],
      render: (_: unknown, row: CameraListItem) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {row.host}:{row.rtspPort} · کانال {row.channel}
        </Text>
      ),
    },
    {
      title: "جریان اصلی",
      responsive: ["lg"],
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
        const s = lastSeenInfo(row.lastSeenUtc);
        return (
          <Space size={6}>
            {/* "never checked" is grey, not red: it means the sweep has not reached this camera
                yet, which is not the same as the camera being down. */}
            <Badge
              status={
                s.freshness === "fresh"
                  ? "success"
                  : s.freshness === "never"
                    ? "default"
                    : s.freshness === "stale"
                      ? "warning"
                      : "error"
              }
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {s.label}
            </Text>
          </Space>
        );
      },
    },
    {
      title: "وضعیت",
      responsive: ["sm"],
      render: (_: unknown, row: CameraListItem) =>
        row.isActive ? <Tag color="green">فعال</Tag> : <Tag>غیرفعال</Tag>,
    },
    {
      title: "",
      align: "end",
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
