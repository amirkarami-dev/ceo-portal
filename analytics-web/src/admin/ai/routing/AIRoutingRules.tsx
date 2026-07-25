import { Form, Select, Switch, InputNumber, List, Button, Space, Skeleton, message } from "antd";
import { useTranslation } from "react-i18next";
import type { TenantAIConfig } from "../../../contracts";
import { useTenantAIConfig, useUpdateTenantAIConfig } from "../../../api/queries";
import { usePromptVersions } from "../usePromptVersions";
import { PageHeader, SectionCard } from "../../../components/ui";

export function AIRoutingRules() {
  const { t } = useTranslation();
  const { data: cfg, isLoading } = useTenantAIConfig();
  const update = useUpdateTenantAIConfig();
  const { data: prompts } = usePromptVersions();

  if (isLoading || !cfg) return <Skeleton active />;

  const enabledProviders = cfg.providers.filter((p) => p.enabled);
  const patch = (next: Partial<TenantAIConfig>) => update.mutate({ ...cfg, ...next });

  const move = (i: number, dir: -1 | 1) => {
    const chain = [...cfg.fallbackChain];
    const j = i + dir;
    if (j < 0 || j >= chain.length) return;
    [chain[i], chain[j]] = [chain[j], chain[i]];
    patch({ fallbackChain: chain });
  };

  const removeFromChain = (id: string) =>
    patch({ fallbackChain: cfg.fallbackChain.filter((x) => x !== id) });

  const addToChain = (id: string) => {
    if (!cfg.fallbackChain.includes(id)) patch({ fallbackChain: [...cfg.fallbackChain, id] });
  };

  const notInChain = enabledProviders.filter((p) => !cfg.fallbackChain.includes(p.id));

  return (
    <div>
      <PageHeader title={t("admin.ai.routingTitle")} />
      <Form layout="vertical" style={{ maxWidth: 560 }}>
        <Form.Item label={t("admin.ai.primaryModel")}>
          <Select
            value={cfg.defaultModelId}
            onChange={(v) => patch({ defaultModelId: v })}
            options={enabledProviders.map((p) => ({
              value: p.id,
              label: `${p.model} (${t(`admin.ai.type.${p.type}`)})`,
            }))}
          />
        </Form.Item>
        <Form.Item label={t("admin.ai.promptVersion")}>
          <Select
            value={cfg.promptVersion}
            onChange={(v) => patch({ promptVersion: v })}
            options={(prompts ?? []).flatMap((p) =>
              p.versions.map((vv) => ({ value: vv.version, label: vv.version })),
            )}
          />
        </Form.Item>
        <Form.Item label={t("admin.ai.responseCache")}>
          <Space>
            <Switch
              checked={cfg.cache.enabled}
              onChange={(c) => patch({ cache: { ...cfg.cache, enabled: c } })}
            />
            <Space.Compact>
              <InputNumber
                disabled={!cfg.cache.enabled}
                min={0}
                value={cfg.cache.ttlSeconds}
                onChange={(s) => patch({ cache: { ...cfg.cache, ttlSeconds: s ?? 0 } })}
              />
              <span style={{ padding: "0 8px", lineHeight: "32px", border: "1px solid var(--ant-color-border)", borderLeft: 0 }}>
                {t("admin.ai.ttlSeconds")}
              </span>
            </Space.Compact>
          </Space>
        </Form.Item>
      </Form>

      <SectionCard title={t("admin.ai.fallbackChain")} style={{ maxWidth: 560 }}>
        <List
          dataSource={cfg.fallbackChain}
          locale={{ emptyText: t("admin.ai.noFallbacks") }}
          renderItem={(id, i) => {
            const p = cfg.providers.find((x) => x.id === id);
            return (
              <List.Item
                actions={[
                  <Button key="up" size="small" aria-label="move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>,
                  <Button key="down" size="small" aria-label="move down" disabled={i === cfg.fallbackChain.length - 1} onClick={() => move(i, 1)}>↓</Button>,
                  <Button key="rm" size="small" danger aria-label="remove" onClick={() => removeFromChain(id)}>×</Button>,
                ]}
              >
                <Space>{i + 1}. {p?.model ?? id}</Space>
              </List.Item>
            );
          }}
        />
        {notInChain.length > 0 && (
          <Select
            style={{ width: "100%", marginTop: 12 }}
            placeholder={t("admin.ai.addToChain")}
            value={null}
            onChange={(v) => { if (v) { addToChain(v); void message.success(t("admin.ai.added")); } }}
            options={notInChain.map((p) => ({ value: p.id, label: p.model }))}
          />
        )}
      </SectionCard>
    </div>
  );
}
