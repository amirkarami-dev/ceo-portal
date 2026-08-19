import { useMemo, useState } from "react";
import { Alert, Button, Form, Input, Select, Switch, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  walfareApi,
  type Guesthouse,
  type GuesthouseInput,
  type WelfareService,
} from "@/api/walfareApi";
import { queryKeys, useApiQuery, useCrud } from "@/query";
import { CrudTable, FormDrawer, PageHeader } from "@/components/ui";

interface GuesthouseFormValues {
  serviceId: number;
  name: string;
  city: string;
  managerName?: string;
  description?: string;
  isActive: boolean;
}

/** مهمانسراها — defined under a guesthouse-type welfare service; what a member requests a stay at. */
export function AdminGuesthousesPage() {
  const [form] = Form.useForm<GuesthouseFormValues>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Guesthouse | null>(null);

  const services = useApiQuery(queryKeys.services.admin(), walfareApi.adminServices);

  const crud = useCrud<Guesthouse, GuesthouseInput>({
    key: queryKeys.guesthouses.admin(),
    list: walfareApi.adminGuesthouses,
    create: walfareApi.createGuesthouse,
    update: walfareApi.updateGuesthouse,
    remove: walfareApi.deleteGuesthouse,
    labels: {
      created: "مهمانسرا با موفقیت افزوده شد",
      updated: "مهمانسرا با موفقیت ذخیره شد",
      // Never «حذف شد» flatly: the API keeps one that already has requests and only turns it off.
      removed: "مهمانسرا حذف یا غیرفعال شد",
    },
    // The member-facing list caches per service, under its own prefix.
    alsoInvalidate: [queryKeys.guesthouses.all()],
  });

  const serviceById = useMemo(() => {
    const map = new Map<number, WelfareService>();
    for (const s of services.data ?? []) map.set(s.id, s);
    return map;
  }, [services.data]);

  /**
   * Only type-2 services may hold a guesthouse.
   *
   * ServicesPage routes a member by `type`: attaching a guesthouse to a pool service would send
   * them to the booking calendar, and the guesthouse would simply never be reachable. The API
   * does not check this, so the picker is what prevents it.
   *
   * The one exception is a record already pointing somewhere else — keep its option present, or
   * editing its name would silently blank the service it belongs to.
   */
  const serviceOptions = useMemo(() => {
    const list = (services.data ?? []).filter((s) => s.type === 2);
    if (editing && !list.some((s) => s.id === editing.serviceId)) {
      const current = serviceById.get(editing.serviceId);
      return [
        ...list.map((s) => ({ value: s.id, label: s.title })),
        {
          value: editing.serviceId,
          label: current ? `${current.title} (نوع نامناسب)` : `خدمت #${editing.serviceId}`,
        },
      ];
    }
    return list.map((s) => ({ value: s.id, label: s.title }));
  }, [services.data, editing, serviceById]);

  const noGuesthouseService =
    !services.isLoading && (services.data ?? []).every((s) => s.type !== 2);

  const columns: ColumnsType<Guesthouse> = [
    { title: "نام مهمانسرا", dataIndex: "name", key: "name" },
    { title: "شهرستان", dataIndex: "city", key: "city", width: 140 },
    {
      title: "مسئول",
      dataIndex: "managerName",
      key: "managerName",
      width: 160,
      render: (v: string) => v || "—",
    },
    {
      title: "خدمت",
      dataIndex: "serviceId",
      key: "serviceId",
      width: 180,
      render: (id: number) => serviceById.get(id)?.title ?? "—",
    },
    {
      title: "وضعیت",
      dataIndex: "isActive",
      key: "isActive",
      width: 110,
      render: (v: boolean) => (v ? <Tag color="green">فعال</Tag> : <Tag>غیرفعال</Tag>),
    },
  ];

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (record: Guesthouse) => {
    setEditing(record);
    setOpen(true);
  };

  const handleSubmit = async (values: GuesthouseFormValues) => {
    const input: GuesthouseInput = {
      serviceId: values.serviceId,
      name: values.name.trim(),
      city: values.city.trim(),
      managerName: values.managerName?.trim() ?? "",
      description: values.description?.trim() ?? "",
      isActive: values.isActive,
    };
    if (editing) await crud.update.mutateAsync({ id: editing.id, input });
    else await crud.create.mutateAsync(input);
  };

  return (
    <>
      <PageHeader
        title="مدیریت مهمانسراها"
        subtitle="تعریف مهمانسراها، شهرستان و مسئول هر مهمانسرا"
      />

      {noGuesthouseService ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="هنوز خدمتی از نوع «مهمانسرا» تعریف نشده است"
          description="ابتدا از «مدیریت خدمات رفاهی» یک خدمت با نوع «مهمانسرا» بسازید، سپس مهمانسراها را زیر آن تعریف کنید."
        />
      ) : null}

      <CrudTable<Guesthouse>
        columns={columns}
        data={crud.items}
        loading={crud.isFetching}
        error={crud.error}
        onRetry={crud.refetch}
        onRefresh={crud.refetch}
        onCreate={openCreate}
        createLabel="افزودن مهمانسرا"
        onEdit={openEdit}
        onDelete={(r) => crud.remove.mutate(r.id)}
        deleteConfirmTitle={(r) => `حذف مهمانسرای «${r.name}»؟`}
        // The truth, because the default line would be a lie here: a guesthouse that already has
        // requests is kept and deactivated, so old معرفی‌نامه‌ها keep pointing at the right place.
        deleteConfirmDescription="اگر برای این مهمانسرا درخواستی ثبت شده باشد، حذف نمی‌شود و فقط غیرفعال می‌گردد."
        deleting={crud.deleting}
        emptyText="هنوز مهمانسرایی تعریف نشده است"
        emptyAction={
          <Button type="primary" onClick={openCreate} disabled={noGuesthouseService}>
            افزودن مهمانسرا
          </Button>
        }
      />

      <FormDrawer<GuesthouseFormValues>
        open={open}
        form={form}
        width={520}
        title={editing ? "ویرایش مهمانسرا" : "افزودن مهمانسرا"}
        initialValues={
          editing
            ? {
                serviceId: editing.serviceId,
                name: editing.name,
                city: editing.city,
                managerName: editing.managerName,
                description: editing.description,
                isActive: editing.isActive,
              }
            : { isActive: true }
        }
        submitting={crud.saving}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
      >
        <Form.Item
          name="serviceId"
          label="خدمت رفاهی"
          rules={[{ required: true, message: "انتخاب خدمت الزامی است" }]}
          extra="فقط خدمات از نوع «مهمانسرا» در این فهرست می‌آیند."
        >
          <Select<number>
            placeholder="یک خدمت انتخاب کنید"
            loading={services.isLoading}
            options={serviceOptions}
            notFoundContent="خدمتی از نوع مهمانسرا وجود ندارد"
          />
        </Form.Item>
        <Form.Item
          name="name"
          label="نام مهمانسرا"
          rules={[{ required: true, message: "نام الزامی است" }]}
        >
          <Input maxLength={200} placeholder="مهمانسرای سازمان" />
        </Form.Item>
        <Form.Item
          name="city"
          label="شهرستان"
          rules={[{ required: true, message: "شهرستان الزامی است" }]}
        >
          <Input maxLength={100} placeholder="سنندج" />
        </Form.Item>
        <Form.Item
          name="managerName"
          label="مسئول مهمانسرا"
          extra="روی معرفی‌نامه چاپ می‌شود: «مسئول محترم مهمانسرای …»."
        >
          <Input maxLength={200} placeholder="نام و نام خانوادگی" />
        </Form.Item>
        <Form.Item name="description" label="توضیحات">
          <Input.TextArea rows={3} maxLength={1000} placeholder="امکانات، آدرس، شماره تماس و…" />
        </Form.Item>
        <Form.Item name="isActive" label="وضعیت" valuePropName="checked">
          <Switch checkedChildren="فعال" unCheckedChildren="غیرفعال" />
        </Form.Item>
      </FormDrawer>
    </>
  );
}
