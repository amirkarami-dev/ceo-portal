import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/api/client";

/**
 * Shared QueryClient. Auth/permission failures are never retried (they will not
 * fix themselves), everything else gets one retry.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Auth, not-found, and validation failures never fix themselves on a retry.
        if (error instanceof ApiError &&
            (error.isUnauthorized || error.status === 404 || error.isValidation)) return false;
        return failureCount < 1;
      },
    },
    mutations: { retry: 0 },
  },
});
