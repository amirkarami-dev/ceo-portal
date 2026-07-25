// Design-system primitives now live in the shared @mabhas19/ui workspace package.
// Re-exporting here keeps all existing `@/components/ui` import paths working
// without any churn in the consuming pages/components.
export * from "@mabhas19/ui"
