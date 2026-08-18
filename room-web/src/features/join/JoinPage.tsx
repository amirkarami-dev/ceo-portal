import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Input,
  Result,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme,
} from "antd";
import {
  ArrowLeftOutlined,
  BulbFilled,
  BulbOutlined,
  ClockCircleOutlined,
  LoginOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Countdown } from "./Countdown";
import { Lobby } from "./Lobby";
import { MeetingScreen } from "../meeting/MeetingScreen";
import { useAuth } from "../../auth/useAuth";
import { RETURN_KEY } from "../../auth/routes";
import { useThemeMode } from "../../theme/useThemeMode";
import { useEnter } from "../../theme/motion";
import { roomKeys, useJoinByLink, useRoomLanding } from "../../lib/queries";
import { ApiError } from "../../lib/api";
import {
  RoomType,
  TYPE_LABELS,
  fa,
  type RoomJoinResult,
  type RoomLanding,
} from "../../lib/types";

const WHEN = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "Asia/Tehran",
});

/**
 * The shell every state of this page sits in.
 *
 * Standalone on purpose — no sidebar, no app menu, no user chip. Whoever opens this may have no
 * account at all, and this is the first thing an outside guest ever sees of the organisation.
 */
function JoinShell({ children }: { children: React.ReactNode }) {
  const { mode, toggle } = useThemeMode();
  const enter = useEnter();

  return (
    <div className="room-join-shell">
      <Tooltip title={mode === "dark" ? "حالت روشن" : "حالت تیره"}>
        <Button
          type="text"
          aria-label="تغییر پوسته روشن و تیره"
          className="room-tap"
          icon={mode === "dark" ? <BulbFilled /> : <BulbOutlined />}
          onClick={toggle}
          style={{ position: "absolute", top: 20, insetInlineStart: 20 }}
        />
      </Tooltip>

      <motion.div {...enter} style={{ width: "100%", maxWidth: 480 }}>
        <Card
          className="room-join-card"
          variant="borderless"
          // Inline, not in the class: a borderless AntD card sets its own
          // box-shadow from a rule that outranks a single class, and AntD injects
          // its stylesheet after ours, so a specificity tie loses too.
          style={{ boxShadow: "var(--shadow-3)" }}
          styles={{ body: { padding: "clamp(20px, 6vw, 32px)" } }}
        >
          {children}
        </Card>
      </motion.div>
    </div>
  );
}

/** Meeting name, type, presenter and time. The same block in every state of the page. */
function MeetingHeader({ landing }: { landing: RoomLanding }) {
  const { token } = theme.useToken();

  return (
    <Space direction="vertical" size={10} style={{ width: "100%", textAlign: "center" }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 15,
          background: token.colorPrimary,
          display: "grid",
          placeItems: "center",
          color: "#fff",
          fontSize: 24,
          margin: "0 auto",
        }}
      >
        <VideoCameraOutlined />
      </div>

      <Space size={6} wrap style={{ justifyContent: "center" }}>
        {/* Neutral. On this page the meeting's own name is the loud thing. */}
        <Tag bordered={false}>{TYPE_LABELS[landing.type]}</Tag>
      </Space>

      {/* The page's real heading, and the first line an outsider reads of the
          organisation. Sized here rather than taken from the level — AntD's h1 is
          built for a marketing page. */}
      <Typography.Title
        level={1}
        style={{
          margin: 0,
          fontSize: "clamp(21px, 5.4vw, 27px)",
          fontWeight: 700,
          letterSpacing: "-0.5px",
          lineHeight: 1.35,
          textWrap: "balance",
        }}
      >
        {landing.name}
      </Typography.Title>

      {landing.description && (
        <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
          {landing.description}
        </Typography.Paragraph>
      )}

      <Space
        direction="vertical"
        size={2}
        style={{ color: token.colorTextSecondary, fontSize: 13 }}
      >
        <Space size={6}>
          <ClockCircleOutlined />
          <span>{WHEN.format(new Date(landing.startsAtUtc))}</span>
        </Space>
        {landing.durationMinutes ? (
          <span>مدت: {fa(landing.durationMinutes)} دقیقه</span>
        ) : null}
        {landing.presenterName && (
          <Space size={6}>
            <TeamOutlined />
            <span>ارائه‌دهنده: {landing.presenterName}</span>
          </Space>
        )}
      </Space>
    </Space>
  );
}

