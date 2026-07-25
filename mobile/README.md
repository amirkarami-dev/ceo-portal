# Mabhas19 Mobile (Expo / React Native)

The fa-IR (RTL) mobile client for the Section 19 building-energy assessment. Talks
to the same .NET API as the web app and reuses the shared `@mabhas19/assessment-core`
scoring engine. Default API base: `https://api.mabhas19.myceo.ir` (override with
`EXPO_PUBLIC_API_BASE`).

## Develop

```bash
npm install            # from the repo root (npm workspaces)
cd mobile
npm run start          # Metro dev server (Expo Go / dev client)
npm run android        # run on a device/emulator
npm run typecheck
```

## Build a release APK (local)

Prerequisites: Android SDK + NDK `27.1.12297006`, a JDK 17 toolchain.

```bash
cd mobile
npx expo prebuild --platform android        # if android/ is missing (it is gitignored)
cd android
ANDROID_HOME=<your-sdk> ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
# → app/build/outputs/apk/release/app-release.apk  (debug-signed, installable)
```

The release build is debug-signed (no keystore needed) and installs on any
arm64-v8a device.

## Build via EAS (cloud)

```bash
npx eas-cli login
npx eas-cli build -p android --profile preview   # downloadable APK
```

## Monorepo notes (important)

This app lives in an npm-workspaces monorepo and several gotchas are already
handled in config — don't undo them:

- **`EXPO_NO_METRO_WORKSPACE_ROOT=1`** (in `.env` and `eas.json`): `react` is hoisted
  to the repo root, so Metro must keep the project root at `mobile/` or the release
  bundle can't resolve the entry. `metro.config.js` covers the hoisted deps via
  `nodeModulesPaths`/`watchFolders`.
- **React dedup** (`metro.config.js` `resolveRequest`): forces every `react` /
  `react-native` import to `mobile/node_modules`, avoiding a second React (web uses
  a newer React) which crashes with `Cannot read property 'useEffect' of null`.
- **New Architecture** must stay enabled (`app.json` `newArchEnabled: true`) — the
  RN 0.81 / Expo SDK 54 native libraries require it.
- **`index.js`** is the entry (`package.json` `"main"`), re-exporting `expo-router/entry`.
