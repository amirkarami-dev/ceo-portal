import { useEffect, useState } from "react";
import { App, Form, Input, Modal, Typography } from "antd";
import type { NamePath } from "antd/es/form/interface";
import { ApiError, errorMessage } from "@/api/client";

interface ResetPasswordFormValues {
  newPassword: string;
  confirm: string;
}

export interface ResetPasswordModalProps {
  open: boolean;
  /** Shown in the title so the admin knows whose password they are changing. */
  userName?: string | null;
  submitting?: boolean;
  onClose: () => void;
  /** Let it throw — an ApiError with field errors is mapped onto the password field. */
  onSubmit: (newPassword: string) => Promise<void>;
}

/** A one-field modal that sets a new password via POST /api/admin/users/{id}/reset-password. */
export function ResetPasswordModal({
  open,
  userName,
  submitting,
  onClose,
  onSubmit,
}: ResetPasswordModalProps) {
  const [form] = Form.useForm<ResetPasswordFormValues>();
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  const handleOk = async () => {
    let values: ResetPasswordFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    setBusy(true);
    try {
      await onSubmit(values.newPassword);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.isValidation) {
        const fields = err.fieldErrors();
        if (fields.length) {
          form.setFields(fields.map((f) => ({ name: f.name as NamePath, errors: f.errors })));
        } else {
          message.error(errorMessage(err));
        }
      } else {
        message.error(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const pending = busy || !!submitting;

  return (
    <Modal
      open={open}
      title="تغییر رمز عبور"
      okText="تغییر رمز"
      cancelText="انصراف"
      confirmLoading={pending}
      onOk={handleOk}
      onCancel={onClose}
      maskClosable={!pending}
      destroyOnClose
    >
      {userName ? (
        <Typography.Paragraph type="secondary">
          تعیین رمز عبور جدید برای «{userName}».
        </Typography.Paragraph>
      ) : null}
      <Form form={form} layout="vertical" requiredMark onFinish={handleOk}>
        <Form.Item
          name="newPassword"
          label="رمز عبور جدید"
          rules={[
            { required: true, message: "رمز عبور جدید الزامی است" },
            { min: 6, message: "رمز عبور باید حداقل ۶ نویسه باشد" },
          ]}
        >
          <Input.Password placeholder="••••••••" autoFocus autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm"
          label="تکرار رمز عبور"
          dependencies={["newPassword"]}
          rules={[
            { required: true, message: "تکرار رمز عبور الزامی است" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("newPassword") === value) return Promise.resolve();
                return Promise.reject(new Error("رمز عبور و تکرار آن یکسان نیستند"));
              },
            }),
          ]}
        >
          <Input.Password placeholder="••••••••" autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
