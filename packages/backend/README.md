# Firebase backend

The Firebase JS SDK adapter implements the frozen `HomeApi` from
`@funswitch/contract`. It accepts Auth and Firestore instances created by the
caller and has no React Native dependencies.

```ts
import { createFirebaseApi } from '@funswitch/backend';

const api = createFirebaseApi({ auth, db });
```

The app initializes Firebase from its `EXPO_PUBLIC_FIREBASE_*` variables and
connects those instances to emulators when `EXPO_PUBLIC_USE_EMULATORS=true`.
React Native clients whose listeners stall should create Firestore with
`initializeFirestore(app, { experimentalForceLongPolling: true })`. The adapter
accepts any initialized `Firestore` instance; Auth persistence belongs to the
app as well.

## Local setup

Requires Node.js 22.13+ and Java 21+.

The root package applies scoped overrides for patched gRPC, OpenTelemetry,
and UUID dependencies pinned by Firebase's SDK and CLI.

Run these commands from the repository root:

```sh
npm install
npm run emulators
```

The project is `demo-funswitch`: Auth uses port 9099, Firestore uses 8080, and the
emulator UI uses 4000. Auth and Firestore bind to `0.0.0.0` for phone access.
Hosting is not configured.

In another terminal:

```sh
npm run seed
```

On a fresh emulator this creates three users, six devices covering every type,
and 16 activity events (six adds and ten flips). Password: `password123`.
Users: `maya@demo.test`, `sam@demo.test`, and `jas@demo.test`. The light named
`Flip Room` starts with two seeded flips. Rerunning the seed preserves existing
devices and skips flips already counted.

## Tests

```sh
npm run test -w packages/backend
npm run test -w packages/backend -- devices
npm run typecheck
```

The test wrapper starts Auth and Firestore, forwards filters to Vitest, and
stops the emulators afterwards. Tests run serially because fixtures reset their
shared database and Auth accounts. Stop manually running emulators before
using this command. All mutation tests are restricted to `demo-funswitch` and
never load the production `.env` file.

`@funswitch/backend/node` exports `initForNode(config, emulatorHost?)`. This
helper creates independent app instances with in-memory Auth persistence,
connects both services to emulators, and rejects any project other than
`demo-funswitch`.

## Act as another demo user

With the emulators running and seeded:

```sh
npm run actAs -w packages/backend -- \
  --email sam@demo.test --password password123 \
  --device "Flip Room" --action on --delay 3000
```

Actions are `on`, `off`, `level:60`, `join`, `leave`, and `remove`. `--delay`
waits that many milliseconds before the action. Names must match exactly one
device. Invalid controls and levels are rejected by the adapter.

`join` writes one presence entry and exits, with heartbeat disabled. It remains
visible until the default 45-second TTL expires or a separate `leave` command
deletes the entry. This supports short emulator E2E scenarios; ongoing app
sessions use the adapter's normal heartbeat. These scripts always target the
demo project. Use `FUNSWITCH_EMULATOR_HOST` to select another emulator hostname
without a scheme or port; the default is `127.0.0.1`.

## Firebase configuration and live check

The repository's `.env.example` contains the Expo variables:

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase web app API key |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth domain |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Project ID |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Web app storage bucket setting |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Web app sender ID |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase web app ID |
| `EXPO_PUBLIC_API_MODE` | `firebase` or the future UI's `mock` adapter |
| `EXPO_PUBLIC_USE_EMULATORS` | `true` for the local demo services |
| `EXPO_PUBLIC_EMULATOR_HOST` | Host reachable from the app's device |

For phones use your computer's LAN IP; for the Android emulator use `10.0.2.2`;
for the iOS simulator use `127.0.0.1`. The app will need its configuration in
`.env`. A real project must have Email/Password sign-in enabled.

Your existing root `.env` can be checked now:

```sh
npm run check:firebase
```

This command reads Auth configuration and at most one device document. It
creates no accounts or Firestore documents and prints no configuration secrets
or device contents. Without a user it checks unauthenticated access. Optional
local `FIREBASE_CHECK_EMAIL` and `FIREBASE_CHECK_PASSWORD` values allow it to sign
in an existing user for the read check. These values are separate from Expo
public variables and must remain in the ignored `.env` file.

## Rules, data, and deployment

`users/{uid}` stores email and creation time; `devices/{id}` stores device
state; `activity/{id}` stores immutable events; and
`presence/{deviceId}/viewers/{uid}` stores each viewer's email and last-seen
server timestamp. Public API timestamps are epoch milliseconds.

Device adds use one batch. Flips use transactions with an atomic increment;
removal also uses a transaction to prevent duplicate removal events during
concurrent deletes. Each successful mutation creates one event atomically.
Repeated values still count as flips, as required by the contract.

`subscribeOne` includes Firestore metadata changes. Its pending flag combines
`snapshot.metadata.hasPendingWrites` with this adapter's in-flight transactions,
because Firebase transactions bypass the local write queue. The cache flag
comes from Firestore metadata. Unsubscribing removes listeners and local
transaction notifications.

Presence uses a 15-second heartbeat and 45-second TTL by default. Joins by the
same client/user/device share a document and heartbeat; the final leave deletes
the entry. Heartbeats are serialized with leaving, and adapter sign-out removes
active presence before signing out. A terminal heartbeat failure falls back to
TTL expiry. Presence subscriptions re-filter their cache every TTL/3 and emit
only changed lists.

Device listeners expose errors through the contract's optional callback.
Activity and presence have no error callback in the frozen contract; a terminal
listener error clears their lists. Callers must unsubscribe before changing
users and create one adapter per client session.

Rules require sign-in, validate device shapes and actor identity, restrict
profile/presence writes to their owner, and keep activity immutable. The
`activity` query uses the included `deviceId ASC, at DESC` composite index.

After reviewing the rules, deploy them explicitly to your real project:

```sh
npx firebase login
npx firebase deploy --only firestore --project YOUR_FIREBASE_PROJECT_ID
```

`.firebaserc` keeps `demo-funswitch` as the local default. The CLI does not read
`EXPO_PUBLIC_FIREBASE_PROJECT_ID`; specify the real project when deploying.
