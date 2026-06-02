# Alfredo Android Internal Build

Alfredo Android v1 is a Capacitor wrapper around the deployed Next.js dashboard.

## Configuration

Set the deployed dashboard URL before syncing:

```bash
export NEXT_PUBLIC_APP_URL=https://your-alfredo-domain.example
export NEXT_PUBLIC_ANDROID_APP_ID=com.alfredo.devops
```

For push notifications, create a Firebase Android app with package ID `com.alfredo.devops`, then place the generated file at:

```text
android/app/google-services.json
```

The file is ignored by git.

## Sync

```bash
npm run android:sync
```

## Internal APK

Open `android/` in Android Studio and run a debug build, or use Gradle when Android SDK is installed:

```bash
cd android
./gradlew assembleDebug
```

The debug APK is written under `android/app/build/outputs/apk/debug/`.
