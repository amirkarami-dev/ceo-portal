import { useEffect, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card, Col, Form, Input, Row, Space, Typography } from "antd";
import type { NamePath } from "antd/es/form/interface";
import {
  EyeOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RiseOutlined,
  SaveOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { ApiError } from "@/api/client";
import { settingsApi } from "@/api/endpoints";
import type { Settings, SettingsInput } from "@/api/types";
import { ErrorState, Loading, PageHeader, StatCard } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { queryKeys, useApiMutation, useApiQuery } from "@/query";

/**
 * The form mirrors `SettingsInput` — deliberately WITHOUT `footerLinks`/`stats`, which are
 * read-only here (footer links have their own page; stats are server-computed counters).
 * `Form.List` yields a sparse array, so a freshly-added phone row is `undefined` until typed in.
 */
type SettingsFormValues = Omit<SettingsInput, "phones"> & {
  phones?: (string | undefined)[];
};

/** Only these names exist on the form — anything else the API flags gets a toast instead. */
const FORM_FIELDS: readonly string[] = [
  "nameFa",
  "nameKu",
  "nameEn",
  "tagline",
  "address",
  "phones",
  "postalCode",
  "telegram",
  "instagram",
];

/** Server payload -> form values (an empty phone row so the field is never a blank void). */
function toFormValues(settings: Settings): SettingsFormValues {
  return {
    nameFa: settings.nameFa ?? "",
    nameKu: settings.nameKu ?? "",
    nameEn: settings.nameEn ?? "",
    tagline: settings.tagline ?? "",
    address: settings.address ?? "",
    phones: settings.phones?.length ? [...settings.phones] : [""],
    postalCode: settings.postalCode ?? "",
    telegram: settings.telegram ?? "",
    instagram: settings.instagram ?? "",
  };
}

/** Form values -> PUT body. Blank phone rows are dropped; footerLinks/stats never travel. */
function toInput(values: SettingsFormValues): SettingsInput {
  return {
    nameFa: values.nameFa?.trim() ?? "",
    nameKu: values.nameKu?.trim() ?? "",
    nameEn: values.nameEn?.trim() ?? "",
    tagline: values.tagline?.trim() ?? "",
    address: values.address?.trim() ?? "",
    phones: (values.phones ?? []).map((p) => (p ?? "").trim()).filter((p) => p.length > 0),
    postalCode: values.postalCode?.trim() ?? "",
    telegram: values.telegram?.trim() ?? "",
    instagram: values.instagram?.trim() ?? "",
  };
}

const LTR_INPUT: CSSProperties = { direction: "ltr", textAlign: "left" };

export function SettingsPage() {
  const [form] = Form.useForm<SettingsFormValues>();

  const query = useApiQuery<Settings>(queryKeys.settings.get(), settingsApi.get);
  const settings = query.data;

  // Seed the form whenever fresh settings land (first load and after a refetch).
  useEffect(() => {
    if (settings) form.setFieldsValue(toFormValues(settings));
  }, [settings, form]);

  const save = useApiMutation<SettingsInput>({
    mutationFn: (input) => settingsApi.update(input),
    invalidate: [queryKeys.settings.all()],
    success: "تنظیمات ذخیره شد",
  });

  const handleFinish = async (values: SettingsFormValues) => {
    try {
      await save.mutateAsync(toInput(values));
    } catch (err) {
      // useApiMutation already toasted — additionally paint per-field validation errors.
      if (err instanceof ApiError && err.isValidation) {
        const fields = err.fieldErrors().filter((f) => FORM_FIELDS.includes(f.name));
        if (fields.length) {
          form.setFields(fields.map((f) => ({ name: f.name as NamePath, errors: f.errors })));
        }
      }
    }
  };

  const stats = settings?.stats;

  return (
    <>
      <PageHeader
        title="تنظیمات"
        subtitle="نام، شعار، اطلاعات تماس و شبکه‌های اجتماعی"
        actions={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void query.refetch()}
            loading={query.isFetching}
          >
            به‌روزرسانی
          </Button>
        }
      />

      {/* Live counters — read-only, computed by the API. */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <StatCard
            label="بازدید کل"
            value={formatNumber(stats?.totalVisits)}
            icon={<EyeOutlined />}
            tone="blue"
            loading={query.isLoading}
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            label="بازدید امروز"
            value={formatNumber(stats?.todayVisits)}
            icon={<RiseOutlined />}
            tone="emerald"
            loading={query.isLoading}
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            label="کاربران آنلاین"
            value={formatNumber(stats?.online)}
            icon={<TeamOutlined />}
            tone="amber"
            loading={query.isLoading}
            hint="نشست‌های فعال در چند دقیقهٔ اخیر"
          />
        </Col>
      </Row>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="لینک‌های فوتر جداگانه مدیریت می‌شوند"
        description={
          <span>
            برای افزودن، ویرایش یا حذف لینک‌های فوتر به صفحهٔ{" "}
            <Link to="/footer-links">لینک‌های فوتر</Link> بروید. آمار بازدید نیز فقط خواندنی است و
            به‌صورت خودکار محاسبه می‌شود.
          </span>
        }
      />

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <Card>
          <Loading rows={10} />
        </Card>
      ) : (
        <Card>
          <Form<SettingsFormValues>
            form={form}
            layout="vertical"
            requiredMark
            onFinish={handleFinish}
            initialValues={settings ? toFormValues(settings) : undefined}
          >
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              نام و شعار
            </Typography.Title>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item
                  name="nameFa"
                  label="نام (فارسی)"
                  rules={[{ required: true, message: "نام فارسی الزامی است" }]}
                >
                  <Input placeholder="سازمان نظام مهندسی ساختمان استان کردستان" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="nameKu" label="نام (کردی)">
                  <Input placeholder="ڕێکخراوی ئەندازیاری…" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="nameEn" label="نام (انگلیسی)">
                  <Input placeholder="Kurdistan Construction Engineering Organization" style={LTR_INPUT} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="tagline" label="شعار">
              <Input placeholder="شعار سایت" />
            </Form.Item>

            <Typography.Title level={5}>اطلاعات تماس</Typography.Title>
            <Form.Item name="address" label="نشانی">
              <Input.TextArea rows={3} placeholder="نشانی کامل دفتر مرکزی" />
            </Form.Item>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="شماره‌های تماس" required={false}>
                  <Form.List name="phones">
                    {(fields, { add, remove }, { errors }) => (
                      <>
                        {/* `key` must not be spread into <Form.Item> (React 19 warns) — pull it out. */}
                        {fields.map(({ key, ...field }) => (
                          <Space key={key} align="baseline" style={{ display: "flex", marginBottom: 8 }}>
                            <Form.Item {...field} noStyle>
                              <Input
                                placeholder="۰۸۷-۳۳۲۸۰۰۰۰"
                                style={{ ...LTR_INPUT, width: 260 }}
                              />
                            </Form.Item>
                            <Button
                              type="text"
                              danger
                              aria-label="حذف شماره"
                              icon={<MinusCircleOutlined />}
                              onClick={() => remove(field.name)}
                            />
                          </Space>
                        ))}
                        <Button
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() => add("")}
                          style={{ width: 260 }}
                        >
                          افزودن شماره
                        </Button>
                        <Form.ErrorList errors={errors} />
                        {fields.length === 0 ? (
                          <Typography.Paragraph
                            type="secondary"
                            style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}
                          >
                            هیچ شماره‌ای ثبت نشده است.
                          </Typography.Paragraph>
                        ) : null}
                      </>
                    )}
                  </Form.List>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="postalCode" label="کد پستی">
                  <Input placeholder="۶۶۱۷۷۳۳۳۳۳" style={LTR_INPUT} />
                </Form.Item>
              </Col>
            </Row>

            <Typography.Title level={5}>شبکه‌های اجتماعی</Typography.Title>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="telegram" label="تلگرام">
                  <Input placeholder="https://t.me/…" style={LTR_INPUT} dir="ltr" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="instagram" label="اینستاگرام">
                  <Input placeholder="https://instagram.com/…" style={LTR_INPUT} dir="ltr" />
                </Form.Item>
              </Col>
            </Row>

            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={save.isPending}
              >
                ذخیره تغییرات
              </Button>
              <Button
                htmlType="button"
                onClick={() => {
                  if (settings) form.setFieldsValue(toFormValues(settings));
                }}
                disabled={save.isPending || !settings}
              >
                بازگردانی مقادیر
              </Button>
            </Space>
          </Form>
        </Card>
      )}
    </>
  );
}

export default SettingsPage;
