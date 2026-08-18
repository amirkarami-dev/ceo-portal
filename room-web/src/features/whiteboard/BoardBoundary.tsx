import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Typography, theme } from "antd";
import { ExclamationCircleOutlined, ReloadOutlined } from "@ant-design/icons";

/**
 * Contains a failure in the lazily-loaded whiteboard chunk to the whiteboard pane itself.
 *
 * `MeetingScreen`'s `<Suspense>` around `WhiteboardStage` has a loading fallback but nothing that
 * catches a rejected import — without an error boundary, a chunk that fails to fetch unmounts the
 * whole tree, and `MeetingScreen` **is** the meeting. `/assets/` is served immutable with a hard
 * 404, and this estate has a recorded case of the CDN still answering 404 for a minute or two after
 * an origin container restarts, so a guest with the page open across a redeploy is exactly the
 * client who would otherwise lose their video call over a whiteboard button.
 */
export class BoardBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Never swallowed — the sentence that explains the failure still needs somewhere to land,
    // even though the person only ever sees the Persian fallback below.
    console.error("[room] whiteboard failed to load:", error, info.componentStack);
  }

  // A plain re-render is enough: it drops the fallback and mounts `<Suspense>` again, which
  // retries the dynamic import.
  private retry = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return <BoardErrorFallback onRetry={this.retry} />;
    }
    return this.props.children;
  }
}

/**
 * `theme.useToken()` is a hook and cannot run inside the class above, so the message is its own
 * component. Exported (rather than kept private) only because `eslint-plugin-react-refresh` cannot
 * tell that `BoardBoundary`, a class, already is one — an un-exported component alongside it reads
 * to the rule as the file exporting no component at all.
 */
export function BoardErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { token } = theme.useToken();

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100%", padding: 16 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          maxWidth: 320,
          textAlign: "center",
          padding: 24,
          borderRadius: token.borderRadius,
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <ExclamationCircleOutlined style={{ fontSize: 22, color: token.colorWarning }} />
        <Typography.Text strong>تخته بارگذاری نشد</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          جلسه شما تحت تأثیر قرار نگرفته؛ می‌توانید همچنان در جلسه بمانید یا دوباره تلاش کنید.
        </Typography.Text>
        <Button icon={<ReloadOutlined />} onClick={onRetry} style={{ marginTop: 4 }}>
          تلاش دوباره
        </Button>
      </div>
    </div>
  );
}
