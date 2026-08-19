import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckOutlined,
  CloseOutlined,
  MessageOutlined,
  NumberOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import {
  GUESTHOUSE_STATUS_LABELS,
  GuesthouseRequestStatus,
  walfareApi,
  type ApplicantGender,
  type Guesthouse,
  type GuesthouseRequest,
  type Paged,
} from "@/api/walfareApi";
import { queryKeys, useApiMutation, useApiQuery } from "@/query";
import { CrudTable, PageHeader } from "@/components/ui";
import { faDigits, faToman } from "@/lib/jalali";

/** The API refuses anything above this. Shown in Tomans, so the cap is Rials / 10. */
const MAX_TOMANS = 500_000_000;

const STATUS_OPTIONS = (
  Object.keys(GUESTHOUSE_STATUS_LABELS) as unknown as GuesthouseRequestStatus[]
).map((k) => ({
  value: Number(k) as GuesthouseRequestStatus,
  label: GUESTHOUSE_STATUS_LABELS[Number(k) as GuesthouseRequestStatus],
}));

function StatusTag({ status }: { status: GuesthouseRequestStatus }) {
  const label = GUESTHOUSE_STATUS_LABELS[status] ?? "—";
  switch (status) {
    case GuesthouseRequestStatus.Priced:
      return <Tag color="orange">{label}</Tag>;
    case GuesthouseRequestStatus.Paid:
      return <Tag color="green">{label}</Tag>;
    case GuesthouseRequestStatus.Rejected:
      return <Tag color="red">{label}</Tag>;
    default:
      return <Tag>{label}</Tag>;
  }
}

interface PriceFormValues {
  /** TOMANS. This is what the office thinks in; it becomes Rials on the way out. */
  amountTomans: number;
  adminNote?: string;
  gender: ApplicantGender;
}

interface RejectFormValues {
  reason: string;
}

interface ReceiptFormValues {
  receiptNumber: string;
}

