import { useMemo } from "react";
import { Card, Col, Row, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ApartmentOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { rolesApi, servicesApi, usersApi } from "@/api/adminApi";
import type { Paged, ServiceKey, UserDto, UserListParams } from "@/api/types";
import { ErrorState, Loading, PageHeader, StatCard } from "@/components/ui";
import { queryKeys, useApiQuery } from "@/query";
import { formatNumber } from "@/lib/format";
import { roleColor, roleLabel } from "@/features/users/labels";

/** One row asks the paged endpoint for an exact `total` — the cheapest way to count users. */
const USER_COUNT: UserListParams = { page: 1, pageSize: 1 };

export function RolesServicesPage() {
  const usersCount = useApiQuery<Paged<UserDto>>(queryKeys.users.list(USER_COUNT), () =>
    usersApi.list(USER_COUNT),
  );
  const rolesQuery = useApiQuery<string[]>(queryKeys.roles.list(), rolesApi.list);
  const servicesQuery = useApiQuery<ServiceKey[]>(queryKeys.services.list(), servicesApi.list);

  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);
  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);

  const serviceColumns: ColumnsType<ServiceKey> = [
    {
      title: "نام سرویس",
      dataIndex: "nameFa",
      key: "nameFa",
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: "نام انگلیسی",
      dataIndex: "nameEn",
      key: "nameEn",
      render: (value: string) => (
        <Typography.Text style={{ direction: "ltr", display: "inline-block" }}>
          {value}
        </Typography.Text>
      ),
    },
    {
      title: "کلید",
      dataIndex: "key",
      key: "key",
      render: (value: string) => (
        <Typography.Text code style={{ direction: "ltr" }}>
          {value}
        </Typography.Text>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="نقش‌ها و سرویس‌ها"
        subtitle="مرجع نقش‌های دسترسی و سرویس‌های سکو"
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <StatCard
            tone="blue"
            icon={<TeamOutlined />}
            label="کل کاربران"
            loading={usersCount.isLoading}
            value={usersCount.error ? "—" : formatNumber(usersCount.data?.total ?? 0)}
            hint={usersCount.error ? "خطا در دریافت آمار" : "کاربران ثبت‌شده در سکو"}
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            tone="emerald"
            icon={<SafetyCertificateOutlined />}
            label="نقش‌ها"
            loading={rolesQuery.isLoading}
            value={rolesQuery.error ? "—" : formatNumber(roles.length)}
            hint="نقش‌های دسترسی"
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            tone="amber"
            icon={<ApartmentOutlined />}
            label="سرویس‌ها"
            loading={servicesQuery.isLoading}
            value={servicesQuery.error ? "—" : formatNumber(services.length)}
            hint="سرویس‌های قابل‌واگذاری"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={8}>
          <Card
            title={
              <Space size={8}>
                <SafetyCertificateOutlined />
                <span>نقش‌ها</span>
              </Space>
            }
            style={{ height: "100%", borderRadius: 12 }}
          >
            {rolesQuery.isLoading ? (
              <Loading rows={3} />
            ) : rolesQuery.error ? (
              <ErrorState error={rolesQuery.error} onRetry={() => void rolesQuery.refetch()} />
            ) : (
              <Space size={8} wrap>
                {roles.map((r) => (
                  <Tag key={r} color={roleColor(r)}>
                    {roleLabel(r)}
                  </Tag>
                ))}
              </Space>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={16}>
          <Card
            title={
              <Space size={8}>
                <ApartmentOutlined />
                <span>سرویس‌ها</span>
              </Space>
            }
            style={{ height: "100%", borderRadius: 12 }}
            styles={{ body: { padding: 0 } }}
          >
            {servicesQuery.isLoading ? (
              <div style={{ padding: 16 }}>
                <Loading rows={4} />
              </div>
            ) : servicesQuery.error ? (
              <div style={{ padding: 16 }}>
                <ErrorState
                  error={servicesQuery.error}
                  onRetry={() => void servicesQuery.refetch()}
                />
              </div>
            ) : (
              <Table<ServiceKey>
                columns={serviceColumns}
                dataSource={services}
                rowKey="key"
                size="middle"
                pagination={false}
              />
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}

export default RolesServicesPage;
