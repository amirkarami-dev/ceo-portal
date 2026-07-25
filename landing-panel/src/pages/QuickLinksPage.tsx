import { useMemo, useState, type ReactNode } from "react";
import { Button, Form, Input, InputNumber, Select, Space, Tooltip, Typography } from "antd";
import {
  ApiOutlined,
  FireOutlined,
  HomeOutlined,
  IdcardOutlined,
  SolutionOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { CrudTable, FormDrawer, PageHeader } from "@/components/ui";
import { quickLinksApi } from "@/api/endpoints";
import {
  QUICK_LINK_ICONS,
  QUICK_LINK_ICON_LABELS,
  type QuickLink,
  type QuickLinkIcon,
  type QuickLinkInput,
} from "@/api/types";
import { queryKeys, useCrud } from "@/query";
import { formatNumber, truncate } from "@/lib/format";

/** The API only accepts these seven keys; each one maps to a card icon on the landing site. */
const ICON_META: Record<QuickLinkIcon, { icon: ReactNode; hint: string }> = {
  engineer: { icon: <ToolOutlined />, hint: "خدمات مهندسان" },
  owner: { icon: <HomeOutlined />, hint: "خدمات مالکان" },
  badge: { icon: <IdcardOutlined />, hint: "پروانهٔ اشتغال" },
  membership: { icon: <SolutionOutlined />, hint: "عضویت در سازمان" },
  automation: { icon: <ApiOutlined />, hint: "اتوماسیون اداری" },
  gas: { icon: <FireOutlined />, hint: "تأییدیهٔ گاز" },
  power: { icon: <ThunderboltOutlined />, hint: "تأییدیهٔ برق" },
};

const ICON_OPTIONS = QUICK_LINK_ICONS.map((icon) => ({
  value: icon,
  label: (
    <Space size={8}>
      <span style={{ display: "inline-flex", alignItems: "center" }}>{ICON_META[icon].icon}</span>
      <span>{QUICK_LINK_ICON_LABELS[icon]}</span>
      <Typography.Text type="secondary" style={{ fontSize: 12, direction: "ltr" }}>
        {icon}
      </Typography.Text>
    </Space>
  ),
}));

/** Hrefs are always LTR, even inside the RTL panel. */
function HrefCell({ href }: { href: string }) {
  const text = (
    <span dir="ltr" style={{ direction: "ltr", unicodeBidi: "isolate", display: "inline-block" }}>
      {truncate(href, 48)}
    </span>
  );
  const isAbsolute = /^https?:\/\//i.test(href);
  return (
    <Tooltip title={<span dir="ltr">{href}</span>}>
      {isAbsolute ? (
        <Typography.Link href={href} target="_blank" rel="noreferrer">
          {text}
        </Typography.Link>
      ) : (
        <Typography.Text type="secondary">{text}</Typography.Text>
      )}
    </Tooltip>
  );
}

interface QuickLinkFormValues {
  title: string;
  href: string;
  icon: QuickLinkIcon;
  sortOrder: number;
}

function toInput(values: QuickLinkFormValues): QuickLinkInput {
  return {
    title: values.title.trim(),
    href: values.href.trim(),
    icon: values.icon,
    sortOrder: values.sortOrder ?? 0,
  };
}

const columns: ColumnsType<QuickLink> = [
  {
    title: "آیکون",
    dataIndex: "icon",
    key: "icon",
    width: 170,
    render: (icon: QuickLinkIcon) => {
      const meta = ICON_META[icon];
      return (
        <Space size={8}>
          <span style={{ display: "inline-flex", alignItems: "center", fontSize: 16 }}>
            {meta?.icon}
          </span>
          <Space direction="vertical" size={0}>
            <Typography.Text>{QUICK_LINK_ICON_LABELS[icon] ?? icon}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {meta?.hint ?? icon}
            </Typography.Text>
          </Space>
        </Space>
      );
    },
  },
  {
    title: "عنوان",
    dataIndex: "title",
    key: "title",
    render: (title: string) => <Typography.Text strong>{title}</Typography.Text>,
  },
  {
    title: "پیوند",
    dataIndex: "href",
    key: "href",
    render: (href: string) => <HrefCell href={href} />,
  },
  {
    title: "ترتیب",
    dataIndex: "sortOrder",
    key: "sortOrder",
    width: 90,
    align: "center",
    defaultSortOrder: "ascend",
    sorter: (a: QuickLink, b: QuickLink) => a.sortOrder - b.sortOrder,
    render: (sortOrder: number) => formatNumber(sortOrder),
  },
];

export function QuickLinksPage() {
  const crud = useCrud<QuickLink, QuickLinkInput>({
    key: queryKeys.quickLinks.all(),
    list: quickLinksApi.list,
    create: quickLinksApi.create,
    update: quickLinksApi.update,
    remove: quickLinksApi.remove,
    labels: {
      created: "پیوند سریع افزوده شد",
      updated: "پیوند سریع ذخیره شد",
      removed: "پیوند سریع حذف شد",
    },
  });

  const [form] = Form.useForm<QuickLinkFormValues>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuickLink | null>(null);

  const selectedIcon = Form.useWatch("icon", form);

  const nextSortOrder = useMemo(
    () => crud.items.reduce((max, q) => Math.max(max, q.sortOrder), -1) + 1,
    [crud.items],
  );

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (link: QuickLink) => {
    setEditing(link);
    setOpen(true);
  };

  const initialValues: Partial<QuickLinkFormValues> = editing
    ? {
        title: editing.title,
        href: editing.href,
        icon: editing.icon,
        sortOrder: editing.sortOrder,
      }
    : { title: "", href: "", sortOrder: nextSortOrder };

  const handleSubmit = async (values: QuickLinkFormValues) => {
    const input = toInput(values);
    if (editing) await crud.update.mutateAsync({ id: editing.id, input });
    else await crud.create.mutateAsync(input);
  };

  return (
    <>
      <PageHeader title="پیوندهای سریع" subtitle="کارت‌های دسترسی سریع صفحهٔ نخست" />

      <CrudTable<QuickLink>
        columns={columns}
        data={crud.query.data}
        loading={crud.isLoading || crud.isFetching}
        error={crud.error}
        onRetry={crud.refetch}
        onRefresh={crud.refetch}
        searchable
        searchPlaceholder="جستجو در عنوان یا پیوند…"
        searchFields={["title", "href", "icon"]}
        onCreate={openCreate}
        createLabel="افزودن پیوند"
        onEdit={openEdit}
        onDelete={(link) => crud.remove.mutate(link.id)}
        deleteConfirmTitle={(link) => `حذف پیوند «${link.title}»؟`}
        deleting={crud.deleting}
        emptyText="هنوز پیوند سریعی ثبت نشده است"
        emptyAction={
          <Button type="primary" onClick={openCreate}>
            افزودن پیوند
          </Button>
        }
        pageSize={10}
      />

      <FormDrawer<QuickLinkFormValues>
        form={form}
        open={open}
        title={editing ? "ویرایش پیوند سریع" : "افزودن پیوند سریع"}
        initialValues={initialValues}
        submitting={crud.saving}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
      >
        <Form.Item
          name="title"
          label="عنوان"
          rules={[{ required: true, whitespace: true, message: "عنوان پیوند الزامی است" }]}
        >
          <Input placeholder="مثلاً: استعلام پروانهٔ اشتغال" maxLength={100} />
        </Form.Item>

        <Form.Item
          name="href"
          label="پیوند"
          rules={[
            { required: true, whitespace: true, message: "آدرس پیوند الزامی است" },
            {
              pattern: /^(https?:\/\/|mailto:|tel:|\/|#)/i,
              message: "پیوند باید با /، # یا //:http(s) آغاز شود",
            },
          ]}
          extra="آدرس کامل (https://…) یا مسیر داخلی سایت (/services/engineer)"
        >
          <Input dir="ltr" style={{ direction: "ltr", textAlign: "left" }} placeholder="https://example.com/services" />
        </Form.Item>

        <Form.Item
          name="icon"
          label="آیکون"
          rules={[{ required: true, message: "انتخاب آیکون الزامی است" }]}
          extra={
            selectedIcon
              ? `${QUICK_LINK_ICON_LABELS[selectedIcon]} — ${ICON_META[selectedIcon].hint}`
              : "آیکونی که روی کارت این پیوند نشان داده می‌شود."
          }
        >
          <Select placeholder="انتخاب آیکون" options={ICON_OPTIONS} />
        </Form.Item>

        <Form.Item
          name="sortOrder"
          label="ترتیب نمایش"
          rules={[{ required: true, message: "ترتیب نمایش الزامی است" }]}
          extra="عدد کوچک‌تر، زودتر نمایش داده می‌شود."
        >
          <InputNumber min={0} step={1} style={{ width: "100%" }} />
        </Form.Item>
      </FormDrawer>
    </>
  );
}

export default QuickLinksPage;
