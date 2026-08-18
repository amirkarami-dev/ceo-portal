/**
 * The whiteboard's sync rules, as pure functions.
 *
 * Nothing here imports React, LiveKit or Excalidraw — which is what makes it testable in a node
 * process with no canvas, no jsdom and no media server. The hook next door is the only place that
 * knows about the data channel, and `WhiteboardStage` the only place that knows about Excalidraw.
 */

/** The part of an Excalidraw element this module needs. The real type carries dozens more fields. */
export interface BoardElement {
  id: string;
  version: number;
  [key: string]: unknown;
}

/** What travels over the data channel. `kind` is the same discriminator chat uses. */
export interface WhiteboardWireMessage {
  kind: "whiteboard";
  elements: BoardElement[];
}

/** Its own topic on the shared channel, so chat and board never see each other's traffic. */
export const WHITEBOARD_TOPIC = "whiteboard";

/**
 * LiveKit's reliable data messages top out around 15 KB. 12,000 leaves room for the envelope and a
 * margin — and it is counted in BYTES, which is the whole point: see `chunkByBytes`.
 */
export const MAX_CHUNK_BYTES = 12_000;

const encoder = new TextEncoder();

export function byteLength(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).length;
}

/** The envelope's own cost, so a chunk cannot be sized as though it travelled bare. */
const ENVELOPE_BYTES = byteLength({ kind: "whiteboard", elements: [] } satisfies WhiteboardWireMessage);

/** The shapes whose version differs from the last one we sent or received. */
export function selectChanged(
  elements: readonly BoardElement[],
  lastVersions: Map<string, number>,
): BoardElement[] {
  return elements.filter((element) => lastVersions.get(element.id) !== element.version);
}

/**
 * Records what we have seen. Called after sending AND after applying a remote change — the second
 * one is what stops an element we just received bouncing back to its author as our own edit.
 */
export function rememberVersions(
  elements: readonly BoardElement[],
  lastVersions: Map<string, number>,
): void {
  for (const element of elements) lastVersions.set(element.id, element.version);
}

/**
 * Splits a delta into messages that each fit under `maxBytes` **on the wire**.
 *
 * Measured with `TextEncoder`, not `String.length`. Persian is two bytes per character in UTF-8, so
 * counting characters means a message believed to be 12,000 can be 24,000 bytes, over LiveKit's
 * ceiling, dropped silently. A single shape too big to fit travels alone rather than being lost.
 */
export function chunkByBytes(
  elements: readonly BoardElement[],
  maxBytes: number = MAX_CHUNK_BYTES,
): BoardElement[][] {
  const chunks: BoardElement[][] = [];
  let current: BoardElement[] = [];
  let used = ENVELOPE_BYTES;

  for (const element of elements) {
    const size = byteLength(element) + 1; // + the separating comma
    if (current.length > 0 && used + size > maxBytes) {
      chunks.push(current);
      current = [];
      used = ENVELOPE_BYTES;
    }
    current.push(element);
    used += size;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function encodeWhiteboardMessage(elements: readonly BoardElement[]): Uint8Array {
  const message: WhiteboardWireMessage = { kind: "whiteboard", elements: [...elements] };
  return encoder.encode(JSON.stringify(message));
}

/**
 * Reads a payload off the shared channel, or returns null.
 *
 * Every participant can put whatever they like on this channel, so this is the boundary: the kind,
 * the shape of `elements`, and the two fields the sync logic relies on are all checked before
 * anything reaches the canvas. Chat rides the same channel and must fall through here untouched.
 */
export function decodeWhiteboardMessage(payload: Uint8Array): BoardElement[] | null {
  try {
    const wire = JSON.parse(new TextDecoder().decode(payload)) as WhiteboardWireMessage;
    if (wire?.kind !== "whiteboard" || !Array.isArray(wire.elements)) return null;

    const usable = wire.elements.every(
      (element) => typeof element?.id === "string" && typeof element?.version === "number",
    );
    return usable ? wire.elements : null;
  } catch {
    return null;
  }
}

/**
 * Whether an edit from this sender may be applied.
 *
 * The media server tells every browser each participant's publish permission, and a peer cannot
 * forge another peer's. In a presentation only the presenter may publish, so this single check is
 * the audience rule; in a meeting everybody may, so it lets everybody through. `=== true` on
 * purpose: an unknown sender or unknown permissions is a drop, not a maybe.
 */
export function senderMayDraw(
  sender: { permissions?: { canPublish?: boolean } } | undefined,
): boolean {
  return sender?.permissions?.canPublish === true;
}
