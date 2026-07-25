import { EmptyState } from "@/components/ui";

export function PagePlaceholder({ name }: { name: string }) {
  return <EmptyState description={name} />;
}
