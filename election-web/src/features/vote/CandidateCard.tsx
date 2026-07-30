import { useState, type KeyboardEvent } from "react";
import { Avatar, Button, Tag, Typography, theme } from "antd";
import { CheckCircleFilled } from "@ant-design/icons";
import { mediaUrl } from "../../lib/api";
import type { BallotCandidate } from "../../lib/types";

/**
 * One candidate on the ballot.
 *
 * The rules here are from the design (§9, "Candidate cards") and every one of them exists because a
 * ballot is not an ordinary list:
 *
 * - **A missing photo must not disadvantage anyone.** No `image` renders initials in the same circle
 *   at the same size — never a smaller placeholder, never blank space.
 * - **Every card is the same height and shape** regardless of how much the admin typed. The biography
 *   is clamped to three lines behind a «بیشتر» toggle; without that, a long entry would tower over
 *   the others and the layout itself becomes campaigning.
 * - **The whole card is the target**, not a small dot, with a comfortable minimum height.
 * - **Selection is visible without relying on colour**: a border weight change AND a check icon.
 * - **Order comes from the server** and never shuffles — the parent passes them in `sortOrder`.
 * - **RTL**: logical properties only, and the avatar and check icon are never mirrored.
 */
export function CandidateCard({
  candidate,
  selected,
  disabled,
  disabledReason,
  onToggle,
}: {
  candidate: BallotCandidate;
  selected: boolean;
  /** True when the cap is reached and this card is not one of the chosen. */
  disabled: boolean;
  /** Shown on the card, not just as a tooltip — a silently dead card reads as a broken page. */
  disabledReason?: string;
  onToggle: () => void;
}) {
  const { token } = theme.useToken();
  const [expanded, setExpanded] = useState(false);

  const image = mediaUrl(candidate.image);
  const meta = [candidate.reshteLabelOrCode, candidate.educationLevel].filter(Boolean) as string[];

  // Only long text needs the toggle; showing «بیشتر» on two lines would be noise.
  const isLong = (candidate.description?.length ?? 0) > 140;

  const activate = () => {
    if (!disabled) onToggle();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // A div with role=checkbox has to implement the keyboard contract itself.
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      activate();
    }
  };

  return (
    <div
      role="checkbox"
      aria-checked={selected}
      aria-disabled={disabled}
      aria-label={candidate.fullName}
      tabIndex={disabled ? -1 : 0}
      onClick={activate}
      onKeyDown={onKeyDown}
      style={{
        position: "relative",
        height: "100%",
        minHeight: 132,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 16,
        borderRadius: token.borderRadiusLG,
        // A constant 2px border: switching between 1px and 2px on selection would shift the layout
        // of every neighbouring card.
        border: `2px solid ${selected ? token.colorPrimary : token.colorBorderSecondary}`,
        background: selected ? token.colorPrimaryBg : token.colorBgContainer,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "border-color .15s, background .15s, opacity .15s",
        outlineOffset: 2,
      }}
    >
      {selected && (
        <CheckCircleFilled
          aria-hidden
          style={{
            position: "absolute",
            top: 10,
            // Logical property: lands on the left in RTL without any mirroring.
            insetInlineEnd: 10,
            fontSize: 20,
            color: token.colorPrimary,
          }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar
          size={56}
          src={image || undefined}
          style={{
            flex: "0 0 auto",
            background: selected ? token.colorPrimary : token.colorFillSecondary,
            color: selected ? "#fff" : token.colorTextSecondary,
            fontSize: 20,
          }}
        >
          {/* The fallback fills the SAME circle at the SAME size — see the note above. */}
          {candidate.fullName.trim().charAt(0) || "؟"}
        </Avatar>

        <div style={{ minWidth: 0 }}>
          <Typography.Text strong style={{ fontSize: 15, display: "block" }}>
            {candidate.fullName}
          </Typography.Text>
          {meta.length > 0 && (
            <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
              {meta.map((m) => (
                <Tag key={m} style={{ marginInlineEnd: 0 }}>
                  {m}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </div>

      {candidate.description && (
        <div style={{ flex: 1 }}>
          <Typography.Paragraph
            type="secondary"
            style={{
              marginBottom: 0,
              fontSize: 13,
              whiteSpace: "pre-wrap",
              ...(expanded || !isLong
                ? {}
                : {
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical" as const,
                    overflow: "hidden",
                  }),
            }}
          >
            {candidate.description}
          </Typography.Paragraph>
          {isLong && (
            <Button
              type="link"
              size="small"
              style={{ paddingInline: 0, height: "auto" }}
              // Must not select the candidate — reading a biography is not a vote.
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
            >
              {expanded ? "کمتر" : "بیشتر"}
            </Button>
          )}
        </div>
      )}

      {disabled && disabledReason && (
        <Typography.Text type="warning" style={{ fontSize: 12 }}>
          {disabledReason}
        </Typography.Text>
      )}
    </div>
  );
}
