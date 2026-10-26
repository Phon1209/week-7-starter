# FunSwitch mobile app

Expo SDK 58 app with email/password login, a shared device grid, switch and
slider controls, activity history, and live room presence. Firebase and mock
mode use the same frozen `HomeApi` contract.

From the repository root, install dependencies with `npm install`.

## Firebase emulators

Copy `apps/mobile/.env.emulator` to `apps/mobile/.env`. Start and seed the
backend in separate terminals:

```sh
npm run emulators
npm run seed
npm run start -w apps/mobile
```

Requires Java 21+ for Firestore. Demo accounts are `maya@demo.test`,
`sam@demo.test`, and `jas@demo.test`, all with password `password123`.
Use `127.0.0.1` for web/iOS simulators, `10.0.2.2` for an Android emulator,
or your computer's LAN IP for a phone. With no configuration, Firebase mode
uses the demo emulators and chooses the host for the platform.

## Real Firebase

Copy the public Expo settings from the root `.env.example` into
`apps/mobile/.env`, fill in your Firebase web app settings, and set
`EXPO_PUBLIC_USE_EMULATORS=false`. Enable Email/Password authentication and
deploy this repository's Firestore rules and indexes to that project as
described in [the backend README](../../packages/backend/README.md).
Expo reads the app's `.env`; the root `.env` is used by backend CLI checks.
Restart Expo after changing environment variables. Local `.env` files stay
ignored by Git.

## Mock mode

Set `EXPO_PUBLIC_API_MODE=mock` in the app's `.env` and restart Expo. Create
an account on the signup screen. The Dev Simulator supplies a second mock
client for remote changes and presence; it is hidden in Firebase mode.
Mock accounts and device state persist in AsyncStorage.

## Verification

```sh
npm test -w apps/mobile -- --runInBand
npm run typecheck
npm run lint -w apps/mobile
```

Tests cover Firebase initialization/configuration and all 19 shared contract
cases against the mock adapter. `npm test` at the root also runs the Firebase
emulator and contract suites. Run native development builds on a phone and
tablet to check layout, foreground/background presence, and persisted login.
