import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, apiPut } from "./api";
import { ElectionPhase } from "./types";
import type {
  Ballot,
  CastVoteResult,
  ElectionDetail,
  ElectionInput,
  ElectionListItem,
  ElectionResult,
  TallyOutcome,
} from "./types";

const ADMIN = "/api/ElectionAdmin";
const VOTER = "/api/Election";

export const electionKeys = {
  list: ["elections"] as const,
  detail: (id: number) => ["election", id] as const,
  result: (id: number) => ["election-result", id] as const,
  myBallots: ["my-ballots"] as const,
};

/**
 * The elections list. Polled while anything is open so ballot counts move without a manual refresh;
 * otherwise slowly, because this is an admin screen on a shared 4-service box, not a dashboard.
 */
export function useElections() {
  return useQuery({
    queryKey: electionKeys.list,
    queryFn: () => apiGet<ElectionListItem[]>(ADMIN),
    refetchInterval: (q) =>
      q.state.data?.some((e) => e.phase === ElectionPhase.Open) ? 15_000 : false,
  });
}

export function useElection(id: number | undefined) {
  return useQuery({
    queryKey: electionKeys.detail(id ?? 0),
    queryFn: () => apiGet<ElectionDetail>(`${ADMIN}/${id}`),
    enabled: !!id,
  });
}

export function useElectionResult(id: number | undefined) {
  return useQuery({
    // Results come from the VOTER route — the admin API deliberately has no results endpoint, so
    // there is one code path producing the published numbers.
    queryKey: electionKeys.result(id ?? 0),
    queryFn: () => apiGet<ElectionResult>(`/api/Election/${id}/result`),
    enabled: !!id,
    retry: false, // 404 until tallied; retrying just delays the empty state.
  });
}

/** Invalidate list + detail together — a mutation on one always changes the other. */
function useElectionMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  idOf?: (args: TArgs) => number,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_data, args) => {
      void qc.invalidateQueries({ queryKey: electionKeys.list });
      if (idOf) void qc.invalidateQueries({ queryKey: electionKeys.detail(idOf(args)) });
    },
  });
}

export function useCreateElection() {
  return useElectionMutation((input: ElectionInput) => apiPost<number>(ADMIN, { input }));
}

export function useUpdateElection() {
  return useElectionMutation(
    ({ id, input }: { id: number; input: ElectionInput }) =>
      apiPut<void>(`${ADMIN}/${id}`, { id, input }),
    ({ id }) => id,
  );
}

export function usePublishElection() {
  return useElectionMutation((id: number) => apiPost<void>(`${ADMIN}/${id}/publish`), (id) => id);
}

export function useCancelElection() {
  return useElectionMutation((id: number) => apiPost<void>(`${ADMIN}/${id}/cancel`), (id) => id);
}

export function useDeleteElection() {
  return useElectionMutation((id: number) => apiDelete<void>(`${ADMIN}/${id}`));
}

export function useTallyElection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiPost<TallyOutcome>(`${ADMIN}/${id}/tally`),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: electionKeys.list });
      void qc.invalidateQueries({ queryKey: electionKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: electionKeys.result(id) });
    },
  });
}

// ── voter side ───────────────────────────────────────────────────────────────

/**
 * The elections this person can see, each with the server's verdict on whether they may vote.
 *
 * `staleTime: 0` on purpose. The default 5 s is fine for an admin table, but here a stale
 * `canVote: true` means offering a ballot the server will refuse — and after a cast, a stale
 * `alreadyVoted: false` means offering to vote twice. Always ask.
 */
export function useMyBallots() {
  return useQuery({
    queryKey: electionKeys.myBallots,
    queryFn: () => apiGet<Ballot[]>(`${VOTER}/MyBallots`),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * Cast a ballot.
 *
 * Note what is NOT here: no voter identifier. Identity comes from the token — the API would reject a
 * body field for it, because کد ملی is not secret in Iran and a body field would let anyone vote as
 * anyone whose code they know.
 *
 * `retry: false` is TanStack's default for mutations; it is stated here because on this one endpoint it
 * matters. A retried POST after a network blip whose first attempt actually committed would come back
 * as «شما قبلاً در این انتخابات رأی داده‌اید» and tell the voter their vote failed when it did not.
 */
export function useCastVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vote: { electionId: number; candidateIds: number[] }) =>
      apiPost<CastVoteResult>(`${VOTER}/Cast`, vote),
    retry: false,
    onSuccess: () => {
      // Re-ask the server rather than patching the cache: `alreadyVoted` must come from the receipt
      // table, so a refresh can never resurrect a ballot that was already cast.
      void qc.invalidateQueries({ queryKey: electionKeys.myBallots });
    },
  });
}
