import { App } from "antd";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { errorMessage } from "@/api/client";
import { type QueryKey } from "./keys";

export interface CrudLabels {
  created?: string;
  updated?: string;
  removed?: string;
}

const DEFAULT_LABELS: Required<CrudLabels> = {
  created: "با موفقیت افزوده شد",
  updated: "با موفقیت ذخیره شد",
  removed: "با موفقیت حذف شد",
};

/** The four functions a flat-list resource exposes on its `*Api` module. */
export interface CrudResource<TDto, TInput, TId = number, TCreateResult = number> {
  /** Invalidation prefix — pass `queryKeys.<resource>.all()`. */
  key: QueryKey;
  list: () => Promise<TDto[]>;
  create: (input: TInput) => Promise<TCreateResult>;
  update: (id: TId, input: TInput) => Promise<void>;
  remove: (id: TId) => Promise<void>;
  labels?: CrudLabels;
  /** Extra prefixes to invalidate after a mutation. */
  alsoInvalidate?: QueryKey[];
  enabled?: boolean;
}

export interface UpdateVars<TInput, TId = number> {
  id: TId;
  input: TInput;
}

export interface UseCrudResult<TDto, TInput, TId = number, TCreateResult = number> {
  items: TDto[];
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
  query: UseQueryResult<TDto[], Error>;
  create: UseMutationResult<TCreateResult, Error, TInput>;
  update: UseMutationResult<void, Error, UpdateVars<TInput, TId>>;
  remove: UseMutationResult<void, Error, TId>;
  /** create or update in flight — bind to the FormDrawer's `submitting`. */
  saving: boolean;
  /** remove in flight. */
  deleting: boolean;
}

/**
 * List + create + update + remove for one flat-list resource, with cache invalidation and
 * success/error toasts wired in. Mutations REJECT on failure (so a `FormDrawer` can still
 * map ValidationProblemDetails onto its fields) — the toast is fired on top of that.
 */
export function useCrud<TDto, TInput, TId = number, TCreateResult = number>(
  resource: CrudResource<TDto, TInput, TId, TCreateResult>,
): UseCrudResult<TDto, TInput, TId, TCreateResult> {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const labels = { ...DEFAULT_LABELS, ...resource.labels };

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: resource.key });
    for (const key of resource.alsoInvalidate ?? []) {
      void qc.invalidateQueries({ queryKey: key });
    }
  };

  const query = useQuery<TDto[], Error>({
    queryKey: resource.key,
    queryFn: () => resource.list(),
    enabled: resource.enabled ?? true,
  });

  const create = useMutation<TCreateResult, Error, TInput>({
    mutationFn: (input) => resource.create(input),
    onSuccess: () => {
      invalidate();
      message.success(labels.created);
    },
    onError: (err) => message.error(errorMessage(err)),
  });

  const update = useMutation<void, Error, UpdateVars<TInput, TId>>({
    mutationFn: ({ id, input }) => resource.update(id, input),
    onSuccess: () => {
      invalidate();
      message.success(labels.updated);
    },
    onError: (err) => message.error(errorMessage(err)),
  });

  const remove = useMutation<void, Error, TId>({
    mutationFn: (id) => resource.remove(id),
    onSuccess: () => {
      invalidate();
      message.success(labels.removed);
    },
    onError: (err) => message.error(errorMessage(err)),
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: () => void query.refetch(),
    query,
    create,
    update,
    remove,
    saving: create.isPending || update.isPending,
    deleting: remove.isPending,
  };
}

/** Read-only query for shapes `useCrud` does not cover (paged lists…). */
export function useApiQuery<TData>(
  key: QueryKey,
  fn: () => Promise<TData>,
  options?: { enabled?: boolean; staleTime?: number; placeholderData?: TData },
): UseQueryResult<TData, Error> {
  const queryOptions: UseQueryOptions<TData, Error, TData> = {
    queryKey: key,
    queryFn: fn,
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime,
  };

  // Keep the previous page's data on screen while the next loads (paged tables). TanStack guards
  // placeholderData with NonFunctionGuard<TData>, which an unconstrained TData can't satisfy, so we
  // cast to the option's own type — the runtime value is the correct placeholder either way.
  if (options?.placeholderData !== undefined) {
    const value = options.placeholderData;
    queryOptions.placeholderData = (() => value) as UseQueryOptions<TData, Error, TData>["placeholderData"];
  }

  return useQuery(queryOptions);
}

export interface ApiMutationOptions<TVars, TData> {
  mutationFn: (vars: TVars) => Promise<TData>;
  /** Prefixes to invalidate on success. */
  invalidate?: QueryKey[];
  /** Toast on success. Pass `null` to stay silent. */
  success?: string | null;
  /** Overrides the message derived from the thrown ApiError. */
  error?: string;
  onSuccess?: (data: TData, vars: TVars) => void;
}

/** One-off mutation (reset password / delete / composite save …) with the same toast behaviour. */
export function useApiMutation<TVars, TData = void>(
  options: ApiMutationOptions<TVars, TData>,
): UseMutationResult<TData, Error, TVars> {
  const qc = useQueryClient();
  const { message } = App.useApp();

  return useMutation<TData, Error, TVars>({
    mutationFn: (vars) => options.mutationFn(vars),
    onSuccess: (data, vars) => {
      for (const key of options.invalidate ?? []) {
        void qc.invalidateQueries({ queryKey: key });
      }
      if (options.success !== null) message.success(options.success ?? DEFAULT_LABELS.updated);
      options.onSuccess?.(data, vars);
    },
    onError: (err) => message.error(options.error ?? errorMessage(err)),
  });
}
