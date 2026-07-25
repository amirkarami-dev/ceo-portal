import { useMemo, useState } from "react";
import { Button, Checkbox, Form, Input, InputNumber, Select, Switch, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  walfareApi,
  type WelfarePool,
  type WelfarePoolInput,
  type WelfareService,
} from "@/api/walfareApi";
import { queryKeys, useApiMutation, useApiQuery } from "@/query";
import { CrudTable, FormDrawer, PageHeader, TimeField } from "@/components/ui";
import { faDigits, faMoney, JALALI_WEEKDAYS } from "@/lib/jalali";

const DAY_OPTIONS = [
  "شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه",
].map((label, bit) => ({ label, value: bit }));

const maskToBits = (mask: number): number[] =>
  DAY_OPTIONS.map((o) => o.value).filter((bit) => (mask & (1 << bit)) !== 0);

const bitsToMask = (bits: number[]): number => bits.reduce((m, bit) => m | (1 << bit), 0);

interface PoolFormValues {
  serviceId: number;
  name: string;
  activeDayBits: number[];
  description?: string;
  isActive: boolean;
  priceRials: number;
  reserveStartTime: string;
  reserveEndTime: string;
  capacity: number;
}

/** استخرها — defined under a welfare service; what engineers actually reserve. */
export function AdminPoolsPage() {
  const [form] = Form.useForm<PoolFormValues>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WelfarePool | null>(null);
  const [serviceFilter, setServiceFilter] = useState<number | undefined>(undefined);

  const services = useApiQuery(queryKeys.services.admin(), walfareApi.adminServices);
  const pools = useApiQuery(queryKeys.pools.admin(serviceFilter), () =>
    walfareApi.adminPools(serviceFilter),
  );

  const invalidate = [queryKeys.pools.all()];
  const create = useApiMutation<WelfarePoolInput, number>({
    mutationFn: (input) => walfareApi.createPool(input),
    invalidate,
    success: "استخر با موفقیت افزوده شد",
  });
  const update = useApiMutation<{ id: number; input: WelfarePoolInput }>({
    mutationFn: ({ id, input }) => walfareApi.updatePool(id, input),
    invalidate,
    success: "استخر با موفقیت ذخیره شد",
  });
  const remove = useApiMutation<number>({
    mutationFn: (id) => walfareApi.deletePool(id),
    invalidate,
    success: "استخر حذف شد",
  });

  const serviceTitleById = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of services.data ?? []) map.set(s.id, s.title);
    return map;
  }, [services.data]);

  const columns: ColumnsType<WelfarePool> = [
    { title: "نام استخر", dataIndex: "name", key: "name" },
    {
      title: "خدمت",
      dataIndex: "serviceId",
      key: "serviceId",
      width: 150,
      render: (id: number) => serviceTitleById.get(id) ?? faDigits(id),
    },
    {
      title: "روزهای فعال",
      dataIndex: "activeDays",
      key: "activeDays",
      width: 170,
      render: (mask: number) => (
        <span style={{ letterSpacing: 2 }}>
          {JALALI_WEEKDAYS.map((w, bit) => (
            <span key={bit} style={{ opacity: (mask & (1 << bit)) !== 0 ? 1 : 0.2 }}>
              {w}
            </span>
          ))}
        </span>
      ),
    },
    {
      title: "مبلغ",
      dataIndex: "priceRials",
      key: "priceRials",
      width: 140,
      render: (v: number) => faMoney(v),
    },
    {
      title: "ساعت رزرو",
      key: "hours",
      width: 130,
      render: (_, r) => `${faDigits(r.reserveStartTime)} تا ${faDigits(r.reserveEndTime)}`,
    },
    {
      title: "ظرفیت",
      dataIndex: "capacity",
      key: "capacity",
      width: 90,
      align: "center",
      render: (v: number) => faDigits(v),
    },
    {
      title: "وضعیت",
      dataIndex: "isActive",
      key: "isActive",
      width: 100,
      render: (v: boolean) => (v ? <Tag color="green">فعال</Tag> : <Tag>غیرفعال</Tag>),
    },
  ];

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (record: WelfarePool) => {
    setEditing(record);
    setOpen(true);
  };

  const handleSubmit = async (values: PoolFormValues) => {
    const input: WelfarePoolInput = {
      serviceId: values.serviceId,
      name: values.name.trim(),
      activeDays: bitsToMask(values.activeDayBits),
      description: values.description?.trim() ?? "",
      isActive: values.isActive,
      priceRials: values.priceRials,
      reserveStartTime: values.reserveStartTime.trim(),
      reserveEndTime: values.reserveEndTime.trim(),
      capacity: values.capacity,
    };
    if (editing) await update.mutateAsync({ id: editing.id, input });
    else await create.mutateAsync(input);
  };

  return (
    <>
      <PageHeader title="مدیریت استخرها" subtitle="تعریف استخرها، روزهای فعال، مبلغ و ظرفیت هر روز" />

      <CrudTable<WelfarePool>
        columns={columns}
        data={pools.data}
        loading={pools.isFetching}
        error={pools.error}
        onRetry={() => void pools.refetch()}
        onRefresh={() => void pools.refetch()}
        toolbarExtra={
          <Select<number>
            allowClear
            placeholder="همه خدمات"
            style={{ width: 200 }}
            value={serviceFilter}
            loading={services.isLoading}
            onChange={(v) => setServiceFilter(v ?? undefined)}
            options={(services.data ?? []).map((s: WelfareService) => ({ value: s.id, label: s.title }))}
            aria-label="فیلتر خدمت"
          />
        }
        onCreate={openCreate}
        createLabel="افزودن استخر"
        onEdit={openEdit}
        onDelete={(r) => remove.mutate(r.id)}
        deleteConfirmTitle={(r) => `حذف استخر «${r.name}»؟`}
        deleting={remove.isPending}
        emptyText="هنوز استخری تعریف نشده است"
        emptyAction={
          <Button type="primary" onClick={openCreate}>
            افزودن استخر
          </Button>
        }
      />

      <FormDrawer<PoolFormValues>
        open={open}
        form={form}
        width={520}
        title={editing ? "ویرایش استخر" : "افزودن استخر"}
        initialValues={
          editing
            ? {
                serviceId: editing.serviceId,
                name: editing.name,
                activeDayBits: maskToBits(editing.activeDays),
                description: editing.description,
                isActive: editing.isActive,
                priceRials: editing.priceRials,
                reserveStartTime: editing.reserveStartTime,
                reserveEndTime: editing.reserveEndTime,
                capacity: editing.capacity,
              }
            : {
                serviceId: serviceFilter,
                isActive: true,
                activeDayBits: [0, 1, 2, 3, 4, 5, 6],
              }
        }
        submitting={create.isPending || update.isPending}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
      >
        <Form.Item
          name="serviceId"
          label="خدمت رفاهی"
          rules={[{ required: true, message: "انتخاب خدمت الزامی است" }]}
        >
          <Select<number>
            placeholder="یک خدمت انتخاب کنید"
            loading={services.isLoading}
            options={(services.data ?? []).map((s: WelfareService) => ({ value: s.id, label: s.title }))}
          />
        </Form.Item>
        <Form.Item name="name" label="نام استخر" rules={[{ required: true, message: "نام الزامی است" }]}>
          <Input maxLength={300} placeholder="استخر آزادی" />
        </Form.Item>
        <Form.Item
          name="activeDayBits"
          label="روزهای فعال در هفته"
          rules={[{ required: true, message: "دست‌کم یک روز انتخاب کنید" }]}
        >
          <Checkbox.Group options={DAY_OPTIONS} />
        </Form.Item>
        <Form.Item name="description" label="توضیحات">
          <Input.TextArea rows={3} maxLength={2000} placeholder="سانس آقایان / بانوان، امکانات و…" />
        </Form.Item>
        <Form.Item
          name="priceRials"
          label="مبلغ قابل پرداخت (ریال)"
          rules={[{ required: true, message: "مبلغ الزامی است" }]}
        >
          <InputNumber<number>
            min={1000}
            step={10000}
            style={{ width: "100%" }}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            parser={(v) => Number((v ?? "").replace(/,/g, ""))}
          />
        </Form.Item>
        <Form.Item
          name="reserveStartTime"
          label="ساعت شروع رزرو"
          rules={[{ required: true, message: "ساعت شروع الزامی است" }]}
        >
          <TimeField placeholder="۰۸:۰۰" />
        </Form.Item>
        <Form.Item
          name="reserveEndTime"
          label="ساعت پایان رزرو"
          rules={[{ required: true, message: "ساعت پایان الزامی است" }]}
        >
          <TimeField placeholder="۲۲:۰۰" />
        </Form.Item>
        <Form.Item
          name="capacity"
          label="ظرفیت تعداد رزرو (هر روز)"
          rules={[{ required: true, message: "ظرفیت الزامی است" }]}
        >
          <InputNumber<number> min={1} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="isActive" label="وضعیت" valuePropName="checked">
          <Switch checkedChildren="فعال" unCheckedChildren="غیرفعال" />
        </Form.Item>
      </FormDrawer>
    </>
  );
}
