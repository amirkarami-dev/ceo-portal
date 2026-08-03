import { useMemo, useState, type CSSProperties } from "react";
import { Alert, Form, Grid, Input, InputNumber, Select, Space, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { orgPagesApi } from "@/api/endpoints";
import { PERSON_GROUPS, PERSON_GROUP_LABELS } from "@/api/types";
import type { OrgPage, OrgPageInput } from "@/api/types";
import { CrudTable, FormDrawer, PageHeader } from "@/components/ui";
import { queryKeys, useCrud } from "@/query";
import { formatNumber, truncate } from "@/lib/format";
import { ICON_GROUPS, iconLabel } from "@/lib/siteMeta";

const LTR: CSSProperties = { direction: "ltr", textAlign: "left" };

/** The Select's "no group" / "no parent" choice — both go to the API as `null`. */
const NO_GROUP = "";
const NO_PARENT = "";

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
  parentSlug?: string;
  icon?: string;
  summary?: string;
  sortOrder: number;
}

/**
 * Parents first (SQL Server sorts NULL first and the API relies on it), then each parent's children
 * beneath it. Sorting by `sortOrder` alone would interleave a child numbered 1 with a top-level page
 * numbered 1, which reads as noise.
 */
function inOutlineOrder(pages: OrgPage[]): OrgPage[] {
  const byOrder = (a: OrgPage, b: OrgPage) => a.sortOrder - b.sortOrder || a.id - b.id;
  const top = pages.filter((p) => !p.parentSlug).sort(byOrder);
  const childrenOf = (slug: string) =>
    pages.filter((p) => p.parentSlug === slug).sort(byOrder);

  const out = top.flatMap((parent) => [parent, ...childrenOf(parent.slug)]);
  // Anything whose parent is missing would otherwise vanish from this screen entirely.
  const orphans = pages.filter((p) => !out.includes(p)).sort(byOrder);
  return [...out, ...orphans];
}

