# FunSwitch

Shared workspace for the Firebase backend and Expo mobile app described in
[the plan](docs/Plan.md). The Firebase backend and Expo mobile UI are integrated
through the shared API contract.

Requires Node.js 22.13 or newer, npm, and Java 21+ for the Firestore emulator.

```sh
npm install
npm test
npm run typecheck
```

The workspace uses `packages/*` and `apps/*`. `packages/contract` exports the
platform-independent API, types, validation and formatting helpers.
`packages/backend` implements the Firebase adapter; `apps/mobile` contains
the Expo app. See [the mobile README](apps/mobile/README.md) for Firebase and
mock mode setup.

Start the local backend and seed it from another terminal:

```sh
npm run emulators
npm run seed
```

See [the backend README](packages/backend/README.md) for emulator tests, demo
accounts, the `actAs` CLI, adapter integration, and rules deployment.

Import production helpers from `@funswitch/contract`; import the reusable
19-case test suite from `@funswitch/contract/conformance`. Production imports
do not load the test suite or a test framework.

## Adapter conformance

Both clients supplied by the factory must share one backend and use isolated
auth sessions. `reset()` clears all users, devices, events and presence; it runs
before and after each case. The factory may be asynchronous, and may return
an optional `dispose()` to release resources after each test.

```ts
import { runHomeApiConformance } from '@funswitch/contract/conformance';

runHomeApiConformance('firebase', async (opts) => {
  // Create two independent Firebase apps connected to demo-funswitch emulators.
  return { clientA, clientB, reset, dispose };
});
```

Enable `globals: true` in Vitest; Jest supplies globals by default. The suite
uses shared matchers and no test framework imports. For a mock with zero write
latency, return `latencyMs: 0` to omit the pending-write assertion. The suite
uses real timers, including presence TTL expiry; consumers using fake timers
must advance them while promises are pending. All 19 cases pass against the
Firebase adapter and the mobile mock adapter.

## Firebase configuration

[.env.example](.env.example) lists all Expo Firebase variables and emulator host
examples. Copy it to `apps/mobile/.env`. Defaults
target `demo-funswitch` emulators. For a real project, replace the web app
configuration and set `EXPO_PUBLIC_USE_EMULATORS=false`. These variables will
be read by the app. The backend accepts initialized Auth and Firestore
instances from that app.

To make a read-only check using your existing root `.env`, run
`npm run check:firebase`. It checks Auth configuration and attempts to read at
most one device document. Optional `FIREBASE_CHECK_EMAIL` and
`FIREBASE_CHECK_PASSWORD` values enable an existing-user read check. Emulator
tests and seed scripts always target `demo-funswitch`.

Local `.env` files are ignored by Git. Use `localhost` for an iOS simulator,
`10.0.2.2` for an Android emulator, and your computer's LAN IP for a phone.

## Contract freeze

The Phase 0 commit establishes the contract. Subsequent backend and UI work
must treat `packages/contract` as read-only and record proposed changes in
[CONTRACT_CHANGES.md](CONTRACT_CHANGES.md) before modifying the contract.
