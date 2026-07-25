import { useQuery } from "@tanstack/react-query";

export interface PromptTemplate {
  id: string;
  name: string;
  activeVersion: string;
  versions: { version: string; createdAt: string; note: string; active: boolean }[];
}

const SEED: PromptTemplate[] = [
  {
    id: "report-gen",
    name: "report-gen",
    activeVersion: "report-gen@3",
    versions: [
      { version: "report-gen@3", createdAt: "2026-06-01T08:00:00Z", note: "Added drill-down hints", active: true },
      { version: "report-gen@2", createdAt: "2026-05-12T08:00:00Z", note: "Persian field-synonym mapping", active: false },
      { version: "report-gen@1", createdAt: "2026-04-02T08:00:00Z", note: "Initial template", active: false },
    ],
  },
];

export function usePromptVersions() {
  return useQuery({ queryKey: ["admin", "promptVersions"], queryFn: async () => SEED, initialData: SEED });
}
