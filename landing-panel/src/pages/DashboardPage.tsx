import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, Badge, Button, Card, Col, List, Row, Space, Tag, Typography } from "antd";
import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  CheckOutlined,
  EyeOutlined,
  FileTextOutlined,
  FormOutlined,
  MailOutlined,
  PictureOutlined,
  ReloadOutlined,
  RiseOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
  WifiOutlined,
} from "@ant-design/icons";
import {
  contactApi,
  formsApi,
  newsApi,
  peopleApi,
  settingsApi,
  slidesApi,
  submissionsApi,
  unitsApi,
} from "@/api/endpoints";
import type { ContactListParams, NewsListParams, SubmissionListParams } from "@/api/types";
import { EmptyState, ErrorState, Loading, PageHeader, StatCard } from "@/components/ui";
import { queryKeys, useApiMutation, useApiQuery } from "@/query";
import { formatDateTime, formatNumber, truncate } from "@/lib/format";

/**
 * Module-level so the query keys stay referentially stable across renders.
 * The counters ask for a single row and read `total` off the paging envelope —
 * that is the cheapest way to get an exact count out of a paged endpoint.
 */
const NEWS_COUNT: NewsListParams = { page: 1, pageSize: 1 };
const LATEST_SUBMISSIONS: SubmissionListParams = { page: 1, pageSize: 5 };
const PENDING_SUBMISSIONS: SubmissionListParams = { handled: false, page: 1, pageSize: 1 };
const LATEST_MESSAGES: ContactListParams = { page: 1, pageSize: 5 };
const UNREAD_MESSAGES: ContactListParams = { isRead: false, page: 1, pageSize: 1 };

