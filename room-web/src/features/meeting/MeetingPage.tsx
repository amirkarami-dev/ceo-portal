import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Result, Space, Spin, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { MeetingScreen } from "./MeetingScreen";
import { useJoinRoom } from "../../lib/queries";
import { ApiError } from "../../lib/api";

/**
 * `/room/:id` — a member opening a meeting from their own list.
 *
 * The join runs once on arrival, and every gate on the server runs with it: the invite list, the
 * start time, the capacity. So an id typed into the address bar gets exactly the same refusal that
 * pressing the wrong row would — the id is not a secret and grants nothing on its own.
 *
 * A guest never reaches this route. They come through `/j/:joinToken`, which already holds the same
 * result and renders the same `MeetingScreen` — one screen, two doors.
 */
export function MeetingPage() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const navigate = useNavigate();
  const join = useJoinRoom();

  // Fired once. Without the guard, React's development double-invoke joins twice and leaves a
  // phantom participant behind — the first token's session stays open until it times out.
  const started = useRef(false);
  const { mutate } = join;
  useEffect(() => {
    if (started.current || !Number.isFinite(id)) return;
    started.current = true;
    mutate(id);
    // `mutate` is stable; the whole mutation object is not, and depending on it would re-run this
    // effect on every render. The ref is what actually guarantees one join either way.
  }, [id, mutate]);

  if (join.isPending || (!join.data && !join.error)) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <Space direction="vertical" align="center" size={12}>
          <Spin size="large" />
          <Typography.Text type="secondary">در حال ورود به جلسه…</Typography.Text>
        </Space>
      </div>
    );
  }

  if (join.error || !join.data) {
    // The server's Persian reason verbatim — «شما به این جلسه دعوت نشده‌اید», «هنوز زمان ورود به جلسه
    // نرسیده است», «ظرفیت این جلسه تکمیل شده است». Each one tells the person what to do next.
    const message =
      join.error instanceof ApiError ? join.error.message : "ورود به این جلسه ممکن نشد";

    return (
      <Result
        status="warning"
        title="ورود به جلسه ممکن نیست"
        subTitle={message}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                started.current = false;
                join.reset();
              }}
            >
              تلاش دوباره
            </Button>
            <Button type="primary" onClick={() => navigate("/")}>
              بازگشت به جلسات من
            </Button>
          </Space>
        }
      />
    );
  }

  return <MeetingScreen result={join.data} onLeave={() => navigate("/")} />;
}
