import { useState } from "react";
import { Button, Form, Input, Select, Switch, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  walfareApi,
  type WelfareService,
  type WelfareServiceInput,
  type WelfareServiceType,
} from "@/api/walfareApi";
import { queryKeys, useCrud } from "@/query";
import { CrudTable, FormDrawer, JalaliDateField, PageHeader } from "@/components/ui";
import { faDigits } from "@/lib/jalali";

interface ServiceFormValues {
  type: WelfareServiceType;
  title: string;
  startDate: string;
  endDate: string;
  activationDate: string;
  isAccessible: boolean;
}

/**
 * The kind decides which screen a member lands on: type 1 opens the pool calendar, type 2 opens
 * the guesthouse request form. Getting it wrong makes the service unreachable, so it is a real
 * field on the form rather than a constant.
 */
const TYPE_OPTIONS: { value: WelfareServiceType; label: string }[] = [
  { value: 1, label: "بلیط استخر" },
  { value: 2, label: "مهمانسرا" },
];

/** خدمات رفاهی — the offering + its window. Two kinds: pool tickets (1) and guesthouses (2). */
export function AdminServicesPage() {
  const [form] = Form.useForm<ServiceFormValues>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WelfareService | null>(null);

  const crud = useCrud<WelfareService, WelfareServiceInput>({
    key: queryKeys.services.admin(),
    list: walfareApi.adminServices,
    create: walfareApi.createService,
    update: walfareApi.updateService,
    remove: walfareApi.deleteService,
    // The engineer-facing list caches separately.
    alsoInvalidate: [queryKeys.services.all()],
  });

  const columns: ColumnsType<WelfareService> = [
    { title: "عنوان", dataIndex: "title", key: "title" },
    {
      title: "نوع",
      dataIndex: "type",
      key: "type",
      width: 110,
      render: (v: WelfareServiceType) =>
        v === 2 ? <Tag color="orange">مهمانسرا</Tag> : <Tag color="blue">بلیط استخر</Tag>,
    },
    {
      title: "بازه",
      key: "window",
      width: 220,
      render: (_, r) => `${faDigits(r.startDate)} تا ${faDigits(r.endDate)}`,
    },
    {
      title: "فعال‌سازی",
      dataIndex: "activationDate",
      key: "activationDate",
      width: 120,
      render: (v: string) => faDigits(v),
    },
    {
      title: "استخرها",
      dataIndex: "poolCount",
      key: "poolCount",
      width: 100,
      align: "center",
      // A guesthouse service has no pools, so its count is always 0. Printing «۰» would read
      // as something broken; a dash says "does not apply".
      render: (v: number, r) => (r.type === 2 ? "—" : faDigits(v)),
    },
    {
      title: "وضعیت",
      dataIndex: "isAccessible",
      key: "isAccessible",
      width: 110,
      render: (v: boolean) =>
        v ? <Tag color="green">قابل دسترس</Tag> : <Tag>غیرفعال</Tag>,
    },
  ];

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (record: WelfareService) => {
    setEditing(record);
    setOpen(true);
  };

  const handleSubmit = async (values: ServiceFormValues) => {
    // `values.type` — NEVER a constant here. It used to be hardcoded to 1, which made a
    // guesthouse service impossible to create AND silently turned an existing one back into a
    // pool the first time somebody edited its title.
    const input: WelfareServiceInput = { ...values };
    if (editing) await crud.update.mutateAsync({ id: editing.id, input });
    else await crud.create.mutateAsync(input);
  };

  return (
    <>
      <PageHeader title="مدیریت خدمات رفاهی" subtitle="تعریف خدمت (بلیط استخر یا مهمانسرا) و بازه فعال بودن آن" />

      <CrudTable<WelfareService>
        columns={columns}
        data={crud.items}
        loading={crud.isFetching}
        error={crud.error}
        onRetry={crud.refetch}
        onRefresh={crud.refetch}
        onCreate={openCreate}
        createLabel="افزودن خدمت"
        onEdit={openEdit}
        onDelete={(r) => crud.remove.mutate(r.id)}
        deleteConfirmTitle={(r) => `حذف خدمت «${r.title}»؟`}
        deleting={crud.deleting}
        emptyText="هنوز خدمتی تعریف نشده است"
        emptyAction={
          <Button type="primary" onClick={openCreate}>
            افزودن خدمت
          </Button>
        }
      />

      <FormDrawer<ServiceFormValues>
        open={open}
        form={form}
        width={480}
        title={editing ? "ویرایش خدمت" : "افزودن خدمت"}
        initialValues={
          editing
            ? {
                type: editing.type,
                title: editing.title,
                startDate: editing.startDate,
                endDate: editing.endDate,
                activationDate: editing.activationDate,
                isAccessible: editing.isAccessible,
              }
            : { isAccessible: true, type: 1 as WelfareServiceType }
        }
        submitting={crud.saving}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
      >
        <Form.Item
          name="type"
          label="نوع خدمت"
          rules={[{ required: true, message: "نوع خدمت الزامی است" }]}
          extra="نوع تعیین می‌کند مهندس به کدام صفحه هدایت شود و پس از ثبت درخواست قابل تغییر نیست."
        >
          <Select<WelfareServiceType> options={TYPE_OPTIONS} />
        </Form.Item>
        <Form.Item name="title" label="عنوان" rules={[{ required: true, message: "عنوان الزامی است" }]}>
          <Input placeholder="بلیط استخر" maxLength={300} />
        </Form.Item>
        <Form.Item
          name="startDate"
          label="تاریخ شروع (شمسی)"
          rules={[{ required: true, message: "تاریخ شروع الزامی است" }]}
        >
          <JalaliDateField />
        </Form.Item>
        <Form.Item
          name="endDate"
          label="تاریخ پایان (شمسی)"
          rules={[{ required: true, message: "تاریخ پایان الزامی است" }]}
        >
          <JalaliDateField />
        </Form.Item>
        <Form.Item
          name="activationDate"
          label="تاریخ فعال‌سازی (شمسی)"
          rules={[{ required: true, message: "تاریخ فعال‌سازی الزامی است" }]}
          extra="از این تاریخ، خدمت در داشبورد مهندسین دیده می‌شود."
        >
          <JalaliDateField />
        </Form.Item>
        <Form.Item name="isAccessible" label="قابل دسترس برای مهندسین" valuePropName="checked">
          <Switch checkedChildren="بله" unCheckedChildren="خیر" />
        </Form.Item>
      </FormDrawer>
    </>
  );
}
