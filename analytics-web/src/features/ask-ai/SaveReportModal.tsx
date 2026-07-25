// report-web/src/features/ask-ai/SaveReportModal.tsx
import { Form, Input, Modal, Select, message } from "antd";
import { useTranslation } from "react-i18next";
import type { ReportDefinition } from "@/contracts";
import { useSaveReport } from "@/api/queries";

interface Props {
  open: boolean;
  def: ReportDefinition;
  onClose: () => void;
}

export function SaveReportModal({ open, def, onClose }: Props) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const save = useSaveReport();

  const submit = async () => {
    const v = await form.validateFields();
    const definition: ReportDefinition = {
      ...def,
      name: v.name as string,
      description: v.description as string | undefined,
      tags: (v.tags as string[] | undefined) ?? [],
    };
    await save.mutateAsync({
      definition,
      name: v.name as string,
      visibility: v.visibility as "private" | "tenant",
    });
    void message.success(t("ask.saved"));
    onClose();
  };

  return (
    <Modal
      open={open}
      title={t("ask.saveTitle")}
      okText={t("common.save")}
      cancelText={t("common.cancel")}
      confirmLoading={save.isPending}
      onOk={() => void submit()}
      onCancel={onClose}
      destroyOnHidden
      width={480}
      styles={{
        body: { paddingTop: 8 },
      }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ name: def.name, visibility: "private" }}
        style={{ marginTop: 16 }}
      >
        <Form.Item
          name="name"
          label={t("ask.fieldName")}
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="description" label={t("ask.fieldDescription")}>
          <Input.TextArea autoSize={{ minRows: 2 }} />
        </Form.Item>
        <Form.Item name="tags" label={t("ask.fieldTags")}>
          <Select mode="tags" tokenSeparators={[","]} />
        </Form.Item>
        <Form.Item name="visibility" label={t("ask.fieldVisibility")}>
          <Select
            options={[
              { value: "private", label: t("ask.visPrivate") },
              { value: "tenant", label: t("ask.visTenant") },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
