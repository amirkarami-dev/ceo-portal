import { useMemo } from "react";
import { Checkbox, Divider, Form, Input, Select, Switch, Typography } from "antd";
import { FormDrawer } from "@/components/ui";
import type { ServiceKey, UserDto } from "@/api/types";
import { roleLabel } from "./labels";

/** The shape the drawer's `<Form.Item name>`s bind to. */
export interface UserFormValues {
  userName: string;
  email?: string;
  phoneNumber?: string;
  /** Create-only; on edit the password is changed via the separate reset-password action. */
  password?: string;
  roles: string[];
  services: string[];
  /** Edit-only — true means the account is disabled (locked and cannot sign in). */
  locked?: boolean;
}

export interface UserFormDrawerProps {
  open: boolean;
  /** null = create mode. */
  editing: UserDto | null;
  roles: string[];
  services: ServiceKey[];
  rolesLoading?: boolean;
  submitting?: boolean;
  onClose: () => void;
  /** Let it throw — FormDrawer maps ValidationProblemDetails onto the offending fields. */
  onSubmit: (values: UserFormValues) => Promise<void>;
}

/**
 * Create / edit a user. On create the password + inline roles/services go out in one POST; on
 * edit the profile, roles and services are saved by the page through their separate endpoints.
 */
export function UserFormDrawer({
  open,
  editing,
  roles,
  services,
  rolesLoading,
  submitting,
  onClose,
  onSubmit,
}: UserFormDrawerProps) {
  const isEdit = editing !== null;

  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: r, label: roleLabel(r) })),
    [roles],
  );

  const serviceOptions = useMemo(
    () => services.map((s) => ({ value: s.key, label: s.nameFa })),
    [services],
  );

  const initialValues: Partial<UserFormValues> = isEdit
    ? {
        userName: editing.userName ?? "",
        email: editing.email ?? "",
        phoneNumber: editing.phoneNumber ?? "",
        roles: editing.roles,
        services: editing.services,
        locked: editing.isLocked,
      }
    : { roles: ["User"], services: [] };

  return (
    <FormDrawer<UserFormValues>
      open={open}
      title={isEdit ? "ویرایش کاربر" : "افزودن کاربر"}
      initialValues={initialValues}
      submitting={submitting}
      onClose={onClose}
      onSubmit={onSubmit}
      width={560}
    >
      <Form.Item
        name="userName"
        label="نام کاربری"
        rules={[{ required: true, message: "نام کاربری الزامی است" }]}
      >
        <Input placeholder="مثلاً ahmadi" maxLength={256} autoComplete="off" />
      </Form.Item>

      <Form.Item
        name="email"
        label="ایمیل"
        rules={[{ type: "email", message: "ایمیل معتبر نیست" }]}
      >
        <Input
          placeholder="user@example.com"
          style={{ direction: "ltr" }}
          autoComplete="off"
          inputMode="email"
        />
      </Form.Item>

      <Form.Item name="phoneNumber" label="شماره موبایل">
        <Input placeholder="09xxxxxxxxx" style={{ direction: "ltr" }} autoComplete="off" />
      </Form.Item>

      {!isEdit ? (
        <Form.Item
          name="password"
          label="رمز عبور"
          rules={[{ min: 6, message: "رمز عبور باید حداقل ۶ نویسه باشد" }]}
          extra="اختیاری — در صورت خالی بودن، کاربر تنها با کد یک‌بارمصرف یا گوگل وارد می‌شود."
        >
          <Input.Password placeholder="••••••••" autoComplete="new-password" />
        </Form.Item>
      ) : null}

      <Form.Item name="roles" label="نقش‌ها">
        <Select
          mode="multiple"
          allowClear
          placeholder="انتخاب نقش"
          loading={rolesLoading}
          options={roleOptions}
          optionFilterProp="label"
        />
      </Form.Item>

      {isEdit ? (
        <Form.Item
          name="locked"
          label="قفل حساب کاربری"
          valuePropName="checked"
          extra="کاربر قفل‌شده نمی‌تواند وارد شود."
        >
          <Switch />
        </Form.Item>
      ) : null}

      <Divider style={{ marginBlock: 8 }} />

      <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
        دسترسی به سرویس‌ها
      </Typography.Text>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
        سرویس‌هایی که این کاربر به آن‌ها دسترسی دارد را انتخاب کنید.
      </Typography.Paragraph>
      <Form.Item name="services" noStyle>
        <Checkbox.Group style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {serviceOptions.map((s) => (
            <Checkbox key={s.value} value={s.value}>
              {s.label}
            </Checkbox>
          ))}
        </Checkbox.Group>
      </Form.Item>
    </FormDrawer>
  );
}
