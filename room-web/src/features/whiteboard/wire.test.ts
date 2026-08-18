import { describe, expect, it } from "vitest";
import {
  MAX_CHUNK_BYTES,
  byteLength,
  chunkByBytes,
  decodeWhiteboardMessage,
  encodeWhiteboardMessage,
  rememberVersions,
  selectChanged,
  senderMayDraw,
  type BoardElement,
} from "./wire";

const el = (id: string, version: number, extra: Record<string, unknown> = {}): BoardElement =>
  ({ id, version, type: "rectangle", ...extra });

describe("selectChanged", () => {
  it("sends everything the first time", () => {
    const seen = new Map<string, number>();
    expect(selectChanged([el("a", 1), el("b", 1)], seen).map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("sends only the shape whose version moved", () => {
    const seen = new Map([["a", 1], ["b", 1]]);
    expect(selectChanged([el("a", 1), el("b", 2)], seen).map((e) => e.id)).toEqual(["b"]);
  });

  it("sends nothing when nothing changed", () => {
    const seen = new Map([["a", 1]]);
    expect(selectChanged([el("a", 1)], seen)).toEqual([]);
  });

  it("stops resending once the versions are remembered", () => {
    const seen = new Map<string, number>();
    const first = selectChanged([el("a", 1)], seen);
    rememberVersions(first, seen);
    expect(selectChanged([el("a", 1)], seen)).toEqual([]);
  });

  /**
   * The reason `rememberVersions` is called on RECEIVE as well as send: an element applied from
   * somebody else must not bounce straight back to them as our own change.
   */
  it("does not echo a shape that arrived from someone else", () => {
    const seen = new Map<string, number>();
    rememberVersions([el("a", 7)], seen);
    expect(selectChanged([el("a", 7)], seen)).toEqual([]);
  });
});

describe("chunkByBytes", () => {
  it("keeps a small delta in one message", () => {
    expect(chunkByBytes([el("a", 1), el("b", 1)])).toHaveLength(1);
  });

  /**
   * The bug this exists to prevent. The old implementation counted CHARACTERS against a byte limit;
   * Persian is two bytes per character in UTF-8, so a payload it believed was 12,000 was 24,000 on
   * the wire, over LiveKit's reliable ceiling, and dropped with no error anywhere.
   */
  it("splits Persian text by bytes, not characters", () => {
    // Sized so the two elements only exceed the cap when counted as BYTES. Each is 6,051 bytes
    // (3,051 chars): one fits comfortably, two do not — 12,139 > 12,000. Count characters instead
    // and the pair measures 6,139, which fits, so the buggy version produces a single chunk and
    // this test fails on `chunks.length`. That is what makes it a discriminator rather than a
    // decoration. Do not "round it up" — at 1,500 repeats a single element already exceeds the cap
    // and both implementations split, proving nothing.
    const persian = "سلام".repeat(750); // 3,000 chars ⇒ 6,000 bytes of text
    const chunks = chunkByBytes([el("a", 1, { text: persian }), el("b", 1, { text: persian })]);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(byteLength({ kind: "whiteboard", elements: chunk })).toBeLessThanOrEqual(MAX_CHUNK_BYTES);
    }
  });

  it("loses nothing when it splits", () => {
    const big = "x".repeat(5000);
    const ids = chunkByBytes([el("a", 1, { big }), el("b", 1, { big }), el("c", 1, { big })])
      .flat()
      .map((e) => e.id);
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("sends a single oversized shape alone rather than dropping it", () => {
    const huge = el("a", 1, { text: "x".repeat(MAX_CHUNK_BYTES * 2) });
    const chunks = chunkByBytes([huge, el("b", 1)]);
    expect(chunks[0]).toEqual([huge]);
    expect(chunks[1].map((e) => e.id)).toEqual(["b"]);
  });

  it("returns nothing for nothing", () => {
    expect(chunkByBytes([])).toEqual([]);
  });
});

describe("decodeWhiteboardMessage", () => {
  it("round-trips our own message", () => {
    const decoded = decodeWhiteboardMessage(encodeWhiteboardMessage([el("a", 3)]));
    expect(decoded).toEqual([el("a", 3)]);
  });

  const reject = (payload: unknown) =>
    decodeWhiteboardMessage(new TextEncoder().encode(JSON.stringify(payload)));

  it("ignores chat, which shares the channel", () => {
    expect(reject({ kind: "chat", id: 1, text: "سلام" })).toBeNull();
  });

  it("ignores a message with no kind", () => {
    expect(reject({ elements: [el("a", 1)] })).toBeNull();
  });

  it("ignores elements that are not an array", () => {
    expect(reject({ kind: "whiteboard", elements: "everything" })).toBeNull();
  });

  it("ignores an element missing an id or a version", () => {
    expect(reject({ kind: "whiteboard", elements: [{ version: 1 }] })).toBeNull();
    expect(reject({ kind: "whiteboard", elements: [{ id: "a" }] })).toBeNull();
  });

  it("ignores bytes that are not JSON at all", () => {
    expect(decodeWhiteboardMessage(new Uint8Array([0xff, 0x00, 0x42]))).toBeNull();
  });
});

describe("senderMayDraw", () => {
  it("accepts a sender the media server says may publish", () => {
    expect(senderMayDraw({ permissions: { canPublish: true } })).toBe(true);
  });

  /**
   * In a presentation only the presenter may publish, so this one boolean is the whole audience
   * rule — no branch on meeting type anywhere.
   */
  it("refuses a sender who may not publish", () => {
    expect(senderMayDraw({ permissions: { canPublish: false } })).toBe(false);
  });

  it("refuses when the sender or its permissions are unknown", () => {
    expect(senderMayDraw(undefined)).toBe(false);
    expect(senderMayDraw({})).toBe(false);
    expect(senderMayDraw({ permissions: {} })).toBe(false);
  });
});
