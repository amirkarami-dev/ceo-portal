import { useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Modal,
  Row,
  Skeleton,
  Space,
  Tag,
  Typography,
  theme,
} from "antd";
import { ClockCircleOutlined, RightOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { walfareApi, type PoolAvailability, type ServiceCalendar } from "@/api/walfareApi";
import { errorMessage } from "@/api/client";
import { queryKeys, useApiQuery } from "@/query";
import { EmptyState, PageHeader } from "@/components/ui";
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  faDigits,
  faMoney,
  isSameDay,
  jalaliMonthDays,
  shiftJalaliMonth,
  toJalali,
  todayStart,
  type CalendarDay,
} from "@/lib/jalali";

/**
 * True when the service actually runs on that day: inside its window AND one of its active
 * pools covers that weekday. Jalali strings are zero-padded YYYY/MM/DD, so plain string
 * comparison orders them correctly.
 */
function isServiceDay(day: CalendarDay, cal: ServiceCalendar | undefined): boolean {
  if (!cal || !cal.isAccessible) return false;
  if (day.apiDate < cal.startDate || day.apiDate > cal.endDate) return false;
  return (cal.activeDays & (1 << day.weekdayBit)) !== 0;
}

/** A month of Jalali days, Saturday-first grid, past days disabled. Days that carry the
 *  service are tinted and dotted so the engineer sees them before clicking. */
