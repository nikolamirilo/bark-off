# Expo + EAS Commands Cheat Sheet

## 🔧 Setup

Install EAS CLI
`npm install -g eas-cli`

Login
`eas login`

Initialize EAS in project
`eas init`

---

## 🚀 Development

Install dev client
`npx expo install expo-dev-client`

Start dev server (for development build)
`npx expo start --dev-client`

Start normal Expo (Expo Go)
`npx expo start`

---

## 📱 Builds

### Android

Preview Android Build (APK)
`eas build -p android --profile preview`

Development Android Build (Dev Client APK)
`eas build -p android --profile development`

Production Android Build (AAB for Play Store)
`eas build -p android --profile production`

---

### iOS

Preview iOS Build
`eas build -p ios --profile preview`

Development iOS Build
`eas build -p ios --profile development`

Production iOS Build
`eas build -p ios --profile production`

---

## 📦 Install / Run Builds

Open latest build
`eas build:list`

Open specific build
`eas build:view`

---

## 🔄 Updates (OTA)

Publish update
`eas update --branch production --message "update message"`

Publish to preview
`eas update --branch preview --message "update message"`

---

## 🌿 Branches (for OTA)

Create branch
`eas branch:create`

List branches
`eas branch:list`

---

## 🔐 Credentials

Configure credentials
`eas credentials`

Upload/manage the Google Service Account key used for Play Store submissions
`eas credentials -p android` → `production` → `Google Service Account`

> The key file is git-ignored and is **not** referenced from `eas.json`.
> Upload it to EAS once so builds/submissions run non-interactively.

---

## 📤 Submit to stores

Submit the latest Android build (internal track)
`eas submit -p android --profile production`

Build and submit in one go
`eas build -p android --profile production --auto-submit`

Submit with a local key file (instead of the EAS-hosted one)
`eas submit -p android --profile production --service-account-key-path ./google-service-account.json`

---

## 🤖 CI / GitHub

Trigger build (CI-friendly)
`eas build --non-interactive`

---

## 🧹 Maintenance

Clear cache build
`eas build --clear-cache`

---

## ⚙️ Useful Expo Commands

Prebuild (generate native code if needed)
`npx expo prebuild`

Run on Android locally
`npx expo run:android`

Run on iOS locally
`npx expo run:ios`

---

## 🧪 Debugging

Start with tunnel (if network issues)
`npx expo start --tunnel`

Clear Metro cache
`npx expo start -c`
