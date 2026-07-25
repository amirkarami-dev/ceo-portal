import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TenantState {
  currentTenantId: string | null;
  setCurrentTenant: (id: string) => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      currentTenantId: null,
      setCurrentTenant: (currentTenantId) => set({ currentTenantId }),
    }),
    { name: "report.currentTenantId" },
  ),
);
