import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
  Typography,
} from "antd";
import type { NamePath } from "antd/es/form/interface";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  COMPANION_RELATION_LABELS,
  walfareApi,
  type CompanionRelation,
  type GuesthouseCompanion,
} from "@/api/walfareApi";
import { ApiError, errorMessage } from "@/api/client";
import { queryKeys, useApiQuery } from "@/query";
import { EmptyState, JalaliDateField, PageHeader } from "@/components/ui";
import { faDigits } from "@/lib/jalali";

/** The paper form's own limits. The API checks them too — see GuesthouseRequestInputValidator. */
const MAX_COMPANIONS = 5;
const MAX_INFANTS = 2;

/**
 * Keeps ONLY digits, after folding Persian and Arabic-Indic ones to ASCII.
 *
 * This mirrors `GuesthouseRequestInputValidator.Digits` on the server, and it must. A کد ملی
 * pasted out of a message carries an invisible direction mark that is NOT whitespace, so
 * `value.length` sees 11 where the eye sees 10 and we would refuse a perfectly good code the
 * server would have accepted. That exact bug locked an engineer out of this service before —
 * see docs/ai/GOTCHAS.md.
 */
function digitsOnly(value: string | undefined | null): string {
  if (!value) return "";
  let out = "";
  for (const ch of value) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ch >= "۰" && ch <= "۹") out += String("۰۱۲۳۴۵۶۷۸۹".indexOf(ch));
    else if (ch >= "٠" && ch <= "٩") out += String("٠١٢٣٤٥٦٧٨٩".indexOf(ch));
  }
  return out;
}

interface CompanionRow {
  fullName?: string;
  relation?: CompanionRelation;
}

interface InfantRow {
  fullName?: string;
}

interface FormValues {
  guesthouseId: number;
  fullName: string;
  nationalCode: string;
  membershipNumber?: string;
  mobile: string;
  checkInDate: string;
  checkOutDate: string;
  companions?: CompanionRow[];
  infants?: InfantRow[];
}

/**
 * Field names that exist as a real box on screen.
 *
 * A server error on `companions` maps to a Form.List, which has no input to paint, so painting
 * it there would show the user nothing at all. Those become a toast instead.
 */
const PAINTABLE = new Set([
  "guesthouseId",
  "fullName",
  "nationalCode",
  "membershipNumber",
  "mobile",
  "checkInDate",
  "checkOutDate",
]);

const RELATION_OPTIONS = Object.entries(COMPANION_RELATION_LABELS).map(([value, label]) => ({
  value: Number(value) as CompanionRelation,
  label,
}));

