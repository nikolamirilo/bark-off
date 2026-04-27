# BarkOff App Specifications

## 1. Overview

**BarkOff** is a React Native mobile application designed to detect dog barks and play calming sounds. Built with Expo, it leverages device microphone capabilities to monitor noise levels and respond with pre-recorded or custom audio to soothe pets. The app also tracks barking sessions and provides detailed reports.

## 2. Technology Stack

### Core

- **Framework**: React Native (0.81.5) via Expo (SDK 54)
- **Language**: TypeScript (~5.9.2)
- **Web Engine**: React 19 / React DOM 19
- **Bundler/Router**: Expo Router (v6)

### State Management & Storage

- **State**: Zustand (`^5.0.3`)
- **Persistence**: @react-native-async-storage/async-storage (`^2.1.2`)

### Audio & Video

- **Audio Playback/Recording**:
  - `expo-av` (~16.0.8)
  - `expo-audio` (~1.1.1)
- **Video**: `expo-video` (~3.0.15)
- **Assets**: `expo-asset` (~12.0.12)

### UI & Animations

- **Icons**: @expo/vector-icons
- **Animations**:
  - `react-native-reanimated` (~4.1.1)
  - `lottie-react-native` (^7.1.0)
- **Charts**: `react-native-chart-kit` (^6.12.0)
- **Gesture Handling**: `react-native-gesture-handler` (~2.28.0)
- **SVG**: `react-native-svg` (15.12.1)
- **Safe Area**: `react-native-safe-area-context`

## 3. Architecture & Navigation

### Entry Point

- **Main Entry**: `expo-router/entry`
- **Root Layout**: `app/_layout.tsx`

### Navigation Structure (Expo Router)

The app uses a Tab-based navigation layout located in `app/(tabs)`:

1.  **Home** (`index.tsx`): Dashboard/Landing screen.
2.  **Explore** (`explore.tsx`): Library of sounds or community features.
3.  **Listening** (`listening.tsx`): Active monitoring mode interface.
4.  **Reports** (`reports.tsx`): Statistical breakdown of barking sessions (using Charts).
5.  **Settings** (`settings.tsx`): Configuration for sensitivity, sounds, and app preferences.

### Additional Screens

- **Modal**: `app/modal.tsx` (Likely for quick actions or details).
- **Session Details**: `app/session-report/` (Drill-down views for specific reports).

## 4. Key Features

### 🎧 Bark Detection & Response

- **Microphone Access**: Uses `expo-av` and `expo-audio` to listen to ambient noise.
- **Auto-Play**: Trigger calming sounds when bark threshold is exceeded.
- **Background Operation**: Configured for background audio execution (iOS `UIBackgroundModes: ["audio"]`).

### 📊 Reporting & Analytics

- Visualizes data using `react-native-chart-kit`.
- Tracks frequency and duration of barking events.

### ⚙️ Customization

- **Sound Library**: Manage and select calming tracks.
- **Sensitivity Control**: Adjustable thresholds for bark detection.

## 5. Configuration & Permissions

### Permissions (app.json)

- **iOS**:
  - `NSMicrophoneUsageDescription`: "BarkOff needs microphone access to listen for your dog's barks and play calming sounds."
  - Background Mode: Audio.
- **Android**:
  - `android.permission.RECORD_AUDIO`
  - `android.permission.MODIFY_AUDIO_SETTINGS`
  - Package: `com.reactifysolutions.bark-off`

### Theme

- **Colors**: Primary brand color `#FF8C42` (Orange/Amber tone).
- **Orientation**: Portrait locked.
- **New Architecture**: Enabled (`newArchEnabled: true`).