function JalaliCalendar({
  anchor,
  onShift,
  selected,
  onSelect,
  calendar,
}: {
  anchor: Date;
  onShift: (delta: number) => void;
  selected: Date | null;
  onSelect: (day: CalendarDay) => void;
  calendar?: ServiceCalendar;
}) {
  const { token } = theme.useToken();
  const days = useMemo(() => jalaliMonthDays(anchor), [anchor]);
  const today = todayStart();
  const header = toJalali(anchor);

  // Leading blanks so day 1 lands on its weekday column (Saturday-first).
  const leading = days.length > 0 ? days[0].weekdayBit : 0;

  return (
    <Card
      title={
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Button size="small" onClick={() => onShift(-1)} icon={<RightOutlined />} aria-label="ماه قبل" />
          <Typography.Text strong>
            {JALALI_MONTHS[header.jm - 1]} {faDigits(header.jy)}
          </Typography.Text>
          <Button
            size="small"
            onClick={() => onShift(1)}
            icon={<RightOutlined style={{ transform: "rotate(180deg)" }} />}
            aria-label="ماه بعد"
          />
        </Space>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {JALALI_WEEKDAYS.map((w) => (
          <div key={w} style={{ textAlign: "center", fontSize: 12, color: token.colorTextSecondary, padding: 4 }}>
            {w}
          </div>
        ))}
        {Array.from({ length: leading }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((d) => {
          const past = d.date < today;
          const isSelected = selected !== null && isSameDay(d.date, selected);
          const isToday = isSameDay(d.date, today);
          const hasService = !past && isServiceDay(d, calendar);
          return (
            <button
              key={d.apiDate}
              type="button"
              disabled={past}
              onClick={() => onSelect(d)}
              aria-pressed={isSelected}
              aria-label={
                hasService && calendar
                  ? `${faDigits(d.apiDate)} — ${calendar.title}`
                  : faDigits(d.apiDate)
              }
              title={hasService && calendar ? calendar.title : undefined}
              style={{
                position: "relative",
                height: 42,
                borderRadius: 10,
                border: isToday && !isSelected ? `1px dashed ${token.colorPrimary}` : "1px solid transparent",
                cursor: past ? "not-allowed" : "pointer",
                background: isSelected
                  ? token.colorPrimary
                  : hasService
                    ? token.colorPrimaryBg
                    : "transparent",
                color: past
                  ? token.colorTextQuaternary
                  : isSelected
                    ? "#fff"
                    : hasService
                      ? token.colorPrimaryText
                      : token.colorText,
                fontWeight: isSelected || hasService ? 700 : 400,
                fontSize: 14,
              }}
            >
              {faDigits(d.jalali.jd)}
              {hasService ? (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    bottom: 5,
                    insetInlineStart: "50%",
                    transform: "translateX(50%)",
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: isSelected ? "#fff" : token.colorPrimary,
                  }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {calendar && calendar.activeDays !== 0 ? (
        <Space size={6} style={{ marginTop: 12, fontSize: 12 }}>
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: token.colorPrimary,
            }}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            روزهای دارای «{calendar.title}»
          </Typography.Text>
        </Space>
      ) : null}
    </Card>
  );
}

export function BookingPage() {
  const { serviceId: serviceIdParam } = useParams<{ serviceId: string }>();
  const serviceId = Number(serviceIdParam);
  const navigate = useNavigate();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const [anchor, setAnchor] = useState<Date>(todayStart());
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [confirmPool, setConfirmPool] = useState<PoolAvailability | null>(null);
  const [paying, setPaying] = useState(false);

  const me = useApiQuery(queryKeys.me.get(), walfareApi.me);
  const services = useApiQuery(queryKeys.services.active(), walfareApi.activeServices);
  const service = services.data?.find((s) => s.id === serviceId);

  const pools = useApiQuery(
    queryKeys.pools.forDate(serviceId, selectedDay?.apiDate ?? ""),
    () => walfareApi.poolsForDate(serviceId, selectedDay!.apiDate),
    { enabled: !!selectedDay && Number.isFinite(serviceId) },
  );

  // One call feeds the day badges for every month the user browses.
  const calendar = useApiQuery(
    queryKeys.pools.calendar(serviceId),
    () => walfareApi.serviceCalendar(serviceId),
    { enabled: Number.isFinite(serviceId) },
  );

  /** Reserve, then push straight into the bank. One click = one ticket + one payment attempt. */
  const reserveAndPay = async (pool: PoolAvailability) => {
    if (!selectedDay) return;
    setPaying(true);
    try {
      const reservationId = await walfareApi.createReservation(pool.id, selectedDay.apiDate);
      const init = await walfareApi.initPayment(reservationId);
      // The reservation exists (PendingPayment) even if the user abandons the gateway —
      // "رزروهای من" offers a retry button.
      void qc.invalidateQueries({ queryKey: queryKeys.reservations.all() });
      window.location.href = init.redirectUrl;
    } catch (err) {
      message.error(errorMessage(err, "ثبت رزرو ناموفق بود"));
      void qc.invalidateQueries({ queryKey: queryKeys.pools.all() });
      setPaying(false);
      setConfirmPool(null);
    }
  };

  if (!Number.isFinite(serviceId)) {
    return <Alert type="error" showIcon message="سرویس نامعتبر" />;
  }

  return (
    <>
      <PageHeader
        title={service?.title ?? "رزرو استخر"}
        subtitle="تاریخ را از تقویم انتخاب کنید؛ استخرهای فعال همان روز نمایش داده می‌شوند."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10} xl={8}>
          <JalaliCalendar
            anchor={anchor}
            onShift={(delta) => setAnchor((a) => shiftJalaliMonth(a, delta))}
            selected={selectedDay?.date ?? null}
            onSelect={setSelectedDay}
            calendar={calendar.data}
          />
        </Col>

        <Col xs={24} lg={14} xl={16}>
          {!selectedDay ? (
            <EmptyState description="برای مشاهده استخرها، یک روز را از تقویم انتخاب کنید." />
          ) : pools.isFetching ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : pools.error ? (
            <Alert type="error" showIcon message={errorMessage(pools.error)} />
          ) : pools.data && pools.data.length > 0 ? (
            <Row gutter={[12, 12]}>
              {pools.data.map((p) => {
                const full = p.remaining <= 0;
                return (
                  <Col key={p.id} xs={24} md={12}>
                    <Card>
                      <Space direction="vertical" size={6} style={{ width: "100%" }}>
                        {/* Pool names are long ("استخر ۲۲ گولان-آقایان- 19:30تا 21") — wrap. */}
                        <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
                          <Typography.Text strong style={{ fontSize: 15, overflowWrap: "anywhere" }}>
                            {p.name}
                          </Typography.Text>
                          {full ? (
                            <Tag color="red">تکمیل</Tag>
                          ) : (
                            <Tag color="green">{faDigits(p.remaining)} جای خالی</Tag>
                          )}
                        </Space>
                        {p.description ? (
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {p.description}
                          </Typography.Text>
                        ) : null}
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          <ClockCircleOutlined /> ساعت {faDigits(p.reserveStartTime)} تا {faDigits(p.reserveEndTime)}
                        </Typography.Text>
                        <Space wrap style={{ width: "100%", justifyContent: "space-between", marginTop: 4 }}>
                          <Typography.Text strong>{faMoney(p.priceRials)}</Typography.Text>
                          <Button type="primary" disabled={full || paying} onClick={() => setConfirmPool(p)}>
                            رزرو و پرداخت
                          </Button>
                        </Space>
                      </Space>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          ) : (
            <EmptyState description="برای این روز استخری فعال نیست. روز دیگری را انتخاب کنید." />
          )}
        </Col>
      </Row>

      <Modal
        open={confirmPool !== null}
        title="تأیید رزرو"
        okText="پرداخت"
        cancelText="انصراف"
        confirmLoading={paying}
        onOk={() => confirmPool && reserveAndPay(confirmPool)}
        onCancel={() => (paying ? undefined : setConfirmPool(null))}
      >
        {confirmPool && selectedDay ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="استخر">{confirmPool.name}</Descriptions.Item>
            <Descriptions.Item label="تاریخ">{faDigits(selectedDay.apiDate)}</Descriptions.Item>
            <Descriptions.Item label="نام و نام خانوادگی">{me.data?.fullName ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="کد ملی">{faDigits(me.data?.nationalCode ?? "—")}</Descriptions.Item>
            <Descriptions.Item label="مبلغ">{faMoney(confirmPool.priceRials)}</Descriptions.Item>
          </Descriptions>
        ) : null}
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
          پس از تأیید به درگاه پرداخت ایران کیش منتقل می‌شوید. کد رهگیری پس از پرداخت موفق در
          «رزروهای من» ثبت می‌شود.
        </Typography.Paragraph>
      </Modal>

      <Button style={{ marginTop: 16 }} onClick={() => navigate("/")}>
        بازگشت به خدمات
      </Button>
    </>
  );
}
