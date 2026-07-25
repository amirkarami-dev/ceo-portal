import { Form, Input, Select } from "antd";
import { useTranslation } from "react-i18next";
import type { Tenant } from "../../contracts";
import { FormDrawer } from "../../components/ui";

export function TenantFormModal({
  open,
  initial,
  onCancel,
  onSave,
}: {
  open: boolean;
  initial?: Tenant;
  onCancel: () => void;
  onSave: (t: Tenant) => void;
}) {
  const { t } = useTranslation();
  const [form] = Form.useForm<{
    displayName: string;
    slug: string;
    plan: Tenant["plan"];
    defaultLocale: Tenant["defaultLocale"];
  }>();

  const handleSubmit = async () => {
    const v = await form.validateFields();
    const now = new Date().toISOString();
    onSave({
      id: initial?.id ?? `tenant-${Date.now()}`,
      slug: v.slug,
      displayName: v.displayName,
      status: initial?.status ?? "trial",
      plan: v.plan,
      branding: initial?.branding ?? { primaryColor: "#10b981" },
      aiConfig: initial?.aiConfig ?? ({} as Tenant["aiConfig"]),
      quotas: initial?.quotas ?? ({} as Tenant["quotas"]),
      dataSourceIds: initial?.dataSourceIds ?? [],
      defaultLocale: v.defaultLocale,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  };

  return (
    <FormDrawer
      open={open}
      title={initial ? t("admin.tenants.edit") : t("admin.tenants.create")}
      onClose={onCancel}
      onSubmit={() => void handleSubmit()}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          displayName: initial?.displayName,
          slug: initial?.slug,
          plan: initial?.plan ?? "free",
          defaultLocale: initial?.defaultLocale ?? "fa-IR",
        }}
      >
        <Form.Item
          name="displayName"
          label={t("admin.tenants.displayName")}
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="slug"
          label={t("admin.tenants.slug")}
          rules={[{ required: true }]}
        >
          <Input placeholder="acme-co" />
        </Form.Item>
        <Form.Item name="plan" label={t("admin.tenants.plan")}>
          <Select
            options={["free", "pro", "enterprise"].map((p) => ({
              value: p,
              label: t(`admin.tenant.planValue.${p}`),
            }))}
          />
        </Form.Item>
        <Form.Item name="defaultLocale" label={t("admin.tenants.defaultLocale")}>
          <Select
            options={[
              { value: "fa-IR", label: "فارسی (RTL)" },
              { value: "en-US", label: "English (LTR)" },
            ]}
          />
        </Form.Item>
      </Form>
    </FormDrawer>
  );
}
