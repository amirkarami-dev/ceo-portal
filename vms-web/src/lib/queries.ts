import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, apiPut } from "./api";
import type { CameraDetail, CameraInput, CameraListItem, MediaSession, VmsCity } from "./types";

const ADMIN = "/api/VmsAdmin";

export const cameraKeys = {
  cities: ["vms", "cities"] as const,
  list: (cityCode?: string) => ["vms", "cameras", cityCode ?? "all"] as const,
  one: (id: number) => ["vms", "camera", id] as const,
};

export function useCities() {
  return useQuery({
    queryKey: cameraKeys.cities,
    queryFn: () => apiGet<VmsCity[]>(`${ADMIN}/cities`),

    // Cities change about once a year. Refetching them behind every navigation would be a request
    // per page view for a list of eight rows.
    staleTime: 10 * 60 * 1000,
  });
}

export function useCameras(cityCode?: string) {
  return useQuery({
    queryKey: cameraKeys.list(cityCode),
    queryFn: () => apiGet<CameraListItem[]>(cityCode ? `${ADMIN}?cityCode=${encodeURIComponent(cityCode)}` : ADMIN),
  });
}

export function useCamera(id: number | undefined) {
  return useQuery({
    queryKey: cameraKeys.one(id ?? 0),
    queryFn: () => apiGet<CameraDetail>(`${ADMIN}/${id}`),
    enabled: id !== undefined,
  });
}

/** Everything that changes a camera invalidates every list, because the city filter is a slice of one. */
function useCameraMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vms"] });
    },
  });
}

export const useCreateCamera = () => useCameraMutation((input: CameraInput) => apiPost<number>(ADMIN, input));

export const useUpdateCamera = () =>
  useCameraMutation((v: { id: number; input: CameraInput }) => apiPut(`${ADMIN}/${v.id}`, v.input));

export const useSetCameraActive = () =>
  useCameraMutation((v: { id: number; isActive: boolean }) =>
    apiPost(`${ADMIN}/${v.id}/active`, { isActive: v.isActive }),
  );

export const useDeleteCamera = () => useCameraMutation((id: number) => apiDelete(`${ADMIN}/${id}`));

/**
 * Opens a media session: trades this SPA's bearer token for the cookie the gateway checks.
 *
 * Not a react-query `useQuery`. It has a side effect the cache knows nothing about — a cookie on a
 * different host — and it has to be finished *before* the first tile connects, or every tile races
 * the session and shows a 401 that looks like a broken camera.
 */
export const openMediaSession = () => apiPost<MediaSession>("/api/VmsMedia/session");

export const closeMediaSession = () => apiDelete("/api/VmsMedia/session");
