import { useEffect, useRef, useState } from "react";
import {
  Tabs,
  Form,
  Select,
  Switch,
  InputNumber,
  Input,
  Button,
  Skeleton,
  Modal,
  message,
} from "antd";
import { useTranslation } from "react-i18next";
import {
  useSystemSettings as useSystemSettingsQuery,
  useUpdateSystemSettings,
} from "../../api/queries";
import type { SystemSettings as SystemSettingsData } from "./types";
import { PageHeader, PageContainer } from "../../components/ui";

const FLAGS: (keyof SystemSettingsData["flags"])[] = [
  "advancedECharts",
  "dashboardSharing",
  "exportFormats",
];

export function SystemSettings() {
  const { t } = useTranslation();
  const { data, isLoading } = useSystemSettingsQuery();
  const update = useUpdateSystemSettings();
  const [draft, setDraft] = useState<SystemSettingsData | null>(data ?? null);
  const seeded = useRef(false);

  useEffect(() => {
    if (data && !seeded.current) {
      seeded.current = true;
      setDraft(data);
    }
  }, [data]);

  if (isLoading || !draft) return <Skeleton active paragraph={{ rows: 10 }} />;

  const patch = (p: Partial<SystemSettingsData>) =>
    setDraft((d) => (d ? { ...d, ...p } : d));

  const setFlag = (k: keyof SystemSettingsData["flags"], v: boolean) =>
    setDraft((d) => (d ? { ...d, flags: { ...d.flags, [k]: v } } : d));

  const save = () => {
    if (!draft) return;
    Modal.confirm({
      title: t("admin.system.confirmTitle"),
      content: t("admin.system.confirmBody"),
      okText: t("common.confirm"),
      cancelText: t("common.cancel"),
      onOk: () => {
        update.mutate(draft);
        void message.success(t("admin.system.saved"));
      },
    });
  };

  return (
    <PageContainer>
      <PageHeader title={t("admin.system.title")} />
      <Tabs
        items={[
          {
            key: "general",
            label: t("admin.system.general"),
            children: (
              <Form layout="vertical" style={{ maxWidth: 480 }}>
                <Form.Item label={t("admin.system.defaultLocale")}>
                  <Select
                    value={draft.defaultLocale}
                    onChange={(v) => patch({ defaultLocale: v })}
                    options={[
                      { value: "fa-IR", label: "فارسی (RTL)" },
                      { value: "en-US", label: "English (LTR)" },
                    ]}
                  />
                </Form.Item>
                <Form.Item label={t("admin.system.defaultTheme")}>
                  <Select
                    value={draft.defaultTheme}
                    onChange={(v) => patch({ defaultTheme: v })}
                    options={[
                      { value: "light", label: t("admin.system.light") },
                      { value: "dark", label: t("admin.system.dark") },
                    ]}
                  />
                </Form.Item>
                <Form.Item label={t("admin.system.dateSystem")}>
                  <Select
                    value={draft.dateSystem}
                    onChange={(v) => patch({ dateSystem: v })}
                    options={[
                      { value: "jalali", label: t("admin.system.jalali") },
                      { value: "gregorian", label: t("admin.system.gregorian") },
                    ]}
                  />
                </Form.Item>
              </Form>
            ),
          },
          {
            key: "flags",
            label: t("admin.system.flags"),
            children: (
              <Form layout="horizontal">
                {FLAGS.map((f) => (
                  <Form.Item key={f} label={t(`admin.system.flag.${f}`)}>
                    <span data-testid={`flag-${f}`}>
                      <Switch checked={draft.flags[f]} onChange={(v) => setFlag(f, v)} />
                    </span>
                  </Form.Item>
                ))}
              </Form>
            ),
          },
          {
            key: "ai",
            label: t("admin.system.aiDefaults"),
            children: (
              <Form layout="vertical" style={{ maxWidth: 480 }}>
                <Form.Item label={t("admin.system.defaultProvider")}>
                  <Input
                    value={draft.ai.defaultProvider}
                    onChange={(e) =>
                      patch({ ai: { ...draft.ai, defaultProvider: e.target.value } })
                    }
                  />
                </Form.Item>
                <Form.Item label={t("admin.system.defaultModel")}>
                  <Input
                    value={draft.ai.defaultModel}
                    onChange={(e) =>
                      patch({ ai: { ...draft.ai, defaultModel: e.target.value } })
                    }
                  />
                </Form.Item>
                <Form.Item label={t("admin.system.globalTokenBudget")}>
                  <InputNumber
                    style={{ width: "100%" }}
                    value={draft.ai.globalTokenBudget}
                    onChange={(v) =>
                      patch({ ai: { ...draft.ai, globalTokenBudget: v ?? 0 } })
                    }
                  />
                </Form.Item>
                <Form.Item label={t("admin.system.defaultCacheTtl")}>
                  <InputNumber
                    style={{ width: "100%" }}
                    value={draft.ai.defaultCacheTtl}
                    onChange={(v) =>
                      patch({ ai: { ...draft.ai, defaultCacheTtl: v ?? 0 } })
                    }
                  />
                </Form.Item>
                <Form.Item label={t("admin.system.promptVersionPin")}>
                  <Input
                    value={draft.ai.promptVersionPin}
                    onChange={(e) =>
                      patch({ ai: { ...draft.ai, promptVersionPin: e.target.value } })
                    }
                  />
                </Form.Item>
              </Form>
            ),
          },
          {
            key: "security",
            label: t("admin.system.security"),
            children: (
              <Form layout="vertical" style={{ maxWidth: 480 }}>
                <Form.Item label={t("admin.system.sessionPolicy")}>
                  <Input
                    value={draft.security.sessionPolicy}
                    onChange={(e) =>
                      patch({ security: { ...draft.security, sessionPolicy: e.target.value } })
                    }
                  />
                </Form.Item>
                <Form.Item label={t("admin.system.allowedExportFormats")}>
                  <Select
                    mode="multiple"
                    value={draft.security.allowedExportFormats}
                    onChange={(v) =>
                      patch({ security: { ...draft.security, allowedExportFormats: v } })
                    }
                    options={["pdf", "excel", "csv", "json"].map((f) => ({
                      value: f,
                      label: f.toUpperCase(),
                    }))}
                  />
                </Form.Item>
                <Form.Item label={t("admin.system.piiRedaction")}>
                  <Switch
                    checked={draft.security.piiRedaction}
                    onChange={(v) =>
                      patch({ security: { ...draft.security, piiRedaction: v } })
                    }
                  />
                </Form.Item>
              </Form>
            ),
          },
          {
            key: "integrations",
            label: t("admin.system.integrations"),
            children: (
              <Form layout="vertical" style={{ maxWidth: 480 }}>
                <Form.Item
                  label={t("admin.system.oidcIssuer")}
                  extra={t("admin.system.oidcReadOnly")}
                >
                  <Input value={draft.integrations.oidcIssuer} readOnly disabled />
                </Form.Item>
              </Form>
            ),
          },
        ]}
      />
      <Button
        type="primary"
        style={{ marginTop: 16 }}
        loading={update.isPending}
        onClick={save}
      >
        {t("common.save")}
      </Button>
    </PageContainer>
  );
}