/** درخواست‌های مهمانسرا — the office's main screen: confirm, price, refuse, send the link. */
export function AdminGuesthouseRequestsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<GuesthouseRequestStatus | undefined>(undefined);
  const [guesthouseId, setGuesthouseId] = useState<number | undefined>(undefined);

  const [pricing, setPricing] = useState<GuesthouseRequest | null>(null);
  const [rejecting, setRejecting] = useState<GuesthouseRequest | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<GuesthouseRequest | null>(null);
  const [smsId, setSmsId] = useState<number | null>(null);

  const [priceForm] = Form.useForm<PriceFormValues>();
  const [rejectForm] = Form.useForm<RejectFormValues>();
  const [receiptForm] = Form.useForm<ReceiptFormValues>();

  const guesthouses = useApiQuery(queryKeys.guesthouses.admin(), walfareApi.adminGuesthouses);

  const params = useMemo(
    () => ({ status, guesthouseId, page, pageSize }),
    [status, guesthouseId, page, pageSize],
  );

  const query = useApiQuery<Paged<GuesthouseRequest>>(
    queryKeys.guesthouseRequests.admin(params),
    () => walfareApi.adminGuesthouseRequests(params),
  );

  // Keep the last page on screen while the next one loads, same as the reservations table.
  const previous = useRef<Paged<GuesthouseRequest> | undefined>(undefined);
  useEffect(() => {
    if (query.data) previous.current = query.data;
  }, [query.data]);
  const paged = query.data ?? previous.current;

  const invalidate = [queryKeys.guesthouseRequests.all()];

  const price = useApiMutation<{ id: number; body: PriceFormValues }>({
    mutationFn: ({ id, body }) =>
      walfareApi.priceGuesthouseRequest(id, {
        // Tomans on screen, RIALS on the wire. Never send Tomans.
        amountRials: body.amountTomans * 10,
        adminNote: body.adminNote?.trim() ?? "",
        gender: body.gender,
      }),
    invalidate,
    success: "درخواست تأیید شد و لینک پرداخت ساخته شد",
  });

  const reject = useApiMutation<{ id: number; reason: string }>({
    mutationFn: ({ id, reason }) => walfareApi.rejectGuesthouseRequest(id, reason.trim()),
    invalidate,
    success: "درخواست رد شد",
  });

  /**
   * The SMS answer is the API's, never a guess.
   *
   * `useApiMutation` only fires the success toast when the call resolved. The handler throws a
   * Persian sentence when the SMS company did not take the message, so a refusal shows that
   * sentence and never «ارسال شد» — which is the whole point: an admin told "sent" about a
   * message nobody received has no reason to try again.
   */
  const sendSms = useApiMutation<number>({
    mutationFn: (id) => walfareApi.sendGuesthousePaymentSms(id),
    invalidate,
    success: "پیامک ارسال شد",
    onSuccess: () => setSmsId(null),
  });

  const receipt = useApiMutation<{ id: number; receiptNumber: string }>({
    mutationFn: ({ id, receiptNumber }) =>
      walfareApi.updateGuesthouseReceipt(id, receiptNumber.trim()),
    invalidate,
    success: "شماره فیش ذخیره شد",
  });

  const openPricing = (r: GuesthouseRequest) => {
    setPricing(r);
    priceForm.resetFields();
    priceForm.setFieldsValue({
      // Re-pricing starts from what is already there, not from an empty box.
      amountTomans: r.amountRials > 0 ? r.amountRials / 10 : undefined,
      adminNote: r.adminNote || undefined,
      gender: r.gender ?? undefined,
    } as Partial<PriceFormValues>);
  };

  const submitPrice = async () => {
    const values = await priceForm.validateFields();
    if (!pricing) return;
    await price.mutateAsync({ id: pricing.id, body: values });
    setPricing(null);
  };

  const submitReject = async () => {
    const values = await rejectForm.validateFields();
    if (!rejecting) return;
    await reject.mutateAsync({ id: rejecting.id, reason: values.reason });
    setRejecting(null);
  };

  const submitReceipt = async () => {
    const values = await receiptForm.validateFields();
    if (!editingReceipt) return;
    await receipt.mutateAsync({ id: editingReceipt.id, receiptNumber: values.receiptNumber });
    setEditingReceipt(null);
  };

  const columns: ColumnsType<GuesthouseRequest> = [
    {
      title: "متقاضی",
      key: "who",
      width: 210,
      render: (_, r) => (
        <>
          <Typography.Text strong style={{ display: "block" }}>
            {r.fullName}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }} dir="ltr">
            {faDigits(r.nationalCode)}
          </Typography.Text>
          {r.createdByAdmin ? (
            <Tag style={{ marginInlineStart: 0, marginTop: 4 }}>ثبت توسط امور رفاهی</Tag>
          ) : null}
        </>
      ),
    },
    {
      title: "مهمانسرا",
      key: "guesthouse",
      width: 190,
      render: (_, r) => (
        <>
          <Typography.Text style={{ display: "block" }}>{r.guesthouseName}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {r.guesthouseCity}
          </Typography.Text>
        </>
      ),
    },
    {
      title: "اقامت",
      key: "stay",
      width: 190,
      render: (_, r) => (
        <>
          <Typography.Text style={{ display: "block", fontSize: 13 }}>
            {faDigits(r.checkInDateJalali)} تا {faDigits(r.checkOutDateJalali)}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {faDigits(r.nights)} شب — {faDigits(r.guestCount)} نفر
          </Typography.Text>
        </>
      ),
    },
    {
      title: "موبایل",
      dataIndex: "mobile",
      key: "mobile",
      width: 125,
      render: (v: string) => <Typography.Text dir="ltr">{v ? faDigits(v) : "—"}</Typography.Text>,
    },
    {
      title: "مبلغ",
      dataIndex: "amountRials",
      key: "amountRials",
      width: 145,
      render: (v: number) =>
        v > 0 ? faToman(v) : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "شماره فیش",
      dataIndex: "receiptNumber",
      key: "receiptNumber",
      width: 120,
      render: (v: string) =>
        v ? faDigits(v) : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "وضعیت",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (v: GuesthouseRequestStatus) => <StatusTag status={v} />,
    },
  ];

  const rowActions = (r: GuesthouseRequest) => {
    const canDecide =
      r.status === GuesthouseRequestStatus.Submitted ||
      r.status === GuesthouseRequestStatus.Priced;

    return (
      <Space size={0}>
        {canDecide ? (
          <Tooltip title="تأیید و تعیین مبلغ">
            <Button
              type="text"
              aria-label="تأیید و تعیین مبلغ"
              icon={<CheckOutlined />}
              onClick={() => openPricing(r)}
            />
          </Tooltip>
        ) : null}

        {r.status === GuesthouseRequestStatus.Priced ? (
          <Popconfirm
            open={smsId === r.id}
            title="ارسال لینک پرداخت"
            // The number sits on the confirm on purpose: the admin should SEE where it goes
            // before pressing, especially for a request they typed in themselves.
            description={`پیامک به شماره ${faDigits(r.mobile || "—")} ارسال شود؟`}
            okText="ارسال"
            cancelText="انصراف"
            okButtonProps={{ loading: sendSms.isPending }}
            onConfirm={() => sendSms.mutate(r.id)}
            onCancel={() => setSmsId(null)}
          >
            <Tooltip title="ارسال پیامک پرداخت">
              <Button
                type="text"
                aria-label="ارسال پیامک پرداخت"
                icon={<MessageOutlined />}
                onClick={() => setSmsId(r.id)}
              />
            </Tooltip>
          </Popconfirm>
        ) : null}

        {r.status === GuesthouseRequestStatus.Paid ? (
          <Tooltip title="معرفی‌نامه">
            <Button
              type="text"
              aria-label="معرفی‌نامه"
              icon={<PrinterOutlined />}
              onClick={() => navigate(`/admin/guesthouse-requests/${r.id}/referral`)}
            />
          </Tooltip>
        ) : null}

        {r.status === GuesthouseRequestStatus.Paid ? (
          <Tooltip title="ویرایش شماره فیش">
            <Button
              type="text"
              aria-label="ویرایش شماره فیش"
              icon={<NumberOutlined />}
              onClick={() => {
                setEditingReceipt(r);
                receiptForm.resetFields();
                receiptForm.setFieldsValue({ receiptNumber: r.receiptNumber });
              }}
            />
          </Tooltip>
        ) : null}

        {canDecide ? (
          <Tooltip title="رد کردن">
            <Button
              type="text"
              danger
              aria-label="رد کردن"
              icon={<CloseOutlined />}
              onClick={() => {
                setRejecting(r);
                rejectForm.resetFields();
              }}
            />
          </Tooltip>
        ) : null}
      </Space>
    );
  };

  return (
    <>
      <PageHeader
        title="درخواست‌های مهمانسرا"
        subtitle={
          paged
            ? `${faDigits(paged.total)} درخواست ثبت شده است`
            : "بررسی، تعیین مبلغ و ارسال لینک پرداخت"
        }
      />

      <CrudTable<GuesthouseRequest>
        columns={columns}
        data={paged?.items}
        loading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        onRefresh={() => void query.refetch()}
        toolbarExtra={
          <Space wrap>
            <Select<GuesthouseRequestStatus>
              allowClear
              placeholder="همه وضعیت‌ها"
              style={{ width: 170 }}
              value={status}
              onChange={(v) => {
                setStatus(v ?? undefined);
                setPage(1);
              }}
              options={STATUS_OPTIONS}
              aria-label="فیلتر وضعیت"
            />
            <Select<number>
              allowClear
              placeholder="همه مهمانسراها"
              style={{ width: 200 }}
              value={guesthouseId}
              loading={guesthouses.isLoading}
              onChange={(v) => {
                setGuesthouseId(v ?? undefined);
                setPage(1);
              }}
              options={(guesthouses.data ?? []).map((g: Guesthouse) => ({
                value: g.id,
                label: `${g.city} — ${g.name}`,
              }))}
              aria-label="فیلتر مهمانسرا"
            />
          </Space>
        }
        rowActions={rowActions}
        actionsWidth={160}
        emptyText="درخواستی یافت نشد"
        pagination={{
          current: page,
          pageSize,
          total: paged?.total ?? 0,
          showSizeChanger: true,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
      />

      {/* ── تأیید و تعیین مبلغ ─────────────────────────────────────────────── */}
      <Modal
        open={pricing !== null}
        title="تأیید و تعیین مبلغ"
        okText="تأیید و ساخت لینک پرداخت"
        cancelText="انصراف"
        confirmLoading={price.isPending}
        onOk={() => void submitPrice()}
        onCancel={() => setPricing(null)}
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="با تأیید، لینک پرداخت ساخته می‌شود."
          description="سپس می‌توانید لینک را با پیامک برای متقاضی بفرستید."
        />
        <Form form={priceForm} layout="vertical" requiredMark>
          <Form.Item
            name="amountTomans"
            label="مبلغ (تومان)"
            rules={[
              { required: true, message: "مبلغ الزامی است" },
              { type: "number", min: 1, max: MAX_TOMANS, message: "مبلغ واردشده معتبر نیست" },
            ]}
            extra="مبلغ به تومان وارد می‌شود؛ در سامانه به ریال ذخیره می‌گردد."
          >
            <InputNumber<number>
              style={{ width: "100%" }}
              min={1}
              max={MAX_TOMANS}
              step={10_000}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              parser={(v) => Number((v ?? "").replace(/,/g, ""))}
            />
          </Form.Item>
          <Form.Item
            name="gender"
            label="عنوان متقاضی"
            rules={[{ required: true, message: "انتخاب عنوان الزامی است" }]}
            // Required here rather than optional: the API allows null, but the معرفی‌نامه
            // refuses to print without it, so leaving it empty only moves the dead end later.
            extra="برای صدور معرفی‌نامه، «جناب آقای / سرکار خانم» باید مشخص باشد."
          >
            <Radio.Group>
              <Radio value={0}>جناب آقای</Radio>
              <Radio value={1}>سرکار خانم</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="adminNote" label="توضیح (اختیاری)">
            <Input.TextArea
              rows={3}
              maxLength={1000}
              placeholder="این توضیح برای متقاضی نمایش داده می‌شود."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── رد کردن ───────────────────────────────────────────────────────── */}
      <Modal
        open={rejecting !== null}
        title="رد کردن درخواست"
        okText="رد کردن"
        okButtonProps={{ danger: true }}
        cancelText="انصراف"
        confirmLoading={reject.isPending}
        onOk={() => void submitReject()}
        onCancel={() => setRejecting(null)}
        destroyOnHidden
      >
        <Form form={rejectForm} layout="vertical" requiredMark>
          <Form.Item
            name="reason"
            label="دلیل رد درخواست"
            rules={[{ required: true, message: "دلیل الزامی است" }]}
            extra="این متن را متقاضی می‌بیند، پس روشن بنویسید."
          >
            <Input.TextArea rows={3} maxLength={1000} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── شماره فیش ─────────────────────────────────────────────────────── */}
      <Modal
        open={editingReceipt !== null}
        title="ویرایش شماره فیش"
        okText="ذخیره"
        cancelText="انصراف"
        confirmLoading={receipt.isPending}
        onOk={() => void submitReceipt()}
        onCancel={() => setEditingReceipt(null)}
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="ویرایش شماره فیش، پرداخت را ثبت نمی‌کند."
          description="فقط شماره‌ای که روی معرفی‌نامه چاپ می‌شود اصلاح می‌گردد."
        />
        <Form form={receiptForm} layout="vertical">
          <Form.Item name="receiptNumber" label="شماره فیش">
            <Input maxLength={100} dir="ltr" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
