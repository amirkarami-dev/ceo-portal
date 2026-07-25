import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Button, Form, Input, Select, Space, Switch, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PictureOutlined } from "@ant-design/icons";
import { mediaUrl } from "@/api/client";
import { categoriesApi, newsApi, unitsApi } from "@/api/endpoints";
import type { News, NewsAttachment, NewsInput, NewsListParams, Paged } from "@/api/types";
import {
  AttachmentUploader,
  CrudTable,
  FormDrawer,
  ImageUploader,
  PageHeader,
  RichTextEditor,
} from "@/components/ui";
import { formatDate, formatDateTime, formatNumber, truncate } from "@/lib/format";
import { queryKeys, useApiMutation, useApiQuery } from "@/query";

/** Filter value for the "featured" dropdown — a tri-state that maps to `featured?: boolean`. */
type FeaturedFilter = "all" | "yes" | "no";

const FEATURED_OPTIONS: { value: FeaturedFilter; label: string }[] = [
  { value: "all", label: "همه خبرها" },
  { value: "yes", label: "فقط ویژه" },
  { value: "no", label: "غیرویژه" },
];

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Cap a long value at N lines with an ellipsis. Titles here run to 200 characters, which used to
 * wrap all the way down the row; the full text is still available via the cell's tooltip.
 */
const clampLines = (lines: number): CSSProperties => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  wordBreak: "break-word",
});

/** The drawer's shape. `image` is optional here; the API wants a (possibly empty) string. */
interface NewsFormValues {
  title: string;
  summary: string;
  body: string;
  date: string;
  author: string;
  categoryId: number;
  unitId?: number | null;
  image?: string;
  featured: boolean;
  attachments?: NewsAttachment[];
}

