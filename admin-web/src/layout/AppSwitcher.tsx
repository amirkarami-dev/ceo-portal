import { useEffect, useState, type ReactNode } from "react";
import { Button, Popover, theme } from "antd";
import { getUserManager } from "../auth/oidc";

// One product service the user can switch to. `key` matches the IdP `svc` grant key
// (src/Auth/Data/ServiceKeys.cs); `href` is the live subdomain. `adminOnly` services are gated by
// the central Administrator role instead of a `svc` grant. Shared verbatim across the SPAs.
type Svc = {
  key: string;
  nameFa: string;
  nameEn: string;
  href: string;
  color: string;
  icon: ReactNode;
  adminOnly?: boolean;
};

const ic = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const SERVICES: Svc[] = [
  {
    key: "mabhas19",
    nameFa: "مبحث ۱۹",
    nameEn: "Mabhas 19",
    href: "https://mabhas19.myceo.ir",
    color: "#059669",
    icon: (
      <svg {...ic}>
        <path d="M3 21h18" />
        <path d="M6 21V7l6-4 6 4v14" />
        <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10 21v-4h4v4" />
      </svg>
    ),
  },
  {
    key: "analytics",
    nameFa: "تحلیل داده",
    nameEn: "Analytics",
    href: "https://analytic.myceo.ir",
    color: "#0284c7",
    icon: (
      <svg {...ic}>
        <path d="M3 3v18h18" />
        <path d="M7 15v3M12 10v8M17 6v12" />
      </svg>
    ),
  },
  {
    key: "mun-sanandaj",
    nameFa: "شهرداری سنندج",
    nameEn: "Sanandaj Municipality",
    href: "https://mun-sanandaj.myceo.ir",
    color: "#d97706",
    icon: (
      <svg {...ic}>
        <path d="M12 3 4 8h16z" />
        <path d="M4 10h16" />
        <path d="M6 10v8M10 10v8M14 10v8M18 10v8" />
        <path d="M3 21h18" />
      </svg>
    ),
  },
  {
    key: "landing-panel",
    nameFa: "پنل لندینگ",
    nameEn: "Landing Panel",
    href: "https://landing-panel.myceo.ir",
    color: "#7c3aed",
    icon: (
      <svg {...ic}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 9v11" />
      </svg>
    ),
  },
  {
    key: "plan",
    nameFa: "پلن",
    nameEn: "Plan",
    href: "https://plan.myceo.ir",
    color: "#e11d48",
    icon: (
      <svg {...ic}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 3v4M16 3v4" />
        <path d="m9 15 2 2 4-4" />
      </svg>
    ),
  },
  {
    key: "walfare",
    nameFa: "سامانه رفاهی",
    nameEn: "Welfare",
    href: "https://refahi.kurdnezam.ir",
    color: "#db2777",
    icon: (
      <svg {...ic}>
        <path d="M12 20s-6.5-4.2-8.4-7.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.4 5.4C18.5 15.8 12 20 12 20z" />
      </svg>
    ),
  },
  {
    key: "admin",
    nameFa: "مدیریت کاربران",
    nameEn: "User Admin",
    href: "https://admin.myceo.ir",
    color: "#64748b",
    adminOnly: true,
    icon: (
      <svg {...ic}>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <path d="M16 6.6a3 3 0 0 1 0 5.8M18.5 20a5.5 5.5 0 0 0-3-4.9" />
      </svg>
    ),
  },
];

function toArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") return v.split(/\s+/).filter(Boolean);
  return [];
}

function WaffleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {[5, 12, 19].flatMap((y) => [5, 12, 19].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2" />))}
    </svg>
  );
}

/**
 * Header "waffle" launcher: shows the product services the signed-in user may open (from the
 * `svc` grant on the OIDC id_token; empty = all/grandfathered), each with a distinct icon/accent,
 * and switches to them. Display-only — the IdP still enforces access at authorize.
 */
export function AppSwitcher({ currentKey, locale = "fa" }: { currentKey: string; locale?: string }) {
  const { token } = theme.useToken();
  const isFa = locale.startsWith("fa");
  const [svc, setSvc] = useState<string[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const u = await getUserManager().getUser();
        if (!alive) return;
        const p = (u && !u.expired ? u.profile : {}) as Record<string, unknown>;
        setSvc(toArr(p.svc));
        setIsAdmin(toArr(p.role ?? p.roles).includes("Administrator"));
      } catch {
        if (alive) setSvc([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (svc === null) return null;
  const grantAll = svc.length === 0;
  const visible = SERVICES.filter((s) => (s.adminOnly ? isAdmin : grantAll || svc.includes(s.key)));
  if (visible.length < 2) return null;

  const label = isFa ? "سرویس‌ها" : "Apps";

  const content = (
    <div style={{ width: 264 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: token.colorTextSecondary, padding: "2px 6px 8px" }}>
        {isFa ? "سرویس‌های شما" : "Your apps"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
        {visible.map((s) => {
          const current = s.key === currentKey;
          return (
            <a
              key={s.key}
              href={s.href}
              aria-current={current ? "page" : undefined}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "10px 6px",
                borderRadius: 12,
                textDecoration: "none",
                position: "relative",
                color: token.colorText,
                transition: "background .15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = token.colorFillTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <span
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  display: "grid",
                  placeItems: "center",
                  background: s.color + "1a",
                  color: s.color,
                  boxShadow: current ? `0 0 0 2px ${s.color}66` : "none",
                }}
              >
                {s.icon}
              </span>
              <span style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.25, textAlign: "center", color: token.colorText }}>
                {isFa ? s.nameFa : s.nameEn}
              </span>
              {current ? (
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    insetInlineEnd: 6,
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: token.colorPrimary,
                  }}
                />
              ) : null}
            </a>
          );
        })}
      </div>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      arrow={false}
      overlayInnerStyle={{ padding: 8 }}
      content={content}
    >
      <Button type="text" aria-label={label} title={label} icon={<WaffleIcon />} />
    </Popover>
  );
}
