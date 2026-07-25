import { Drawer, Descriptions, Tag, Typography } from "antd";
import { useTranslation } from "react-i18next";
import type { AuditRow } from "../../api/queries";

/** AI-request detail fields (optional; present only for ai.generate / AiRequest rows). */
export interface AuditAIDetail {
  prompt?: string;
  provider?: string;
  model?: string;
  promptVersion?: string;
  tokens?: number;
  costUsd?: number;
  latencyMs?: number;
  cached?: boolean;
  definition?: unknown;
}

export type AuditRowExt = AuditRow & { actorName?: string; status?: string; detail?: AuditAIDetail };

export function AuditEventDrawer({
  event,
  onClose,
}: {
  event: AuditRowExt | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const d = event?.detail;
  return (
    <Drawer
      open={!!event}
      onClose={onClose}
      width={520}
      title={event ? t(`admin.audit.type.${event.type}`, { defaultValue: event.type }) : ""}
    >
      {event && (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label={t("admin.audit.actor")}>
            {event.actorName ?? event.actorId}
          </Descriptions.Item>
          <Descriptions.Item label={t("admin.audit.time")}>
            {new Date(event.ts).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label={t("admin.audit.eventType")}>
            <Tag>{t(`admin.audit.type.${event.type}`, { defaultValue: event.type })}</Tag>
          </Descriptions.Item>
          {event.status != null && (
            <Descriptions.Item label={t("admin.audit.status")}>
              <Tag color={event.status === "ok" ? "green" : "red"}>
                {t(`admin.audit.statusValue.${event.status}`, { defaultValue: event.status })}
              </Tag>
            </Descriptions.Item>
          )}
          {d?.prompt && (
            <Descriptions.Item label={t("admin.audit.prompt")}>{d.prompt}</Descriptions.Item>
          )}
          {d?.provider && (
            <Descriptions.Item label={t("admin.audit.provider")}>{d.provider}</Descriptions.Item>
          )}
          {d?.model && (
            <Descriptions.Item label={t("admin.audit.model")}>{d.model}</Descriptions.Item>
          )}
          {d?.promptVersion && (
            <Descriptions.Item label={t("admin.audit.promptVersion")}>{d.promptVersion}</Descriptions.Item>
          )}
          {d?.tokens != null && (
            <Descriptions.Item label={t("admin.audit.tokens")}>{d.tokens}</Descriptions.Item>
          )}
          {d?.costUsd != null && (
            <Descriptions.Item label={t("admin.audit.cost")}>${d.costUsd.toFixed(4)}</Descriptions.Item>
          )}
          {d?.latencyMs != null && (
            <Descriptions.Item label={t("admin.audit.latency")}>{d.latencyMs} ms</Descriptions.Item>
          )}
          {d?.cached != null && (
            <Descriptions.Item label={t("admin.audit.cached")}>
              {d.cached ? t("common.yes") : t("common.no")}
            </Descriptions.Item>
          )}
          {event.tokens != null && !d?.tokens && (
            <Descriptions.Item label={t("admin.audit.tokens")}>{event.tokens}</Descriptions.Item>
          )}
          {event.cost != null && !d?.costUsd && (
            <Descriptions.Item label={t("admin.audit.cost")}>${event.cost.toFixed(4)}</Descriptions.Item>
          )}
          {d?.definition != null && (
            <Descriptions.Item label={t("admin.audit.resolvedDefinition")}>
              <Typography.Paragraph
                code
                style={{ whiteSpace: "pre-wrap", maxHeight: 240, overflow: "auto" }}
              >
                {JSON.stringify(d.definition, null, 2)}
              </Typography.Paragraph>
            </Descriptions.Item>
          )}
        </Descriptions>
      )}
    </Drawer>
  );
}