/** «فرم درخواست متقاضی» — the top half of the paper form, as a screen. */
export function GuesthouseRequestPage() {
  const { serviceId: serviceIdParam } = useParams<{ serviceId: string }>();
  const serviceId = Number(serviceIdParam);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const me = useApiQuery(queryKeys.me.get(), walfareApi.me);
  const services = useApiQuery(queryKeys.services.active(), walfareApi.activeServices);
  const service = services.data?.find((s) => s.id === serviceId);

  const guesthouses = useApiQuery(
    queryKeys.guesthouses.active(serviceId),
    () => walfareApi.activeGuesthouses(serviceId),
    { enabled: Number.isFinite(serviceId) },
  );

  // Fill in what the org already knows, ONCE. Every box stays editable: the record can be out
  // of date, and the letter is printed from what is typed here, not from the org row.
  useEffect(() => {
    if (seeded || !me.data) return;
    form.setFieldsValue({
      fullName: me.data.fullName,
      nationalCode: me.data.nationalCode,
      mobile: me.data.mobile ?? "",
    });
    setSeeded(true);
  }, [me.data, seeded, form]);

  const submit = async (values: FormValues) => {
    // Two lists on screen, one array on the wire. An infant carries no نسبت — the paper form
    // has no such column for one, and the server drops any relation sent with isInfant.
    const companions: GuesthouseCompanion[] = [
      ...(values.companions ?? [])
        .filter((c) => c?.fullName?.trim())
        .map((c) => ({
          fullName: c.fullName!.trim(),
          relation: c.relation ?? null,
          isInfant: false,
        })),
      ...(values.infants ?? [])
        .filter((c) => c?.fullName?.trim())
        .map((c) => ({ fullName: c.fullName!.trim(), relation: null, isInfant: true })),
    ];

    setSaving(true);
    try {
      await walfareApi.createGuesthouseRequest({
        guesthouseId: values.guesthouseId,
        fullName: values.fullName.trim(),
        nationalCode: values.nationalCode,
        membershipNumber: values.membershipNumber ?? "",
        mobile: values.mobile,
        checkInDate: values.checkInDate,
        checkOutDate: values.checkOutDate,
        companions,
      });
      void qc.invalidateQueries({ queryKey: queryKeys.guesthouseRequests.all() });
      message.success("درخواست شما ثبت شد");
      navigate("/reservations");
    } catch (err) {
      if (err instanceof ApiError && err.isValidation) {
        const fields = err.fieldErrors();
        const onScreen = fields.filter((f) => PAINTABLE.has(f.name));
        const elsewhere = fields.filter((f) => !PAINTABLE.has(f.name));
        if (onScreen.length) {
          // ApiError gives a flat field name; AntD setFields wants a NamePath.
          form.setFields(onScreen.map((f) => ({ name: f.name as NamePath, errors: f.errors })));
        }
        if (elsewhere.length) message.error(elsewhere[0].errors[0]);
        else if (!onScreen.length) message.error(errorMessage(err));
      } else {
        message.error(errorMessage(err, "ثبت درخواست ناموفق بود"));
      }
    } finally {
      setSaving(false);
    }
  };

  if (!Number.isFinite(serviceId)) {
    return <Alert type="error" showIcon message="سرویس نامعتبر" />;
  }

  // Only take over the screen when there is NOTHING to show. React Query keeps `data` and sets
  // `error` when a BACKGROUND refetch fails, and refetchOnReconnect is on by default — so
  // gating on `error` alone would wipe a half-filled form the moment a phone blinks offline.
  if (guesthouses.error && !guesthouses.data) {
    return (
      <Alert
        type="error"
        showIcon
        message="دریافت فهرست مهمانسراها ناموفق بود"
        description={errorMessage(guesthouses.error)}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={service?.title ?? "درخواست مهمانسرا"}
        subtitle="فرم را کامل کنید. پس از بررسی و تعیین مبلغ توسط امور رفاهی، لینک پرداخت برای شما ارسال می‌شود."
      />

      {guesthouses.isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : !guesthouses.data || guesthouses.data.length === 0 ? (
        <EmptyState description="در حال حاضر مهمانسرای فعالی برای این خدمت وجود ندارد." />
      ) : (
        <Form form={form} layout="vertical" onFinish={submit} requiredMark scrollToFirstError>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {guesthouses.error ? (
              <Alert
                type="warning"
                showIcon
                message="فهرست مهمانسراها به‌روز نشد. آنچه نوشته‌اید حفظ شده است."
              />
            ) : null}
            <Card title="مهمانسرا و تاریخ اقامت">
              <Form.Item
                name="guesthouseId"
                label="مهمانسرا"
                rules={[{ required: true, message: "انتخاب مهمانسرا الزامی است." }]}
              >
                <Select
                  placeholder="یک مهمانسرا را انتخاب کنید"
                  options={guesthouses.data.map((g) => ({
                    value: g.id,
                    label: `${g.city} — ${g.name}`,
                  }))}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>

              <Row gutter={[12, 0]}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="checkInDate"
                    label="تاریخ ورود"
                    rules={[{ required: true, message: "تاریخ ورود الزامی است." }]}
                  >
                    <JalaliDateField placeholder="انتخاب تاریخ ورود" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="checkOutDate"
                    label="تاریخ خروج"
                    dependencies={["checkInDate"]}
                    rules={[
                      { required: true, message: "تاریخ خروج الزامی است." },
                      ({ getFieldValue }) => ({
                        validator(_, value: string) {
                          const from = getFieldValue("checkInDate") as string | undefined;
                          // Both are zero-padded YYYY/MM/DD, so a plain string compare orders
                          // them correctly — the same trick BookingPage uses.
                          if (!value || !from || value > from) return Promise.resolve();
                          return Promise.reject(
                            new Error("تاریخ خروج باید بعد از تاریخ ورود باشد."),
                          );
                        },
                      }),
                    ]}
                  >
                    <JalaliDateField placeholder="انتخاب تاریخ خروج" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card title="مشخصات متقاضی">
              <Row gutter={[12, 0]}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="fullName"
                    label="نام و نام خانوادگی"
                    rules={[{ required: true, message: "نام و نام خانوادگی الزامی است." }]}
                  >
                    <Input placeholder="نام و نام خانوادگی" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="nationalCode"
                    label="کد ملی"
                    rules={[
                      {
                        validator: (_, value: string) =>
                          digitsOnly(value).length === 10
                            ? Promise.resolve()
                            : Promise.reject(new Error("کد ملی باید ۱۰ رقم باشد.")),
                      },
                    ]}
                  >
                    <Input placeholder="۱۰ رقم" inputMode="numeric" autoComplete="off" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="mobile"
                    label="شماره همراه"
                    rules={[
                      {
                        validator: (_, value: string) =>
                          digitsOnly(value).length === 11
                            ? Promise.resolve()
                            : Promise.reject(new Error("شماره همراه باید ۱۱ رقم باشد.")),
                      },
                    ]}
                  >
                    <Input placeholder="۰۹۱۲۳۴۵۶۷۸۹" inputMode="tel" autoComplete="tel" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  {/* Optional on the server too — `me` has no membership number to fill it with. */}
                  <Form.Item name="membershipNumber" label="شماره عضویت (اختیاری)">
                    <Input placeholder="در صورت داشتن" inputMode="numeric" autoComplete="off" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card title="اسامی همراهان">
              <Form.List name="companions">
                {(fields, { add, remove }) => (
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    {fields.length === 0 ? (
                      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                        اگر همراهی ندارید، این بخش را خالی بگذارید.
                      </Typography.Text>
                    ) : null}

                    {fields.map(({ key, name, ...restField }, index) => (
                      <Card
                        key={key}
                        size="small"
                        title={`همراه ${faDigits(index + 1)}`}
                        extra={
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(name)}
                            aria-label={`حذف همراه ${faDigits(index + 1)}`}
                          />
                        }
                      >
                        <Row gutter={[12, 0]}>
                          <Col xs={24} sm={14}>
                            <Form.Item
                              {...restField}
                              name={[name, "fullName"]}
                              label="نام و نام خانوادگی"
                              rules={[{ required: true, message: "نام همراه الزامی است." }]}
                              style={{ marginBottom: 0 }}
                            >
                              <Input placeholder="نام همراه" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={10}>
                            <Form.Item
                              {...restField}
                              name={[name, "relation"]}
                              label="نسبت"
                              style={{ marginBottom: 0 }}
                            >
                              <Select
                                placeholder="انتخاب نسبت"
                                options={RELATION_OPTIONS}
                                allowClear
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    ))}

                    <Button
                      type="dashed"
                      block
                      icon={<PlusOutlined />}
                      onClick={() => add()}
                      disabled={fields.length >= MAX_COMPANIONS}
                    >
                      {fields.length >= MAX_COMPANIONS ? "حداکثر ۵ همراه" : "افزودن همراه"}
                    </Button>
                  </Space>
                )}
              </Form.List>
            </Card>

            <Card title="اسامی کودکان زیر دو سال">
              <Form.List name="infants">
                {(fields, { add, remove }) => (
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      کودک زیر دو سال در تعداد نفرات محاسبه نمی‌شود.
                    </Typography.Text>

                    {fields.map(({ key, name, ...restField }, index) => (
                      <Row key={key} gutter={[8, 0]} align="bottom">
                        <Col flex="auto">
                          <Form.Item
                            {...restField}
                            name={[name, "fullName"]}
                            label={`کودک ${faDigits(index + 1)}`}
                            rules={[{ required: true, message: "نام کودک الزامی است." }]}
                            style={{ marginBottom: 0 }}
                          >
                            <Input placeholder="نام و نام خانوادگی" />
                          </Form.Item>
                        </Col>
                        <Col flex="none">
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(name)}
                            aria-label={`حذف کودک ${faDigits(index + 1)}`}
                          />
                        </Col>
                      </Row>
                    ))}

                    <Button
                      type="dashed"
                      block
                      icon={<PlusOutlined />}
                      onClick={() => add()}
                      disabled={fields.length >= MAX_INFANTS}
                    >
                      {fields.length >= MAX_INFANTS ? "حداکثر ۲ کودک" : "افزودن کودک زیر دو سال"}
                    </Button>
                  </Space>
                )}
              </Form.List>
            </Card>

            <Space wrap>
              <Button type="primary" htmlType="submit" loading={saving}>
                ثبت درخواست
              </Button>
              <Button onClick={() => navigate("/")} disabled={saving}>
                بازگشت به خدمات
              </Button>
            </Space>
          </Space>
        </Form>
      )}
    </>
  );
}
