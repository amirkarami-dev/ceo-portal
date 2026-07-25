import { useState } from "react";
import { Button, Card, Col, Empty, Row, Space, Table, Tooltip, Typography, theme } from "antd";
import { ReloadOutlined, FileTextOutlined, ApartmentOutlined } from "@ant-design/icons";
import { motion, useReducedMotion } from "framer-motion";
import ReactECharts from "echarts-for-react";
import { useRunDetail, useRuns, useTriggerRun } from "../../lib/queries";
import type { MunReportLogDto, MunSyncRunDto, MunWorkerType } from "../../lib/types";
import { PageHeader } from "../../components/PageHeader";
import { KpiTile } from "../../components/KpiTile";
import { RunStatusTag, LogStatusTag } from "../../components/StatusTag";
import { useThemeMode } from "../../theme/useThemeMode";
import { chartColors } from "../../theme/tokens";
import { absoluteTime, relativeTime } from "../../lib/format";

const WORKER_LABEL: Record<MunWorkerType, string> = {
  SaveEngineerReport: "گزارش مهندس ناظر",
  SaveEngMap: "نقشه مهندسین",
};
const WORKER_ICON: Record<MunWorkerType, React.ReactNode> = {
  SaveEngineerReport: <FileTextOutlined />,
  SaveEngMap: <ApartmentOutlined />,
};

export function Dashboard() {
  const { data: runs } = useRuns();
  const trigger = useTriggerRun();
  const { mode } = useThemeMode();
  const { token } = theme.useToken();
  const reduce = useReducedMotion();
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();

  const latestByWorker = (worker: MunWorkerType) => runs?.find((r) => r.workerType === worker);
  const anyRunning = runs?.some((r) => r.status === "Running") ?? false;
  const activeRunId = selectedRunId ?? runs?.find((r) => r.status === "Running")?.runId ?? runs?.[0]?.runId;
  const { data: detail } = useRunDetail(activeRunId);

  const fade = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.28, delay: i * 0.06, ease: "easeOut" as const },
        };

  return (
    <div>
      <PageHeader
        title="داشبورد سرویس ها"
        subtitle="وضعیت همگام‌سازی گزارش‌ها و نقشه‌های مهندسین با سامانه شهرداری سنندج"
        extra={
          anyRunning ? (
            <Space size={8}>
              <span className="mun-live-dot" />
              <Typography.Text type="secondary">همگام‌سازی در حال اجرا…</Typography.Text>
            </Space>
          ) : null
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {(["SaveEngineerReport", "SaveEngMap"] as const).map((worker, i) => {
          const run = latestByWorker(worker);
          return (
            <Col xs={24} md={12} key={worker}>
              <motion.div {...fade(i)}>
                <Card
                  title={
                    <Space>
                      <span style={{ color: token.colorPrimary }}>{WORKER_ICON[worker]}</span>
                      {WORKER_LABEL[worker]}
                    </Space>
                  }
                  extra={run ? <RunStatusTag status={run.status} /> : null}
                >
                  <Space size={10} style={{ display: "flex", marginBottom: 14 }}>
                    <KpiTile label="موفق" value={run?.successCount ?? 0} tone="success" />
                    <KpiTile label="ناموفق" value={run?.failedCount ?? 0} tone="error" />
                    <KpiTile label="کل" value={run?.totalRows ?? 0} tone="muted" />
                  </Space>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    {run ? (
                      <Tooltip title={absoluteTime(run.startedAt)}>
                        <Typography.Text
                          type="secondary"
                          style={{ fontSize: 12, cursor: "pointer" }}
                          onClick={() => setSelectedRunId(run.runId)}
                        >
                          آخرین اجرا: {relativeTime(run.startedAt)}
                        </Typography.Text>
                      </Tooltip>
                    ) : (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        هنوز اجرایی ثبت نشده است
                      </Typography.Text>
                    )}
                    <Button
                      type="primary"
                      icon={<ReloadOutlined />}
                      loading={trigger.isPending && trigger.variables === worker}
                      onClick={() => trigger.mutate(worker)}
                    >
                      اجرای فوری
                    </Button>
                  </div>
                </Card>
              </motion.div>
            </Col>
          );
        })}
      </Row>

      <motion.div {...fade(2)}>
        <Card title="روند اجراها" style={{ marginBottom: 16 }}>
          {runs && runs.length > 0 ? (
            <RunsChart runs={runs} mode={mode} />
          ) : (
            <Empty description="داده‌ای برای نمایش وجود ندارد" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      </motion.div>

      <motion.div {...fade(3)}>
        <Card title="جزئیات آخرین اجرا">
          <Table<MunReportLogDto>
            rowKey="id"
            size="small"
            dataSource={detail?.logs ?? []}
            locale={{ emptyText: <Empty description="ردیفی وجود ندارد" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            pagination={detail && detail.logs.length > 10 ? { pageSize: 10, hideOnSinglePage: true } : false}
            scroll={{ x: "max-content" }}
            columns={[
              {
                title: "پیگیری",
                dataIndex: "peygiri",
                render: (v: string) => <span className="mono">{v}</span>,
              },
              { title: "شماره پروژه", dataIndex: "projectNo", render: (v: string) => <span className="mono">{v}</span> },
              {
                title: "وضعیت",
                dataIndex: "status",
                render: (status: MunReportLogDto["status"]) => <LogStatusTag status={status} />,
              },
              { title: "تلاش", dataIndex: "attemptNumber", align: "center", width: 70 },
              {
                title: "خطا",
                dataIndex: "errorMessage",
                render: (v: string | null) =>
                  v ? (
                    <Tooltip title={v}>
                      <Typography.Text type="danger" ellipsis style={{ maxWidth: 260 }}>
                        {v}
                      </Typography.Text>
                    </Tooltip>
                  ) : (
                    <Typography.Text type="secondary">—</Typography.Text>
                  ),
              },
            ]}
          />
        </Card>
      </motion.div>
    </div>
  );
}

function RunsChart({ runs, mode }: { runs: MunSyncRunDto[]; mode: "light" | "dark" }) {
  const cc = chartColors(mode);
  const ordered = [...runs].reverse();
  const labels = ordered.map((r) => new Date(r.startedAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }));
  return (
    <ReactECharts
      key={mode}
      notMerge
      style={{ height: 300 }}
      option={{
        grid: { top: 36, right: 12, bottom: 28, left: 12, containLabel: true },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          backgroundColor: cc.tooltipBg,
          borderWidth: 0,
          textStyle: { color: cc.tooltipText, fontFamily: "Vazirmatn" },
        },
        legend: { data: ["موفق", "ناموفق"], top: 0, textStyle: { color: cc.text, fontFamily: "Vazirmatn" } },
        xAxis: {
          type: "category",
          data: labels,
          axisLine: { lineStyle: { color: cc.axis } },
          axisLabel: { color: cc.axis, fontFamily: "Vazirmatn" },
        },
        yAxis: {
          type: "value",
          minInterval: 1,
          splitLine: { lineStyle: { color: cc.split } },
          axisLabel: { color: cc.axis, fontFamily: "Vazirmatn" },
        },
        series: [
          {
            name: "موفق",
            type: "bar",
            stack: "t",
            data: ordered.map((r) => r.successCount),
            itemStyle: { color: cc.success, borderRadius: [0, 0, 0, 0] },
          },
          {
            name: "ناموفق",
            type: "bar",
            stack: "t",
            data: ordered.map((r) => r.failedCount),
            itemStyle: { color: cc.error, borderRadius: [4, 4, 0, 0] },
          },
        ],
      }}
    />
  );
}
