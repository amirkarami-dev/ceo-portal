import { useMemo, useState, type CSSProperties } from "react";
import { Alert, Form, Input, InputNumber, Space, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { tabGroupsApi } from "@/api/endpoints";
import type { TabGroup, TabGroupInput, TabItem, TabItemInput } from "@/api/types";
import { CrudTable, FormDrawer, PageHeader } from "@/components/ui";
import { queryKeys, useApiMutation, useCrud } from "@/query";
import { formatNumber } from "@/lib/format";

/** The site renders the Units cards inside this tab, so it deliberately carries no items. */
const UNITS_SLUG = "units";

const LTR: CSSProperties = { direction: "ltr", textAlign: "left" };

interface GroupFormValues {
  slug: string;
  title: string;
  sortOrder: number;
}

interface ItemFormValues {
  title: string;
  href?: string;
  note?: string;
  sortOrder: number;
}

/** Empty text inputs must go back to the API as `null`, not `""`. */
function orNull(value?: string): string | null {
  const v = (value ?? "").trim();
  return v ? v : null;
}

function nextSortOrder(rows: { sortOrder: number }[]): number {
  return rows.length ? Math.max(...rows.map((r) => r.sortOrder)) + 1 : 1;
}

function sortItems(items: TabItem[]): TabItem[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

export function TabGroupsPage() {
  const [groupForm] = Form.useForm<GroupFormValues>();
  const [itemForm] = Form.useForm<ItemFormValues>();

  const [groupDrawer, setGroupDrawer] = useState<{ open: boolean; editing: TabGroup | null }>({
    open: false,
    editing: null,
  });
  const [itemDrawer, setItemDrawer] = useState<{
    open: boolean;
    group: TabGroup | null;
    editing: TabItem | null;
  }>({ open: false, group: null, editing: null });

  const crud = useCrud<TabGroup, TabGroupInput>({
    key: queryKeys.tabGroups.all(),
    list: tabGroupsApi.list,
    create: tabGroupsApi.create,
    update: tabGroupsApi.update,
    remove: tabGroupsApi.remove,
    labels: {
      created: "گروه تب افزوده شد",
      updated: "گروه تب ذخیره شد",
      removed: "گروه تب حذف شد",
    },
  });

  const invalidateGroups = [queryKeys.tabGroups.all()];

  const createItem = useApiMutation<{ groupId: number; input: TabItemInput }, number>({
    mutationFn: ({ groupId, input }) => tabGroupsApi.createItem(groupId, input),
    invalidate: invalidateGroups,
    success: "آیتم افزوده شد",
  });

  const updateItem = useApiMutation<{ itemId: number; input: TabItemInput }>({
    mutationFn: ({ itemId, input }) => tabGroupsApi.updateItem(itemId, input),
    invalidate: invalidateGroups,
    success: "آیتم ذخیره شد",
  });

  const removeItem = useApiMutation<number>({
    mutationFn: (itemId) => tabGroupsApi.removeItem(itemId),
    invalidate: invalidateGroups,
    success: "آیتم حذف شد",
  });

  const groups = useMemo(
    () => [...crud.items].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [crud.items],
  );

  const savingItem = createItem.isPending || updateItem.isPending;

  // ── group drawer ───────────────────────────────────────────────────────────

  const openCreateGroup = () => setGroupDrawer({ open: true, editing: null });
  const openEditGroup = (group: TabGroup) => setGroupDrawer({ open: true, editing: group });
  const closeGroupDrawer = () => setGroupDrawer((s) => ({ ...s, open: false }));

  const groupInitialValues: Partial<GroupFormValues> = groupDrawer.editing
    ? {
        slug: groupDrawer.editing.slug,
        title: groupDrawer.editing.title,
        sortOrder: groupDrawer.editing.sortOrder,
      }
    : { sortOrder: nextSortOrder(groups) };

  const submitGroup = async (values: GroupFormValues) => {
    const input: TabGroupInput = {
      slug: values.slug.trim(),
      title: values.title.trim(),
      sortOrder: values.sortOrder,
    };
    if (groupDrawer.editing) {
      await crud.update.mutateAsync({ id: groupDrawer.editing.id, input });
    } else {
      await crud.create.mutateAsync(input);
    }
  };

  // ── item drawer ────────────────────────────────────────────────────────────

  const openCreateItem = (group: TabGroup) =>
    setItemDrawer({ open: true, group, editing: null });
  const openEditItem = (group: TabGroup, item: TabItem) =>
    setItemDrawer({ open: true, group, editing: item });
  const closeItemDrawer = () => setItemDrawer((s) => ({ ...s, open: false }));

  const itemInitialValues: Partial<ItemFormValues> = itemDrawer.editing
    ? {
        title: itemDrawer.editing.title,
        href: itemDrawer.editing.href ?? undefined,
        note: itemDrawer.editing.note ?? undefined,
        sortOrder: itemDrawer.editing.sortOrder,
      }
    : { sortOrder: nextSortOrder(itemDrawer.group?.items ?? []) };

  const submitItem = async (values: ItemFormValues) => {
    const input: TabItemInput = {
      title: values.title.trim(),
      href: orNull(values.href),
      note: orNull(values.note),
      sortOrder: values.sortOrder,
    };
    if (itemDrawer.editing) {
      await updateItem.mutateAsync({ itemId: itemDrawer.editing.id, input });
    } else if (itemDrawer.group) {
      await createItem.mutateAsync({ groupId: itemDrawer.group.id, input });
    }
  };

  // ── columns ────────────────────────────────────────────────────────────────

  const groupColumns: ColumnsType<TabGroup> = [
    {
      title: "عنوان",
      dataIndex: "title",
      key: "title",
      render: (title: string) => <Typography.Text strong>{title}</Typography.Text>,
    },
    {
      title: "شناسه (slug)",
      dataIndex: "slug",
      key: "slug",
      width: 200,
      render: (slug: string) => (
        <Typography.Text code style={LTR}>
          {slug}
        </Typography.Text>
      ),
    },
    {
      title: "تعداد آیتم",
      key: "itemCount",
      width: 140,
      align: "center",
      render: (_: unknown, group: TabGroup) =>
        group.slug === UNITS_SLUG ? (
          <Tag color="blue">واحدهای فنی</Tag>
        ) : (
          <Tag color={group.items.length ? "green" : "default"}>
            {formatNumber(group.items.length)}
          </Tag>
        ),
    },
    {
      title: "ترتیب",
      dataIndex: "sortOrder",
      key: "sortOrder",
      width: 100,
      align: "center",
      render: (sortOrder: number) => formatNumber(sortOrder),
    },
  ];

  const itemColumns: ColumnsType<TabItem> = [
    {
      title: "عنوان",
      dataIndex: "title",
      key: "title",
    },
    {
      title: "پیوند",
      dataIndex: "href",
      key: "href",
      width: 280,
      render: (href?: string | null) =>
        href ? (
          <Typography.Text code copyable style={LTR}>
            {href}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: "یادداشت",
      dataIndex: "note",
      key: "note",
      render: (note?: string | null) =>
        note ? note : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "ترتیب",
      dataIndex: "sortOrder",
      key: "sortOrder",
      width: 90,
      align: "center",
      render: (sortOrder: number) => formatNumber(sortOrder),
    },
  ];

  // ── expanded row: the group's items ────────────────────────────────────────

  const renderItems = (group: TabGroup) => {
    if (group.slug === UNITS_SLUG) {
      return (
        <Alert
          type="info"
          showIcon
          message="این گروه آیتم ندارد"
          description="سایت در این تب، «واحدهای فنی» را نمایش می‌دهد. برای ویرایش محتوای این تب به بخش «واحدها» بروید."
        />
      );
    }

    return (
      <CrudTable<TabItem>
        columns={itemColumns}
        data={sortItems(group.items)}
        rowKey="id"
        size="small"
        pagination={false}
        loading={crud.isFetching}
        onCreate={() => openCreateItem(group)}
        createLabel="افزودن آیتم"
        onEdit={(item) => openEditItem(group, item)}
        onDelete={(item) => removeItem.mutate(item.id)}
        deleteConfirmTitle={(item) => `حذف آیتم «${item.title}»؟`}
        deleting={removeItem.isPending}
        emptyText="این گروه هنوز آیتمی ندارد"
        actionsWidth={110}
      />
    );
  };

  return (
    <>
      <PageHeader
        title="گروه‌های تب"
        subtitle="گروه‌ها و آیتم‌های پنل تب‌های صفحهٔ نخست — برای مدیریت آیتم‌ها ردیف را باز کنید"
      />

      <CrudTable<TabGroup>
        columns={groupColumns}
        data={groups}
        loading={crud.isLoading}
        error={crud.error}
        onRetry={crud.refetch}
        onRefresh={crud.refetch}
        searchable
        searchPlaceholder="جستجو در عنوان یا شناسه…"
        searchFields={["title", "slug"]}
        onCreate={openCreateGroup}
        createLabel="افزودن گروه"
        onEdit={openEditGroup}
        onDelete={(group) => crud.remove.mutate(group.id)}
        deleteConfirmTitle={(group) => `حذف گروه «${group.title}»؟`}
        deleting={crud.deleting}
        pagination={false}
        emptyText="هنوز گروه تبی ثبت نشده است"
        expandable={{
          expandedRowRender: renderItems,
          rowExpandable: () => true,
        }}
      />

      <FormDrawer<GroupFormValues>
        open={groupDrawer.open}
        form={groupForm}
        title={groupDrawer.editing ? "ویرایش گروه تب" : "افزودن گروه تب"}
        initialValues={groupInitialValues}
        onClose={closeGroupDrawer}
        onSubmit={submitGroup}
        submitting={crud.saving}
      >
        <Form.Item
          name="title"
          label="عنوان"
          rules={[{ required: true, message: "عنوان الزامی است" }]}
        >
          <Input placeholder="مثلاً خدمات مهندسان" />
        </Form.Item>

        <Form.Item
          name="slug"
          label="شناسه (slug)"
          tooltip="شناسهٔ انگلیسی یکتا که سایت با آن این تب را می‌شناسد."
          rules={[
            { required: true, message: "شناسه الزامی است" },
            {
              pattern: /^[a-z0-9-]+$/,
              message: "فقط حروف کوچک انگلیسی، عدد و خط تیره",
            },
          ]}
        >
          <Input style={LTR} placeholder="engineers" />
        </Form.Item>

        <Form.Item
          name="sortOrder"
          label="ترتیب"
          rules={[{ required: true, message: "ترتیب الزامی است" }]}
        >
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>
      </FormDrawer>

      <FormDrawer<ItemFormValues>
        open={itemDrawer.open}
        form={itemForm}
        title={
          <Space>
            {itemDrawer.editing ? "ویرایش آیتم" : "افزودن آیتم"}
            {itemDrawer.group ? (
              <Typography.Text type="secondary">{itemDrawer.group.title}</Typography.Text>
            ) : null}
          </Space>
        }
        initialValues={itemInitialValues}
        onClose={closeItemDrawer}
        onSubmit={submitItem}
        submitting={savingItem}
      >
        <Form.Item
          name="title"
          label="عنوان"
          rules={[{ required: true, message: "عنوان الزامی است" }]}
        >
          <Input placeholder="مثلاً درخواست پروانه اشتغال" />
        </Form.Item>

        <Form.Item name="href" label="پیوند (اختیاری)">
          <Input style={LTR} placeholder="https://example.com/page" />
        </Form.Item>

        <Form.Item name="note" label="یادداشت (اختیاری)">
          <Input.TextArea rows={3} placeholder="توضیح کوتاه کنار آیتم" />
        </Form.Item>

        <Form.Item
          name="sortOrder"
          label="ترتیب"
          rules={[{ required: true, message: "ترتیب الزامی است" }]}
        >
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>
      </FormDrawer>
    </>
  );
}

export default TabGroupsPage;
