import { useMemo, useState } from "react";
import { Alert, Button, Col, Empty, Modal, Pagination, Row, Segmented, Skeleton, Space, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { PageHeader } from "../../components/PageHeader";
import { useCameras, useCities } from "../../lib/queries";
import { WALL_PAGE_SIZE, type CameraListItem } from "../../lib/types";
import { useMediaSession } from "./useMediaSession";
import { CameraTile } from "./CameraTile";
import { CameraPlayer } from "./CameraPlayer";

const { Text } = Typography;

const ALL = "__all__";

/**
 * The wall: pick a city, watch what is there.
 *
 * <p><b>Nine tiles a page, and that is a bandwidth decision.</b> Every tile is a live pull from a
 * different site. Paging is what stops a hundred cameras being opened because somebody scrolled.</p>
 */
export function CameraWall() {
  const cities = useCities();
  const [city, setCity] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<CameraListItem | null>(null);

  const cameras = useCameras(city === ALL ? undefined : city);
  const session = useMediaSession();

  const live = useMemo(() => (cameras.data ?? []).filter((c) => c.isActive), [cameras.data]);
  const pageItems = live.slice((page - 1) * WALL_PAGE_SIZE, page * WALL_PAGE_SIZE);

  const options = [
    { label: `همه (${live.length && city === ALL ? live.length : (cities.data ?? []).reduce((n, c) => n + c.cameraCount, 0)})`, value: ALL },
    ...(cities.data ?? []).map((c) => ({ label: `${c.name} (${c.cameraCount})`, value: c.code })),
  ];

  return (
    <>
      <PageHeader title="دوربین‌های نظارتی" subtitle="تصویر زنده، به تفکیک شهر" />

      {session.status === "failed" && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="سرویس تصویر در دسترس نیست"
          description={session.error}
          action={
            <Button size="small" icon={<ReloadOutlined />} onClick={session.retry}>
              تلاش دوباره
            </Button>
          }
        />
      )}

      <div style={{ overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
        <Segmented
          options={options}
          value={city}
          onChange={(v) => {
            setCity(v as string);
            setPage(1);
          }}
        />
      </div>

      {cameras.isPending ? (
        <Row gutter={[12, 12]}>
          {Array.from({ length: 6 }, (_, i) => (
            <Col key={i} xs={24} sm={12} lg={8}>
              <Skeleton.Node active style={{ width: "100%", aspectRatio: "4 / 3", height: "auto" }} />
            </Col>
          ))}
        </Row>
      ) : live.length === 0 ? (
        <Empty description="دوربین فعالی در این شهر ثبت نشده است" />
      ) : (
        <>
          {/* One tile per row on a phone, two on a tablet, three on a desktop — a 704x576 picture
              squeezed into a third of a 390px screen is not something anybody can watch. */}
          <Row gutter={[12, 12]}>
            {pageItems.map((camera) => (
              <Col key={camera.id} xs={24} sm={12} lg={8}>
                <CameraTile
                  camera={camera}
                  // Suspended while this same camera is open fullscreen. The modal is about to pull
                  // it, and pulling one camera twice is bandwidth spent twice for one picture.
                  //
                  // The lease in streamLease.ts would prevent the duplicate anyway, but only by
                  // preempting — and a preempted tile has no reason to reconnect when the modal
                  // closes. Flipping `enabled` re-runs the tile's effect, so it comes back by
                  // itself. The lease stays as the guarantee; this is the mechanism.
                  enabled={session.status === "ready" && expanded?.id !== camera.id}
                  onExpand={setExpanded}
                />
              </Col>
            ))}
          </Row>

          {live.length > WALL_PAGE_SIZE && (
            <Space direction="vertical" align="center" style={{ width: "100%", marginTop: 20 }}>
              <Pagination
                current={page}
                pageSize={WALL_PAGE_SIZE}
                total={live.length}
                onChange={setPage}
                showSizeChanger={false}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                هر صفحه حداکثر {WALL_PAGE_SIZE} دوربین — تصویر فقط برای دوربین‌های همین صفحه دریافت می‌شود
              </Text>
            </Space>
          )}
        </>
      )}

      <Modal
        open={expanded !== null}
        onCancel={() => setExpanded(null)}
        footer={null}
        width="min(1100px, 96vw)"
        title={expanded ? `${expanded.name} — ${expanded.cityName}` : ""}
        destroyOnClose
      >
        {expanded && (
          <>
            <div style={{ aspectRatio: "4 / 3", background: "#000" }}>
              <CameraPlayer streamKey={expanded.streamKey} active muted={false} />
            </div>
            {/* Said plainly, because somebody will expect a sharper picture here. The main stream is
                ~11.2 Mbit/s against a site uplink of ~0.41 — it is not a setting, it is not possible. */}
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 8 }}>
              همان زیرجریان، بزرگ‌تر. پهنای باند محل دوربین اجازهٔ پخش جریان اصلی را نمی‌دهد.
            </Text>
          </>
        )}
      </Modal>
    </>
  );
}