export function JoinPage() {
  const { joinToken } = useParams();
  const { user, ready, login } = useAuth();
  const qc = useQueryClient();

  const { data: landing, isLoading, error } = useRoomLanding(joinToken);
  const join = useJoinByLink();

  const [fullName, setFullName] = useState("");
  const [joined, setJoined] = useState<RoomJoinResult | null>(null);
  const [entered, setEntered] = useState(false);

  // When the countdown reaches zero, the server is asked again and its answer replaces ours. The
  // button then enables itself with no reload — which is the whole point of the countdown.
  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: roomKeys.landing(joinToken ?? "") });
  }, [qc, joinToken]);

  // A signed-in visitor already has a name; only a guest types one.
  useEffect(() => {
    if (user?.name) setFullName(user.name);
  }, [user?.name]);

  if (isLoading || !ready) {
    return (
      <JoinShell>
        <Skeleton active paragraph={{ rows: 5 }} />
      </JoinShell>
    );
  }

  if (error || !landing) {
    // A link that does not exist and a server that could not answer are completely different things
    // to the person holding the link. Reporting both as «پیدا نشد» sends somebody whose link is
    // perfectly good off to ask for a new one — and the new one will behave exactly the same.
    const status = error instanceof ApiError ? error.status : 0;
    const missing = status === 404;

    return (
      <JoinShell>
        <Result
          status={missing ? "404" : "warning"}
          title={
            missing
              ? "این جلسه پیدا نشد"
              : status === 429
                ? "درخواست‌ها بیش از حد است"
                : "ارتباط با سرور برقرار نشد"
          }
          subTitle={
            missing
              ? "ممکن است لینک اشتباه باشد، یا جلسه حذف شده باشد."
              : status === 429
                ? "چند لحظه صبر کنید و دوباره تلاش کنید. لینک شما درست است."
                : "لینک شما درست است؛ مشکل موقتی است. دوباره تلاش کنید."
          }
          extra={
            // Not a page reload: this re-asks the same question. Without it the only way out of a
            // transient failure is for the guest to find the link again in whatever chat it arrived in.
            !missing && (
              <Button type="primary" icon={<ReloadOutlined />} onClick={refresh}>
                تلاش دوباره
              </Button>
            )
          }
        />
      </JoinShell>
    );
  }

  // In. The lobby confirms who they are and what they may do, then they press through to the meeting
  // — a guest should see their own name and «تماشاگر» before a camera is anywhere near them, not
  // after. `MeetingScreen` is the same component a member reaches from «جلسات من».
  if (joined) {
    return entered ? (
      <MeetingScreen result={joined} onLeave={() => setEntered(false)} />
    ) : (
      <JoinShell>
        <Lobby result={joined} onEnter={() => setEntered(true)} />
      </JoinShell>
    );
  }

  const askName = landing.requiresName && !user;
  const nameOk = !askName || fullName.trim().length > 0;

  // «Not joinable» has several causes and only ONE of them is a countdown. A meeting an admin closed,
  // or one that is full, is not waiting to start — showing it a timer frozen at ۰۰:۰۰:۰۰ reads as a
  // broken page and tells the visitor to keep waiting for something that will never happen.
  const notYetOpen =
    new Date(landing.opensAtUtc).getTime() > new Date(landing.serverNowUtc).getTime();

  const doJoin = () =>
    join.mutate(
      { joinToken: joinToken!, fullName: askName ? fullName.trim() : undefined },
      {
        onSuccess: setJoined,
        onError: (e) => {
          // Only a REFUSAL means the door state changed under us — the meeting filled up, or an admin
          // closed it — and only then is it worth re-asking so the page stops offering a shut door.
          //
          // A 429 or a 5xx is not that. Refreshing on those turns a transient hiccup into a landing
          // query that fails too, and the whole page flips to an error screen: the guest loses the
          // meeting they were looking at because one request was throttled.
          const status = e instanceof ApiError ? e.status : 0;
          if (status >= 400 && status < 429) refresh();
        },
      },
    );

  return (
    <JoinShell>
      <Space direction="vertical" size={22} style={{ width: "100%" }}>
        <MeetingHeader landing={landing} />

        {!landing.canJoinNow && landing.requiresSignIn ? (
          // Private link. The countdown is not the obstacle — signing in is — so it is not shown.
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Alert
              type="info"
              showIcon
              message="این جلسه فقط برای اعضای سازمان است"
              description="برای ورود، با کد ملی و کد یک‌بار‌مصرف پیامکی وارد شوید."
            />
            <Button
              type="primary"
              size="large"
              block
              icon={<LoginOutlined />}
              onClick={() => {
                // Come back to this link afterwards. Without it the IdP round trip drops the guest on
                // the home page and they have to find the link again in whatever chat it arrived in.
                sessionStorage.setItem(RETURN_KEY, window.location.pathname);
                login();
              }}
            >
              ورود با کد ملی
            </Button>
          </Space>
        ) : !landing.canJoinNow && notYetOpen ? (
          <Space direction="vertical" size={18} style={{ width: "100%" }}>
            <Countdown to={landing.opensAtUtc} serverNow={landing.serverNowUtc} onElapsed={refresh} />

            {/* The name box is filled in while the countdown runs, so nothing is left to type at the
                moment the door opens. */}
            {askName && (
              <Input
                size="large"
                prefix={<UserOutlined />}
                placeholder="نام و نام خانوادگی"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={60}
                onPressEnter={() => nameOk && doJoin()}
              />
            )}

            <Button size="large" block disabled>
              هنوز زمان ورود نرسیده است
            </Button>
          </Space>
        ) : !landing.canJoinNow ? (
          // Closed, full, or anything else that a clock will not fix. The reason on its own, and no
          // button — an offer that cannot be accepted is worse than no offer.
          <Alert type="warning" showIcon message={landing.denyMessage || "ورود به این جلسه ممکن نیست"} />
        ) : (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            {askName && (
              <Input
                size="large"
                prefix={<UserOutlined />}
                placeholder="نام و نام خانوادگی"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={60}
                autoFocus
                onPressEnter={() => nameOk && doJoin()}
              />
            )}

            {join.error instanceof ApiError && (
              <Alert type="error" showIcon message={join.error.message} />
            )}

            <Button
              type="primary"
              size="large"
              block
              icon={<ArrowLeftOutlined />}
              loading={join.isPending}
              disabled={!nameOk}
              onClick={doJoin}
            >
              ورود به جلسه
            </Button>

            {landing.type === RoomType.Presentation && !user && (
              <Typography.Text type="secondary" style={{ fontSize: 12, textAlign: "center", display: "block" }}>
                در این ارائه فقط ارائه‌دهنده صحبت می‌کند. شما می‌بینید، می‌شنوید و می‌توانید در گفتگو
                پیام بگذارید.
              </Typography.Text>
            )}
          </Space>
        )}
      </Space>
    </JoinShell>
  );
}
