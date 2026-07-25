import { useEffect, useMemo, useState } from "react";
import { Avatar, Form, Image, Input, InputNumber, Segmented, Select, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { UserOutlined } from "@ant-design/icons";
import { CrudTable, FormDrawer, ImageUploader, PageHeader } from "@/components/ui";
import { mediaApi, peopleApi } from "@/api/endpoints";
import {
  PERSON_GROUPS,
  PERSON_GROUP_LABELS,
  type Person,
  type PersonGroup,
  type PersonInput,
} from "@/api/types";
import { queryKeys, useCrud } from "@/query";

/** "all" = no `group` query param, so the API returns every group. */
type GroupFilter = PersonGroup | "all";

const GROUP_OPTIONS = PERSON_GROUPS.map((g) => ({ label: PERSON_GROUP_LABELS[g], value: g }));

const FILTER_OPTIONS: { label: string; value: GroupFilter }[] = [
  { label: "همه", value: "all" },
  ...GROUP_OPTIONS,
];

const GROUP_TAG_COLORS: Record<PersonGroup, string> = {
  modir: "green",
  hayatraise: "blue",
  bazrsin: "gold",
  shorayeentezami: "purple",
  majmaeomumi: "cyan",
};

/** The drawer's field shape. `image` is optional — an emptied uploader yields `undefined`. */
interface PersonFormValues {
  name: string;
  role: string;
  group: PersonGroup;
  sortOrder: number;
  image?: string;
}

/** Square thumbnail with a graceful icon fallback for a missing OR broken image. */
function PersonAvatar({ src, name }: { src?: string | null; name: string }) {
  const url = mediaApi.url(src);
  const [broken, setBroken] = useState(false);

  // Row data changes under a reused component instance — re-arm whenever the src changes.
  useEffect(() => setBroken(false), [url]);

  if (!url || broken) {
    return <Avatar shape="square" size={44} icon={<UserOutlined />} />;
  }

  return (
    <Image
      src={url}
      alt={name}
      width={44}
      height={44}
      style={{ objectFit: "cover", borderRadius: 8 }}
      onError={() => setBroken(true)}
      preview={{ mask: "نمایش" }}
    />
  );
}

export function PeoplePage() {
  const [filter, setFilter] = useState<GroupFilter>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);

  const group = filter === "all" ? undefined : filter;

  const crud = useCrud<Person, PersonInput>({
    key: queryKeys.people.list(group),
    list: () => peopleApi.list(group),
    create: peopleApi.create,
    update: peopleApi.update,
    remove: peopleApi.remove,
    // The query key is per-group, so a write must drop EVERY group's list — not just this one.
    alsoInvalidate: [queryKeys.people.all()],
  });

  const nextSortOrder = useMemo(
    () => (crud.items.length ? Math.max(...crud.items.map((p) => p.sortOrder)) + 1 : 0),
    [crud.items],
  );

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (person: Person) => {
    setEditing(person);
    setOpen(true);
  };

  // FormDrawer re-seeds from this on every open, so a fresh object per render is fine.
  const initialValues: Partial<PersonFormValues> = editing
    ? {
        name: editing.name,
        role: editing.role,
        group: editing.group,
        sortOrder: editing.sortOrder,
        image: editing.image ?? undefined,
      }
    : {
        // Pre-select whichever group the admin is currently filtered to.
        group: group ?? "modir",
        sortOrder: nextSortOrder,
      };

  const handleSubmit = async (values: PersonFormValues) => {
    const image = values.image?.trim();
    const input: PersonInput = {
      name: values.name.trim(),
      role: values.role.trim(),
      group: values.group,
      sortOrder: values.sortOrder,
      // Explicit null (not undefined): clearing the uploader must clear the stored image.
      image: image ? image : null,
    };

    // mutateAsync REJECTS on failure — FormDrawer maps ValidationProblemDetails onto the fields.
    if (editing) await crud.update.mutateAsync({ id: editing.id, input });
    else await crud.create.mutateAsync(input);
  };

  const columns: ColumnsType<Person> = [
    {
      title: "تصویر",
      dataIndex: "image",
      key: "image",
      width: 80,
      render: (_: unknown, person) => <PersonAvatar src={person.image} name={person.name} />,
    },
    {
      title: "نام",
      dataIndex: "name",
      key: "name",
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
      sorter: (a, b) => a.name.localeCompare(b.name, "fa"),
    },
    {
      title: "سمت",
      dataIndex: "role",
      key: "role",
      render: (role: string) => role || "—",
    },
    {
      title: "گروه",
      dataIndex: "group",
      key: "group",
      width: 150,
      render: (value: PersonGroup) => (
        <Tag color={GROUP_TAG_COLORS[value]}>{PERSON_GROUP_LABELS[value]}</Tag>
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
      <PageHeader title="اعضا" subtitle="مدیران، هیئت رئیسه، بازرسین و شوراها" />

      <CrudTable<Person>
        columns={columns}
        data={crud.items}
        loading={crud.isLoading}
        error={crud.error}
        onRetry={crud.refetch}
        onRefresh={crud.refetch}
        searchable
        searchPlaceholder="جستجوی نام یا سمت…"
        searchFields={["name", "role"]}
        toolbarExtra={
          <Segmented
            options={FILTER_OPTIONS}
            value={filter}
            onChange={(value) => setFilter(value as GroupFilter)}
          />
        }
        onCreate={openCreate}
        createLabel="افزودن عضو"
        onEdit={openEdit}
        onDelete={(person) => crud.remove.mutate(person.id)}
        deleteConfirmTitle={(person) => `حذف «${person.name}»؟`}
        deleting={crud.deleting}
        emptyText={
          filter === "all"
            ? "هنوز عضوی ثبت نشده است"
            : `عضوی در گروه «${PERSON_GROUP_LABELS[filter]}» ثبت نشده است`
        }
        pageSize={12}
        scrollX={860}
      />

      <FormDrawer<PersonFormValues>
        open={open}
        title={editing ? `ویرایش «${editing.name}»` : "افزودن عضو"}
        initialValues={initialValues}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        submitting={crud.saving}
        width={560}
      >
        <Form.Item
          label="نام و نام خانوادگی"
          name="name"
          rules={[{ required: true, message: "نام الزامی است" }]}
        >
          <Input placeholder="مثال: مهندس سارا احمدی" maxLength={120} />
        </Form.Item>

        <Form.Item label="سمت" name="role" rules={[{ required: true, message: "سمت الزامی است" }]}>
          <Input placeholder="مثال: رئیس هیئت مدیره" maxLength={120} />
        </Form.Item>

        <Form.Item
          label="گروه"
          name="group"
          rules={[{ required: true, message: "گروه را انتخاب کنید" }]}
        >
          <Select options={GROUP_OPTIONS} placeholder="انتخاب گروه" />
        </Form.Item>

        <Form.Item
          label="تصویر"
          name="image"
          tooltip="اختیاری — در نبود تصویر، آیکون پیش‌فرض نمایش داده می‌شود."
        >
          <ImageUploader placeholder="/images/people/person-1.png" />
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

export default PeoplePage;