export function OrgPagesPage() {
  const [form] = Form.useForm<OrgPageFormValues>();
  // Five of the seven columns hide below md/lg/xl, but rc-table sizes the table element to exactly
  // `scroll.x` regardless of how many columns actually rendered — so a flat 1100 kept a phone
  // dragging across 1100px of mostly empty table.
  const screens = Grid.useBreakpoint();
  const scrollX = screens.xl ? 1100 : screens.lg ? 900 : screens.md ? 760 : 560;
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

  const pages = useMemo(() => inOutlineOrder(crud.items), [crud.items]);

  const titleBySlug = useMemo(
    () => new Map(crud.items.map((p) => [p.slug, p.title] as const)),
    [crud.items],
  );

  // Watched so the form can explain itself: the card fields only matter once a parent is chosen.
  const watchedParent = Form.useWatch("parentSlug", form) as string | undefined;

  const editing = drawer.editing;

  /** A page that is itself a hub cannot be moved under another one — the API refuses it too. */
  const editingHasChildren = useMemo(
    () => (editing ? crud.items.some((p) => p.parentSlug === editing.slug) : false),
    [crud.items, editing],
  );

  /** Only top-level pages may be parents, and never the page being edited. */
  const parentOptions = useMemo(
    () => [
      { value: NO_PARENT, label: "بدون والد — صفحهٔ مستقل" },
      ...crud.items
        .filter((p) => !p.parentSlug && p.id !== editing?.id)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
        .map((p) => ({ value: p.slug, label: `${p.title} (${p.slug})` })),
    ],
    [crud.items, editing],
  );

  const openCreate = () => setDrawer({ open: true, editing: null });
  const openEdit = (page: OrgPage) => setDrawer({ open: true, editing: page });
  const close = () => setDrawer((s) => ({ ...s, open: false }));

  const nextTopLevelOrder = () => {
    const top = crud.items.filter((p) => !p.parentSlug);
    return top.length ? Math.max(...top.map((p) => p.sortOrder)) + 1 : 1;
  };

  const initialValues: Partial<OrgPageFormValues> = editing
    ? {
        slug: editing.slug,
        title: editing.title,
        group: editing.group ?? NO_GROUP,
        intro: editing.intro,
        parentSlug: editing.parentSlug ?? NO_PARENT,
        icon: editing.icon ?? undefined,
        summary: editing.summary ?? "",
        sortOrder: editing.sortOrder,
      }
    : {
        group: NO_GROUP,
        intro: "",
        parentSlug: NO_PARENT,
        summary: "",
        sortOrder: nextTopLevelOrder(),
      };

  const submit = async (values: OrgPageFormValues) => {
    const group = (values.group ?? "").trim();
    const parent = (values.parentSlug ?? "").trim();
    const icon = (values.icon ?? "").trim();
    const input: OrgPageInput = {
      slug: values.slug.trim(),
      title: values.title.trim(),
      intro: (values.intro ?? "").trim(),
      sortOrder: values.sortOrder,
      group: group ? group : null,
      parentSlug: parent ? parent : null,
      icon: icon ? icon : null,
      summary: (values.summary ?? "").trim(),
    };
    if (editing) {
      await crud.update.mutateAsync({ id: editing.id, input });
    } else {
      await crud.create.mutateAsync(input);
    }
  };

  const columns: ColumnsType<OrgPage> = [
    {
      title: "عنوان",
      dataIndex: "title",
      key: "title",
      render: (title: string, page) => (
        <Space direction="vertical" size={0}>
          <Space size={6}>
            {/* A child is indented so the outline is readable at a glance. */}
            {page.parentSlug ? <Typography.Text type="secondary">└</Typography.Text> : null}
            <Typography.Text strong>{title}</Typography.Text>
          </Space>
          {page.parentSlug ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {truncate(page.summary, 60) || "بدون متن کارت"}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: "شناسه (slug)",
      dataIndex: "slug",
      key: "slug",
      width: 190,
      responsive: ["lg"],
      render: (slug: string) => (
        <Typography.Text code copyable style={LTR}>
          {slug}
        </Typography.Text>
      ),
    },
    {
      title: "زیرمجموعهٔ",
      dataIndex: "parentSlug",
      key: "parentSlug",
      width: 170,
      responsive: ["md"],
      render: (parentSlug?: string | null) =>
        parentSlug ? (
          <Tag color="purple">{titleBySlug.get(parentSlug) ?? parentSlug}</Tag>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: "آیکون",
      dataIndex: "icon",
      key: "icon",
      width: 130,
      responsive: ["xl"],
      render: (icon?: string | null) =>
        icon ? iconLabel(icon) : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "گروه",
      dataIndex: "group",
      key: "group",
      width: 150,
      responsive: ["lg"],
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
      responsive: ["xl"],
      render: (intro: string) => (
        <Typography.Text type="secondary">{truncate(intro, 70)}</Typography.Text>
      ),
    },
    {
      title: "ترتیب",
      dataIndex: "sortOrder",
      key: "sortOrder",
      width: 90,
      align: "center",
      responsive: ["md"],
      render: (sortOrder: number) => formatNumber(sortOrder),
    },
  ];

  const isChild = Boolean(watchedParent);

  return (
    <>
      <PageHeader
        title="صفحات سازمان"
        subtitle="صفحات ثابت معرفی سازمان — صفحه‌ای که والد داشته باشد، روی صفحهٔ والد به شکل کارت دیده می‌شود؛ زیرمجموعه‌های «ارکان سازمان» در منوی بالای سایت هم می‌آیند"
      />

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
        deleteConfirmTitle={(page) =>
          crud.items.some((p) => p.parentSlug === page.slug)
            ? `حذف «${page.title}»؟ زیرمجموعه‌هایش بدون والد می‌مانند.`
            : `حذف صفحهٔ «${page.title}»؟`
        }
        deleting={crud.deleting}
        emptyText="هنوز صفحه‌ای ثبت نشده است"
        scrollX={scrollX}
      />

      <FormDrawer<OrgPageFormValues>
        open={drawer.open}
        form={form}
        title={editing ? "ویرایش صفحهٔ سازمان" : "افزودن صفحهٔ سازمان"}
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
          name="parentSlug"
          label="زیرمجموعهٔ کدام صفحه؟ (اختیاری)"
          tooltip="با انتخاب والد، این صفحه روی صفحهٔ والد به شکل کارت نمایش داده می‌شود. اگر والد «ارکان سازمان» باشد، در منوی بالای سایت هم دیده می‌شود."
          extra={
            editingHasChildren
              ? "این صفحه خودش زیرمجموعه دارد، بنابراین نمی‌تواند زیر صفحهٔ دیگری برود."
              : undefined
          }
        >
          <Select
            allowClear
            options={parentOptions}
            placeholder="بدون والد — صفحهٔ مستقل"
            disabled={editingHasChildren}
          />
        </Form.Item>

        {isChild ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="این صفحه یک کارت هم هست"
            description="آیکون و «متن کارت» زیر، روی صفحهٔ والد نمایش داده می‌شوند. ترتیب هم جای این کارت را میان کارت‌های همان والد تعیین می‌کند."
          />
        ) : null}

        <Form.Item
          name="icon"
          label="آیکون کارت (اختیاری)"
          tooltip="اگر خالی بماند، آیکون پیش‌فرض به کار می‌رود."
        >
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="انتخاب آیکون"
            options={ICON_GROUPS}
          />
        </Form.Item>

        <Form.Item
          name="summary"
          label="متن کارت (اختیاری)"
          tooltip="یک جملهٔ کوتاه که زیر عنوان کارت روی صفحهٔ والد دیده می‌شود."
        >
          <Input.TextArea rows={2} placeholder="مثلاً اداره امور سازمان و اجرای مصوبات مجمع عمومی." />
        </Form.Item>

        <Form.Item
          name="group"
          label="گروه (اختیاری)"
          tooltip="اگر صفحه به یکی از گروه‌های اشخاص مربوط است، اعضای آن گروه زیر صفحه نمایش داده می‌شوند."
        >
          <Select options={GROUP_OPTIONS} placeholder="بدون گروه" />
        </Form.Item>

        <Form.Item
          name="intro"
          label="معرفی"
          tooltip="متن بالای صفحه. سرور این فیلد را الزامی می‌داند."
          rules={[{ required: true, message: "معرفی الزامی است" }]}
        >
          <Input.TextArea rows={5} placeholder="متن معرفی صفحه" />
        </Form.Item>

        <Form.Item
          name="sortOrder"
          label="ترتیب"
          tooltip="میان صفحه‌های هم‌سطح؛ از کوچک به بزرگ."
          rules={[{ required: true, message: "ترتیب الزامی است" }]}
        >
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>
      </FormDrawer>
    </>
  );
}

export default OrgPagesPage;
