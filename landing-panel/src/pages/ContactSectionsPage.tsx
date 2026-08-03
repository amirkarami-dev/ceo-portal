import { useMemo, useState, type CSSProperties } from "react";
import { Form, Input, InputNumber, Select, Space, Switch, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { contactSectionsApi } from "@/api/endpoints";
import {
  CONTACT_CHANNEL_KINDS,
  type ContactChannel,
  type ContactChannelInput,
  type ContactChannelKind,
  type ContactSection,
  type ContactSectionInput,
} from "@/api/types";
import { CrudTable, FormDrawer, PageHeader } from "@/components/ui";
import { queryKeys, useApiMutation, useCrud } from "@/query";
import { formatNumber } from "@/lib/format";
import {
  CHANNEL_KIND_LABELS,
  CHANNEL_KIND_PLACEHOLDERS,
  ICON_GROUPS,
  LINKED_CHANNEL_KINDS,
  iconLabel,
} from "@/lib/siteMeta";

/** Phone numbers, emails and URLs read as gibberish in an RTL field. */
const LTR: CSSProperties = { direction: "ltr", textAlign: "left" };

/** Kinds whose value is a number or a URL, so the input is forced left-to-right. */
const LTR_KINDS: ContactChannelKind[] = [
  "phone",
  "mobile",
  "fax",
  "email",
  "postal",
  "telegram",
  "instagram",
  "website",
];

interface SectionFormValues {
  title: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}

interface ChannelFormValues {
  kind: ContactChannelKind;
  label?: string;
  value: string;
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

function sortChannels(channels: ContactChannel[]): ContactChannel[] {
  return [...channels].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

export function ContactSectionsPage() {
  const [sectionForm] = Form.useForm<SectionFormValues>();
  const [channelForm] = Form.useForm<ChannelFormValues>();

  const [sectionDrawer, setSectionDrawer] = useState<{
    open: boolean;
    editing: ContactSection | null;
  }>({ open: false, editing: null });

  const [channelDrawer, setChannelDrawer] = useState<{
    open: boolean;
    section: ContactSection | null;
    editing: ContactChannel | null;
  }>({ open: false, section: null, editing: null });

  // Watched so the value field can relabel itself and switch direction as the kind changes.
  const watchedKind = Form.useWatch("kind", channelForm) as ContactChannelKind | undefined;

  const crud = useCrud<ContactSection, ContactSectionInput>({
    key: queryKeys.contactSections.all(),
    list: contactSectionsApi.list,
    create: contactSectionsApi.create,
    update: contactSectionsApi.update,
    remove: contactSectionsApi.remove,
    labels: {
      created: "بخش تماس افزوده شد",
      updated: "بخش تماس ذخیره شد",
      removed: "بخش تماس حذف شد",
    },
  });

  const invalidateSections = [queryKeys.contactSections.all()];

  const createChannel = useApiMutation<{ sectionId: number; input: ContactChannelInput }, number>({
    mutationFn: ({ sectionId, input }) => contactSectionsApi.createChannel(sectionId, input),
    invalidate: invalidateSections,
    success: "ردیف تماس افزوده شد",
  });

  const updateChannel = useApiMutation<{ channelId: number; input: ContactChannelInput }>({
    mutationFn: ({ channelId, input }) => contactSectionsApi.updateChannel(channelId, input),
    invalidate: invalidateSections,
    success: "ردیف تماس ذخیره شد",
  });

  const removeChannel = useApiMutation<number>({
    mutationFn: (channelId) => contactSectionsApi.removeChannel(channelId),
    invalidate: invalidateSections,
    success: "ردیف تماس حذف شد",
  });

  const sections = useMemo(
    () => [...crud.items].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [crud.items],
  );

  const savingChannel = createChannel.isPending || updateChannel.isPending;

  // ── section drawer ─────────────────────────────────────────────────────────

  const openCreateSection = () => setSectionDrawer({ open: true, editing: null });
  const openEditSection = (section: ContactSection) =>
    setSectionDrawer({ open: true, editing: section });
  const closeSectionDrawer = () => setSectionDrawer((s) => ({ ...s, open: false }));

  const sectionInitialValues: Partial<SectionFormValues> = sectionDrawer.editing
    ? {
        title: sectionDrawer.editing.title,
        description: sectionDrawer.editing.description ?? undefined,
        icon: sectionDrawer.editing.icon ?? undefined,
        sortOrder: sectionDrawer.editing.sortOrder,
        isActive: sectionDrawer.editing.isActive,
      }
    : { sortOrder: nextSortOrder(sections), isActive: true };

  const submitSection = async (values: SectionFormValues) => {
    const input: ContactSectionInput = {
      title: values.title.trim(),
      description: orNull(values.description),
      icon: orNull(values.icon),
      sortOrder: values.sortOrder,
      isActive: values.isActive,
    };
    if (sectionDrawer.editing) {
      await crud.update.mutateAsync({ id: sectionDrawer.editing.id, input });
    } else {
      await crud.create.mutateAsync(input);
    }
  };

  // ── channel drawer ─────────────────────────────────────────────────────────

  const openCreateChannel = (section: ContactSection) =>
    setChannelDrawer({ open: true, section, editing: null });
  const openEditChannel = (section: ContactSection, channel: ContactChannel) =>
    setChannelDrawer({ open: true, section, editing: channel });
  const closeChannelDrawer = () => setChannelDrawer((s) => ({ ...s, open: false }));

  const channelInitialValues: Partial<ChannelFormValues> = channelDrawer.editing
    ? {
        kind: channelDrawer.editing.kind,
        label: channelDrawer.editing.label ?? undefined,
        value: channelDrawer.editing.value,
        sortOrder: channelDrawer.editing.sortOrder,
      }
    : { kind: "phone", sortOrder: nextSortOrder(channelDrawer.section?.channels ?? []) };

  const submitChannel = async (values: ChannelFormValues) => {
    const input: ContactChannelInput = {
      kind: values.kind,
      label: orNull(values.label),
      value: values.value.trim(),
      sortOrder: values.sortOrder,
    };
    if (channelDrawer.editing) {
      await updateChannel.mutateAsync({ channelId: channelDrawer.editing.id, input });
    } else if (channelDrawer.section) {
      await createChannel.mutateAsync({ sectionId: channelDrawer.section.id, input });
    }
  };

  // ── columns ────────────────────────────────────────────────────────────────

  const sectionColumns: ColumnsType<ContactSection> = [
    {
      title: "عنوان",
      dataIndex: "title",
      key: "title",
      render: (title: string, section) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{title}</Typography.Text>
          {section.description ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {section.description}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: "آیکون",
      dataIndex: "icon",
      key: "icon",
      width: 150,
      responsive: ["lg"],
      render: (icon?: string | null) =>
        icon ? iconLabel(icon) : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "ردیف‌ها",
      key: "channelCount",
      width: 110,
      align: "center",
      render: (_: unknown, section) => (
        <Tag color={section.channels.length ? "green" : "default"}>
          {formatNumber(section.channels.length)}
        </Tag>
      ),
    },
    {
      title: "وضعیت",
      dataIndex: "isActive",
      key: "isActive",
      width: 110,
      align: "center",
      render: (isActive: boolean) =>
        isActive ? <Tag color="green">فعال</Tag> : <Tag>غیرفعال</Tag>,
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

  const channelColumns: ColumnsType<ContactChannel> = [
    {
      title: "نوع",
      dataIndex: "kind",
      key: "kind",
      width: 140,
      render: (kind: ContactChannelKind) => <Tag>{CHANNEL_KIND_LABELS[kind] ?? kind}</Tag>,
    },
    {
      title: "مقدار",
      dataIndex: "value",
      key: "value",
      render: (value: string, channel) => (
        <Space direction="vertical" size={0}>
          <Typography.Text
            copyable
            style={LTR_KINDS.includes(channel.kind) ? LTR : undefined}
          >
            {value}
          </Typography.Text>
          {/* The برچسب column hides below `md`; without this the label would be unreachable on a
              phone. Same rule as the Messages screen: a hidden column's information has to go
              somewhere, and it must not show twice. */}
          {channel.label ? (
            <Typography.Text type="secondary" className="only-narrow" style={{ fontSize: 12 }}>
              {channel.label}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: "برچسب",
      dataIndex: "label",
      key: "label",
      width: 160,
      responsive: ["md"],
      render: (label?: string | null) =>
        label ? label : <Typography.Text type="secondary">—</Typography.Text>,
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

  // ── expanded row: the section's channels ───────────────────────────────────

  const renderChannels = (section: ContactSection) => (
    <CrudTable<ContactChannel>
      columns={channelColumns}
      data={sortChannels(section.channels)}
      rowKey="id"
      size="small"
      pagination={false}
      loading={crud.isFetching}
      onCreate={() => openCreateChannel(section)}
      createLabel="افزودن ردیف"
      onEdit={(channel) => openEditChannel(section, channel)}
      onDelete={(channel) => removeChannel.mutate(channel.id)}
      deleteConfirmTitle={(channel) =>
        `حذف «${CHANNEL_KIND_LABELS[channel.kind] ?? channel.kind}: ${channel.value}»؟`
      }
      deleting={removeChannel.isPending}
      emptyText="این بخش هنوز ردیفی ندارد"
      actionsWidth={110}
    />
  );

  const valueKind = watchedKind ?? "phone";

  return (
    <>
      <PageHeader
        title="بخش‌های تماس"
        subtitle="بلوک‌های صفحهٔ «تماس با ما» و ردیف‌های داخل هرکدام — برای مدیریت ردیف‌ها ردیف بخش را باز کنید"
      />

      <CrudTable<ContactSection>
        columns={sectionColumns}
        data={sections}
        loading={crud.isLoading}
        error={crud.error}
        onRetry={crud.refetch}
        onRefresh={crud.refetch}
        searchable
        searchPlaceholder="جستجو در عنوان یا توضیح…"
        searchFields={["title", "description"]}
        onCreate={openCreateSection}
        createLabel="افزودن بخش"
        onEdit={openEditSection}
        onDelete={(section) => crud.remove.mutate(section.id)}
        deleteConfirmTitle={(section) => `حذف بخش «${section.title}»؟`}
        deleting={crud.deleting}
        pagination={false}
        emptyText="هنوز بخش تماسی ثبت نشده است"
        expandable={{
          expandedRowRender: renderChannels,
          rowExpandable: () => true,
        }}
      />

      <FormDrawer<SectionFormValues>
        open={sectionDrawer.open}
        form={sectionForm}
        title={sectionDrawer.editing ? "ویرایش بخش تماس" : "افزودن بخش تماس"}
        initialValues={sectionInitialValues}
        onClose={closeSectionDrawer}
        onSubmit={submitSection}
        submitting={crud.saving}
      >
        <Form.Item
          name="title"
          label="عنوان"
          rules={[{ required: true, message: "عنوان الزامی است" }]}
        >
          <Input placeholder="مثلاً دفتر مرکزی یا واحد حقوقی" />
        </Form.Item>

        <Form.Item name="description" label="توضیح کوتاه (اختیاری)">
          <Input placeholder="مثلاً پاسخگویی در ساعات اداری" />
        </Form.Item>

        <Form.Item
          name="icon"
          label="آیکون (اختیاری)"
          tooltip="آیکونی که کنار عنوان این بخش در سایت دیده می‌شود. اگر خالی بماند، آیکون پیش‌فرض به کار می‌رود."
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
          name="sortOrder"
          label="ترتیب"
          tooltip="بخش‌ها از کوچک به بزرگ چیده می‌شوند."
          rules={[{ required: true, message: "ترتیب الزامی است" }]}
        >
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item
          name="isActive"
          label="نمایش در سایت"
          valuePropName="checked"
          tooltip="خاموش کردن این گزینه، بخش را از صفحهٔ «تماس با ما» برمی‌دارد ولی ردیف‌هایش را نگه می‌دارد."
        >
          <Switch checkedChildren="فعال" unCheckedChildren="غیرفعال" />
        </Form.Item>
      </FormDrawer>

      <FormDrawer<ChannelFormValues>
        open={channelDrawer.open}
        form={channelForm}
        title={
          <Space>
            {channelDrawer.editing ? "ویرایش ردیف تماس" : "افزودن ردیف تماس"}
            {channelDrawer.section ? (
              <Typography.Text type="secondary">{channelDrawer.section.title}</Typography.Text>
            ) : null}
          </Space>
        }
        initialValues={channelInitialValues}
        onClose={closeChannelDrawer}
        onSubmit={submitChannel}
        submitting={savingChannel}
      >
        <Form.Item
          name="kind"
          label="نوع"
          tooltip="نوع، هم آیکون ردیف را تعیین می‌کند و هم اینکه سایت مقدار را به پیوند تبدیل کند یا نه."
          rules={[{ required: true, message: "نوع الزامی است" }]}
        >
          <Select
            options={CONTACT_CHANNEL_KINDS.map((k) => ({
              value: k,
              label: CHANNEL_KIND_LABELS[k],
            }))}
          />
        </Form.Item>

        <Form.Item
          name="value"
          label="مقدار"
          extra={
            LINKED_CHANNEL_KINDS.includes(valueKind)
              ? "سایت این مقدار را به پیوند قابل کلیک تبدیل می‌کند."
              : undefined
          }
          rules={[{ required: true, message: "مقدار الزامی است" }]}
        >
          <Input
            style={LTR_KINDS.includes(valueKind) ? LTR : undefined}
            placeholder={CHANNEL_KIND_PLACEHOLDERS[valueKind]}
          />
        </Form.Item>

        <Form.Item
          name="label"
          label="برچسب (اختیاری)"
          tooltip="توضیح کوتاهی که کنار مقدار دیده می‌شود."
        >
          <Input placeholder="مثلاً داخلی ۱۰۳" />
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

export default ContactSectionsPage;
