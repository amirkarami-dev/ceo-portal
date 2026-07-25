// Metro config for the npm-workspaces monorepo. Copy to mobile/metro.config.js.
// No <PLACEHOLDER> tokens to replace — this file is project-agnostic.
//
// It lets Metro resolve the shared @<SCOPE>/<CORE_PACKAGE> package that lives in ../packages,
// while FORCING a single copy of react / react-native (the app's) to avoid the classic
// "Invalid hook call" from duplicate React in a hoisted monorepo.
const { getDefaultConfig } = require("expo/metro-config")
const path = require("path")

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, "..")

const config = getDefaultConfig(projectRoot)

// 1. Watch the whole monorepo (keep Metro's defaults too).
config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), workspaceRoot]))

// 2. Resolve modules from both the app and the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
]

// 3. Pin react / react-native to the app's copy (fallback resolution).
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
}

// 4. Force a SINGLE copy of react / react-native for EVERY import in the bundle.
//    extraNodeModules alone doesn't dedupe when a hoisted package resolves its own
//    react from the workspace root — that yields two Reacts and a null hook
//    dispatcher ("Cannot read property 'useEffect' of null"). Redirecting the
//    resolution origin to the app dir guarantees mobile/node_modules/react wins.
const forcedRoots = ["react", "react-native"]
const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const pkg = moduleName.split("/")[0]
  const ctx = forcedRoots.includes(pkg)
    ? { ...context, originModulePath: path.join(projectRoot, "index.js") }
    : context
  return (defaultResolveRequest ?? ctx.resolveRequest)(ctx, moduleName, platform)
}

module.exports = config
