import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  List,
  Popconfirm,
  Radio,
  Row,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  ArrowRightOutlined,
  DeleteOutlined,
  SaveOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { PageHeader } from "../../components/PageHeader";
import { JalaliDateField, TimeField } from "../../components/ui/JalaliFields";
import { PersonField } from "./PersonField";
import {
  useCreateRoom,
  useInviteToRoom,
  useRemoveRoomInvite,
  useRoom,
  useUpdateRoom,
} from "../../lib/queries";
import {
  JOIN_MODE_LABELS,
  RoomJoinMode,
  RoomType,
  TYPE_LABELS,
  allowedJoinModes,
  fromWireTime,
  toAsciiDigits,
  toWireTime,
  validateShape,
  type RoomInput,
} from "../../lib/types";
import { ApiError } from "../../lib/api";

/** What the form holds. The time is "HH:mm" here and widened to TimeOnly on submit. */
interface FormValues {
  name: string;
  description?: string;
  type: RoomType;
  joinMode: RoomJoinMode;
  presenterUserId?: string;
  dateJalali: string;
  startTime: string;
  earlyJoinMinutes: number;
  durationMinutes?: number;
  maxParticipants: number;
}

const EMPTY: FormValues = {
  name: "",
  description: "",
  type: RoomType.Meeting,
  joinMode: RoomJoinMode.InviteOnly,
  presenterUserId: "",
  dateJalali: "",
  startTime: "10:00",
  earlyJoinMinutes: 10,
  durationMinutes: 60,
  maxParticipants: 50,
};

