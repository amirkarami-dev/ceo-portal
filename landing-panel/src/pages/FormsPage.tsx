import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Form, Input, InputNumber, Space, Switch, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PictureOutlined, PlusOutlined, TeamOutlined } from "@ant-design/icons";
import { formsApi, mediaApi } from "@/api/endpoints";
import type { SiteForm, SiteFormInput } from "@/api/types";
import { CrudTable, FormDrawer, ImageUploader, PageHeader } from "@/components/ui";
import { queryKeys, useCrud } from "@/query";
import { formatNumber, truncate } from "@/lib/format";

/** Drawer field shape — `ImageUploader`/optional text fields hand back `undefined`, the API wants strings. */
interface FormValues {
  title: string;
  note?: string;
  deadline?: string;
  image?: string;
  isOpen: boolean;
  sortOrder: number;
}

function toInput(values: FormValues): SiteFormInput {
  return {
    title: values.title.trim(),
    note: values.note?.trim() ?? "",
    deadline: values.deadline?.trim() ?? "",
    image: values.image?.trim() ?? "",
    isOpen: !!values.isOpen,
    sortOrder: values.sortOrder ?? 0,
  };
}

function dtoToInput(form: SiteForm): SiteFormInput {
  return {
    title: form.title,
    note: form.note,
    deadline: form.deadline,
    image: form.image,
    isOpen: form.isOpen,
    sortOrder: form.sortOrder,
  };
}

function dtoToValues(form: SiteForm): FormValues {
  return {
    title: form.title,
    note: form.note ?? "",
    deadline: form.deadline ?? "",
    image: form.image || undefined,
    isOpen: form.isOpen,
    sortOrder: form.sortOrder,
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
          editing ? dtoToValues(editing) : { isOpen: true, sortOrder: nextSortOrder, note: "", deadline: "" }
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
      </FormDrawer>
    </>
  );
}

export default FormsPage;
