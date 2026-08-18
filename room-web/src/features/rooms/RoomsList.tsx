import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  App as AntApp,
  Badge,
  Button,
  Card,
  Empty,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { PageHeader } from "../../components/PageHeader";
import { PhaseChip } from "../../components/PhaseChip";
import { describeSchedule } from "../../lib/schedule";
import { useNow } from "../../lib/useNow";
import {
  useDeleteRoom,
  useRegenerateLink,
  useRooms,
  useSetRoomActive,
} from "../../lib/queries";
import {
  JOIN_MODE_COLOURS,
  JOIN_MODE_LABELS,
  RoomJoinMode,
  TYPE_LABELS,
  fa,
  fromWireTime,
  type RoomListItem,
} from "../../lib/types";
import { ApiError } from "../../lib/api";

/**
 * Copies text without needing a secure context.
 *
 * `navigator.clipboard` is undefined on plain http, which is exactly how this app is reached in dev
 * (http://room.localhost:5277) — so the obvious one-liner throws on the one screen where copying is
 * the whole point. The textarea fallback works everywhere.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }

  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/** The join link with a copy button, right on the row. */
function JoinLinkCell({ row }: { row: RoomListItem }) {
  const { message } = AntApp.useApp();
  const [copied, setCopied] = useState(false);

  if (!row.joinUrl) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {/* Not an empty cell: "this meeting has no link" is a real answer, and an admin looking for a
            link to send needs to see why there isn't one. */}
        بدون لینک — {fa(row.inviteCount)} نفر دعوت شده
      </Typography.Text>
    );
  }

  return (
    <Space size={4}>
      <Typography.Text
        className="mono"
        style={{ fontSize: 12, maxWidth: 190, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle" }}
        title={row.joinUrl}
      >
        {row.joinUrl}
      </Typography.Text>
      <Tooltip title={copied ? "کپی شد" : "کپی لینک"}>
        <Button
          size="small"
          type={copied ? "primary" : "default"}
          icon={<CopyOutlined />}
          onClick={async () => {
            const ok = await copyText(row.joinUrl!);
            if (!ok) {
              message.error("کپی نشد؛ لینک را دستی انتخاب کنید");
              return;
            }
            setCopied(true);
            message.success("لینک کپی شد");
            window.setTimeout(() => setCopied(false), 2000);
          }}
        />
      </Tooltip>
    </Space>
  );
}

export function RoomsList() {
  const navigate = useNavigate();
  const { message, modal } = AntApp.useApp();
  const { data, isLoading } = useRooms();
  const now = useNow();

  const setActive = useSetRoomActive();
  const remove = useDeleteRoom();
  const regenerate = useRegenerateLink();

  /** Every refusal here has a Persian reason from the server; show it verbatim. */
  const fail = (e: unknown) => message.error(e instanceof ApiError ? e.message : "خطای غیرمنتظره");

  const columns = [
    {
      title: "جلسه",
      dataIndex: "name",
      render: (name: string, row: RoomListItem) => (
        <Space direction="vertical" size={0}>
          <Space size={6}>
            <Typography.Text strong>{name}</Typography.Text>
            {/* Neutral. In this table the only coloured tags are the public-link
                warning and the schedule chip — see JOIN_MODE_COLOURS. */}
            <Tag bordered={false}>{TYPE_LABELS[row.type]}</Tag>
          </Space>
          {row.presenterName && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              ارائه‌دهنده: {row.presenterName}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: "زمان برگزاری",
      key: "when",
      render: (_: unknown, row: RoomListItem) => {
        // The admin DTO carries no `canJoinNow`, so this mirrors `Room.IsOpenAt`
        // exactly — active, and past the opening time. Display only: every action
        // on this row is still decided by the server.
        const schedule = describeSchedule(
          {
            startsAtUtc: row.startsAtUtc,
            opensAtUtc: row.opensAtUtc,
            durationMinutes: row.durationMinutes,
            canJoinNow: row.isActive && Date.parse(row.opensAtUtc) <= now,
          },
          now,
        );

        return (
          <Space direction="vertical" size={4}>
            <span>{row.dateJalali}</span>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              ساعت {fromWireTime(row.startTime)}
              {row.durationMinutes ? ` — ${fa(row.durationMinutes)} دقیقه` : ""}
            </Typography.Text>
            {/* «باز/بسته» is the admin's own switch; this is where the meeting sits
                in time. Two different questions, and both matter on this row. */}
            <PhaseChip phase={schedule.phase} relative={schedule.relative} />
          </Space>
        );
      },
    },
    {
      title: "نوع ورود",
      dataIndex: "joinMode",
      render: (mode: RoomJoinMode) => <Tag color={JOIN_MODE_COLOURS[mode]}>{JOIN_MODE_LABELS[mode]}</Tag>,
    },
    {
      // Amir asked for the link on the row, not one click deeper — a meeting you cannot hand out is
      // not a meeting anyone attends.
      title: "لینک ورود",
      key: "link",
      render: (_: unknown, row: RoomListItem) => <JoinLinkCell row={row} />,
    },
    {
      title: "داخل جلسه",
      dataIndex: "liveCount",
      align: "center" as const,
      render: (n: number, row: RoomListItem) =>
        n > 0 ? (
          <Space size={6}>
            <span className="room-live-dot" />
            <Typography.Text strong>{fa(n)}</Typography.Text>
          </Space>
        ) : (
          <Typography.Text type="secondary">{`۰ / ${fa(row.maxParticipants)}`}</Typography.Text>
        ),
    },
    {
      title: "وضعیت",
      dataIndex: "isActive",
      align: "center" as const,
      render: (active: boolean) =>
        active ? <Badge status="success" text="باز" /> : <Badge status="default" text="بسته" />,
    },
    {
      title: "",
      key: "actions",
      render: (_: unknown, row: RoomListItem) => (
        <Space wrap>
          <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/admin/${row.id}`)}>
            ویرایش
          </Button>

          {row.joinMode !== RoomJoinMode.InviteOnly && (
            <Popconfirm
              title="ساخت لینک تازه"
              description="لینک فعلی از کار می‌افتد و هرکسی که آن را دارد دیگر نمی‌تواند وارد شود."
              okText="لینک تازه"
              cancelText="انصراف"
              okButtonProps={{ danger: true }}
              onConfirm={() =>
                regenerate.mutate(row.id, {
                  // Shown in full, because the row truncates it and the admin has to send the new
                  // link somewhere before anyone can get in again.
                  onSuccess: (url) =>
                    modal.info({
                      title: "لینک تازهٔ ورود",
                      content: (
                        <Typography.Paragraph className="mono" copyable style={{ wordBreak: "break-all" }}>
                          {url}
                        </Typography.Paragraph>
                      ),
                      okText: "بستن",
                    }),
                  onError: fail,
                })
              }
            >
              <Tooltip title="لینک تازه؛ لینک قبلی باطل می‌شود">
                <Button size="small" icon={<ReloadOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}

          {row.isActive ? (
            <Popconfirm
              title="بستن جلسه"
              description="ورود تازه بسته می‌شود و افراد داخل جلسه هم خارج می‌شوند."
              okText="بستن"
              cancelText="انصراف"
              okButtonProps={{ danger: true }}
              onConfirm={() =>
                setActive.mutate(
                  { id: row.id, isActive: false },
                  { onSuccess: () => message.success("جلسه بسته شد"), onError: fail },
                )
              }
            >
              <Button size="small" danger icon={<StopOutlined />}>
                بستن
              </Button>
            </Popconfirm>
          ) : (
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() =>
                setActive.mutate(
                  { id: row.id, isActive: true },
                  { onSuccess: () => message.success("جلسه باز شد"), onError: fail },
                )
              }
            >
              بازکردن
            </Button>
          )}

          <Popconfirm
            title="حذف جلسه"
            description="لینک ورود باطل می‌شود و جلسه از فهرست حذف می‌شود."
            okText="حذف"
            cancelText="انصراف"
            okButtonProps={{ danger: true }}
            onConfirm={() =>
              remove.mutate(row.id, {
                onSuccess: () => message.success("جلسه حذف شد"),
                onError: fail,
              })
            }
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="جلسات"
        subtitle="ساخت جلسه و ارائه، و ساخت لینک ورود"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/admin/new")}>
            جلسه جدید
          </Button>
        }
      />

      <Card>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data ?? []}
          columns={columns}
          pagination={false}
          // Persian labels are long and this table has seven columns; without this it crushes on a
          // phone and the link column is the first thing to go.
          scroll={{ x: "max-content" }}
          expandable={{
            // The invite list is the one thing that does not fit on a row. Only invite-only meetings
            // have one, so only they expand.
            rowExpandable: (row) => row.joinMode === RoomJoinMode.InviteOnly,
            expandedRowRender: (row) => (
              <Space>
                <TeamOutlined />
                <Typography.Text type="secondary">
                  {row.inviteCount > 0
                    ? `${fa(row.inviteCount)} نفر دعوت شده‌اند`
                    : "هنوز کسی دعوت نشده است"}
                </Typography.Text>
                <Button size="small" type="link" onClick={() => navigate(`/admin/${row.id}`)}>
                  مدیریت دعوت‌ها
                </Button>
              </Space>
            ),
          }}
          locale={{
            emptyText: (
              <Empty description="هنوز جلسه‌ای ساخته نشده است" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ),
          }}
        />
      </Card>
    </>
  );
}
