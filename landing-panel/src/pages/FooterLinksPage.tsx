import { useMemo, useState } from "react";
import { Button, Form, Input, InputNumber, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CrudTable, FormDrawer, PageHeader } from "@/components/ui";
import { footerLinksApi } from "@/api/endpoints";
import type { FooterLink, FooterLinkInput } from "@/api/types";
import { queryKeys, useCrud } from "@/query";
import { formatNumber, truncate } from "@/lib/format";

/** Hrefs are always LTR, even inside the RTL panel. */
function HrefCell({ href }: { href: string }) {
  const text = (
    <span dir="ltr" style={{ direction: "ltr", unicodeBidi: "isolate", display: "inline-block" }}>
      {truncate(href, 56)}
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

interface FooterLinkFormValues {
  title: string;
  href: string;
  sortOrder: number;
}

function toInput(values: FooterLinkFormValues): FooterLinkInput {
  return {
    title: values.title.trim(),
    href: values.href.trim(),
    sortOrder: values.sortOrder ?? 0,
  };
}

const columns: ColumnsType<FooterLink> = [
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
    sorter: (a: FooterLink, b: FooterLink) => a.sortOrder - b.sortOrder,
    render: (sortOrder: number) => formatNumber(sortOrder),
  },
];

export function FooterLinksPage() {
  const crud = useCrud<FooterLink, FooterLinkInput>({
    key: queryKeys.footerLinks.all(),
    list: footerLinksApi.list,
    create: footerLinksApi.create,
    update: footerLinksApi.update,
    remove: footerLinksApi.remove,
    // GET /settings embeds footerLinks — keep the settings page in sync.
    alsoInvalidate: [queryKeys.settings.all()],
    labels: {
      created: "پیوند فوتر افزوده شد",
      updated: "پیوند فوتر ذخیره شد",
      removed: "پیوند فوتر حذف شد",
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FooterLink | null>(null);

  const nextSortOrder = useMemo(
    () => crud.items.reduce((max, l) => Math.max(max, l.sortOrder), -1) + 1,
    [crud.items],
  );

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (link: FooterLink) => {
    setEditing(link);
    setOpen(true);
  };

  const initialValues: Partial<FooterLinkFormValues> = editing
    ? { title: editing.title, href: editing.href, sortOrder: editing.sortOrder }
    : { title: "", href: "", sortOrder: nextSortOrder };

  const handleSubmit = async (values: FooterLinkFormValues) => {
    const input = toInput(values);
    if (editing) await crud.update.mutateAsync({ id: editing.id, input });
    else await crud.create.mutateAsync(input);
  };

  return (
    <>
      <PageHeader title="پیوندهای فوتر" subtitle="لینک‌های پاورقی سایت" />

      <CrudTable<FooterLink>
        columns={columns}
        data={crud.query.data}
        loading={crud.isLoading || crud.isFetching}
        error={crud.error}
        onRetry={crud.refetch}
        onRefresh={crud.refetch}
        searchable
        searchPlaceholder="جستجو در عنوان یا پیوند…"
        searchFields={["title", "href"]}
        onCreate={openCreate}
        createLabel="افزودن پیوند"
        onEdit={openEdit}
        onDelete={(link) => crud.remove.mutate(link.id)}
        deleteConfirmTitle={(link) => `حذف پیوند «${link.title}»؟`}
        deleting={crud.deleting}
        emptyText="هنوز پیوندی برای فوتر ثبت نشده است"
        emptyAction={
          <Button type="primary" onClick={openCreate}>
            افزودن پیوند
          </Button>
        }
        pageSize={10}
      />

      <FormDrawer<FooterLinkFormValues>
        open={open}
        title={editing ? "ویرایش پیوند فوتر" : "افزودن پیوند فوتر"}
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
          <Input placeholder="مثلاً: تماس با ما" maxLength={100} />
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
          extra="آدرس کامل (https://…) یا مسیر داخلی سایت (/contact)"
        >
          <Input dir="ltr" style={{ direction: "ltr", textAlign: "left" }} placeholder="/contact" />
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

export default FooterLinksPage;
