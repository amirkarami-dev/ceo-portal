import { useMemo, useState, type CSSProperties } from "react";
import { Form, Input, InputNumber, Select, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { orgPagesApi } from "@/api/endpoints";
import { PERSON_GROUPS, PERSON_GROUP_LABELS } from "@/api/types";
import type { OrgPage, OrgPageInput } from "@/api/types";
import { CrudTable, FormDrawer, PageHeader } from "@/components/ui";
import { queryKeys, useCrud } from "@/query";
import { formatNumber, truncate } from "@/lib/format";

const LTR: CSSProperties = { direction: "ltr", textAlign: "left" };

/** The Select's "no group" choice — sent to the API as `null`. */
const NO_GROUP = "";

const GROUP_OPTIONS = [
  { value: NO_GROUP, label: "بدون گروه" },
  ...PERSON_GROUPS.map((g) => ({ value: g as string, label: PERSON_GROUP_LABELS[g] })),
];

/** `group` is a free-text column on the API; label it when it matches a known person group. */
const GROUP_LABELS: Record<string, string | undefined> = PERSON_GROUP_LABELS;

function groupLabel(group?: string | null): string | undefined {
  if (!group) return undefined;
  return GROUP_LABELS[group] ?? group;
}

interface OrgPageFormValues {
  slug: string;
  title: string;
  group?: string;
  intro: string;
  sortOrder: number;
}

export function OrgPagesPage() {
  const [form] = Form.useForm<OrgPageFormValues>();
  const [drawer, setDrawer] = useState<{ open: boolean; editing: OrgPage | null }>({
    open: false,
    editing: null,
  });

  const crud = useCrud<OrgPage, OrgPageInput>({
    key: queryKeys.orgPages.all(),
    list: orgPagesApi.list,
    create: orgPagesApi.create,
    update: orgPagesApi.update,
    remove: orgPagesApi.remove,
    labels: {
      created: "صفحه افزوده شد",
      updated: "صفحه ذخیره شد",
      removed: "صفحه حذف شد",
    },
  });

  const pages = useMemo(
    () => [...crud.items].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [crud.items],
  );

  const openCreate = () => setDrawer({ open: true, editing: null });
  const openEdit = (page: OrgPage) => setDrawer({ open: true, editing: page });
  const close = () => setDrawer((s) => ({ ...s, open: false }));

  const initialValues: Partial<OrgPageFormValues> = drawer.editing
    ? {
        slug: drawer.editing.slug,
        title: drawer.editing.title,
        group: drawer.editing.group ?? NO_GROUP,
        intro: drawer.editing.intro,
        sortOrder: drawer.editing.sortOrder,
      }
    : {
        group: NO_GROUP,
        intro: "",
        sortOrder: pages.length ? Math.max(...pages.map((p) => p.sortOrder)) + 1 : 1,
      };

  const submit = async (values: OrgPageFormValues) => {
    const group = (values.group ?? "").trim();
    const input: OrgPageInput = {
      slug: values.slug.trim(),
      title: values.title.trim(),
      intro: (values.intro ?? "").trim(),
      sortOrder: values.sortOrder,
      group: group ? group : null,
    };
    if (drawer.editing) {
      await crud.update.mutateAsync({ id: drawer.editing.id, input });
    } else {
      await crud.create.mutateAsync(input);
    }
  };

  const columns: ColumnsType<OrgPage> = [
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
        <Typography.Text code copyable style={LTR}>
          {slug}
        </Typography.Text>
      ),
    },
    {
      title: "گروه",
      dataIndex: "group",
      key: "group",
      width: 160,
      render: (group?: string | null) => {
        const label = groupLabel(group);
        return label ? (
          <Tag color="geekblue">{label}</Tag>
        ) : (
          <Typography.Text type="secondary">بدون گروه</Typography.Text>
        );
      },
    },
    {
      title: "معرفی",
      dataIndex: "intro",
      key: "intro",
      render: (intro: string) => (
        <Typography.Text type="secondary">{truncate(intro, 70)}</Typography.Text>
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

  return (
    <>
      <PageHeader title="صفحات سازمان" subtitle="صفحات ثابت معرفی سازمان" />

      <CrudTable<OrgPage>
        columns={columns}
        data={pages}
        loading={crud.isLoading}
        error={crud.error}
        onRetry={crud.refetch}
        onRefresh={crud.refetch}
        searchable
        searchPlaceholder="جستجو در عنوان، شناسه یا معرفی…"
        searchFields={["title", "slug", "intro"]}
        onCreate={openCreate}
        createLabel="افزودن صفحه"
        onEdit={openEdit}
        onDelete={(page) => crud.remove.mutate(page.id)}
        deleteConfirmTitle={(page) => `حذف صفحهٔ «${page.title}»؟`}
        deleting={crud.deleting}
        emptyText="هنوز صفحه‌ای ثبت نشده است"
        scrollX={900}
      />

      <FormDrawer<OrgPageFormValues>
        open={drawer.open}
        form={form}
        title={drawer.editing ? "ویرایش صفحهٔ سازمان" : "افزودن صفحهٔ سازمان"}
        initialValues={initialValues}
        onClose={close}
        onSubmit={submit}
        submitting={crud.saving}
        width={560}
      >
        <Form.Item
          name="title"
          label="عنوان"
          rules={[{ required: true, message: "عنوان الزامی است" }]}
        >
          <Input placeholder="مثلاً هیئت مدیره" />
        </Form.Item>

        <Form.Item
          name="slug"
          label="شناسه (slug)"
          tooltip="شناسهٔ انگلیسی یکتا؛ نشانی صفحه در سایت با آن ساخته می‌شود."
          rules={[
            { required: true, message: "شناسه الزامی است" },
            { pattern: /^[a-z0-9-]+$/, message: "فقط حروف کوچک انگلیسی، عدد و خط تیره" },
          ]}
        >
          <Input style={LTR} placeholder="board-of-directors" />
        </Form.Item>

        <Form.Item
          name="group"
          label="گروه (اختیاری)"
          tooltip="اگر صفحه به یکی از گروه‌های اشخاص مربوط است، اعضای آن گروه زیر صفحه نمایش داده می‌شوند."
        >
          <Select options={GROUP_OPTIONS} placeholder="بدون گروه" />
        </Form.Item>

        <Form.Item name="intro" label="معرفی">
          <Input.TextArea rows={5} placeholder="متن معرفی صفحه" />
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

export default OrgPagesPage;
