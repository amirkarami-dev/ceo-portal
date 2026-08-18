import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDataChannel, useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import {
  WHITEBOARD_TOPIC,
  chunkByBytes,
  decodeWhiteboardMessage,
  encodeWhiteboardMessage,
  rememberVersions,
  selectChanged,
  senderMayDraw,
  type BoardElement,
} from "./wire";

/**
 * Moves whiteboard edits between participants over the channel chat already uses.
 *
 * Thin on purpose: every rule lives in `wire.ts`, which is tested. What is here is the wiring that
 * cannot be tested without a media server — the subscription, the sender check, and the one full
 * resend when somebody new arrives.
 */
export function useWhiteboardSync({
  canDraw,
  onRemote,
  getScene,
}: {
  canDraw: boolean;
  onRemote: (elements: BoardElement[]) => void;
  getScene: () => readonly BoardElement[];
}) {
  const room = useRoomContext();

  // What we last sent or applied, per element. Also the echo guard — see rememberVersions.
  const lastVersions = useMemo(() => new Map<string, number>(), []);

  // Callbacks that change identity every render would re-subscribe the data channel constantly.
  const handlers = useRef({ onRemote, getScene });
  handlers.current = { onRemote, getScene };

  const onData = useCallback(
    (message: { payload: Uint8Array; from?: { permissions?: { canPublish?: boolean } } }) => {
      // The sender is attested by the media server; the payload is not. Anyone in the room can put
      // bytes on this channel, so an audience member's edits are refused here rather than trusted.
      if (!senderMayDraw(message.from)) return;

      const elements = decodeWhiteboardMessage(message.payload);
      if (!elements || elements.length === 0) return;

      rememberVersions(elements, lastVersions);
      handlers.current.onRemote(elements);
    },
    [lastVersions],
  );

  const { send } = useDataChannel(WHITEBOARD_TOPIC, onData);

  const publish = useCallback(
    (elements: readonly BoardElement[]) => {
      for (const chunk of chunkByBytes(elements)) {
        // Reliable: a lost delta would leave two people looking at different boards, and there is
        // no periodic full resend to repair it.
        void send(encodeWhiteboardMessage(chunk), { reliable: true }).catch(() => {
          // Nothing useful to tell the person drawing. The next change resends, and a newcomer gets
          // the whole board from the server.
        });
      }
    },
    [send],
  );

  const broadcastChanged = useCallback(() => {
    if (!canDraw) return;
    const changed = selectChanged(handlers.current.getScene(), lastVersions);
    if (changed.length === 0) return;
    rememberVersions(changed, lastVersions);
    publish(changed);
  }, [canDraw, lastVersions, publish]);

  const broadcastFull = useCallback(() => {
    if (!canDraw) return;
    const scene = handlers.current.getScene();
    if (scene.length === 0) return;
    rememberVersions(scene, lastVersions);
    publish(scene);
  }, [canDraw, lastVersions, publish]);

  /**
   * One full resend when a participant joins.
   *
   * This is what a late joiner's first seconds rest on, and it replaces the old implementation's
   * ten-second timer: it fires exactly when it is needed and never otherwise. The old version's
   * equivalent was gated on a "host" check that could never be true, so it never ran at all.
   */
  useEffect(() => {
    if (!canDraw) return;
    const onJoin = () => broadcastFull();
    room.on(RoomEvent.ParticipantConnected, onJoin);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onJoin);
    };
  }, [room, canDraw, broadcastFull]);

  return { broadcastChanged, broadcastFull };
}
