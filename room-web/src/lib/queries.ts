import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiDownload, apiGet, apiPost, apiPut, apiUpload } from "./api";
import type {
  MyRoom,
  RoomBoard,
  RoomDetail,
  RoomFile,
  RoomInput,
  RoomJoinResult,
  RoomLanding,
  RoomListItem,
  RoomMessage,
  RoomPerson,
} from "./types";

const ADMIN = "/api/RoomAdmin";
const ATTENDEE = "/api/Room";

export const roomKeys = {
  list: ["rooms"] as const,
  detail: (id: number) => ["room", id] as const,
  mine: ["my-rooms"] as const,
  person: (code: string) => ["room-person", code] as const,
  landing: (token: string) => ["room-landing", token] as const,
  messages: (id: number) => ["room-messages", id] as const,
  board: (id: number) => ["room-board", id] as const,
  files: (id: number) => ["room-files", id] as const,
};

/**
 * The admin meetings table. Polled while anything has people in it, so the head-count moves without a
 * manual refresh; otherwise not at all, because this is an admin screen on a shared box.
 */
export function useRooms() {
  return useQuery({
    queryKey: roomKeys.list,
    queryFn: () => apiGet<RoomListItem[]>(ADMIN),
    refetchInterval: (q) => (q.state.data?.some((r) => r.liveCount > 0) ? 15_000 : false),
  });
}

export function useRoom(id: number | undefined) {
  return useQuery({
    queryKey: roomKeys.detail(id ?? 0),
    queryFn: () => apiGet<RoomDetail>(`${ADMIN}/${id}`),
    enabled: !!id,
  });
}

/**
 * Resolves a کد ملی to the name the organisation has on file.
 *
 * `retry: false` — the two failures worth showing are "not found" and "the directory is unreachable",
 * and they carry different messages. Retrying just delays whichever one it is.
 */
export function useRoomPerson(nationalCode: string) {
  const code = nationalCode.trim();
  return useQuery({
    queryKey: roomKeys.person(code),
    queryFn: () => apiGet<RoomPerson>(`${ADMIN}/people/${code}`),
    enabled: code.length === 10,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

/** Invalidate list + detail together — a mutation on one always changes the other. */
function useRoomMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  idOf?: (args: TArgs) => number,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_data, args) => {
      void qc.invalidateQueries({ queryKey: roomKeys.list });
      void qc.invalidateQueries({ queryKey: roomKeys.mine });
      if (idOf) void qc.invalidateQueries({ queryKey: roomKeys.detail(idOf(args)) });
    },
  });
}

export function useCreateRoom() {
  return useRoomMutation((input: RoomInput) => apiPost<number>(ADMIN, input));
}

export function useUpdateRoom() {
  return useRoomMutation(
    ({ id, input }: { id: number; input: RoomInput }) => apiPut<void>(`${ADMIN}/${id}`, input),
    ({ id }) => id,
  );
}

/** New link; every copy of the old one stops working. Answers the full URL. */
export function useRegenerateLink() {
  return useRoomMutation(
    (id: number) => apiPost<string>(`${ADMIN}/${id}/link`),
    (id) => id,
  );
}

export function useSetRoomActive() {
  return useRoomMutation(
    ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiPost<void>(`${ADMIN}/${id}/active`, { isActive }),
    ({ id }) => id,
  );
}

export function useDeleteRoom() {
  return useRoomMutation((id: number) => apiDelete<void>(`${ADMIN}/${id}`));
}

export function useInviteToRoom() {
  return useRoomMutation(
    ({ id, nationalCode }: { id: number; nationalCode: string }) =>
      apiPost<void>(`${ADMIN}/${id}/invites`, { nationalCode }),
    ({ id }) => id,
  );
}

export function useRemoveRoomInvite() {
  return useRoomMutation(
    ({ id, userId }: { id: number; userId: string }) =>
      apiDelete<void>(`${ADMIN}/${id}/invites/${userId}`),
    ({ id }) => id,
  );
}

// ── attendee side ────────────────────────────────────────────────────────────

/**
 * The meetings this person may attend, each with the server's verdict on whether they may join now.
 *
 * `staleTime: 0` on purpose. The default 5 s is fine for an admin table, but a stale `canJoinNow`
 * here means offering a door the server will refuse — and after a meeting opens, a stale `false`
 * means hiding a door that is open.
 */
export function useMyRooms() {
  return useQuery({
    queryKey: roomKeys.mine,
    queryFn: () => apiGet<MyRoom[]>(`${ATTENDEE}/MyRooms`),
    staleTime: 0,
    refetchOnWindowFocus: true,
    // A meeting that has not opened yet becomes joinable at a moment nobody presses a button for.
    // Re-asking every half minute is what makes the list agree with the server without a reload.
    refetchInterval: 30_000,
  });
}

/**
 * Join a meeting from «جلسات من», by id — the invite-only path, where there is no link to hold.
 *
 * `retry: false` for the same reason as the link join: a silent retry after a blip whose first
 * attempt succeeded would put a second copy of this person in the room.
 */
export function useJoinRoom() {
  return useMutation({
    mutationFn: (id: number) => apiPost<RoomJoinResult>(`${ATTENDEE}/${id}/join`),
    retry: false,
  });
}