/** Today as the Jalali string the editors type, e.g. "۱۴۰۵/۴/۲۱" (fa-IR digits come from Intl). */
function todayJalali(): string {
  const parts = new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}/${part("month")}/${part("day")}`;
}

/** Table thumbnail: legacy site paths (e.g. "/images/news/news-1.png") cannot be served by the
 *  panel, so a broken image degrades to a placeholder instead of an ugly torn-page icon. */
function Thumb({ src, alt }: { src?: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);
  const url = mediaUrl(src);

  useEffect(() => {
    setBroken(false);
  }, [url]);

  return (
    <div
      style={{
        width: 64,
        height: 44,
        borderRadius: 6,
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        border: "1px solid var(--ant-color-border-secondary)",
        background: "var(--ant-color-fill-quaternary)",
      }}
    >
      {url && !broken ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          onError={() => setBroken(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <PictureOutlined style={{ color: "var(--ant-color-text-quaternary)" }} />
      )}
    </div>
  );
}

export function NewsPage() {
  const [form] = Form.useForm<NewsFormValues>();

  // ── filters / paging ───────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [featured, setFeatured] = useState<FeaturedFilter>("all");

  // Debounce the search box: `CrudTable` fires `onSearch` on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const params: NewsListParams = useMemo(
    () => ({
      page,
      pageSize,
      q: q || undefined,
      categoryId,
      featured: featured === "all" ? undefined : featured === "yes",
    }),
    [page, pageSize, q, categoryId, featured],
  );

  // ── data ───────────────────────────────────────────────────────────────────
  const newsQuery = useApiQuery<Paged<News>>(queryKeys.news.list(params), () =>
    newsApi.list(params),
  );
  const categoriesQuery = useApiQuery(queryKeys.categories.list(), categoriesApi.list);
  const unitsQuery = useApiQuery(queryKeys.units.list(), unitsApi.list);

  // Keep the previous page on screen while the next one loads (no skeleton flash on paging).
  const previous = useRef<Paged<News> | undefined>(undefined);
  useEffect(() => {
    if (newsQuery.data) previous.current = newsQuery.data;
  }, [newsQuery.data]);
  const paged = newsQuery.data ?? previous.current;
  const rows = paged?.items;
  const total = paged?.total ?? 0;

  // Deleting the last row of the last page would otherwise strand us on an empty page.
  useEffect(() => {
    if (paged && paged.totalPages > 0 && page > paged.totalPages) setPage(paged.totalPages);
  }, [paged, page]);

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);

  const categoryTitleById = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of categories) map.set(c.id, c.title);
    return map;
  }, [categories]);

  // ── mutations ──────────────────────────────────────────────────────────────
  // Slides embed the linked article's title, so they go stale when a news item changes.
  const invalidate = [queryKeys.news.all(), queryKeys.slides.all()];

  const create = useApiMutation<NewsInput, number>({
    mutationFn: (input) => newsApi.create(input),
    invalidate,
    success: "خبر با موفقیت افزوده شد",
  });

  const update = useApiMutation<{ id: number; input: NewsInput }>({
    mutationFn: ({ id, input }) => newsApi.update(id, input),
    invalidate,
    success: "خبر با موفقیت ذخیره شد",
  });

  const remove = useApiMutation<number>({
    mutationFn: (id) => newsApi.remove(id),
    invalidate,
    success: "خبر با موفقیت حذف شد",
  });

  // ── drawer ─────────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<News | null>(null);

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (record: News) => {
    setEditing(record);
    setOpen(true);
  };

  const initialValues: Partial<NewsFormValues> = editing
    ? {
        title: editing.title,
        summary: editing.summary,
        body: editing.body,
        date: editing.date,
        author: editing.author,
        categoryId: editing.categoryId,
        unitId: editing.unitId ?? undefined,
        image: editing.image,
        featured: editing.featured,
        attachments: editing.attachments ?? [],
      }
    : { date: todayJalali(), featured: false, attachments: [] };

  const handleSubmit = async (values: NewsFormValues) => {
    const input: NewsInput = {
      title: values.title.trim(),
      summary: values.summary.trim(),
      body: values.body,
      date: values.date.trim(),
      author: values.author.trim(),
      categoryId: values.categoryId,
      unitId: values.unitId ?? null,
      image: values.image?.trim() ?? "",
      featured: !!values.featured,
      // Sent in full: the server replaces the article's files with exactly this list.
      attachments: values.attachments ?? [],
    };

    // Let it throw: `FormDrawer` paints ValidationProblemDetails onto the offending fields.
    if (editing) await update.mutateAsync({ id: editing.id, input });
    else await create.mutateAsync(input);
  };

  // ── columns ────────────────────────────────────────────────────────────────
  const columns: ColumnsType<News> = [
    {
      title: "تصویر",
      dataIndex: "image",
      key: "image",
      width: 84,
      render: (_: unknown, record) => <Thumb src={record.image} alt={record.title} />,
    },
    {
      title: "عنوان",
      dataIndex: "title",
      key: "title",
      width: 380,
      render: (_: unknown, record) => (
        <Space direction="vertical" size={0} style={{ width: "100%" }}>
          <Tooltip title={record.title}>
            <Typography.Text strong style={clampLines(2)}>
              {record.title}
            </Typography.Text>
          </Tooltip>
          <Typography.Text type="secondary" style={{ fontSize: 12, ...clampLines(1) }}>
            {record.summary}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "دسته‌بندی",
      dataIndex: "categoryId",
      key: "categoryId",
      width: 150,
      render: (_: unknown, record) => {
        const title = record.categoryTitle ?? categoryTitleById.get(record.categoryId);
        return title ? <Tag color="blue">{title}</Tag> : <Typography.Text type="secondary">—</Typography.Text>;
      },
    },
    {
      title: "نویسنده",
      dataIndex: "author",
      key: "author",
      width: 150,
      ellipsis: true,
      render: (value: string) =>
        value ? value : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "تاریخ",
      dataIndex: "date",
      key: "date",
      width: 140,
      render: (_: unknown, record) => (
        <Tooltip title={`انتشار: ${formatDateTime(record.publishedAt)}`}>
          <span>{record.date?.trim() ? record.date : formatDate(record.publishedAt)}</span>
        </Tooltip>
      ),
    },
    {
      title: "ویژه",
      dataIndex: "featured",
      key: "featured",
      width: 90,
      align: "center",
      render: (value: boolean) =>
        value ? <Tag color="gold">ویژه</Tag> : <Typography.Text type="secondary">—</Typography.Text>,
    },
  ];

  const filters = (
    <>
      <Select<number>
        allowClear
        placeholder="همه دسته‌بندی‌ها"
        style={{ width: 200 }}
        value={categoryId}
        loading={categoriesQuery.isLoading}
        onChange={(value) => {
          setCategoryId(value ?? undefined);
          setPage(1);
        }}
        options={categories.map((c) => ({ value: c.id, label: c.title }))}
        aria-label="فیلتر دسته‌بندی"
      />
      <Select<FeaturedFilter>
        style={{ width: 160 }}
        value={featured}
        onChange={(value) => {
          setFeatured(value);
          setPage(1);
        }}
        options={FEATURED_OPTIONS}
        aria-label="فیلتر خبر ویژه"
      />
    </>
  );

  return (
    <>
      <PageHeader
        title="اخبار"
        subtitle={
          newsQuery.isLoading ? "مدیریت مطالب خبری سایت" : `${formatNumber(total)} خبر ثبت شده است`
        }
      />

      <CrudTable<News>
        columns={columns}
        data={rows}
        loading={newsQuery.isFetching}
        error={newsQuery.error}
        onRetry={() => void newsQuery.refetch()}
        onRefresh={() => void newsQuery.refetch()}
        searchable
        searchPlaceholder="جستجو در عنوان و متن…"
        searchValue={searchInput}
        onSearch={setSearchInput}
        toolbarExtra={filters}
        onCreate={openCreate}
        createLabel="افزودن خبر"
        onEdit={openEdit}
        onDelete={(record) => remove.mutate(record.id)}
        deleteConfirmTitle={(record) => `حذف خبر «${truncate(record.title, 40)}»؟`}
        deleting={remove.isPending}
        emptyText={q || categoryId || featured !== "all" ? "خبری با این فیلترها یافت نشد" : "هنوز خبری ثبت نشده است"}
        emptyAction={
          <Button type="primary" onClick={openCreate}>
            افزودن خبر
          </Button>
        }
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
      />

      <FormDrawer<NewsFormValues>
        open={open}
        form={form}
        width={760}
        title={editing ? "ویرایش خبر" : "افزودن خبر"}
        initialValues={initialValues}
        submitting={create.isPending || update.isPending}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
      >
        <Form.Item
          name="title"
          label="عنوان"
          rules={[{ required: true, message: "عنوان خبر الزامی است" }]}
        >
          <Input placeholder="عنوان خبر" maxLength={200} showCount />
        </Form.Item>

        <Form.Item
          name="summary"
          label="خلاصه"
          rules={[{ required: true, message: "خلاصه خبر الزامی است" }]}
          extra="یکی دو جمله؛ در کارت‌های خبری سایت نمایش داده می‌شود."
        >
          <Input.TextArea rows={3} placeholder="خلاصه کوتاه خبر" maxLength={500} showCount />
        </Form.Item>

        <Form.Item
          name="body"
          label="متن خبر"
          rules={[{ required: true, message: "متن خبر الزامی است" }]}
          extra="متن را قالب‌بندی کنید: درشت، فهرست، عنوان و پیوند. خبرهای قدیمی خودکار تبدیل می‌شوند."
        >
          <RichTextEditor minHeight={320} />
        </Form.Item>

        <Form.Item
          name="attachments"
          label="پیوست‌ها"
          extra="PDF / Word / Excel / تصویر — حداکثر ۲۰ مگابایت برای هر فایل. ترتیب فهرست همان ترتیب نمایش در سایت است."
        >
          <AttachmentUploader />
        </Form.Item>

        <Form.Item
          name="date"
          label="تاریخ (شمسی)"
          rules={[{ required: true, message: "تاریخ الزامی است" }]}
          extra="همان‌گونه که روی سایت نمایش داده می‌شود، مثلاً ۱۴۰۵/۴/۲۱."
        >
          <Input
            placeholder="۱۴۰۵/۴/۲۱"
            addonAfter={
              <Button
                type="link"
                size="small"
                style={{ padding: 0, height: "auto" }}
                onClick={() => form.setFieldValue("date", todayJalali())}
              >
                امروز
              </Button>
            }
          />
        </Form.Item>

        <Form.Item
          name="author"
          label="نویسنده"
          rules={[{ required: true, message: "نام نویسنده الزامی است" }]}
        >
          <Input placeholder="روابط عمومی" maxLength={100} />
        </Form.Item>

        <Form.Item
          name="categoryId"
          label="دسته‌بندی"
          rules={[{ required: true, message: "انتخاب دسته‌بندی الزامی است" }]}
        >
          <Select<number>
            placeholder="یک دسته‌بندی انتخاب کنید"
            loading={categoriesQuery.isLoading}
            options={categories.map((c) => ({ value: c.id, label: c.title }))}
            notFoundContent={
              categoriesQuery.isLoading ? "در حال بارگذاری…" : "هیچ دسته‌بندی‌ای تعریف نشده است"
            }
          />
        </Form.Item>

        <Form.Item name="unitId" label="واحد مرتبط (اختیاری)">
          <Select<number>
            allowClear
            placeholder="بدون واحد"
            loading={unitsQuery.isLoading}
            options={units.map((u) => ({ value: u.id, label: u.title }))}
            notFoundContent={unitsQuery.isLoading ? "در حال بارگذاری…" : "واحدی تعریف نشده است"}
          />
        </Form.Item>

        <Form.Item name="image" label="تصویر">
          <ImageUploader placeholder="/images/news/news-1.png" />
        </Form.Item>

        <Form.Item
          name="featured"
          label="خبر ویژه"
          valuePropName="checked"
          extra="خبرهای ویژه در بخش برجستهٔ صفحهٔ اصلی نمایش داده می‌شوند."
        >
          <Switch checkedChildren="بله" unCheckedChildren="خیر" />
        </Form.Item>
      </FormDrawer>
    </>
  );
}

export default NewsPage;
