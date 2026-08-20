// Dev-only probe for step 5 (route: /dev/room-files). Excluded from prod.
//
// The real page needs a signed-in account with an invite, which this check cannot produce. So it
// seeds the query cache with meetings and files and renders THE REAL <MyMeetings />, card, button and
// drawer included — nothing here re-implements what it is measuring.
//
// The background refetch behind that seeded data WILL fail (no API is running), which is the point:
// react-query keeps the data and sets `error`, so this doubles as a live test that neither the list
// nor the panel throws its rows away when a refetch fails.
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MyMeetings } from "../../meetings/MyMeetings";
import { roomKeys } from "../../../lib/queries";
import { RoomJoinMode, RoomType, type MyRoom, type RoomFile } from "../../../lib/types";

const HOUR = 3_600_000;

/** A fixed instant so the report does not change between runs. */
const T0 = new Date("2026-08-20T09:00:00Z").getTime();

const ROOMS: MyRoom[] = [
  {
    id: 901,
    name: "جلسهٔ هماهنگی پروژهٔ بازآفرینی بافت تاریخی",
    description: "بررسی گزارش پیشرفت و تصمیم‌گیری دربارهٔ فاز دوم.",
    type: RoomType.Meeting,
    joinMode: RoomJoinMode.InviteOnly,
    presenterName: null,
    startsAtUtc: new Date(T0 + HOUR).toISOString(),
    opensAtUtc: new Date(T0).toISOString(),
    durationMinutes: 90,
    liveCount: 3,
    canJoinNow: true,
    isPresenter: false,
    fileCount: 3,
    canManageFiles: true,
  },
  {
    // The presenter of an empty presentation: the button must still offer a way in.
    id: 902,
    name: "ارائهٔ ضوابط جدید",
    description: null,
    type: RoomType.Presentation,
    joinMode: RoomJoinMode.Public,
    presenterName: "مهندس رضایی",
    startsAtUtc: new Date(T0 + 3 * HOUR).toISOString(),
    opensAtUtc: new Date(T0 + 3 * HOUR).toISOString(),
    durationMinutes: 45,
    liveCount: 0,
    canJoinNow: false,
    isPresenter: true,
    fileCount: 0,
    canManageFiles: true,
  },
  {
    // An audience member with nothing to read: the button must not appear at all.
    id: 903,
    name: "ارائهٔ ایمنی کارگاه",
    description: null,
    type: RoomType.Presentation,
    joinMode: RoomJoinMode.Public,
    presenterName: "مهندس رضایی",
    startsAtUtc: new Date(T0 + 5 * HOUR).toISOString(),
    opensAtUtc: new Date(T0 + 5 * HOUR).toISOString(),
    durationMinutes: 30,
    liveCount: 0,
    canJoinNow: false,
    isPresenter: false,
    fileCount: 0,
    canManageFiles: false,
  },
];

const FILES: RoomFile[] = [
  {
    id: 1,
    // Deliberately long and unbroken: this is the name that pushes buttons out of the drawer.
    fileName: "گزارش‌پیشرفت‌فاز‌دوم‌بازآفرینی‌بافت‌تاریخی‌شهرداری‌سنندج‌مردادماه.pdf",
    contentType: "application/pdf",
    sizeBytes: 19 * 1024 * 1024,
    uploadedAtUtc: new Date(T0 - HOUR).toISOString(),
  },
  { id: 2, fileName: "صورت‌جلسه.docx", contentType: "application/msword", sizeBytes: 48_000, uploadedAtUtc: new Date(T0 - 2 * HOUR).toISOString() },
  { id: 3, fileName: "notes.txt", contentType: "text/plain", sizeBytes: 380, uploadedAtUtc: new Date(T0 - 3 * HOUR).toISOString() },
];

export function RoomFilesProbe() {
  const qc = useQueryClient();
  const [report, setReport] = useState("seeding…");

  useEffect(() => {
    qc.setQueryData(roomKeys.mine, ROOMS);
    qc.setQueryData(roomKeys.files(901), FILES);
  }, [qc]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const doc = document.documentElement;
      const labels = [...document.querySelectorAll("button")]
        .map((b) => b.textContent?.trim() ?? "")
        .filter((t) => t.includes("فایل"));

      // Anything wider than the viewport, anywhere on the page.
      const overflowing = [...document.querySelectorAll<HTMLElement>("body *")]
        .filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 1)
        .map((el) => `${el.tagName.toLowerCase()}.${el.className?.toString().split(" ")[0] ?? ""}`);

      // A download must never be a plain link to the API — a navigation carries no token.
      const apiLinks = [...document.querySelectorAll("a[href]")]
        .map((a) => a.getAttribute("href") ?? "")
        .filter((h) => h.includes("/api/"));

      setReport(
        [
          `viewport: ${doc.clientWidth}px`,
          `page scrollWidth: ${doc.scrollWidth} (want <= ${doc.clientWidth})`,
          `file buttons: ${labels.length ? labels.join(" | ") : "(none)"}`,
          `overflowing elements: ${overflowing.length ? overflowing.slice(0, 5).join(", ") : "none"}`,
          `<a> pointing at /api/: ${apiLinks.length} (want 0)`,
        ].join("\n"),
      );
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <pre
        data-testid="files-probe"
        style={{ margin: "0 0 16px", padding: 12, background: "#111", color: "#0f0", fontSize: 12, direction: "ltr", textAlign: "left" }}
      >
        {report}
      </pre>
      <MyMeetings />
    </div>
  );
}

export default RoomFilesProbe;
