import { Alert, Card, Col, Row, Skeleton, Tag, Typography } from "antd";
import { CalendarOutlined, RightOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { walfareApi } from "@/api/walfareApi";
import { errorMessage } from "@/api/client";
import { queryKeys, useApiQuery } from "@/query";
import { EmptyState, PageHeader } from "@/components/ui";
import { faDigits } from "@/lib/jalali";

/** واترپلو-blue pool tile — the visual anchor of the service card. */
function PoolBadge() {
  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(135deg,#0ea5e9,#0369a1)",
        color: "#fff",
        flex: "none",
      }}
    >
      {/* swimmer */}
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="16.5" cy="6.5" r="2" />
        <path d="m3 13 4-3 4 2.5L15 9l3 2" />
        <path d="M2 18c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0" />
      </svg>
    </div>
  );
}

export function ServicesPage() {
  const navigate = useNavigate();

  const me = useApiQuery(queryKeys.me.get(), walfareApi.me);
  const services = useApiQuery(queryKeys.services.active(), walfareApi.activeServices);

  return (
    <>
      <PageHeader
        title="خدمات رفاهی"
        subtitle={
          me.data
            ? `${me.data.fullName} — خوش آمدید`
            : "خدمات رفاهی فعال برای مهندسین عضو سازمان"
        }
      />

      {services.error ? (
        <Alert
          type="error"
          showIcon
          message="دریافت خدمات ناموفق بود"
          description={errorMessage(services.error)}
        />
      ) : services.isLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : services.data && services.data.length > 0 ? (
        <Row gutter={[16, 16]}>
          {/* AntD breakpoints read the WINDOW, not this column's box — the sider takes ~232px
              of it, so halving at `sm` left ~250px and the title broke one letter per line.
              Stay full width until md, and only go to thirds on a genuinely wide screen. */}
          {services.data.map((s) => (
            <Col key={s.id} xs={24} sm={24} md={12} xl={8}>
              <Card
                hoverable
                onClick={() => navigate(`/book/${s.id}`)}
                styles={{ body: { display: "flex", gap: 12, alignItems: "center" } }}
              >
                <PoolBadge />
                <div style={{ minWidth: 0, flex: 1, overflowWrap: "anywhere" }}>
                  <Typography.Text strong style={{ fontSize: 16, display: "block" }}>
                    {s.title}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
                    <CalendarOutlined /> از {faDigits(s.startDate)} تا {faDigits(s.endDate)}
                  </Typography.Text>
                  <Tag color="blue" style={{ marginTop: 8 }}>
                    {faDigits(s.poolCount)} استخر فعال
                  </Tag>
                </div>
                <RightOutlined style={{ transform: "rotate(180deg)", color: "#999" }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <EmptyState description="در حال حاضر خدمت رفاهی فعالی وجود ندارد." />
      )}
    </>
  );
}
