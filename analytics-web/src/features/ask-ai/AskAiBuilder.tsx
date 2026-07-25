// report-web/src/features/ask-ai/AskAiBuilder.tsx
import { Alert, Breadcrumb, Button, Col, Dropdown, Empty, Flex, Row, Spin } from "antd";
import { DownloadOutlined, RobotOutlined, SaveOutlined } from "@ant-design/icons";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ReportViewRenderer } from "@/presentation/ReportView";
import { buildExportMenuItems } from "@/features/export";
import { useAuth } from "@/auth/useAuth";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { KpiTile } from "@/components/ui/KpiTile";
import { PromptHero } from "./PromptHero";
import { DefinitionPanel } from "./DefinitionPanel";
import { ViewSwitcher } from "./ViewSwitcher";
import { SaveReportModal } from "./SaveReportModal";
import { useAskAi } from "./useAskAi";

const THINKING_STEPS = [
  "ask.thinking.understanding",
  "ask.thinking.resolving",
  "ask.thinking.building",
] as const;

/** Derive a small KPI summary from the result for the bento row. */
function useResultKpis(result: { columns: { key: string; label: string; isMetric: boolean }[]; rows: { [k: string]: string | number | null }[]; total: number } | undefined) {
  if (!result) return [];
  const metricCols = result.columns.filter((c) => c.isMetric);
  const kpis = metricCols.slice(0, 3).map((col) => {
    const values = result.rows.map((r) => r[col.key]).filter((v): v is number => typeof v === "number");
    const total = values.reduce((a, b) => a + b, 0);
    const fmt = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(total);
    return { key: col.key, label: col.label, value: fmt };
  });
  // Always add row count
  kpis.push({ key: "__rows__", label: "#", value: String(result.total) });
  return kpis;
}

export function AskAiBuilder() {
  const { t } = useTranslation();

  const { roles } = useAuth();
  // AI Manager can run/preview but cannot save (execute-only, no reports:write — §3.1).
  const canSave = !roles.includes("AIManager");

  const { state, submit, setDataset, switchView, drill, drillUp } = useAskAi();
  const [saveOpen, setSaveOpen] = useState(false);

  const resultKpis = useResultKpis(state.result);

  if (state.phase === "hero") {
    return (
      <div className="ask-screen ask-screen--hero">
        <PageContainer>
          <PageHeader
            title={t("ask.heroTitle")}
            subtitle={t("ask.sqlReassurance")}
          />
          <PromptHero
            compact={false}
            datasetKey={state.datasetKey}
            onDataset={setDataset}
            onSubmit={(p) => void submit(p)}
          />
        </PageContainer>
      </div>
    );
  }

  const activeView = state.views[state.activeViewIndex];

  return (
    <div className="ask-screen ask-screen--work">
      <PageContainer>
        {/* Compact prompt bar */}
        <PromptHero
          compact
          datasetKey={state.datasetKey}
          onDataset={setDataset}
          onSubmit={(p) => void submit(p)}
        />

        {state.phase === "thinking" && (
          <SectionCard style={{ marginTop: 16 }}>
            <Flex align="center" gap={12} role="status">
              <Spin />
              <motion.span
                key="thinking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ color: "var(--ant-color-text-secondary)" }}
              >
                {t(THINKING_STEPS[0])}
              </motion.span>
            </Flex>
          </SectionCard>
        )}

        {state.phase === "error" && (
          <Alert
            type="warning"
            showIcon
            role="alert"
            style={{ marginTop: 16 }}
            message={t("ask.error.unmappedTitle")}
            description={t("ask.error.unmappedHint")}
          />
        )}

        {state.phase === "result" && state.def && state.result && (
          <>
            {/* KPI bento row */}
            {resultKpis.length > 0 && (
              <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
                {resultKpis.map((kpi, i) => (
                  <Col key={kpi.key} xs={12} sm={8} md={6}>
                    <KpiTile
                      label={kpi.label}
                      value={kpi.value}
                      tone={i === 0 ? "emerald" : i === 1 ? "blue" : i === 2 ? "amber" : "neutral"}
                    />
                  </Col>
                ))}
              </Row>
            )}

            {/* Definition (collapsible) */}
            <div style={{ marginTop: 16 }}>
              <DefinitionPanel def={state.def} />
            </div>

            {/* Toolbar: view switcher + actions */}
            <SectionCard
              style={{ marginTop: 8 }}
              styles={{ body: { padding: "10px 16px" } }}
            >
              <Flex align="center" justify="space-between" wrap gap={8}>
                <ViewSwitcher
                  views={state.views}
                  active={activeView}
                  result={state.result}
                  onSwitch={switchView}
                />
                <Flex gap={8} wrap>
                  {canSave && (
                    <Button
                      icon={<SaveOutlined />}
                      onClick={() => setSaveOpen(true)}
                      data-testid="save-btn"
                    >
                      {t("ask.saveToLibrary")}
                    </Button>
                  )}
                  <Dropdown
                    menu={{ items: buildExportMenuItems(state.def, state.result) }}
                    trigger={["click"]}
                  >
                    <Button icon={<DownloadOutlined />} data-testid="export-btn">
                      {t("ask.export")}
                    </Button>
                  </Dropdown>
                </Flex>
              </Flex>
            </SectionCard>

            {/* Drill breadcrumb */}
            {state.drillPath.length > 0 && (
              <Breadcrumb
                style={{ marginTop: 8 }}
                items={[
                  {
                    title: (
                      <a
                        onClick={() => drillUp()}
                        style={{ cursor: "pointer" }}
                      >
                        {t("ask.root")}
                      </a>
                    ),
                  },
                  ...state.drillPath.map((c) => ({ title: c.label })),
                ]}
              />
            )}

            {/* Result canvas */}
            <SectionCard
              title={state.def.name}
              extra={<RobotOutlined style={{ color: "var(--ant-color-text-quaternary)" }} />}
              style={{ marginTop: 8 }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={state.activeViewIndex + (activeView?.component ?? "")}
                  data-testid="result-canvas"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {state.result.total === 0 ? (
                    <Empty description={t("ask.empty.noRows")} />
                  ) : activeView ? (
                    <ReportViewRenderer
                      view={activeView}
                      def={state.def}
                      result={state.result}
                      onDrill={drill}
                    />
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </SectionCard>
          </>
        )}

        {state.def && (
          <SaveReportModal
            open={saveOpen}
            def={state.def}
            onClose={() => setSaveOpen(false)}
          />
        )}
      </PageContainer>
    </div>
  );
}
