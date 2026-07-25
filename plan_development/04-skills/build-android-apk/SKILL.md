---
name: build-android-apk
description: Use when producing an Android release APK from an Expo (React Native) app in an npm-workspaces monorepo — either locally via expo prebuild + Gradle assembleRelease, or in the cloud via EAS. Covers the required fixes (New Architecture ON, Metro project root pinned, React dedup, local index.js entry), SDK/NDK/JDK prerequisites, single-ABI build, and verifying the install via adb + logcat crash buffer.
---

# Build an Android Release APK (Expo, monorepo)

Two paths: **local Gradle** (no Expo account, full control, debug-signed release for internal testing) and
**EAS cloud** (managed signing, app-bundle for the Play Store). The monorepo-specific fixes below must be
in place either way, otherwise the **release** JS bundle fails to resolve its entry even though `expo start`
works. Replace `<scope>/<pkg>` and `<package.id>` (e.g. `ir.myceo.mabhas19`).

## Prerequisites (local build)

- **Android SDK** (platform-tools + a build platform), with `ANDROID_HOME` / `ANDROID_SDK_ROOT` set and
  `platform-tools` on `PATH` (gives you `adb`).
- **Android NDK 27.1.12297006** (the version Expo SDK 54 / RN 0.81 expects — install via SDK Manager).
- **JDK 17** (`JAVA_HOME` pointing at it; Gradle for RN 0.81 requires 17).
- Node ≥ 20.9 and a clean `npm install` at the repo root (workspaces hoisted).

```powershell
adb --version          # platform-tools present
java -version          # 17.x
$env:ANDROID_HOME      # set
```

## Required monorepo fixes (must be present before building)

These four are what make the **release** bundle work in an npm-workspaces monorepo (see
`setup-monorepo-shared-package` for the full rationale):

1. **New Architecture ON** — `"newArchEnabled": true` in `mobile/app.json` (`expo` block).
2. **Metro project root pinned to `mobile/`** — `EXPO_NO_METRO_WORKSPACE_ROOT=1` in `mobile/.env` and in
   each `mobile/eas.json` profile's `env`.
3. **React dedup in `mobile/metro.config.js`** — `watchFolders` + `nodeModulesPaths` + the
   `resolveRequest` that forces a single `react`/`react-native` (origin redirected to the app dir).
4. **Local `index.js` entry** — `mobile/index.js` is `import "expo-router/entry";` and
   `mobile/package.json` has `"main": "index.js"` (not `expo-router/entry` directly).

## Workflow — Option A: local Gradle release APK

### 1. Generate the native Android project

`prebuild` materializes `mobile/android/` from `app.json` (applies config plugins, New Architecture, package id).

```powershell
cd mobile
npx expo prebuild --platform android         # add --clean to regenerate from scratch
```

### 2. Assemble the release APK

Build a **single ABI** to keep it small/fast (arm64 covers modern devices). The default `release` build
type is **debug-signed** here — fine for internal/`adb` install, not for Play Store upload.

```powershell
cd mobile/android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Output: `mobile/android/app/build/outputs/apk/release/app-release.apk`.

> If the JS bundle step fails to resolve the entry, re-check the four monorepo fixes above — that's almost
> always the cause in a hoisted workspace (the bundler otherwise picks the workspace root as the project
> root). `npx expo prebuild --clean` after fixing them.

### 3. Install on a device/emulator

```powershell
adb install -r mobile/android/app/build/outputs/apk/release/app-release.apk
```

## Workflow — Option B: EAS cloud build

Uses `mobile/eas.json` profiles. `preview` → internal **APK**; `production` → **app-bundle** (.aab) for the
Play Store. Both profiles already carry `EXPO_NO_METRO_WORKSPACE_ROOT=1` and the runtime API base.

```powershell
cd mobile
npx eas-cli build --platform android --profile preview        # internal APK, managed signing
# or for a store-ready bundle:
npx eas-cli build --platform android --profile production     # .aab
```

`eas.json` (already configured) for reference:

```jsonc
"preview":    { "distribution": "internal", "android": { "buildType": "apk" },
                "env": { "EXPO_PUBLIC_API_BASE": "https://<api-host>", "EXPO_NO_METRO_WORKSPACE_ROOT": "1" } },
"production": { "android": { "buildType": "app-bundle" },
                "env": { "EXPO_PUBLIC_API_BASE": "https://<api-host>", "EXPO_NO_METRO_WORKSPACE_ROOT": "1" } }
```

When the build finishes, EAS prints a download URL; `adb install -r <downloaded.apk>` to test the `preview`
build on a device.

## Verification

```powershell
# 1. It installs cleanly
adb install -r mobile/android/app/build/outputs/apk/release/app-release.apk

# 2. Launch it
adb shell monkey -p <package.id> -c android.intent.category.LAUNCHER 1

# 3. Confirm it didn't crash on startup — inspect the crash buffer
adb logcat -b crash -d            # empty = no native/JS crash recorded
adb logcat -d | Select-String -Pattern "<package.id>","ReactNative","FATAL"
```

- A blank/empty `-b crash` buffer plus the app reaching its first screen confirms the release bundle
  resolved its entry and React is not duplicated (a duplicate React would crash immediately on the first
  hook with *"Cannot read property 'useEffect' of null"*).
- For EAS: the build status page must show **finished**, and the downloaded artifact must install + launch
  the same way.
