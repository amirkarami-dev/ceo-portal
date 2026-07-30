import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  ArrowRightOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { PageHeader } from "../../components/PageHeader";
import { JalaliDateField, TimeField } from "../../components/ui/JalaliFields";
import { PhotoField } from "../../components/ui/PhotoField";
import { useCreateElection, useElection, useUpdateElection } from "../../lib/queries";
import {
  EligibilityMode,
  ElectionStatus,
  PHASE_COLOURS,
  PHASE_LABELS,
  RESHTE_OPTIONS,
  fromWireTime,
  toWireTime,
  type CandidateInput,
  type ElectionInput,
} from "../../lib/types";
import { ApiError } from "../../lib/api";

/** What the form holds. Times are "HH:mm" here and widened to TimeOnly on submit. */
interface FormValues {
  title: string;
  description?: string;
  eligibilityMode: EligibilityMode;
  reshteCodes: string[];
  dateJalali: string;
  startTime: string;
  endTime: string;
  maxSelections: number;
  candidates: {
    fullName: string;
    description?: string;
    reshteCode?: string;
    educationLevel?: string;
    image?: string;
  }[];
}

const EMPTY: FormValues = {
  title: "",
  description: "",
  eligibilityMode: EligibilityMode.AllMembers,
  reshteCodes: [],
  dateJalali: "",
  startTime: "08:00",
  endTime: "18:00",
  maxSelections: 1,
  candidates: [{ fullName: "" }],
};

const RESHTE_LABEL = new Map(RESHTE_OPTIONS.map((r) => [r.value, r.label] as [string, string]));

