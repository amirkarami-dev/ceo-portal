import { useEffect, useState, type ReactNode } from "react";
import { App, Button, Drawer, Form, Space } from "antd";
import type { FormInstance } from "antd";
import type { NamePath } from "antd/es/form/interface";
import { ApiError, errorMessage } from "@/api/client";

export interface FormDrawerProps<TValues extends object> {
  open: boolean;
  title: ReactNode;
  /** Values to seed the form with when it opens (undefined = create mode). */
  initialValues?: Partial<TValues>;
  onClose: () => void;
  /**
   * Called with the validated values. Let it THROW — an `ApiError` carrying
   * ValidationProblemDetails is mapped onto the matching `<Form.Item name>` fields;
   * anything else becomes a `message.error`. The drawer stays open on failure.
   */
  onSubmit: (values: TValues) => Promise<void> | void;
  /** External pending flag (e.g. `crud.saving`); OR-ed with the drawer's own. */
  submitting?: boolean;
  width?: number;
  submitText?: string;
  cancelText?: string;
  /** Bring your own instance when the page needs to read/watch fields. */
  form?: FormInstance<TValues>;
  layout?: "vertical" | "horizontal";
  /** `<Form.Item>` fields. */
  children: ReactNode;
  /** Extra content in the footer, left of the buttons. */
  extraFooter?: ReactNode;
}

/**
 * AntD `Drawer` + `Form` with submit/cancel and ApiError -> field-error mapping.
 * The form is reset and re-seeded from `initialValues` every time `open` flips to true, so one
 * instance can serve both "create" and "edit" without stale values.
 */
export function FormDrawer<TValues extends object>({
  open,
  title,
  initialValues,
  onClose,
  onSubmit,
  submitting,
  width = 520,
  submitText = "ذخیره",
  cancelText = "انصراف",
  form: externalForm,
  layout = "vertical",
  children,
  extraFooter,
}: FormDrawerProps<TValues>) {
  const [internalForm] = Form.useForm<TValues>();
  const form = externalForm ?? internalForm;
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);

  // AntD only applies `initialValues` on mount, so re-seed explicitly on every open.
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (initialValues) {
      form.setFieldsValue(initialValues as unknown as Parameters<typeof form.setFieldsValue>[0]);
    }
    // `initialValues` is a fresh object literal on most renders — keying off `open` is the
    // intended behaviour (seed once per opening, never clobber what the user is typing).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async () => {
    let values: TValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // client-side validation already painted the fields
    }

    setBusy(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.isValidation) {
        const fields = err.fieldErrors();
        if (fields.length) {
          // ApiError gives a flat field name; AntD's setFields wants a NamePath.
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
    <Drawer
      open={open}
      title={title}
      onClose={onClose}
      width={width}
      maskClosable={!pending}
      footer={
        <Space style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{extraFooter}</span>
          <Space>
            <Button onClick={onClose} disabled={pending}>
              {cancelText}
            </Button>
            <Button type="primary" loading={pending} onClick={handleSubmit}>
              {submitText}
            </Button>
          </Space>
        </Space>
      }
    >
      {/* Values are seeded by the effect above, not by `initialValues` — one instance serves
          both create and edit, and AntD would otherwise keep the first mount's values. */}
      <Form<TValues> form={form} layout={layout} requiredMark onFinish={handleSubmit}>
        {children}
      </Form>
    </Drawer>
  );
}