// ── chat ─────────────────────────────────────────────────────────────────────

/**
 * The saved chat for one meeting.
 *
 * Fetched once when the panel opens, and after that new lines arrive over the data channel — so this
 * is history, not a poll. A meeting that polled would cost every participant a request every few
 * seconds against a rate limit they share with everyone behind their NAT.
 */
export function useRoomMessages(roomId: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: roomKeys.messages(roomId ?? 0),
    queryFn: () => apiGet<RoomMessage[]>(`${ATTENDEE}/${roomId}/messages`),
    enabled: !!roomId && enabled,
    staleTime: Infinity,
  });
}

/** Sends a line. The body carries the text and nothing else — see the endpoint for why. */
export function useSendRoomMessage(roomId: number) {
  return useMutation({
    mutationFn: (text: string) =>
      apiPost<RoomMessage>(`${ATTENDEE}/${roomId}/messages`, { text }),
    retry: false,
  });
}

// ── the link landing page ────────────────────────────────────────────────────

/**
 * What the landing page shows somebody holding a link.
 *
 * `retry: false` because the two failures worth showing — an unknown link and a deleted meeting —
 * are the same 404, and retrying only delays it.
 *
 * No polling. The countdown knows exactly when to re-ask, and a page that may sit open for twenty
 * minutes before a webinar should not be sending a request every thirty seconds to learn nothing.
 */
export function useRoomLanding(joinToken: string | undefined) {
  return useQuery({
    queryKey: roomKeys.landing(joinToken ?? ""),
    queryFn: () => apiGet<RoomLanding>(`${ATTENDEE}/j/${joinToken}`),
    enabled: !!joinToken,
    retry: false,
    // Always ask. A cached "not open yet" is exactly the answer that goes stale on its own.
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * Join through a link.
 *
 * `retry: false` is TanStack's default for mutations; it is stated here because on this endpoint it
 * matters. Every successful call mints a fresh guest identity, so a silent retry after a network
 * blip whose first attempt actually succeeded would put a second phantom participant in the room.
 */
export function useJoinByLink() {
  return useMutation({
    mutationFn: ({ joinToken, fullName }: { joinToken: string; fullName?: string }) =>
      apiPost<RoomJoinResult>(`${ATTENDEE}/j/${joinToken}`, { fullName: fullName ?? null }),
    retry: false,
  });
}

// ── whiteboard ───────────────────────────────────────────────────────────────

/**
 * The saved board for one meeting.
 *
 * Fetched once when the board opens; after that changes arrive over the data channel. Same reasoning
 * as chat history — a meeting that polled would cost every participant a request every few seconds
 * against a rate limit they share with everyone behind their NAT.
 */
export function useRoomBoard(roomId: number, enabled: boolean) {
  return useQuery({
    queryKey: roomKeys.board(roomId),
    queryFn: () => apiGet<RoomBoard | undefined>(`${ATTENDEE}/${roomId}/board`),
    enabled: !!roomId && enabled,
    staleTime: Infinity,
  });
}

/** Replaces the board. The whole scene, because any drawer's copy is already everyone's merged board. */
export function useSaveRoomBoard(roomId: number) {
  return useMutation({
    mutationFn: (scene: string) => apiPut<void>(`${ATTENDEE}/${roomId}/board`, { scene }),
    retry: false,
  });
}

// ── the meeting's files ──────────────────────────────────────────────────────

/**
 * The files attached to one meeting.
 *
 * Fetched when the panel opens, and not polled: a handout list changes when somebody presses a
 * button, and the mutations below invalidate it themselves.
 */
export function useRoomFiles(roomId: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: roomKeys.files(roomId ?? 0),
    queryFn: () => apiGet<RoomFile[]>(`${ATTENDEE}/${roomId}/files`),
    enabled: !!roomId && enabled,
    staleTime: 0,
  });
}

/**
 * Invalidate the list AND «جلسات من».
 *
 * The count on the meeting card comes from the MyRooms row, not from this list, so refreshing only
 * the panel would leave the button saying «۲ فایل» over a panel showing three. That list polls every
 * thirty seconds, which would fix it eventually — "eventually" is not a state to ship.
 */
function useFileMutation<TArgs>(roomId: number, fn: (args: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    retry: false,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: roomKeys.files(roomId) });
      void qc.invalidateQueries({ queryKey: roomKeys.mine });
    },
  });
}

export function useUploadRoomFile(roomId: number) {
  return useFileMutation(roomId, (file: File) =>
    apiUpload<number>(`${ATTENDEE}/${roomId}/files`, file));
}

export function useDeleteRoomFile(roomId: number) {
  return useFileMutation(roomId, (fileId: number) =>
    apiDelete<void>(`${ATTENDEE}/files/${fileId}`));
}

/**
 * Saves one file to the device.
 *
 * A mutation rather than a query because it is an action with a result the cache has no use for —
 * and because `isPending` is exactly the per-row spinner the panel needs.
 */
export function useDownloadRoomFile() {
  return useMutation({
    mutationFn: (file: RoomFile) =>
      apiDownload(`${ATTENDEE}/files/${file.id}/content`, file.fileName),
    retry: false,
  });
}
