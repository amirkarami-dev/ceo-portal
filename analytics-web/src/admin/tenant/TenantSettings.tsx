import { useEffect, useRef, useState } from "react";
import { Form, Input, Select, ColorPicker, Button, Skeleton, Space, Upload } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { Tenant } from "../../contracts";
import { useTenant, useUpdateTenant, useTenantUsage } from "../../api/queries";
import { useUiStore } from "../../store/ui-store";
import { QuotaPanel } from "./QuotaPanel";
import { PageHeader, PageContainer, SectionCard } from "../../components/ui";

type BrandingFormValues = {
  displayName: string;
  productName?: string;
  primaryColor: string;
  accentColor?: string;
  defaultLocale: Tenant["defaultLocale"];
  plan: Tenant["plan"];
};

export function TenantSettings() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { data: tenant, isLoading } = useTenant();
  const { data: usage } = useTenantUsage();
  const update = useUpdateTenant();
  const setPreviewColor = useUiStore((s) => s.setPreviewPrimaryColor);
  const [form] = Form.useForm<BrandingFormValues>();
  const [draft, setDraft] = useState<Tenant | null>(tenant ?? null);
  const seeded = useRef(false);

  useEffect(() => {
    if (tenant && !seeded.current) {
      seeded.current = true;
      setDraft(tenant);
    }
  }, [tenant]);

  if (isLoading || !draft) return <Skeleton active paragraph={{ rows: 10 }} />;

  const submit = (values: BrandingFormValues) => {
    update.mutate({
      ...draft,
      displayName: values.displayName,
      plan: values.plan,
      defaultLocale: values.defaultLocale,
      branding: {
        ...draft.branding,
        productName: values.productName,
        primaryColor: values.primaryColor,
        accentColor: values.accentColor,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <PageContainer>
      <PageHeader title={t("admin.tenant.title")} />
      <SectionCard title={t("admin.tenant.branding")} style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="vertical"
          style={{ maxWidth: 560 }}
          initialValues={{
            displayName: draft.displayName,
            productName: draft.branding.productName,
            primaryColor: draft.branding.primaryColor,
            accentColor: draft.branding.accentColor,
            defaultLocale: draft.defaultLocale,
            plan: draft.plan,
          }}
          onFinish={submit}
        >
          <Form.Item
            name="displayName"
            label={t("admin.tenant.displayName")}
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="productName" label={t("admin.tenant.productName")}>
            <Input />
          </Form.Item>
          <Form.Item label={t("admin.tenant.logo")}>
            <Upload listType="picture-card" maxCount={1} beforeUpload={() => false}>
              {t("admin.tenant.uploadLogo")}
            </Upload>
          </Form.Item>
          <Form.Item
            name="primaryColor"
            label={t("admin.tenant.primaryColor")}
            getValueFromEvent={(c: string | { toHexString: () => string }) =>
              typeof c === "string" ? c : c.toHexString()
            }
          >
            <ColorPicker
              showText
              onChangeComplete={(c) => setPreviewColor(c.toHexString())}
            />
          </Form.Item>
          <Form.Item
            name="accentColor"
            label={t("admin.tenant.accentColor")}
            getValueFromEvent={(c: string | { toHexString: () => string }) =>
              typeof c === "string" ? c : c.toHexString()
            }
          >
            <ColorPicker showText />
          </Form.Item>
          <Form.Item name="defaultLocale" label={t("admin.tenant.defaultLocale")}>
            <Select
              options={[
                { value: "fa-IR", label: "فارسی (RTL)" },
                { value: "en-US", label: "English (LTR)" },
              ]}
            />
          </Form.Item>
          <Form.Item name="plan" label={t("admin.tenant.plan")}>
            <Select
              options={["free", "pro", "enterprise"].map((p) => ({
                value: p,
                label: t(`admin.tenant.planValue.${p}`),
              }))}
            />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={update.isPending}>
              {t("common.save")}
            </Button>
            <Button onClick={() => nav("/admin/ai/providers")}>
              {t("admin.tenant.perTenantAi")}
            </Button>
          </Space>
        </Form>
      </SectionCard>
      {usage && <QuotaPanel quotas={draft.quotas} usage={usage} />}
    </PageContainer>
  );
}
