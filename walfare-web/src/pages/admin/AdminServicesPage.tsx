import { useState } from "react";
import { Button, Form, Input, Switch, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { walfareApi, type WelfareService, type WelfareServiceInput } from "@/api/walfareApi";
import { queryKeys, useCrud } from "@/query";
import { CrudTable, FormDrawer, JalaliDateField, PageHeader } from "@/components/ui";
import { faDigits } from "@/lib/jalali";

interface ServiceFormValues {
  title: string;
  startDate: string;
  endDate: string;
  activationDate: string;
  isAccessible: boolean;
}

/** خدمات رفاهی — the offering + its window. Only pool tickets exist today (type = 1). */
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
      render: (v: number) => faDigits(v),
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
    const input: WelfareServiceInput = { type: 1, ...values };
    if (editing) await crud.update.mutateAsync({ id: editing.id, input });
    else await crud.create.mutateAsync(input);
  };

  return (
    <>
      <PageHeader title="مدیریت خدمات رفاهی" subtitle="تعریف خدمت (بلیط استخر) و بازه فعال بودن آن" />

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
                title: editing.title,
                startDate: editing.startDate,
                endDate: editing.endDate,
                activationDate: editing.activationDate,
                isAccessible: editing.isAccessible,
              }
            : { isAccessible: true }
        }
        submitting={crud.saving}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
      >
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
