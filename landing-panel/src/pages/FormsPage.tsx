import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  FileTextOutlined,
  PaperClipOutlined,
  PictureOutlined,
  PlusOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { formsApi, mediaApi } from "@/api/endpoints";
import type { FormFieldKind, SiteForm, SiteFormFieldInput, SiteFormInput } from "@/api/types";
import { CrudTable, FormDrawer, ImageUploader, PageHeader } from "@/components/ui";
import { queryKeys, useCrud } from "@/query";
import { formatNumber, truncate } from "@/lib/format";

/** What each kind is called on screen, and the icon that stands for it. */
const KIND_LABELS: Record<FormFieldKind, string> = {
  text: "متن",
  file: "فایل",
};

/** Drawer field shape — `ImageUploader`/optional text fields hand back `undefined`, the API wants strings. */
interface FormValues {
  title: string;
  note?: string;
  deadline?: string;
  image?: string;
  isOpen: boolean;
  successMessage?: string;
  sortOrder: number;
  fields?: SiteFormFieldInput[];
}

function toInput(values: FormValues): SiteFormInput {
  return {
    title: values.title.trim(),
    note: values.note?.trim() ?? "",
    deadline: values.deadline?.trim() ?? "",
    image: values.image?.trim() ?? "",
    isOpen: !!values.isOpen,
    successMessage: values.successMessage?.trim() ?? "",
    sortOrder: values.sortOrder ?? 0,
    // Position in the list IS the order shown to the member, so it is written here rather than
    // asking an editor to keep numbers in step by hand.
    fields: (values.fields ?? []).map((f, index) => ({
      id: f.id ?? 0,
      label: (f.label ?? "").trim(),
      kind: f.kind,
      isRequired: !!f.isRequired,
      allowMultiple: f.kind === "file" && !!f.allowMultiple,
      maxLength: f.kind === "text" ? (f.maxLength ?? null) : null,
      help: f.help?.trim() ? f.help.trim() : null,
      sortOrder: index + 1,
    })),
  };
}

function dtoToInput(form: SiteForm): SiteFormInput {
  return {
    title: form.title,
    note: form.note,
    deadline: form.deadline,
    image: form.image,
    isOpen: form.isOpen,
    successMessage: form.successMessage ?? "",
    sortOrder: form.sortOrder,
    fields: (form.fields ?? []).map((f) => ({
      id: f.id,
      label: f.label,
      kind: f.kind,
      isRequired: f.isRequired,
      allowMultiple: f.allowMultiple,
      maxLength: f.maxLength ?? null,
      help: f.help ?? null,
      sortOrder: f.sortOrder,
    })),
  };
}

function dtoToValues(form: SiteForm): FormValues {
  return {
    title: form.title,
    note: form.note ?? "",
    deadline: form.deadline ?? "",
    image: form.image || undefined,
    isOpen: form.isOpen,
    successMessage: form.successMessage ?? "",
    sortOrder: form.sortOrder,
    fields: dtoToInput(form).fields,
  };
}

