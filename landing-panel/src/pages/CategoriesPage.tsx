import { useMemo, useState } from "react";
import { App, Button, Form, Input, InputNumber, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { categoriesApi } from "@/api/endpoints";
import type { Category, CategoryInput } from "@/api/types";
import { CrudTable, FormDrawer, PageHeader } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { queryKeys, useCrud } from "@/query";

interface CategoryFormValues {
  title: string;
  sortOrder: number;
}

export function CategoriesPage() {
  const { message } = App.useApp();

  const crud = useCrud<Category, CategoryInput>({
    key: queryKeys.categories.all(),
    list: categoriesApi.list,
    create: categoriesApi.create,
    update: categoriesApi.update,
    remove: categoriesApi.remove,
    // News rows carry `categoryTitle`, so renaming a category makes the news cache stale.
    alsoInvalidate: [queryKeys.news.all()],
    labels: {
      created: "دسته‌بندی افزوده شد",
      updated: "دسته‌بندی ذخیره شد",
      removed: "دسته‌بندی حذف شد",
    },
  });

  const categories = useMemo(
    () => [...crud.items].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [crud.items],
  );

  const nextSortOrder = useMemo(
    () => (categories.length ? Math.max(...categories.map((c) => c.sortOrder)) + 1 : 1),
    [categories],
  );

  const totalNews = useMemo(
    () => categories.reduce((sum, c) => sum + c.newsCount, 0),
    [categories],
  );

  // ── drawer ─────────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (record: Category) => {
    setEditing(record);
    setOpen(true);
  };

  const initialValues: Partial<CategoryFormValues> = editing
    ? { title: editing.title, sortOrder: editing.sortOrder }
    : { sortOrder: nextSortOrder };

  const handleSubmit = async (values: CategoryFormValues) => {
    const input: CategoryInput = {
      title: values.title.trim(),
      sortOrder: values.sortOrder,
    };

    // Let it throw: `FormDrawer` maps ValidationProblemDetails onto the offending fields.
    if (editing) await crud.update.mutateAsync({ id: editing.id, input });
    else await crud.create.mutateAsync(input);
  };

  /**
   * The API answers 400 while a category still has news attached. The DTO already tells us how
   * many, so we stop the doomed request and say so in Persian; a server-side 400 (a race with
   * another editor) still surfaces as a `message.error` from `useCrud`.
   */
  const handleDelete = (record: Category) => {
    if (record.newsCount > 0) {
      message.error(
        `«${record.title}» در ${formatNumber(record.newsCount)} خبر استفاده شده است؛ ابتدا آن خبرها را به دسته‌بندی دیگری منتقل یا حذف کنید.`,
      );
      return;
    }
    crud.remove.mutate(record.id);
  };

  // ── columns ────────────────────────────────────────────────────────────────
  const columns: ColumnsType<Category> = [
    {
      title: "عنوان",
      dataIndex: "title",
      key: "title",
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: "تعداد خبر",
      dataIndex: "newsCount",
      key: "newsCount",
      width: 140,
      align: "center",
      sorter: (a, b) => a.newsCount - b.newsCount,
      render: (value: number) =>
        value > 0 ? (
          <Tag color="blue">{formatNumber(value)}</Tag>
        ) : (
          <Typography.Text type="secondary">بدون خبر</Typography.Text>
        ),
    },
    {
      title: "ترتیب",
      dataIndex: "sortOrder",
      key: "sortOrder",
      width: 110,
      align: "center",
      defaultSortOrder: "ascend",
      sorter: (a, b) => a.sortOrder - b.sortOrder,
      render: (value: number) => formatNumber(value),
    },
  ];

  return (
    <>
      <PageHeader
        title="دسته‌بندی‌ها"
        subtitle={
          crud.isLoading
            ? "دسته‌بندی مطالب خبری"
            : `${formatNumber(categories.length)} دسته‌بندی · ${formatNumber(totalNews)} خبر`
        }
      />

      <CrudTable<Category>
        columns={columns}
        data={crud.query.data}
        loading={crud.isFetching}
        error={crud.error}
        onRetry={crud.refetch}
        onRefresh={crud.refetch}
        searchable
        searchPlaceholder="جستجوی دسته‌بندی…"
        searchFields={["title"]}
        onCreate={openCreate}
        createLabel="افزودن دسته‌بندی"
        onEdit={openEdit}
        onDelete={handleDelete}
        deleteConfirmTitle={(record) => `حذف دسته‌بندی «${record.title}»؟`}
        deleting={crud.deleting}
        emptyText="هنوز دسته‌بندی‌ای تعریف نشده است"
        emptyAction={
          <Button type="primary" onClick={openCreate}>
            افزودن دسته‌بندی
          </Button>
        }
        pageSize={10}
      />

      <FormDrawer<CategoryFormValues>
        open={open}
        title={editing ? "ویرایش دسته‌بندی" : "افزودن دسته‌بندی"}
        initialValues={initialValues}
        submitting={crud.saving}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        extraFooter={
          editing && editing.newsCount > 0 ? (
            <Typography.Text type="secondary">
              {`${formatNumber(editing.newsCount)} خبر در این دسته‌بندی`}
            </Typography.Text>
          ) : null
        }
      >
        <Form.Item
          name="title"
          label="عنوان"
          rules={[{ required: true, message: "عنوان دسته‌بندی الزامی است" }]}
        >
          <Input placeholder="مثلاً اطلاعیه‌ها" maxLength={100} showCount />
        </Form.Item>

        <Form.Item
          name="sortOrder"
          label="ترتیب نمایش"
          rules={[{ required: true, message: "ترتیب نمایش الزامی است" }]}
          extra="عدد کوچک‌تر، بالاتر نمایش داده می‌شود."
        >
          <InputNumber min={0} step={1} style={{ width: "100%" }} placeholder="۱" />
        </Form.Item>
      </FormDrawer>
    </>
  );
}

export default CategoriesPage;
