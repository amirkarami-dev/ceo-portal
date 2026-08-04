import { useEffect, useState, type ReactNode } from "react";
import { Button, Popover, theme } from "antd";
import { ADMIN_ROLES, getUserManager } from "../auth/oidc";

// One product service the user can switch to. `key` matches the IdP `svc` grant key
// (src/Auth/Data/ServiceKeys.cs); `href` is the live subdomain. Shared verbatim across the SPAs.
type Svc = {
  key: string;
  nameFa: string;
  nameEn: string;
  href: string;
  color: string;
  icon: ReactNode;
  /** Requires an admin role to appear at all. */
  adminOnly?: boolean;
  /**
   * Never hidden from a NON-admin, because the service does not gate engineers at authorize.
   * Administrators are still filtered by their grants — see `canSee`.
   */
  ungated?: boolean;
  /**
   * Never hidden from an admin, whatever their grants. Only the user-admin panel carries this: it
   * is the one place a narrowed administrator can widen their own services again, so hiding it
   * would make a mistaken grant unrecoverable from the UI.
   */
  alwaysForAdmin?: boolean;
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
    key: "election",
    nameFa: "سامانه انتخابات",
    nameEn: "Elections",
    href: "https://election.myceo.ir",
    color: "#0d9488",
    // Ungated for ENGINEERS only. `election` never blocks a non-admin at authorize — every engineer
    // provisioned before this service existed carries ["walfare"] and must still be able to vote, so
    // hiding the tile would hide a service they can actually use. An administrator with an explicit
    // grant list IS filtered here and gated at authorize (ServiceKeys.AdminGatedClientToKey).
    ungated: true,
    icon: (
      <svg {...ic}>
        <path d="M5 21h14" />
        <path d="M7 21v-9l5-3 5 3v9" />
        <path d="M9.5 13.5 11 15l3.5-3.5" />
        <path d="M12 3v3" />
      </svg>
    ),
  },
  {
    key: "room",
    nameFa: "جلسات آنلاین",
    nameEn: "Meetings",
    href: "https://room.myceo.ir",
    color: "#4f46e5",
    // Ungated for ENGINEERS only, for the same reason as `election`, and the argument is simpler
    // here: who may attend a meeting is the invite list on that meeting, or the link. An engineer
    // carrying ["walfare"] who is invited to a جلسه must be able to sign in and attend it.
    // Administrators with an explicit grant list are filtered and gated like any other service.
    ungated: true,
    icon: (
      <svg {...ic}>
        <rect x="2" y="6" width="13" height="12" rx="2" />
        <path d="m15 11 5-3v8l-5-3z" />
      </svg>
    ),
  },
  {
    key: "vms",
    nameFa: "دوربین‌های نظارتی",
    nameEn: "Cameras",
    href: "https://vms.myceo.ir",
    color: "#0f766e",
    // Administrators only — the design settled that nobody else watches, and both the SPA route
    // guard and the API enforce that. On top of the role, an administrator with an explicit grant
    // list must also hold `vms`, so cameras can be handed to one admin without handing over the
    // rest of the platform.
    adminOnly: true,
    icon: (
      <svg {...ic}>
        <path d="M3 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3z" />
        <path d="m16 11 5-3v8l-5-3z" />
        <circle cx="8" cy="12" r="2" />
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
    // Never filtered by grants: this panel is where a narrowed administrator widens their services
    // again. Hide it and one mistaken checkbox becomes unrecoverable without a database edit.
    // `admin-web` is absent from BOTH client maps in ServiceKeys for the same reason.
    alwaysForAdmin: true,
    icon: (
      <svg {...ic}>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <path d="M16 6.6a3 3 0 0 1 0 5.8M18.5 20a5.5 5.5 0 0 0-3-4.9" />
      </svg>
    ),
  },
];

/**
 * Mirrors the IdP gate in `AuthorizationController.DenyServiceAsync`. Display only — the IdP is
 * what actually enforces this — but the two must agree, or a tile appears that leads to a refusal.
 */
function canSee(s: Svc, isAdmin: boolean, isSuper: boolean, svc: string[]): boolean {
  if (s.adminOnly && !isAdmin) return false;
  if (isSuper) return true;                       // never gated, by design
  if (s.alwaysForAdmin && isAdmin) return true;   // the way back in
  if (svc.length === 0) return true;              // grandfathered: no grants = everything
  if (!isAdmin && s.ungated) return true;         // engineers keep the ballot and their meetings
  return svc.includes(s.key);
}

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
 * Header "waffle" launcher: shows the product services the signed-in user may open (from the `svc`
 * grant on the OIDC id_token; empty = all/grandfathered), each with a distinct icon/accent, and
 * switches to them. Display-only — the IdP still enforces access at authorize; see `canSee`.
 *
 * This file is duplicated verbatim in all eight SPAs. Change one, copy to the other seven, and
 * rebuild every one of them — a panel that is not rebuilt keeps serving the old tile list.
 */
export function AppSwitcher({ currentKey, locale = "fa" }: { currentKey: string; locale?: string }) {
  const { token } = theme.useToken();
  const isFa = locale.startsWith("fa");
  const [svc, setSvc] = useState<string[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const u = await getUserManager().getUser();
        if (!alive) return;
        const p = (u && !u.expired ? u.profile : {}) as Record<string, unknown>;
        const roles = toArr(p.role ?? p.roles);
        setSvc(toArr(p.svc));
        setIsAdmin(roles.some((r) => (ADMIN_ROLES as readonly string[]).includes(r)));
        setIsSuper(roles.includes("SuperUser"));
      } catch {
        if (alive) setSvc([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (svc === null) return null;
  const visible = SERVICES.filter((s) => canSee(s, isAdmin, isSuper, svc));
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
