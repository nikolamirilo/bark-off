# BarkOff

**BarkOff** is a React Native (Expo) app that listens for dog barks and automatically plays calming sounds. It also tracks listening sessions and shows reports/analytics.

## Features

- **Bark detection**: Uses the device microphone with audio metering (dBFS) to detect bark intensity levels.
- **Auto-response**: Plays a selected calming recording per detected level (with a configurable cooldown).
- **Session tracking**: Logs bark events during a listening session.
- **Reports**: Visual breakdown of sessions/events (charts).
- **Customization**: Pet profile, sensitivity, thresholds, cooldown, and per-level sound recordings.

## Tech stack

- **Expo SDK**: 54
- **React Native**: 0.81.5
- **TypeScript**: ~5.9
- **Navigation**: Expo Router (file-based routing)
- **State**: Zustand + AsyncStorage persistence
- **Audio**: `expo-av` / `expo-audio`
- **Charts**: `react-native-chart-kit`

## Project structure

- **Routes**: `app/`
  - Tabs: `app/(tabs)/index.tsx`, `reports.tsx`, `settings.tsx`
  - Listening mode: `app/(tabs)/listening.tsx` (hidden from the tab bar)
  - Session report: `app/session-report/[id].tsx`
- **Bark detection logic**: `services/barkHandler.ts`
- **Audio recording/playback**: `services/audioService.ts`
- **Persisted app state**: `store/appStore.ts`

## Getting started

### Prerequisites

- Node.js + npm
- Expo CLI (recommended via `npx expo ...`)

### Install

```bash
npm install
```

### Run (development)

```bash
npm run start
```

Then open on:
- **Expo Go** (quickest iteration)
- **Android emulator / iOS simulator**
- **Development build** (recommended if you hit Expo Go limitations with audio behavior)

Useful scripts (from `package.json`):

```bash
npm run start
npm run android
npm run ios
npm run web
npm run lint
```

## Permissions & background audio

This app requires microphone access to detect barks:

- **iOS**: `NSMicrophoneUsageDescription` is configured in `app.json`.
- **Android**: requests:
  - `android.permission.RECORD_AUDIO`
  - `android.permission.MODIFY_AUDIO_SETTINGS`

Background audio mode is enabled on iOS (`UIBackgroundModes: ["audio"]`) so listening/playback can continue when appropriate.

## Builds (EAS)

This project includes `eas.json` with `development`, `preview`, and `production` profiles.

### Preview APK (Android)

```bash
eas build -p android --profile preview
```

### Development build (internal distribution)

```bash
eas build --profile development
```

### Production (AAB)

```bash
eas build -p android --profile production
```

## Play Store submissions (Google Service Account)

Submissions use a Google Service Account key. The key is **not** stored in this
repository (`google-service-account.json` is git-ignored), so `eas.json` does not
reference a local path — EAS uses the key uploaded to its servers instead.

Upload the key once per project:

```bash
eas credentials -p android
# -> production -> Google Service Account
#    -> Manage your Google Service Account Key for Play Store Submissions
```

After that, both of these work non-interactively (CI, GitHub-triggered builds,
`--auto-submit`):

```bash
eas submit -p android --profile production
eas build -p android --profile production --auto-submit
```

If you prefer to submit with a local key file instead, pass it on the command
line rather than committing a path into `eas.json`:

```bash
eas submit -p android --profile production \
  --service-account-key-path ./google-service-account.json
```

See https://expo.fyi/creating-google-service-account for how to create the key.

## Troubleshooting

- **Microphone permission denied**: Ensure permission prompts are accepted in the OS settings, then restart the app.
- **No sound plays on detection**: Add recordings in **Settings** first (the bark handler preloads recordings from the persisted store).
- **Weird audio behavior on device**: Prefer an EAS **development build** over Expo Go for more accurate audio/background behavior.
- **Build fails with `File ./google-service-account.json doesn't exist`**: the key is missing on the build machine. Upload it to EAS with `eas credentials -p android` (see [Play Store submissions](#play-store-submissions-google-service-account)) — do not commit the key.

## Reset starter scaffolding (optional)

If you still need it, the original Expo template reset script exists:

```bash
npm run reset-project
```
