import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Typography,
} from "antd";
import { PageHeader } from "../../components/PageHeader";
import { useCamera, useCities, useCreateCamera, useUpdateCamera } from "../../lib/queries";
import type { CameraInput } from "../../lib/types";
import { ApiError } from "../../lib/api";

const { Text } = Typography;

export function CameraForm() {
  const { id } = useParams();
  const cameraId = id ? Number(id) : undefined;
  const isEdit = cameraId !== undefined;

  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<CameraInput>();

  const cities = useCities();
  const existing = useCamera(cameraId);
  const create = useCreateCamera();
  const update = useUpdateCamera();

  useEffect(() => {
    if (existing.data) {
      form.setFieldsValue({ ...existing.data, notes: existing.data.notes ?? null });
    }
  }, [existing.data, form]);

  const onFinish = (values: CameraInput) => {
    const input: CameraInput = {
      ...values,
      // An empty number input gives undefined, and the API wants an explicit null for "this site
      // cannot carry the main stream" — the normal case.
      mainStreamId: values.mainStreamId ?? null,
      notes: values.notes?.trim() ? values.notes : null,
    };

    const onError = (e: unknown) => {
      if (e instanceof ApiError && Object.keys(e.errors).length > 0) {
        // The API answers with flat, camelCase field names on purpose, so they line up with the form
        // and the message lands on the field it is about.
        form.setFields(
          Object.entries(e.errors).map(([name, errors]) => ({
            name: (name.charAt(0).toLowerCase() + name.slice(1)) as keyof CameraInput,
            errors,
          })),
        );
        return;
      }
      message.error(e instanceof ApiError ? e.message : "ذخیره نشد");
    };

    if (isEdit) {
      update.mutate({ id: cameraId, input }, { onSuccess: () => navigate("/admin"), onError });
    } else {
      create.mutate(input, { onSuccess: () => navigate("/admin"), onError });
    }
  };

  return (
    <>
      <PageHeader
        title={isEdit ? "ویرایش دوربین" : "دوربین تازه"}
        subtitle={isEdit ? existing.data?.streamKey : "نام پخش پس از ذخیره ساخته می‌شود"}
      />

      <Card loading={isEdit && existing.isPending}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            rtspPort: 554,
            credentialKey: "default",
            channel: 1,
            subStreamId: 2,
            mainStreamId: null,
            isActive: true,
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="نام دوربین" rules={[{ required: true, message: "نام دوربین الزامی است" }]}>
                <Input placeholder="دوربین ورودی شهرداری" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="cityCode" label="شهر" rules={[{ required: true, message: "شهر را انتخاب کنید" }]}>
                <Select
                  loading={cities.isPending}
                  placeholder="انتخاب شهر"
                  options={(cities.data ?? []).map((c) => ({ label: c.name, value: c.code }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={16}>
              <Form.Item
                name="host"
                label="آدرس دوربین"
                extra="فقط نشانی یا نام میزبان — بدون http:// و بدون پورت"
                rules={[{ required: true, message: "آدرس دوربین الزامی است" }]}
              >
                <Input placeholder="78.39.233.70" dir="ltr" />
              </Form.Item>
            </Col>
            <Col xs={12} md={8}>
              <Form.Item name="rtspPort" label="پورت RTSP">
                <InputNumber min={1} max={65535} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={12} md={8}>
              <Form.Item name="channel" label="کانال (idc)">
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={8}>
              <Form.Item name="subStreamId" label="زیرجریان (ids)">
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="mainStreamId"
                label="جریان اصلی (ids)"
                extra="خالی بگذارید مگر آنکه پهنای باند محل، پخش جریان اصلی را تحمل کند"
              >
                <InputNumber min={1} style={{ width: "100%" }} placeholder="ندارد" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="credentialKey"
                label="کلید اعتبارنامه"
                extra="نام اعتبارنامه روی سرور تصویر — گذرواژه هرگز اینجا ذخیره نمی‌شود"
                rules={[{ required: true, message: "کلید اعتبارنامه الزامی است" }]}
              >
                <Input dir="ltr" placeholder="default" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="isActive" label="فعال" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item name="notes" label="یادداشت">
                <Input.TextArea rows={2} maxLength={1000} showCount />
              </Form.Item>
            </Col>
          </Row>

          {/* The one thing an admin cannot discover from this form. A key the media server does not
              hold produces a camera that never connects, and the only place that is reported is the
              sync log on that machine. */}
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="گذرواژهٔ دوربین روی سرور تصویر نگهداری می‌شود"
            description={
              <Text style={{ fontSize: 13 }}>
                اگر «کلید اعتبارنامه» روی سرور تصویر تعریف نشده باشد، پیکربندی به‌روزرسانی نمی‌شود و
                این دوربین تصویری نخواهد داشت.
              </Text>
            }
          />

          <Space>
            <Button type="primary" htmlType="submit" loading={create.isPending || update.isPending}>
              ذخیره
            </Button>
            <Button onClick={() => navigate("/admin")}>انصراف</Button>
          </Space>
        </Form>
      </Card>
    </>
  );
}
