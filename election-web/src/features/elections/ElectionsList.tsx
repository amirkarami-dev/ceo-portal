import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  App as AntApp,
  Button,
  Card,
  Empty,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  BarChartOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SendOutlined,
  StopOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { PageHeader } from "../../components/PageHeader";
import {
  useCancelElection,
  useDeleteElection,
  useElections,
  usePublishElection,
  useTallyElection,
} from "../../lib/queries";
import {
  ElectionPhase,
  ElectionStatus,
  PHASE_COLOURS,
  PHASE_LABELS,
  fromWireTime,
  type ElectionListItem,
} from "../../lib/types";
import { ApiError } from "../../lib/api";

const fa = (n: number) => n.toLocaleString("fa-IR");

export function ElectionsList() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const { data, isLoading } = useElections();

  const publish = usePublishElection();
  const cancel = useCancelElection();
  const remove = useDeleteElection();
  const tally = useTallyElection();

  const [tallyResult, setTallyResult] = useState<string | null>(null);

  /** Every refusal here has a Persian reason from the server; show it verbatim. */
  const fail = (e: unknown) => message.error(e instanceof ApiError ? e.message : "خطای غیرمنتظره");

  const columns = [
    {
      title: "عنوان",
      dataIndex: "title",
      render: (title: string, row: ElectionListItem) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{title}</Typography.Text>
          {/* The title restricts nobody — only the discipline set does. Showing eligibility right
              under it is what stops an admin assuming «واحد گاز» in the title limits voters. */}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.eligibilitySummary}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "زمان برگزاری",
      key: "when",
      render: (_: unknown, row: ElectionListItem) => (
        <Space direction="vertical" size={0}>
          <span>{row.dateJalali}</span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {fromWireTime(row.startTime)} تا {fromWireTime(row.endTime)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "وضعیت",
      dataIndex: "phase",
      render: (phase: ElectionPhase) => (
        <Tag color={PHASE_COLOURS[phase]}>{PHASE_LABELS[phase]}</Tag>
      ),
    },
    {
      title: "کاندیداها",
      dataIndex: "candidateCount",
      align: "center" as const,
      render: (n: number, row: ElectionListItem) => (
        <Space direction="vertical" size={0}>
          <span>{fa(n)}</span>
          {row.maxSelections > 1 && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              انتخاب {fa(row.maxSelections)} نفر
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      // A count, never a list. The API has no endpoint that says WHO voted.
      title: "رأی ثبت‌شده",
      dataIndex: "ballotCount",
      align: "center" as const,
      render: (n: number) => fa(n),
    },
    {
      title: "",
      key: "actions",
      render: (_: unknown, row: ElectionListItem) => {
        const editable = row.status === ElectionStatus.Draft || row.phase === ElectionPhase.NotYetOpen;
        const finished =
          row.phase === ElectionPhase.Closed || row.phase === ElectionPhase.ResultsAvailable;

        return (
          <Space wrap>
            <Button
              size="small"
              icon={editable ? <EditOutlined /> : <EyeOutlined />}
              onClick={() => navigate(`/admin/${row.id}`)}
            >
              {editable ? "ویرایش" : "مشاهده"}
            </Button>

            {row.status === ElectionStatus.Draft && (
              <Popconfirm
                title="انتشار انتخابات"
                description="پس از انتشار، رأی‌دهندگان آن را می‌بینند و با آغاز رأی‌گیری دیگر قابل ویرایش نیست."
                okText="انتشار"
                cancelText="انصراف"
                onConfirm={() =>
                  publish.mutate(row.id, {
                    onSuccess: () => message.success("انتخابات منتشر شد"),
                    onError: fail,
                  })
                }
              >
                <Button size="small" type="primary" icon={<SendOutlined />}>
                  انتشار
                </Button>
              </Popconfirm>
            )}

            {finished && (
              <Button
                size="small"
                icon={<BarChartOutlined />}
                loading={tally.isPending && tally.variables === row.id}
                onClick={() =>
                  tally.mutate(row.id, {
                    onSuccess: (r) =>
                      setTallyResult(
                        `${fa(r.ballotsCounted)} برگه شمارش شد` +
                          (r.wasRecount ? " (شمارش مجدد؛ برگه‌ها تغییر نکرده‌اند)" : "") +
                          `\n\nاثر انگشت نتیجه:\n${r.resultDigest}`,
                      ),
                    onError: fail,
                  })
                }
              >
                {row.phase === ElectionPhase.ResultsAvailable ? "شمارش مجدد" : "شمارش آرا"}
              </Button>
            )}

            {row.phase === ElectionPhase.ResultsAvailable && (
              <Button
                size="small"
                icon={<TrophyOutlined />}
                onClick={() => navigate(`/admin/${row.id}/result`)}
              >
                نتیجه
              </Button>
            )}

            {row.status === ElectionStatus.Published && (
              <Popconfirm
                title="لغو انتخابات"
                description="برگه‌های ثبت‌شده پاک نمی‌شوند، اما این انتخابات دیگر برگزار نخواهد شد."
                okText="لغو انتخابات"
                cancelText="انصراف"
                okButtonProps={{ danger: true }}
                onConfirm={() =>
                  cancel.mutate(row.id, {
                    onSuccess: () => message.success("انتخابات لغو شد"),
                    onError: fail,
                  })
                }
              >
                <Button size="small" danger icon={<StopOutlined />}>
                  لغو
                </Button>
              </Popconfirm>
            )}

            {row.status === ElectionStatus.Draft && (
              <Popconfirm
                title="حذف پیش‌نویس"
                okText="حذف"
                cancelText="انصراف"
                okButtonProps={{ danger: true }}
                onConfirm={() =>
                  remove.mutate(row.id, {
                    onSuccess: () => message.success("پیش‌نویس حذف شد"),
                    onError: fail,
                  })
                }
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="انتخابات"
        subtitle="تعریف، انتشار و شمارش آرای انتخابات سازمان"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/admin/new")}>
            انتخابات جدید
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
          // Persian labels are long and this table has six columns; without this it crushes on a phone.
          scroll={{ x: "max-content" }}
          locale={{
            emptyText: (
              <Empty
                description="هنوز انتخاباتی تعریف نشده است"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>

      <Modal
        open={tallyResult !== null}
        title="شمارش آرا انجام شد"
        onCancel={() => setTallyResult(null)}
        onOk={() => setTallyResult(null)}
        okText="بستن"
        cancelButtonProps={{ style: { display: "none" } }}
      >
        {/* The digest is the evidence behind the published numbers, and it is the only thing that
            survives the 30-day ballot purge — so it is shown for the admin to record externally. */}
        <Typography.Paragraph style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {tallyResult}
        </Typography.Paragraph>
      </Modal>
    </>
  );
}