export function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ── reads ──────────────────────────────────────────────────────────────────
  const settings = useApiQuery(queryKeys.settings.get(), settingsApi.get);
  const news = useApiQuery(queryKeys.news.list(NEWS_COUNT), () => newsApi.list(NEWS_COUNT));
  const slides = useApiQuery(queryKeys.slides.list(), slidesApi.list);
  const people = useApiQuery(queryKeys.people.list(), () => peopleApi.list());
  const units = useApiQuery(queryKeys.units.list(), unitsApi.list);
  const forms = useApiQuery(queryKeys.forms.list(), formsApi.list);

  const submissions = useApiQuery(queryKeys.submissions.list(LATEST_SUBMISSIONS), () =>
    submissionsApi.list(LATEST_SUBMISSIONS),
  );
  const pendingSubmissions = useApiQuery(queryKeys.submissions.list(PENDING_SUBMISSIONS), () =>
    submissionsApi.list(PENDING_SUBMISSIONS),
  );
  const messages = useApiQuery(queryKeys.contactMessages.list(LATEST_MESSAGES), () =>
    contactApi.list(LATEST_MESSAGES),
  );
  const unreadMessages = useApiQuery(queryKeys.contactMessages.list(UNREAD_MESSAGES), () =>
    contactApi.list(UNREAD_MESSAGES),
  );

  const queries = [
    settings,
    news,
    slides,
    people,
    units,
    forms,
    submissions,
    pendingSubmissions,
    messages,
    unreadMessages,
  ];
  const refreshing = queries.some((q) => q.isFetching);

  // ── writes (inbox triage straight from the dashboard) ──────────────────────
  const markHandled = useApiMutation<number>({
    mutationFn: (id) => submissionsApi.setHandled(id, true),
    invalidate: [queryKeys.submissions.all()],
    success: "ثبت‌نام «بررسی‌شده» علامت خورد",
  });

  const markRead = useApiMutation<number>({
    mutationFn: (id) => contactApi.setRead(id, true),
    invalidate: [queryKeys.contactMessages.all()],
    success: "پیام «خوانده‌شده» علامت خورد",
  });

  const stats = settings.data?.stats;
  const pendingCount = pendingSubmissions.data?.total ?? 0;
  const unreadCount = unreadMessages.data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="داشبورد"
        subtitle="نمای کلی بازدیدها، محتوای سایت و آخرین درخواست‌ها"
        actions={
          <Button
            icon={<ReloadOutlined />}
            loading={refreshing}
            onClick={() => void qc.invalidateQueries()}
          >
            به‌روزرسانی
          </Button>
        }
      />

      {/* بازدیدها */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <StatCard
            tone="blue"
            icon={<EyeOutlined />}
            label="بازدید کل"
            loading={settings.isLoading}
            value={statValue(settings.error, stats?.totalVisits)}
            hint={settings.error ? "خطا در دریافت آمار" : "از ابتدای راه‌اندازی سایت"}
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            tone="emerald"
            icon={<RiseOutlined />}
            label="بازدید امروز"
            loading={settings.isLoading}
            value={statValue(settings.error, stats?.todayVisits)}
            hint={settings.error ? "خطا در دریافت آمار" : "بازدیدهای امروز"}
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            tone="amber"
            icon={<WifiOutlined />}
            label="کاربران آنلاین"
            loading={settings.isLoading}
            value={statValue(settings.error, stats?.online)}
            hint={settings.error ? "خطا در دریافت آمار" : "فعال در چند دقیقهٔ اخیر"}
          />
        </Col>
      </Row>

      {/* شمارش محتوا */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col flex="1 1 170px">
          <StatCard
            icon={<FileTextOutlined />}
            label="اخبار"
            loading={news.isLoading}
            value={statValue(news.error, news.data?.total)}
            onClick={() => navigate("/news")}
          />
        </Col>
        <Col flex="1 1 170px">
          <StatCard
            icon={<PictureOutlined />}
            label="اسلایدها"
            loading={slides.isLoading}
            value={statValue(slides.error, slides.data?.length)}
            onClick={() => navigate("/slides")}
          />
        </Col>
        <Col flex="1 1 170px">
          <StatCard
            icon={<TeamOutlined />}
            label="اعضا"
            loading={people.isLoading}
            value={statValue(people.error, people.data?.length)}
            onClick={() => navigate("/people")}
          />
        </Col>
        <Col flex="1 1 170px">
          <StatCard
            icon={<ApartmentOutlined />}
            label="واحدها"
            loading={units.isLoading}
            value={statValue(units.error, units.data?.length)}
            onClick={() => navigate("/units")}
          />
        </Col>
        <Col flex="1 1 170px">
          <StatCard
            icon={<FormOutlined />}
            label="فرم‌ها"
            loading={forms.isLoading}
            value={statValue(forms.error, forms.data?.length)}
            onClick={() => navigate("/forms")}
          />
        </Col>
      </Row>

      {/* آخرین ثبت‌نام‌ها + آخرین پیام‌ها */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={12}>
          <Card
            style={{ height: "100%", borderRadius: 12 }}
            title={
              <Space size={8}>
                <SolutionOutlined />
                <span>آخرین ثبت‌نام‌ها</span>
                <Badge
                  count={pendingCount}
                  overflowCount={99}
                  title={`${formatNumber(pendingCount)} ثبت‌نام در انتظار بررسی`}
                />
              </Space>
            }
            extra={<PanelLink to="/submissions" />}
          >
            <PanelBody
              loading={submissions.isLoading}
              error={submissions.error}
              onRetry={() => void submissions.refetch()}
              isEmpty={(submissions.data?.items.length ?? 0) === 0}
              emptyText="هنوز ثبت‌نامی ارسال نشده است"
            >
              <List
                itemLayout="horizontal"
                dataSource={submissions.data?.items ?? []}
                rowKey={(s) => s.id}
                renderItem={(s) => (
                  <List.Item
                    actions={
                      s.isHandled
                        ? []
                        : [
                            <Button
                              type="link"
                              size="small"
                              icon={<CheckOutlined />}
                              loading={markHandled.isPending && markHandled.variables === s.id}
                              onClick={() => markHandled.mutate(s.id)}
                            >
                              بررسی شد
                            </Button>,
                          ]
                    }
                  >
                    <List.Item.Meta
                      avatar={<Avatar icon={<UserOutlined />} />}
                      title={
                        <Space size={8} wrap>
                          <Typography.Text strong>{s.fullName}</Typography.Text>
                          {s.isHandled ? (
                            <Tag color="green">بررسی‌شده</Tag>
                          ) : (
                            <Tag color="gold">در انتظار</Tag>
                          )}
                        </Space>
                      }
                      description={
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {s.formTitle || "فرم نامشخص"} · {s.mobile || "—"} ·{" "}
                          {formatDateTime(s.created)}
                        </Typography.Text>
                      }
                    />
                  </List.Item>
                )}
              />
            </PanelBody>
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card
            style={{ height: "100%", borderRadius: 12 }}
            title={
              <Space size={8}>
                <MailOutlined />
                <span>آخرین پیام‌ها</span>
                <Badge
                  count={unreadCount}
                  overflowCount={99}
                  title={`${formatNumber(unreadCount)} پیام خوانده‌نشده`}
                />
              </Space>
            }
            extra={<PanelLink to="/messages" />}
          >
            <PanelBody
              loading={messages.isLoading}
              error={messages.error}
              onRetry={() => void messages.refetch()}
              isEmpty={(messages.data?.items.length ?? 0) === 0}
              emptyText="هنوز پیامی دریافت نشده است"
            >
              <List
                itemLayout="horizontal"
                dataSource={messages.data?.items ?? []}
                rowKey={(m) => m.id}
                renderItem={(m) => (
                  <List.Item
                    actions={
                      m.isRead
                        ? []
                        : [
                            <Button
                              type="link"
                              size="small"
                              icon={<CheckOutlined />}
                              loading={markRead.isPending && markRead.variables === m.id}
                              onClick={() => markRead.mutate(m.id)}
                            >
                              خواندم
                            </Button>,
                          ]
                    }
                  >
                    <List.Item.Meta
                      avatar={<Avatar icon={<MailOutlined />} />}
                      title={
                        <Space size={8} wrap>
                          <Typography.Text strong>{m.name}</Typography.Text>
                          {m.isRead ? null : <Tag color="blue">جدید</Tag>}
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {truncate(m.subject, 40)}
                          </Typography.Text>
                        </Space>
                      }
                      description={
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {truncate(m.message, 70)} · {m.phone || "—"} · {formatDateTime(m.created)}
                        </Typography.Text>
                      }
                    />
                  </List.Item>
                )}
              />
            </PanelBody>
          </Card>
        </Col>
      </Row>
    </>
  );
}

// ── local helpers ────────────────────────────────────────────────────────────

/** A failed counter shows an em dash instead of a misleading zero. */
function statValue(error: unknown, value: number | undefined): ReactNode {
  if (error) return "—";
  return formatNumber(value ?? 0);
}

/** "مشاهده همه" — in RTL the left arrow points forward. */
function PanelLink({ to }: { to: string }) {
  return (
    <Link to={to}>
      <Button type="link" size="small">
        مشاهده همه <ArrowLeftOutlined />
      </Button>
    </Link>
  );
}

interface PanelBodyProps {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  isEmpty: boolean;
  emptyText: string;
  children: ReactNode;
}

function PanelBody({ loading, error, onRetry, isEmpty, emptyText, children }: PanelBodyProps) {
  if (loading) return <Loading rows={5} />;
  if (error) return <ErrorState title="خطا در دریافت اطلاعات" error={error} onRetry={onRetry} />;
  if (isEmpty) return <EmptyState description={emptyText} />;
  return <>{children}</>;
}

export default DashboardPage;
