import { useMemo, useState } from "react";
import { Form, Input, InputNumber, Space, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CrudTable, FormDrawer, PageHeader } from "@/components/ui";
import { unitsApi } from "@/api/endpoints";
import type { Unit, UnitInput } from "@/api/types";
import { truncate } from "@/lib/format";
import { queryKeys, useCrud } from "@/query";

/** The drawer's field shape. Optional fields come back as `undefined` when left blank. */
interface UnitFormValues {
  title: string;
  description?: string;
  headName?: string;
  headRole?: string;
  sortOrder: number;
}

/** "" / undefined -> null, so blanking a field actually clears it server-side. */
function nullable(value?: string | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

export function UnitsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);

  const crud = useCrud<Unit, UnitInput>({
    key: queryKeys.units.all(),
    list: unitsApi.list,
    create: unitsApi.create,
    update: unitsApi.update,
    remove: unitsApi.remove,
  });

  const nextSortOrder = useMemo(
    () => (crud.items.length ? Math.max(...crud.items.map((u) => u.sortOrder)) + 1 : 0),
    [crud.items],
  );

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (unit: Unit) => {
    setEditing(unit);
    setOpen(true);
  };

  // FormDrawer re-seeds from this on every open, so a fresh object per render is fine.
  const initialValues: Partial<UnitFormValues> = editing
    ? {
        title: editing.title,
        description: editing.description,
        headName: editing.headName ?? undefined,
        headRole: editing.headRole ?? undefined,
        sortOrder: editing.sortOrder,
      }
    : { sortOrder: nextSortOrder };

  const handleSubmit = async (values: UnitFormValues) => {
    const input: UnitInput = {
      title: values.title.trim(),
      // `description` is a non-nullable string on the API — send "" rather than null.
      description: (values.description ?? "").trim(),
      headName: nullable(values.headName),
      headRole: nullable(values.headRole),
      sortOrder: values.sortOrder,
    };

    // mutateAsync REJECTS on failure — FormDrawer maps ValidationProblemDetails onto the fields.
    if (editing) await crud.update.mutateAsync({ id: editing.id, input });
    else await crud.create.mutateAsync(input);
  };

  const columns: ColumnsType<Unit> = [
    {
      title: "عنوان واحد",
      dataIndex: "title",
      key: "title",
      render: (title: string, unit) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{title}</Typography.Text>
          {unit.description ? (
            <Tooltip title={unit.description}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {truncate(unit.description, 70)}
              </Typography.Text>
            </Tooltip>
          ) : null}
        </Space>
      ),
      sorter: (a, b) => a.title.localeCompare(b.title, "fa"),
    },
    {
      title: "مسئول واحد",
      dataIndex: "headName",
      key: "headName",
      width: 240,
      render: (_: unknown, unit) =>
        unit.headName ? (
          <Space direction="vertical" size={0}>
            <Typography.Text>{unit.headName}</Typography.Text>
            {unit.headRole ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {unit.headRole}
              </Typography.Text>
            ) : null}
          </Space>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: "ترتیب",
      dataIndex: "sortOrder",
      key: "sortOrder",
      width: 100,
      align: "center",
      defaultSortOrder: "ascend",
      sorter: (a, b) => a.sortOrder - b.sortOrder,
    },
  ];

  return (
    <>
      <PageHeader title="واحدها" subtitle="واحدهای سازمانی و مسئولان آن‌ها" />

      <CrudTable<Unit>
        columns={columns}
        data={crud.items}
        loading={crud.isLoading}
        error={crud.error}
        onRetry={crud.refetch}
        onRefresh={crud.refetch}
        searchable
        searchPlaceholder="جستجوی عنوان یا مسئول…"
        searchFields={["title", "description", "headName", "headRole"]}
        onCreate={openCreate}
        createLabel="افزودن واحد"
        onEdit={openEdit}
        onDelete={(unit) => crud.remove.mutate(unit.id)}
        deleteConfirmTitle={(unit) => `حذف واحد «${unit.title}»؟`}
        deleting={crud.deleting}
        emptyText="هنوز واحدی ثبت نشده است"
        pageSize={12}
        scrollX={760}
      />

      <FormDrawer<UnitFormValues>
        open={open}
        title={editing ? `ویرایش «${editing.title}»` : "افزودن واحد"}
        initialValues={initialValues}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        submitting={crud.saving}
        width={560}
      >
        <Form.Item
          label="عنوان واحد"
          name="title"
          rules={[{ required: true, message: "عنوان واحد الزامی است" }]}
        >
          <Input placeholder="مثال: واحد آموزش" maxLength={150} />
        </Form.Item>

        <Form.Item label="توضیحات" name="description">
          <Input.TextArea
            rows={4}
            maxLength={1000}
            showCount
            placeholder="شرح کوتاهی از وظایف و خدمات این واحد"
          />
        </Form.Item>

        <Form.Item label="نام مسئول" name="headName" tooltip="اختیاری">
          <Input placeholder="مثال: مهندس رضا مرادی" maxLength={120} />
        </Form.Item>

        <Form.Item label="سمت مسئول" name="headRole" tooltip="اختیاری">
          <Input placeholder="مثال: مسئول واحد آموزش" maxLength={120} />
        </Form.Item>

        <Form.Item
          label="ترتیب نمایش"
          name="sortOrder"
          rules={[{ required: true, message: "ترتیب نمایش الزامی است" }]}
          extra="عدد کوچک‌تر بالاتر نمایش داده می‌شود."
        >
          <InputNumber min={0} max={9999} style={{ width: "100%" }} />
        </Form.Item>
      </FormDrawer>
    </>
  );
}

export default UnitsPage;
