import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import "./sidebar-head.css";

/**
 * The same bar-chart mark the app launcher uses for this service, redrawn rather than
 * imported: `SERVICES` in AppSwitcher.tsx is not exported, and that file is
 * byte-identical across all eight SPAs — importing from it is fine, editing it is not.
 *
 * The launcher tints each service its own colour (this one is #0284c7). That is right
 * in a grid of eight; inside the app it would fight the blue the whole interface is
 * built from, so the mark takes the brand instead. Same shape, this app's voice.
 */
function ServiceMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <path d="M3 3v18h18" />
      <path d="M7 15v3M12 10v8M17 6v12" />
    </svg>
  );
}

/**
 * The panel used to begin with a clickable row hard against the top edge — no mark, no
 * name, nothing saying which of the eight services you are standing in after using the
 * launcher. This is that missing confirmation.
 *
 * Deliberately not a card: the sider is already a surface, and a bordered box inside it
 * would be a card within a card. It earns its place with a tint that fades out, its own
 * spacing, and a rule underneath.
 */
export function SidebarHead({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useTranslation();
  const name = t("service.name");
  const tagline = t("service.tagline");

  if (collapsed) {
    return (
      <div className="sidebar-head sidebar-head--rail">
        <Tooltip title={name} placement="left">
          <span className="sidebar-head__mark" aria-label={name} role="img">
            <ServiceMark />
          </span>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="sidebar-head">
      <span className="sidebar-head__mark" aria-hidden>
        <ServiceMark />
      </span>
      <span className="sidebar-head__text">
        <strong className="sidebar-head__name">{name}</strong>
        <span className="sidebar-head__tagline">{tagline}</span>
      </span>
    </div>
  );
}