export function RoomForm() {
  const { id: idParam } = useParams();
  const id = idParam ? Number(idParam) : undefined;
  const isNew = idParam === undefined;

  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<FormValues>();

  const { data, isLoading } = useRoom(id);
  const create = useCreateRoom();
  const update = useUpdateRoom();
  const invite = useInviteToRoom();
  const removeInvite = useRemoveRoomInvite();

  // Watched, because three things on this form depend on them: which join modes are offered, whether
  // the presenter box appears, and whether the invite list is shown at all.
  const type = Form.useWatch("type", form) ?? RoomType.Meeting;
  const joinMode = Form.useWatch("joinMode", form) ?? RoomJoinMode.InviteOnly;
  const presenter = Form.useWatch("presenterUserId", form);

  useEffect(() => {
    if (isNew) {
      form.setFieldsValue(EMPTY);
      return;
    }
    if (!data) return;

    form.setFieldsValue({
      name: data.name,
      description: data.description ?? "",
      type: data.type,
      joinMode: data.joinMode,
      presenterUserId: data.presenterUserId ?? "",
      dateJalali: data.dateJalali,
      startTime: fromWireTime(data.startTime),
      earlyJoinMinutes: data.earlyJoinMinutes,
      durationMinutes: data.durationMinutes ?? undefined,
      maxParticipants: data.maxParticipants,
    });
  }, [data, form, isNew]);

  /**
   * Keeps the join mode legal when the type changes.
   *
   * Without this, switching «جلسه» to «ارائه» leaves «فقط دعوت‌شدگان» selected — a combination the
   * database refuses — and the admin only finds out at save, having filled in everything else.
   */
  const onTypeChange = (next: RoomType) => {
    const allowed = allowedJoinModes(next);
    const current = form.getFieldValue("joinMode") as RoomJoinMode;
    if (!allowed.includes(current)) {
      form.setFieldValue("joinMode", allowed[0]);
    }
  };

  const shapeError = validateShape(type, joinMode, presenter);

  const toInput = (v: FormValues): RoomInput => ({
    name: v.name.trim(),
    description: v.description?.trim() || null,
    type: v.type,
    joinMode: v.joinMode,
    // Only a presentation has one, and the server clears it otherwise — but sending a stale code
    // would make the payload disagree with what the admin sees on screen.
    presenterUserId:
      v.type === RoomType.Presentation ? toAsciiDigits(v.presenterUserId ?? "").trim() || null : null,
    dateJalali: v.dateJalali,
    startTime: toWireTime(v.startTime),
    earlyJoinMinutes: v.earlyJoinMinutes,
    durationMinutes: v.durationMinutes ?? null,
    maxParticipants: v.maxParticipants,
  });

  const fail = (e: unknown) => message.error(e instanceof ApiError ? e.message : "ذخیره نشد");

  const submit = (v: FormValues) => {
    const input = toInput(v);

    if (isNew) {
      create.mutate(input, {
        onSuccess: (newId) => {
          message.success("جلسه ساخته شد");
          // Straight to the saved record, not back to the list: the link and the invite list are
          // here, and handing the meeting out is the next thing the admin does.
          navigate(`/admin/${newId}`, { replace: true });
        },
        onError: fail,
      });
      return;
    }

    update.mutate(
      { id: id!, input },
      { onSuccess: () => message.success("تغییرات ذخیره شد"), onError: fail },
    );
  };

  if (!isNew && isLoading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    );
  }

  const saving = create.isPending || update.isPending;

  return (
    <>
      <PageHeader
        title={isNew ? "جلسه جدید" : data?.name || "ویرایش جلسه"}
        subtitle={
          isNew
            ? "نوع جلسه تعیین می‌کند چه کسی می‌تواند صحبت کند و چطور وارد شود"
            : data?.joinUrl
              ? "لینک ورود در فهرست جلسات، روی همین ردیف، قابل کپی است"
              : undefined
        }
        extra={
          <Button icon={<ArrowRightOutlined />} onClick={() => navigate("/admin")}>
            بازگشت
          </Button>
        }
      />

      <Form<FormValues>
        form={form}
        layout="vertical"
        initialValues={EMPTY}
        onFinish={submit}
        requiredMark="optional"
      >
        <Card title="مشخصات جلسه">
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Form.Item
                name="name"
                label="نام جلسه"
                rules={[{ required: true, message: "نام جلسه الزامی است" }]}
              >
                <Input placeholder="مثلاً: جلسهٔ کمیسیون گاز" maxLength={200} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="maxParticipants"
                label="حداکثر شرکت‌کننده"
                rules={[{ required: true, message: "ظرفیت الزامی است" }]}
              >
                <InputNumber min={2} max={500} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="توضیح">
            <Input.TextArea rows={2} maxLength={1000} showCount placeholder="اختیاری" />
          </Form.Item>
        </Card>

        <Card title="نوع جلسه و نحوهٔ ورود" style={{ marginTop: 16 }}>
          <Form.Item name="type" label="نوع">
            <Radio.Group
              onChange={(e) => onTypeChange(e.target.value as RoomType)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value={RoomType.Meeting}>{TYPE_LABELS[RoomType.Meeting]}</Radio.Button>
              <Radio.Button value={RoomType.Presentation}>
                {TYPE_LABELS[RoomType.Presentation]}
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginTop: -8 }}>
            {type === RoomType.Presentation
              ? "در «ارائه» فقط ارائه‌دهنده می‌تواند صحبت کند، دوربین روشن کند و صفحه به اشتراک بگذارد. بقیه فقط می‌بینند، می‌شنوند و در گفتگو پیام می‌دهند."
              : "در «جلسه» همهٔ شرکت‌کنندگان می‌توانند صحبت کنند، دوربین روشن کنند و صفحه به اشتراک بگذارند."}
          </Typography.Paragraph>

          <Form.Item name="joinMode" label="چه کسی می‌تواند وارد شود">
            <Select
              options={allowedJoinModes(type).map((m) => ({ value: m, label: JOIN_MODE_LABELS[m] }))}
            />
          </Form.Item>

          {joinMode === RoomJoinMode.Public && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="این جلسه با لینک برای همه باز است"
              description="هرکسی که لینک را داشته باشد بدون ورود می‌تواند تماشا کند. تماشاگرها نمی‌توانند صحبت کنند یا دوربین روشن کنند."
            />
          )}

          {type === RoomType.Presentation && (
            <Form.Item
              name="presenterUserId"
              label="ارائه‌دهنده"
              extra="کد ملی فردی که اجازهٔ صحبت و اشتراک صفحه دارد. نام از سامانهٔ نظام مهندسی خوانده می‌شود."
              rules={[
                { required: true, message: "انتخاب ارائه‌دهنده الزامی است" },
                { len: 10, message: "کد ملی باید ۱۰ رقم باشد" },
              ]}
            >
              <PersonField />
            </Form.Item>
          )}

          {shapeError && <Alert type="error" showIcon message={shapeError} />}
        </Card>

        <Card title="زمان برگزاری" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="dateJalali"
                label="تاریخ"
                rules={[{ required: true, message: "تاریخ برگزاری الزامی است" }]}
              >
                <JalaliDateField />
              </Form.Item>
            </Col>
            <Col xs={12} md={5}>
              <Form.Item
                name="startTime"
                label="ساعت شروع"
                rules={[{ required: true, message: "ساعت شروع الزامی است" }]}
              >
                <TimeField />
              </Form.Item>
            </Col>
            <Col xs={12} md={5}>
              <Form.Item
                name="earlyJoinMinutes"
                label="ورود زودهنگام"
                extra="چند دقیقه پیش از شروع، در باز شود"
              >
                <InputNumber min={0} max={120} style={{ width: "100%" }} addonAfter="دقیقه" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="durationMinutes" label="مدت جلسه" extra="فقط برای نمایش">
                <InputNumber min={1} max={600} style={{ width: "100%" }} addonAfter="دقیقه" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {!isNew && data && joinMode === RoomJoinMode.InviteOnly && (
          <InviteCard
            roomId={data.id}
            invites={data.invites}
            onAdd={(nationalCode) =>
              invite.mutate(
                { id: data.id, nationalCode },
                { onSuccess: () => message.success("دعوت اضافه شد"), onError: fail },
              )
            }
            adding={invite.isPending}
            onRemove={(userId) =>
              removeInvite.mutate(
                { id: data.id, userId },
                { onSuccess: () => message.success("دعوت حذف شد"), onError: fail },
              )
            }
          />
        )}

        <div className="room-form-actions">
          <Button
            type="primary"
            size="large"
            htmlType="submit"
            icon={<SaveOutlined />}
            loading={saving}
            // The server refuses these four combinations at the database, so letting the button
            // through would only trade a clear message here for a constraint error there.
            disabled={!!shapeError}
          >
            {isNew ? "ساخت جلسه" : "ذخیره"}
          </Button>
        </div>
      </Form>
    </>
  );
}

