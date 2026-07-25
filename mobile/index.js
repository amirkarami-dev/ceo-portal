// App entry point. Using a local entry file (instead of pointing package.json
// "main" straight at "expo-router/entry") keeps Metro's module resolution
// correct in this npm-workspaces monorepo, where expo-router is hoisted to the
// root node_modules. Without this, the gradle release bundle resolves the entry
// relative to the workspace root and fails.
import "expo-router/entry";
