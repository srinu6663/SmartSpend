# Android build — SMS auto-import

This Android wrapper exists for one reason: **there is no web API for the SMS
inbox.** `WebOTP` reads a single specially-formatted OTP with a user tap and
nothing else, so automatic bank-alert import needs a native app with `READ_SMS`.

> **This build cannot go on Google Play.** Play restricts `READ_SMS` to apps whose
> core function is SMS handling (default SMS app, backup apps). A finance app
> requesting it gets rejected. Sideloading onto your own device is fine, which is
> the intended use.

## One-time toolchain setup

None of this is installed on the machine the code was written on, so it has never
been compiled — expect to fix small environment issues on the first run.

1. **JDK 21** (Capacitor 6 requires 17+; Android Gradle Plugin 8.x prefers 21)
   — [Temurin](https://adoptium.net/) or `winget install EclipseAdoptium.Temurin.21.JDK`
2. **Android Studio** — [developer.android.com/studio](https://developer.android.com/studio).
   During setup install the **Android SDK Platform 34** and **Platform-Tools**.
3. Set the environment variables:
   - `JAVA_HOME` → the JDK folder
   - `ANDROID_HOME` → usually `%LOCALAPPDATA%\Android\Sdk`
   - add `%ANDROID_HOME%\platform-tools` to `PATH` (gives you `adb`)

Verify:

```bash
java -version && adb version
```

## Build and install

Every time you change web code, the built assets must be re-copied into the
native project — `cap sync` does that:

```bash
npm run android:sync
```

Then either open the project in Android Studio and press Run:

```bash
npm run android:open
```

…or build and install a debug APK from the CLI with a phone connected over USB
(with USB debugging enabled):

```bash
cd android && ./gradlew installDebug
```

The APK lands at `android/app/build/outputs/apk/debug/app-debug.apk` if you want
to copy it across manually.

## Granting SMS access

The permission is **not** requested at launch. Open **Profile → Auto-import from
SMS** and turn it on; Android then shows the system prompt. Deny it and the
feature stays off — nothing else in the app is affected.

If you deny it and later change your mind, Android may stop showing the prompt.
Re-enable it under *Settings → Apps → Finly → Permissions → SMS*.

## How import behaves

| Confidence | Behaviour |
| --- | --- |
| ≥ 0.7 | Transaction created automatically |
| < 0.7 | Queued under **Needs review** in Profile for one-tap approval |
| rejected | Discarded — OTPs, promos, reminders, failed/reversed payments, balance replies |

Parsing runs entirely on-device (`src/lib/smsParser.ts`). Nothing is uploaded
unless a message is identified as a real transaction — the raw body of a
non-transaction SMS never leaves the phone.

Duplicates are prevented in the database, not in app memory: a
`UNIQUE (user_id, fingerprint)` constraint on `message_imports` means a re-scan,
a replayed broadcast or a reinstall is a no-op. Apply
`supabase/migrations/0003_message_imports.sql` before enabling the feature.

## Wallet matching

An imported transaction is assigned to a wallet by matching the masked account
tail from the SMS against your wallet **names**. Name a wallet `HDFC 1234` and
alerts for `a/c XX1234` land in it automatically. Without a match it falls back to
your first wallet (or a credit-type wallet for card alerts), so check the wallet
on early imports.
