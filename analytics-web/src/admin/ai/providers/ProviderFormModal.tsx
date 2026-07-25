/* eslint-disable react-refresh/only-export-components -- PROVIDER_TYPES is a constant, not a component; co-locating avoids a one-liner file */
import { Form, Select, Input, InputNumber, Switch } from "antd";
import { useTranslation } from "react-i18next";
import type { ProviderConfig, ProviderType } from "../../../contracts";
import { FormDrawer } from "../../../components/ui";

export const PROVIDER_TYPES: ProviderType[] = [
  "openai", "azure-openai", "ollama", "deepseek", "glm",
  "claude", "gemini", "openrouter", "custom",
];

export function ProviderFormModal({
  open, initial, onCancel, onSave,
}: {
  open: boolean;
  initial?: ProviderConfig;
  onCancel: () => void;
  onSave: (p: ProviderConfig) => void;
}) {
  const { t } = useTranslation();
  const [form] = Form.useForm<ProviderConfig & { temperature: number; maxTokens: number }>();
  const type = Form.useWatch("type", form) ?? initial?.type ?? "openai";
  const isAzure = type === "azure-openai";
  const isLocal = type === "ollama";

  const handleSubmit = async () => {
    const v = await form.validateFields();
    onSave({
      id: initial?.id ?? `${v.type}-${Date.now()}`,
      type: v.type,
      model: v.model,
      baseUrl: v.baseUrl || undefined,
      deployment: isAzure ? v.deployment : undefined,
      apiVersion: isAzure ? v.apiVersion : undefined,
      keyRef: isLocal ? null : (v.keyRef ?? `secret://tenant/${v.type}`),
      params: { temperature: v.temperature ?? 0.1, maxTokens: v.maxTokens ?? 2048 },
      pricing: initial?.pricing,
      enabled: v.enabled ?? true,
    });
  };

  return (
    <FormDrawer
      open={open}
      title={initial ? t("admin.ai.editProvider") : t("admin.ai.addProvider")}
      onClose={onCancel}
      onSubmit={() => void handleSubmit()}
    >
      <Form form={form} layout="vertical" initialValues={{
        type: initial?.type ?? "openai",
        model: initial?.model,
        baseUrl: initial?.baseUrl,
        deployment: initial?.deployment,
        apiVersion: initial?.apiVersion,
        temperature: initial?.params.temperature ?? 0.1,
        maxTokens: initial?.params.maxTokens ?? 2048,
        enabled: initial?.enabled ?? true,
      }}>
        <Form.Item name="type" label={t("admin.ai.providerType")} rules={[{ required: true }]}>
          <Select options={PROVIDER_TYPES.map((p) => ({ value: p, label: t(`admin.ai.type.${p}`) }))} />
        </Form.Item>
        <Form.Item name="model" label={t("admin.ai.model")} rules={[{ required: true }]}>
          <Input placeholder="gpt-4o-mini" />
        </Form.Item>
        <Form.Item name="baseUrl" label={t("admin.ai.baseUrl")}>
          <Input placeholder="https://api.openai.com/v1" />
        </Form.Item>
        {isAzure && (
          <>
            <Form.Item name="deployment" label={t("admin.ai.deployment")}><Input /></Form.Item>
            <Form.Item name="apiVersion" label={t("admin.ai.apiVersion")}><Input placeholder="2024-10-21" /></Form.Item>
          </>
        )}
        {!isLocal && (
          <Form.Item name="keyRef" label={t("admin.ai.apiKey")} extra={t("admin.ai.keyNeverStored")}>
            <Input.Password placeholder="••••••••" autoComplete="off" />
          </Form.Item>
        )}
        <Form.Item name="temperature" label={t("admin.ai.temperature")}>
          <InputNumber min={0} max={2} step={0.1} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="maxTokens" label={t("admin.ai.maxTokens")}>
          <InputNumber min={1} max={32768} step={256} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="enabled" label={t("admin.ai.enabled")} valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </FormDrawer>
  );
}