/** The invite list. Only invite-only meetings have one — for the others the link is the gate. */
function InviteCard({
  invites,
  onAdd,
  onRemove,
  adding,
}: {
  roomId: number;
  invites: { userId: string; userName: string | null }[];
  onAdd: (nationalCode: string) => void;
  onRemove: (userId: string) => void;
  adding: boolean;
}) {
  // Deliberately React state, not an AntD form field: the invite box lives inside the meeting form,
  // and a field there would be submitted — and validated — with the meeting itself.
  const [code, setCode] = useState("");

  return (
    <Card title="دعوت‌شدگان" style={{ marginTop: 16 }}>
      <Space.Compact style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ flex: 1 }}>
          <PersonField value={code} onChange={setCode} placeholder="کد ملی فرد" />
        </div>
        <Button
          type="primary"
          icon={<UserAddOutlined />}
          loading={adding}
          disabled={code.length !== 10}
          onClick={() => {
            onAdd(code);
            setCode("");
          }}
        >
          دعوت
        </Button>
      </Space.Compact>

      <Divider style={{ margin: "16px 0" }} />

      <List
        size="small"
        dataSource={invites}
        locale={{ emptyText: "هنوز کسی دعوت نشده است" }}
        renderItem={(p) => (
          <List.Item
            actions={[
              <Popconfirm
                key="remove"
                title="حذف دعوت"
                okText="حذف"
                cancelText="انصراف"
                okButtonProps={{ danger: true }}
                onConfirm={() => onRemove(p.userId)}
              >
                <Button size="small" danger type="text" icon={<DeleteOutlined />} />
              </Popconfirm>,
            ]}
          >
            <Space>
              <Typography.Text>{p.userName ?? "—"}</Typography.Text>
              <Tag className="mono">{p.userId}</Tag>
            </Space>
          </List.Item>
        )}
      />
    </Card>
  );
}
