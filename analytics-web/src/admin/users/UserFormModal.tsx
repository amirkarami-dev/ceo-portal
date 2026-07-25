import { Form, Input, Select, Switch } from "antd";
import { useTranslation } from "react-i18next";
import type { AppRole } from "../../contracts";
import { FormDrawer } from "../../components/ui";

const ROLES: AppRole[] = [
  "SuperAdmin",
  "TenantAdmin",
  "AIManager",
  "ReportDesigner",
  "DashboardDesigner",
  "PowerUser",
  "Viewer",
];

/** View model used by the admin users UI — maps to UserRow with active boolean. */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  roles: AppRole[];
  tenantId: string;
  active: boolean;
  lastActiveAt?: string;
}

export function UserFormModal({
  open,
  initial,
  tenantId,
  allowSuperAdmin,
  onCancel,
  onSave,
}: {
  open: boolean;
  initial?: AdminUser;
  tenantId: string | null | undefined;
  allowSuperAdmin: boolean;
  onCancel: () => void;
  onSave: (u: AdminUser) => void;
}) {
  const { t } = useTranslation();
  const [form] = Form.useForm<AdminUser>();

  const roleOptions = ROLES.filter((r) => allowSuperAdmin || r !== "SuperAdmin").map((r) => ({
    value: r,
    label: t(`rbac.role.${r}`),
  }));

  const handleSubmit = async () => {
    const v = await form.validateFields();
    onSave({
      ...v,
      id: initial?.id ?? `user-${Date.now()}`,
      tenantId: tenantId ?? "",
      lastActiveAt: initial?.lastActiveAt,
    });
  };

  return (
    <FormDrawer
      open={open}
      title={initial ? t("admin.users.editUser") : t("admin.users.inviteUser")}
      onClose={onCancel}
      onSubmit={() => void handleSubmit()}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          name: initial?.name,
          email: initial?.email,
          roles: initial?.roles ?? ["Viewer"],
          active: initial?.active ?? true,
        }}
      >
        <Form.Item name="name" label={t("admin.users.name")} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item
          name="email"
          label={t("admin.users.email")}
          rules={[{ required: true, type: "email" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="roles" label={t("admin.users.roles")} rules={[{ required: true }]}>
          <Select mode="multiple" options={roleOptions} />
        </Form.Item>
        <Form.Item name="active" label={t("admin.users.active")} valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </FormDrawer>
  );
}