/** Table thumbnail — falls back to a placeholder when the path is empty or the image 404s. */
function Thumb({ src, alt }: { src?: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);
  const url = mediaApi.url(src);

  if (!url || broken) {
    return (
      <div
        aria-label="بدون تصویر"
        style={{
          width: 64,
          height: 42,
          borderRadius: 6,
          display: "grid",
          placeItems: "center",
          background: "var(--ant-color-fill-quaternary)",
          border: "1px dashed var(--ant-color-border)",
        }}
      >
        <PictureOutlined style={{ color: "var(--ant-color-text-quaternary)" }} />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      onError={() => setBroken(true)}
      style={{ width: 64, height: 42, objectFit: "cover", borderRadius: 6, display: "block" }}
    />
  );
}

export function FormsPage() {
  const navigate = useNavigate();

  const crud = useCrud<SiteForm, SiteFormInput>({
    key: queryKeys.forms.all(),
    list: formsApi.list,
    create: formsApi.create,
    update: formsApi.update,
    remove: formsApi.remove,
    labels: {
      created: "فرم افزوده شد",
      updated: "فرم ذخیره شد",
      removed: "فرم حذف شد",
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SiteForm | null>(null);
  /** Which row's inline «باز/بسته» switch is in flight. */
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const nextSortOrder = useMemo(
    () => crud.items.reduce((max, f) => Math.max(max, f.sortOrder), 0) + 1,
    [crud.items],
  );

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (record: SiteForm) => {
    setEditing(record);
    setOpen(true);
  };

  const handleSubmit = async (values: FormValues) => {
    const input = toInput(values);
    if (editing) {
      await crud.update.mutateAsync({ id: editing.id, input });
    } else {
      await crud.create.mutateAsync(input);
    }
  };

  const toggleOpen = async (record: SiteForm, isOpen: boolean) => {
    setTogglingId(record.id);
    try {
      await crud.update.mutateAsync({ id: record.id, input: { ...dtoToInput(record), isOpen } });
    } catch {
      // useCrud already surfaced the error toast; keep the switch on its previous value.
    } finally {
      setTogglingId(null);
    }
  };

  const columns: ColumnsType<SiteForm> = [
    {
      title: "تصویر",
      dataIndex: "image",
      key: "image",
      width: 90,
      render: (_: unknown, record) => <Thumb src={record.image} alt={record.title} />,
    },
    {
      title: "عنوان",
      dataIndex: "title",
      key: "title",
      render: (_: unknown, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.title}</Typography.Text>
          {record.note ? (
            <Tooltip title={record.note}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {truncate(record.note, 70)}
              </Typography.Text>
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
    {
      title: "مهلت",
      dataIndex: "deadline",
      key: "deadline",
      width: 150,
      render: (value: string) =>
        value ? <Tag color="blue">{value}</Tag> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "وضعیت",
      dataIndex: "isOpen",
      key: "isOpen",
      width: 150,
      render: (_: unknown, record) => (
        <Space size={8}>
          <Switch
            checked={record.isOpen}
            loading={togglingId === record.id}
            checkedChildren="باز"
            unCheckedChildren="بسته"
            aria-label={record.isOpen ? "بستن ثبت‌نام" : "بازکردن ثبت‌نام"}
            onChange={(checked) => void toggleOpen(record, checked)}
          />
          <Tag color={record.isOpen ? "green" : "default"}>
            {record.isOpen ? "ثبت‌نام باز" : "بسته"}
          </Tag>
        </Space>
      ),
    },
    {
      title: "فیلدها",
      key: "fields",
      width: 160,
      render: (_: unknown, record) => {
        const fields = record.fields ?? [];
        if (fields.length === 0) {
          return <Tag color="orange">بدون فیلد</Tag>;
        }
        const text = fields.filter((f) => f.kind === "text").length;
        const file = fields.length - text;
        return (
          <Tooltip title={fields.map((f) => f.label).join("، ")}>
            <Space size={4}>
              {text > 0 ? (
                <Tag icon={<FileTextOutlined />}>{formatNumber(text)}</Tag>
              ) : null}
              {file > 0 ? (
                <Tag icon={<PaperClipOutlined />} color="blue">
                  {formatNumber(file)}
                </Tag>
              ) : null}
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: "ثبت‌نام‌ها",
      dataIndex: "submissionCount",
      key: "submissionCount",
      width: 130,
      align: "center",
      sorter: (a, b) => a.submissionCount - b.submissionCount,
      render: (_: unknown, record) =>
        record.submissionCount > 0 ? (
          <Tooltip title="مشاهده ثبت‌نام‌های این فرم">
            <Button
              type="link"
              icon={<TeamOutlined />}
              onClick={() => navigate(`/submissions?formId=${record.id}`)}
            >
              {formatNumber(record.submissionCount)}
            </Button>
          </Tooltip>
        ) : (
          <Typography.Text type="secondary">۰</Typography.Text>
        ),
    },
    {
      title: "ترتیب",
      dataIndex: "sortOrder",
      key: "sortOrder",
      width: 90,
      align: "center",
      defaultSortOrder: "ascend",
      sorter: (a, b) => a.sortOrder - b.sortOrder,
      render: (value: number) => formatNumber(value),
    },
  ];

  return (
    <>
      <PageHeader title="فرم‌ها" subtitle="فرم‌های ثبت‌نام و مهلت‌های آن‌ها" />

      <CrudTable<SiteForm>
        columns={columns}
        // `undefined` while the first request is in flight -> CrudTable shows its skeleton.
        data={crud.query.data}
        loading={crud.isLoading || crud.isFetching}
        error={crud.error}
        onRetry={crud.refetch}
        onRefresh={crud.refetch}
        searchable
        searchPlaceholder="جستجو در عنوان فرم…"
        searchFields={["title", "note", "deadline"]}
        onCreate={openCreate}
        createLabel="افزودن فرم"
        onEdit={openEdit}
        onDelete={(record) => crud.remove.mutate(record.id)}
        deleteConfirmTitle={(record) => `فرم «${record.title}» حذف شود؟`}
        deleting={crud.deleting}
        emptyText="هنوز فرمی ثبت نشده است"
        emptyAction={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            افزودن فرم
          </Button>
        }
        scrollX={1000}
      />

      <FormDrawer<FormValues>
        open={open}
        title={editing ? `ویرایش فرم: ${editing.title}` : "افزودن فرم"}
        width={560}
        submitting={crud.saving}
        initialValues={
          editing
            ? dtoToValues(editing)
            : {
                isOpen: true,
                sortOrder: nextSortOrder,
                note: "",
                deadline: "",
                successMessage: "",
                // A new form starts with the one field almost every form needs, so the editor is
                // never looking at an empty builder wondering what to do first.
                fields: [
                  {
                    id: 0,
                    label: "نام و نام خانوادگی",
                    kind: "text",
                    isRequired: true,
                    allowMultiple: false,
                    maxLength: 200,
                    help: null,
                    sortOrder: 1,
                  },
                ] satisfies SiteFormFieldInput[],
              }
        }
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
      >
        <Form.Item
          name="title"
          label="عنوان"
          rules={[{ required: true, message: "عنوان فرم را وارد کنید" }]}
        >
          <Input placeholder="مثال: ثبت‌نام دوره بازآموزی" maxLength={200} />
        </Form.Item>

        <Form.Item name="note" label="توضیحات">
          <Input.TextArea
            rows={4}
            maxLength={1000}
            showCount
            placeholder="توضیح کوتاه درباره فرم، شرایط و مدارک لازم"
          />
        </Form.Item>

        <Form.Item
          name="deadline"
          label="مهلت"
          tooltip="متن آزاد؛ همان‌طور که در سایت نمایش داده می‌شود (مثال: ۳۱ شهریور)"
        >
          <Input placeholder="۳۱ شهریور" maxLength={100} />
        </Form.Item>

        <Form.Item name="image" label="تصویر">
          <ImageUploader placeholder="/images/forms/form-1.png" />
        </Form.Item>

        <Form.Item
          name="isOpen"
          label="ثبت‌نام باز است"
          valuePropName="checked"
          tooltip="با بستن فرم، امکان ثبت‌نام جدید در سایت غیرفعال می‌شود"
        >
          <Switch checkedChildren="باز" unCheckedChildren="بسته" />
        </Form.Item>

        <Form.Item
          name="sortOrder"
          label="ترتیب نمایش"
          rules={[{ required: true, message: "ترتیب نمایش را وارد کنید" }]}
        >
          <InputNumber min={0} max={9999} style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item
          name="successMessage"
          label="پیام پس از ثبت"
          tooltip="پس از ثبت موفق به کاربر نشان داده می‌شود. خالی بگذارید تا متن پیش‌فرض سایت نمایش داده شود."
        >
          <Input.TextArea
            rows={2}
            maxLength={1000}
            showCount
            placeholder="مثال: درخواست شما ثبت شد. همکاران ما تماس می‌گیرند."
          />
        </Form.Item>

        <Typography.Title level={5} style={{ marginTop: 8 }}>
          فیلدهای فرم
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          کاربر دقیقاً همین فیلدها را به همین ترتیب می‌بیند. برای جابه‌جایی از کلیدهای بالا و پایین
          استفاده کنید.
        </Typography.Paragraph>

        <Form.List
          name="fields"
          rules={[
            {
              validator: async (_, fields?: SiteFormFieldInput[]) => {
                if (!fields || fields.length === 0) {
                  throw new Error("حداقل یک فیلد اضافه کنید");
                }
              },
            },
          ]}
        >
          {(items, { add, remove, move }, { errors }) => (
            <>
              {items.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="هنوز فیلدی اضافه نشده است"
                  style={{ marginBottom: 12 }}
                />
              ) : null}

              {items.map((item, index) => (
                <Card
                  key={item.key}
                  size="small"
                  style={{ marginBottom: 10 }}
                  title={
                    <Space size={6}>
                      <Typography.Text type="secondary">{formatNumber(index + 1)}.</Typography.Text>
                      <Form.Item name={[item.name, "kind"]} noStyle>
                        <Select
                          size="small"
                          style={{ width: 110 }}
                          aria-label="نوع فیلد"
                          options={[
                            { value: "text", label: <Space size={6}><FileTextOutlined />{KIND_LABELS.text}</Space> },
                            { value: "file", label: <Space size={6}><PaperClipOutlined />{KIND_LABELS.file}</Space> },
                          ]}
                        />
                      </Form.Item>
                    </Space>
                  }
                  extra={
                    <Space size={4}>
                      <Button
                        size="small"
                        type="text"
                        icon={<ArrowUpOutlined />}
                        aria-label="انتقال به بالا"
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                      />
                      <Button
                        size="small"
                        type="text"
                        icon={<ArrowDownOutlined />}
                        aria-label="انتقال به پایین"
                        disabled={index === items.length - 1}
                        onClick={() => move(index, index + 1)}
                      />
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label="حذف فیلد"
                        onClick={() => remove(item.name)}
                      />
                    </Space>
                  }
                >
                  {/* The id travels back untouched: the server matches on it to keep answers
                      grouped under the right field. A new field carries 0. */}
                  <Form.Item name={[item.name, "id"]} hidden>
                    <InputNumber />
                  </Form.Item>

                  <Form.Item
                    name={[item.name, "label"]}
                    label="عنوان فیلد"
                    rules={[{ required: true, message: "عنوان فیلد را وارد کنید" }]}
                    style={{ marginBottom: 8 }}
                  >
                    <Input placeholder="مثال: کد ملی" maxLength={300} />
                  </Form.Item>

                  <Form.Item name={[item.name, "help"]} label="راهنما" style={{ marginBottom: 8 }}>
                    <Input placeholder="زیر فیلد نمایش داده می‌شود؛ مثال: فقط PDF" maxLength={500} />
                  </Form.Item>

                  <Space size={16} wrap>
                    <Form.Item
                      name={[item.name, "isRequired"]}
                      label="اجباری"
                      valuePropName="checked"
                      style={{ marginBottom: 0 }}
                    >
                      <Switch size="small" />
                    </Form.Item>

                    {/* Each option belongs to one kind only, so the other is hidden rather than
                        shown disabled — a switch you cannot use is just noise. */}
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, cur) =>
                        prev.fields?.[item.name]?.kind !== cur.fields?.[item.name]?.kind
                      }
                    >
                      {({ getFieldValue }) =>
                        getFieldValue(["fields", item.name, "kind"]) === "file" ? (
                          <Form.Item
                            name={[item.name, "allowMultiple"]}
                            label="چند فایل"
                            valuePropName="checked"
                            style={{ marginBottom: 0 }}
                            tooltip="حداکثر ۳ فایل، هرکدام تا ۵ مگابایت"
                          >
                            <Switch size="small" />
                          </Form.Item>
                        ) : (
                          <Form.Item
                            name={[item.name, "maxLength"]}
                            label="حداکثر نویسه"
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber min={1} max={4000} placeholder="بدون محدودیت" style={{ width: 150 }} />
                          </Form.Item>
                        )
                      }
                    </Form.Item>
                  </Space>
                </Card>
              ))}

              <Space wrap>
                <Button
                  icon={<FileTextOutlined />}
                  onClick={() => add({ id: 0, kind: "text", isRequired: false, allowMultiple: false })}
                >
                  افزودن فیلد متن
                </Button>
                <Button
                  icon={<PaperClipOutlined />}
                  onClick={() => add({ id: 0, kind: "file", isRequired: false, allowMultiple: false })}
                >
                  افزودن فیلد فایل
                </Button>
              </Space>

              <Form.ErrorList errors={errors} />
            </>
          )}
        </Form.List>

        {editing && editing.submissionCount > 0 ? (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 12 }}
            message="این فرم ثبت‌نام دارد"
            description="حذف یک فیلد، پاسخ‌های ثبت‌شده را پاک نمی‌کند؛ آن‌ها با عنوان همان زمان باقی می‌مانند."
          />
        ) : null}
      </FormDrawer>
    </>
  );
}

export default FormsPage;