export function ElectionForm() {
  const { id: idParam } = useParams();
  const id = idParam ? Number(idParam) : undefined;
  const isNew = idParam === undefined;

  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<FormValues>();

  const { data, isLoading } = useElection(id);
  const create = useCreateElection();
  const update = useUpdateElection();

  // The server decides. Draft = editable; published-and-open, cancelled, or any ballot cast = frozen.
  // Guessing this on the client would let the form accept typing it is about to be refused for.
  const readOnly = !isNew && data ? !data.isEditable : false;

  useEffect(() => {
    if (isNew) {
      form.setFieldsValue(EMPTY);
      return;
    }
    if (!data) return;

    form.setFieldsValue({
      title: data.title,
      description: data.description ?? "",
      eligibilityMode: data.eligibilityMode,
      reshteCodes: data.eligibleReshtes.map((r) => r.code),
      dateJalali: data.dateJalali,
      startTime: fromWireTime(data.startTime),
      endTime: fromWireTime(data.endTime),
      maxSelections: data.maxSelections,
      candidates: data.candidates.map((c) => ({
        fullName: c.fullName,
        description: c.description ?? undefined,
        reshteCode: c.reshteCode ?? undefined,
        educationLevel: c.educationLevel ?? undefined,
        image: c.image ?? undefined,
      })),
    });
  }, [data, form, isNew]);

  const toInput = (v: FormValues): ElectionInput => ({
    title: v.title.trim(),
    description: v.description?.trim() || null,
    eligibilityMode: v.eligibilityMode,
    dateJalali: v.dateJalali,
    startTime: toWireTime(v.startTime),
    endTime: toWireTime(v.endTime),
    maxSelections: v.maxSelections,
    // Only sent for ByReshte. The server clears the set for AllMembers anyway, but sending a stale
    // list would make the payload disagree with what the admin sees on screen.
    eligibleReshtes:
      v.eligibilityMode === EligibilityMode.ByReshte
        ? v.reshteCodes.map((code) => ({ code, label: RESHTE_LABEL.get(code) ?? null }))
        : [],
    candidates: v.candidates.map(
      (c, i): CandidateInput => ({
        fullName: c.fullName.trim(),
        description: c.description?.trim() || null,
        reshteCode: c.reshteCode || null,
        educationLevel: c.educationLevel?.trim() || null,
        image: c.image?.trim() || null,
        // Position in the list IS the ballot order. The server keeps a non-zero SortOrder as given
        // and falls back to the index otherwise, so the two agree.
        sortOrder: i,
      }),
    ),
  });

  const fail = (e: unknown) => message.error(e instanceof ApiError ? e.message : "ذخیره نشد");

  const submit = (v: FormValues) => {
    const input = toInput(v);

    if (isNew) {
      create.mutate(input, {
        onSuccess: (newId) => {
          message.success("پیش‌نویس انتخابات ساخته شد");
          // Straight to the saved record, not back to the list: the admin still has to publish it,
          // and landing on the row they just made is where that button is.
          navigate(`/admin/${newId}`, { replace: true });
        },
        onError: fail,
      });
      return;
    }

    update.mutate(
      { id: id!, input },
      { onSuccess: () => message.success("تغییرات ذخیره شد"), onError: fail },
    );
  };

  const saving = create.isPending || update.isPending;

  const header = useMemo(() => {
    if (isNew) return { title: "انتخابات جدید", subtitle: "پیش‌نویس ساخته می‌شود؛ انتشار مرحلهٔ بعد است" };
    return {
      title: data?.title ?? "انتخابات",
      subtitle: data ? `${data.dateJalali} — ${data.eligibilitySummary}` : undefined,
    };
  }, [data, isNew]);

  if (!isNew && isLoading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title={header.title}
        subtitle={header.subtitle}
        extra={
          <Space>
            {data && (
              <Tag color={PHASE_COLOURS[data.phase]}>{PHASE_LABELS[data.phase]}</Tag>
            )}
            <Button icon={<ArrowRightOutlined />} onClick={() => navigate("/admin")}>
              بازگشت
            </Button>
            {!readOnly && (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={() => void form.submit()}
              >
                {isNew ? "ساختن پیش‌نویس" : "ذخیره تغییرات"}
              </Button>
            )}
          </Space>
        }
      />

      {readOnly && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="این انتخابات قابل ویرایش نیست"
          description={
            data?.status === ElectionStatus.Cancelled
              ? "این انتخابات لغو شده است."
              : data && data.ballotCount > 0
                ? `برای این انتخابات ${data.ballotCount.toLocaleString("fa-IR")} رأی ثبت شده است. تغییر عنوان، کاندیداها، زمان یا شرایط رأی‌دهی، معنای آرای ثبت‌شده را عوض می‌کند و مجاز نیست.`
                : "رأی‌گیری آغاز شده است. پس از شروع، هیچ بخشی از انتخابات قابل تغییر نیست."
          }
        />
      )}

      <Form<FormValues>
        form={form}
        layout="vertical"
        initialValues={EMPTY}
        onFinish={submit}
        disabled={readOnly || saving}
        requiredMark="optional"
      >
        <Card title="اطلاعات انتخابات" style={{ marginBottom: 16 }}>
          <Form.Item
            name="title"
            label="عنوان"
            rules={[{ required: true, message: "عنوان لازم است" }, { max: 300 }]}
            extra="عنوان فقط یک نام است و هیچ محدودیتی ایجاد نمی‌کند. برای محدود کردن رأی‌دهندگان، از «شرایط رأی‌دهی» استفاده کنید."
          >
            <Input placeholder="مثال: انتخاب هیئت رئیسه واحد گاز" />
          </Form.Item>

          <Form.Item name="description" label="توضیحات" rules={[{ max: 2000 }]}>
            <Input.TextArea rows={3} placeholder="اختیاری — برای رأی‌دهندگان نمایش داده می‌شود" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="dateJalali"
                label="تاریخ برگزاری"
                rules={[{ required: true, message: "تاریخ برگزاری لازم است" }]}
              >
                <JalaliDateField />
              </Form.Item>
            </Col>
            <Col xs={12} md={5}>
              <Form.Item
                name="startTime"
                label="ساعت شروع"
                rules={[{ required: true, message: "ساعت شروع لازم است" }]}
              >
                <TimeField />
              </Form.Item>
            </Col>
            <Col xs={12} md={5}>
              <Form.Item
                name="endTime"
                label="ساعت پایان"
                dependencies={["startTime"]}
                rules={[
                  { required: true, message: "ساعت پایان لازم است" },
                  {
                    // The server refuses this too; catching it here saves a round trip and points at
                    // the field instead of showing a banner.
                    validator: (_, value: string) =>
                      !value || !form.getFieldValue("startTime") || value > form.getFieldValue("startTime")
                        ? Promise.resolve()
                        : Promise.reject(new Error("ساعت پایان باید بعد از ساعت شروع باشد")),
                  },
                ]}
              >
                <TimeField />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item
                name="maxSelections"
                label="تعداد انتخاب مجاز"
                tooltip="هر رأی‌دهنده حداکثر چند کاندیدا می‌تواند انتخاب کند"
                rules={[{ required: true, message: "تعداد انتخاب مجاز لازم است" }]}
              >
                <InputNumber min={1} max={50} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            ساعت‌ها به وقت ایران (+۳:۳۰) است. رأی‌گیری در ساعت پایان بسته می‌شود.
          </Typography.Text>
        </Card>

        <Card title="شرایط رأی‌دهی" style={{ marginBottom: 16 }}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="در هر حالت، رأی‌دهنده باید عضو فعال سازمان با پروانهٔ معتبر باشد"
            description="عضویت غیرفعال یا پروانهٔ منقضی، در هر دو حالت زیر مانع رأی دادن می‌شود."
          />

          <Form.Item name="eligibilityMode" label="چه کسانی می‌توانند رأی دهند؟">
            <Radio.Group>
              <Space direction="vertical">
                <Radio value={EligibilityMode.AllMembers}>همهٔ اعضای سازمان</Radio>
                <Radio value={EligibilityMode.ByReshte}>فقط رشته‌های انتخاب‌شده</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(a: FormValues, b: FormValues) => a.eligibilityMode !== b.eligibilityMode}
          >
            {({ getFieldValue }) =>
              getFieldValue("eligibilityMode") === EligibilityMode.ByReshte ? (
                <Form.Item
                  name="reshteCodes"
                  label="رشته‌های مجاز"
                  rules={[{ required: true, message: "حداقل یک رشته انتخاب کنید" }]}
                  extra="فهرست رشته‌های واقعی سازمان. صلاحیت‌ها (سازه، ژئوتکنیک، زه‌کشی، سازه نگهبان) رشته نیستند و در بانک اطلاعاتی سازمان ستونی ندارند."
                >
                  <Select
                    mode="multiple"
                    allowClear
                    placeholder="مثال: مکانیک"
                    options={RESHTE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Card>

        <Card
          title="کاندیداها"
          extra={
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              ترتیب فهرست، ترتیب نمایش در برگهٔ رأی است
            </Typography.Text>
          }
        >
          <Form.List
            name="candidates"
            rules={[
              {
                validator: async (_, list: FormValues["candidates"]) => {
                  if (!list || list.length === 0) throw new Error("حداقل یک کاندیدا لازم است");
                  const max = form.getFieldValue("maxSelections") as number;
                  // Picking 3 of 2 cannot be satisfied; the server refuses it at save AND at publish.
                  if (max > list.length) {
                    throw new Error("تعداد انتخاب مجاز نمی‌تواند از تعداد کاندیداها بیشتر باشد");
                  }
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                {fields.map((field, index) => (
                  <div key={field.key}>
                    {index > 0 && <Divider style={{ margin: "8px 0 16px" }} />}
                    <Row gutter={16} align="top">
                      <Col flex="none" style={{ paddingTop: 34 }}>
                        <Tag>{(index + 1).toLocaleString("fa-IR")}</Tag>
                      </Col>
                      <Col flex="auto">
                        <Row gutter={16}>
                          <Col xs={24} md={9}>
                            <Form.Item
                              name={[field.name, "fullName"]}
                              label="نام و نام خانوادگی"
                              rules={[{ required: true, message: "نام کاندیدا لازم است" }, { max: 300 }]}
                            >
                              <Input placeholder="نام کاندیدا" />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={7}>
                            <Form.Item name={[field.name, "reshteCode"]} label="رشته">
                              <Select
                                allowClear
                                placeholder="اختیاری"
                                options={RESHTE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={8}>
                            <Form.Item
                              name={[field.name, "educationLevel"]}
                              label="مقطع تحصیلی"
                              rules={[{ max: 200 }]}
                            >
                              <Input placeholder="مثال: کارشناسی ارشد" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={16}>
                            <Form.Item
                              name={[field.name, "description"]}
                              label="معرفی"
                              rules={[{ max: 2000 }]}
                            >
                              <Input.TextArea rows={2} placeholder="روی کارت کاندیدا نمایش داده می‌شود" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            {/* The photo uploads to object storage under the election service's own
                                elections/ folder. It was briefly a free-text path field, which meant
                                the admin had to put the file somewhere else first — so in practice it
                                stayed empty and every card fell back to initials. */}
                            <Form.Item
                              noStyle
                              shouldUpdate={(a: FormValues, b: FormValues) =>
                                a.candidates?.[index]?.fullName !== b.candidates?.[index]?.fullName
                              }
                            >
                              {({ getFieldValue }) => (
                                <Form.Item
                                  name={[field.name, "image"]}
                                  label="تصویر کاندیدا"
                                  rules={[{ max: 500 }]}
                                >
                                  <PhotoField
                                    disabled={readOnly}
                                    fallbackName={
                                      getFieldValue(["candidates", index, "fullName"]) as string
                                    }
                                  />
                                </Form.Item>
                              )}
                            </Form.Item>
                          </Col>
                        </Row>
                      </Col>
                      <Col flex="none" style={{ paddingTop: 30 }}>
                        <Button
                          danger
                          type="text"
                          icon={<DeleteOutlined />}
                          aria-label="حذف کاندیدا"
                          disabled={readOnly || fields.length === 1}
                          onClick={() => remove(field.name)}
                        />
                      </Col>
                    </Row>
                  </div>
                ))}

                <Form.ErrorList errors={errors} />

                <Button
                  type="dashed"
                  block
                  icon={<PlusOutlined />}
                  style={{ marginTop: 8 }}
                  onClick={() => add({ fullName: "" })}
                >
                  افزودن کاندیدا
                </Button>
              </>
            )}
          </Form.List>
        </Card>
      </Form>
    </>
  );
}
