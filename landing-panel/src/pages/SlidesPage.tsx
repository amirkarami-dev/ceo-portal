import { useMemo, useState, type CSSProperties } from "react";
import { Button, Form, Input, InputNumber, Select, Space, Tag, Tooltip, Typography } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { CrudTable, FormDrawer, ImageUploader, PageHeader } from "@/components/ui";
import { mediaApi, newsApi, slidesApi } from "@/api/endpoints";
import type { Slide, SlideInput } from "@/api/types";
import { queryKeys, useApiQuery, useCrud } from "@/query";
import { formatNumber, truncate } from "@/lib/format";

/** The slide picker lists news titles; one page is plenty for a Select. */
const NEWS_OPTIONS_PAGE_SIZE = 200;

interface SlideFormValues {
  title: string;
  subtitle?: string;
  badge?: string;
  image?: string;
  newsId: number;
  sortOrder: number;
}

function toInput(values: SlideFormValues): SlideInput {
  return {
    title: values.title.trim(),
    subtitle: values.subtitle?.trim() ?? "",
    badge: values.badge?.trim() ?? "",
    image: values.image?.trim() ?? "",
    newsId: values.newsId,
    sortOrder: values.sortOrder ?? 0,
  };
}

/** Table thumbnail. Site-relative paths ("/images/…") cannot be served by the panel — fall back gracefully. */
function Thumb({ src }: { src?: string | null }) {
  const [broken, setBroken] = useState(false);
  const url = mediaApi.url(src);

  const box: CSSProperties = {
    width: 72,
    height: 44,
    borderRadius: 6,
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
    background: "var(--ant-color-fill-quaternary)",
    border: "1px solid var(--ant-color-border-secondary)",
  };

  if (!url || broken) {
    return (
      <Tooltip title={src || "بدون تصویر"}>
        <div style={box}>
          <PictureOutlined style={{ color: "var(--ant-color-text-quaternary)" }} />
        </div>
      </Tooltip>
    );
  }

  return (
    <div style={box}>
      <img
        src={url}
        alt=""
        onError={() => setBroken(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}

const columns: ColumnsType<Slide> = [
  {
    title: "تصویر",
    dataIndex: "image",
    key: "image",
    width: 96,
    render: (image: string) => <Thumb key={image} src={image} />,
  },
  {
    title: "عنوان",
    dataIndex: "title",
    key: "title",
    render: (_: unknown, slide: Slide) => (
      <Space direction="vertical" size={0}>
        <Typography.Text strong>{slide.title}</Typography.Text>
        {slide.subtitle ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {truncate(slide.subtitle, 70)}
          </Typography.Text>
        ) : null}
      </Space>
    ),
  },
  {
    title: "برچسب",
    dataIndex: "badge",
    key: "badge",
    width: 140,
    render: (badge: string) =>
      badge ? <Tag color="processing">{badge}</Tag> : <Typography.Text type="secondary">—</Typography.Text>,
  },
  {
    title: "خبر مرتبط",
    dataIndex: "newsTitle",
    key: "newsTitle",
    render: (_: unknown, slide: Slide) =>
      slide.newsTitle ? (
        <Tooltip title={slide.newsTitle}>
          <Typography.Text>{truncate(slide.newsTitle, 45)}</Typography.Text>
        </Tooltip>
      ) : (
        <Typography.Text type="secondary">{`خبر #${formatNumber(slide.newsId)}`}</Typography.Text>
      ),
  },
  {
    title: "ترتیب",
    dataIndex: "sortOrder",
    key: "sortOrder",
    width: 90,
    align: "center",
    defaultSortOrder: "ascend",
    sorter: (a: Slide, b: Slide) => a.sortOrder - b.sortOrder,
    render: (sortOrder: number) => formatNumber(sortOrder),
  },
];

export function SlidesPage() {
  const crud = useCrud<Slide, SlideInput>({
    key: queryKeys.slides.all(),
    list: slidesApi.list,
    create: slidesApi.create,
    update: slidesApi.update,
    remove: slidesApi.remove,
    labels: {
      created: "اسلاید افزوده شد",
      updated: "اسلاید ذخیره شد",
      removed: "اسلاید حذف شد",
    },
  });

  const newsParams = { page: 1, pageSize: NEWS_OPTIONS_PAGE_SIZE };
  const newsQuery = useApiQuery(
    queryKeys.news.list(newsParams),
    () => newsApi.list(newsParams),
    { staleTime: 60_000 },
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Slide | null>(null);

  const newsOptions = useMemo(() => {
    const options = (newsQuery.data?.items ?? []).map((n) => ({ value: n.id, label: n.title }));
    // The linked article may sit outside the first page — keep the edited slide's own news selectable.
    if (editing && !options.some((o) => o.value === editing.newsId)) {
      options.unshift({
        value: editing.newsId,
        label: editing.newsTitle ?? `خبر #${editing.newsId}`,
      });
    }
    return options;
  }, [newsQuery.data, editing]);

  const nextSortOrder = useMemo(
    () => crud.items.reduce((max, s) => Math.max(max, s.sortOrder), -1) + 1,
    [crud.items],
  );

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (slide: Slide) => {
    setEditing(slide);
    setOpen(true);
  };

  const initialValues: Partial<SlideFormValues> = editing
    ? {
        title: editing.title,
        subtitle: editing.subtitle,
        badge: editing.badge,
        image: editing.image,
        newsId: editing.newsId,
        sortOrder: editing.sortOrder,
      }
    : { title: "", subtitle: "", badge: "", sortOrder: nextSortOrder };

  const handleSubmit = async (values: SlideFormValues) => {
    const input = toInput(values);
    if (editing) await crud.update.mutateAsync({ id: editing.id, input });
    else await crud.create.mutateAsync(input);
  };

  return (
    <>
      <PageHeader title="اسلایدر" subtitle="اسلایدهای صفحهٔ نخست" />

      <CrudTable<Slide>
        columns={columns}
        data={crud.query.data}
        loading={crud.isLoading || crud.isFetching}
        error={crud.error}
        onRetry={crud.refetch}
        onRefresh={crud.refetch}
        searchable
        searchPlaceholder="جستجو در عنوان، زیرعنوان یا برچسب…"
        searchFields={["title", "subtitle", "badge", "newsTitle"]}
        onCreate={openCreate}
        createLabel="افزودن اسلاید"
        onEdit={openEdit}
        onDelete={(slide) => crud.remove.mutate(slide.id)}
        deleteConfirmTitle={(slide) => `حذف اسلاید «${slide.title}»؟`}
        deleting={crud.deleting}
        emptyText="هنوز اسلایدی ثبت نشده است"
        emptyAction={
          <Button type="primary" onClick={openCreate}>
            افزودن اسلاید
          </Button>
        }
        pageSize={10}
      />

      <FormDrawer<SlideFormValues>
        open={open}
        title={editing ? "ویرایش اسلاید" : "افزودن اسلاید"}
        initialValues={initialValues}
        submitting={crud.saving}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        width={560}
      >
        <Form.Item
          name="title"
          label="عنوان"
          rules={[{ required: true, whitespace: true, message: "عنوان اسلاید الزامی است" }]}
        >
          <Input placeholder="مثلاً: مجمع عمومی سالانه" maxLength={200} />
        </Form.Item>

        <Form.Item name="subtitle" label="زیرعنوان">
          <Input.TextArea rows={2} maxLength={300} showCount placeholder="توضیح کوتاه زیر عنوان اسلاید" />
        </Form.Item>

        <Form.Item name="badge" label="برچسب" extra="متن کوتاهی که روی اسلاید نشان داده می‌شود؛ مثلاً «خبر ویژه»">
          <Input placeholder="خبر ویژه" maxLength={50} />
        </Form.Item>

        <Form.Item
          name="image"
          label="تصویر"
          rules={[{ required: true, message: "تصویر اسلاید الزامی است" }]}
        >
          <ImageUploader placeholder="/images/slides/slide-1.jpg" />
        </Form.Item>

        <Form.Item
          name="newsId"
          label="خبر مرتبط"
          rules={[{ required: true, message: "انتخاب خبر مرتبط الزامی است" }]}
          extra={
            newsQuery.error ? (
              <Typography.Text type="danger">
                دریافت فهرست اخبار ناموفق بود.{" "}
                <Typography.Link onClick={() => void newsQuery.refetch()}>تلاش دوباره</Typography.Link>
              </Typography.Text>
            ) : (
              "با کلیک روی اسلاید، کاربر به این خبر می‌رود."
            )
          }
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="انتخاب خبر"
            loading={newsQuery.isLoading}
            options={newsOptions}
            notFoundContent={
              newsQuery.error ? (
                <Typography.Text type="danger">خطا در دریافت اخبار</Typography.Text>
              ) : newsQuery.isLoading ? null : (
                <Typography.Text type="secondary">خبری یافت نشد</Typography.Text>
              )
            }
          />
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

export default SlidesPage;
