# FunSwitch: Smart Home Controller Mock App Plan (v3, Expo SDK 58)

This plan is meant to be handed to two separate coding agents:

- a **Server agent**, which follows Part A
- a **UI agent**, which follows Part B

Their work is joined in Part C. Phase 0 runs once, before the split.

---

## 0. Overview and assumptions

FunSwitch is a mock smart home controller built as an **Expo SDK 58 React Native app** (React Native 0.88, React 19.2, Node 22.13 or newer). Users sign in with email and password, see a flat grid of devices, and control each one with an on/off switch or a 0–100 slider. All state lives in Firebase (Auth and Firestore), and every client updates in real time.

**There is no real hardware.** A device is only a Firestore document, and "turning it on" means changing a field. No code may assume a physical device is listening.

**Assumptions**

1. **One shared home.** Every signed-in user sees and controls the same devices.
2. **Email is the user's name.** There are no display names anywhere. Avatars show the first letter of the email.
3. **Firestore is the database.** Its `onSnapshot` listeners provide the real-time updates. The app uses the Firebase **JS SDK**, not `@react-native-firebase`, so the same adapter code runs in the Node tests and in the app.
4. **The app runs as a development build** (`npx expo run:ios` / `run:android`), not Expo Go, because Expo Go's SDK 58 release is still rolling out.
5. **Each device type maps to one control.**

| Type    | Control | Headline noun |
| ------- | ------- | ------------- |
| light   | switch  | "Lights"      |
| plug    | switch  | "Plug"        |
| dimmer  | slider  | "Dimmer"      |
| fan     | slider  | "Fan"         |
| blinds  | slider  | "Blinds"      |
| speaker | slider  | "Volume"      |

**Tooling**

| Area             | Tools                                             |
| ---------------- | ------------------------------------------------- |
| Language         | TypeScript (strict)                               |
| App              | Expo SDK 58, Expo Router                          |
| Backend tests    | Vitest                                            |
| App tests        | Jest (`jest-expo`) + React Native Testing Library |
| End-to-end tests | Maestro                                           |
| Local backend    | Firebase Emulator Suite                           |
| Release builds   | EAS Build                                         |

### Integration strategy

Both agents depend on one shared contract package, `packages/contract`. It contains the TypeScript types, the `HomeApi` interface and a conformance test suite.

- **Phase 0:** the contract is built once and frozen.
- **Server agent:** implements `HomeApi` on Firebase.
- **UI agent:** builds against an in-memory mock of the same interface.
- **Integration:** swaps the mock for the Firebase adapter with one environment variable.

Integration is low-risk because both implementations must pass the same conformance suite.

### Repo layout

```
funswitch/
  package.json              # npm workspaces
  firebase.json             # emulators only (no hosting)
  firestore.rules
  firestore.indexes.json
  packages/contract/        # Phase 0, frozen
  packages/backend/         # Server agent
  apps/mobile/              # UI agent (Expo SDK 58)
  CONTRACT_CHANGES.md       # change requests only
```

---

## 1. Design spec (UI agent only)

The screens copy two reference images:

- **Image 1** is the home grid: the "funSwitch" title, an "Add Switch" pill button, and a 2-column grid of tiles showing a small switch icon and a state line such as "Lights off".
- **Image 2** is the "Flip Room" device screen. The left panel shows a hanging bulb, a big "Lights on" headline, a wall switch, a last-action line and a "Live · in sync" pill. The right column holds three panels: "In the room now", "Database check" and "Flip history".

Navigation is flat. Home is one ungrouped grid, and tapping a tile opens that device's screen, which contains its log.

### Design tokens

Put these in `apps/mobile/src/theme/tokens.ts` as a typed object. Components style themselves with `StyleSheet.create`.

| Token          | Value                                                               | Use                                  |
| -------------- | ------------------------------------------------------------------- | ------------------------------------ |
| `bg`           | `#FFF1C7`                                                           | warm cream screen background         |
| `card`         | `#FFFBEF`                                                           | panels and tiles                     |
| `cardBorder`   | `#F3E3B0`                                                           | panel borders                        |
| `chip`         | `#E3E6F3`                                                           | stat tiles and chips                 |
| `ink`          | `#1F2340`                                                           | headlines, OFF badge                 |
| `inkMuted`     | `#6B6F86`                                                           | labels                               |
| `accent`       | `#FFC83D`                                                           | ON badge, bulb glow, primary buttons |
| `live`         | `#22A06B`                                                           | "Live" dot                           |
| radius         | 20 panels, 14 tiles, 999 pills                                      |                                      |
| font           | Inter (`@expo-google-fonts/inter`), falling back to the system font |                                      |
| headline       | 48dp on phones, 56dp at width ≥ 700, weight 800                     |                                      |
| section labels | 12dp uppercase, letter spacing about 1.5                            | "IN THE ROOM NOW" style              |

**Avatars**

- The color comes from a hash of the uid, picked from a palette of 6 colors (purple, pink, green, blue, orange, teal).
- The letter is the first character of the email, uppercased.
- Avatars are 28dp circles.

**React Native specifics**

- Use `react-native-safe-area-context` on every screen.
- Read the screen width with `useWindowDimensions` for all breakpoints.
- Draw dashed dividers with a `react-native-svg` `Line` using `strokeDasharray`, because single-side dashed borders render inconsistently across platforms.
- Use `Alert.alert` for confirm dialogs.

### Header (every authenticated screen)

- **Left:** a yellow dot followed by "funSwitch". On a device screen this becomes a back arrow, a yellow dot and the device name ("Flip Room" in the mock-up is a device name).
- **Right:** a `UserPill` with the avatar and the email, truncated with `numberOfLines={1}`. Pressing it opens an action sheet (`ActionSheetIOS` on iOS, a small modal on Android) with "Sign out".

### Login and signup screens

- A centered card (max width 400) on `bg`, with the yellow dot and "funSwitch" logo on top.
- **Login:** email, password, a full-width yellow "Log in" button, and the link "No account? Sign up".
- **Signup:** email, password, confirm password, a "Create account" button, and the link "Have an account? Log in".
- Errors appear inline in red under the form.
- The form sits inside a `KeyboardAvoidingView`.

### Home screen (image 1)

- Show a centered, pill-shaped "Add Switch" button under the header.
- Below it, a grid of square tiles. The column count follows the screen width:

| Width        | Columns |
| ------------ | ------- |
| under 700    | 2       |
| 700 to 999   | 3       |
| 1000 or more | 4       |

- Each tile contains three things:
  - a small switch icon, filled `accent` when the device is on or its level is above 0, and grey otherwise
  - the device name
  - a state line: "Lights off" / "Lights on" for switches, "Fan · 60%" for sliders
- Pressing a tile opens `/devices/:id`. Tiles have no controls on them.
- An empty state reads "No switches yet. Add one!" alongside the button.

### Device screen (image 2)

At width ≥ 900 the main panel and the right column sit side by side. Below that they stack in a `ScrollView` in this order:

1. main panel
2. In the room now
3. Database check
4. Flip history

**Main panel**

1. A hanging bulb drawn with `react-native-svg`. The glow opacity is animated over 300ms with `react-native-reanimated`:
   - switch devices: opacity 1 when on, 0 when off
   - slider devices: opacity `level / 100`
2. A large headline: "Lights on" / "Lights off" for switches, "Fan 60%" for sliders.
3. The control:
   - **Switch:** a wall plate (about 150×190dp) with screw dots. The rocker shows a yellow "ON" at the top when on and a navy "OFF" at the bottom when off. The whole plate is the press target.
   - **Slider:** a wall plate holding `@react-native-community/slider`, with the value shown.
4. A last-action line: the avatar, then "maya@x.com turned it on · just now". The relative time updates every 30s.
5. A sync pill:
   - "● Live · in sync" (green) when the listener is active and nothing is pending
   - "● Saving…" (amber) while a write is pending
   - "● Offline" (grey) when the listener has errored
6. A small text-style "Delete switch" button at the bottom, with an `Alert.alert` confirm.

**Right column (three stacked panels)**

1. **IN THE ROOM NOW:** chips with an avatar and an email for each user currently viewing this device.
   - The current user appears as "You" and is always first; the others are sorted by email.
   - A chip is outlined in `accent` for 3s after that person flips the device.
   - Chips wrap with `flexWrap: 'wrap'`.
2. **DATABASE CHECK:** three stat tiles.
   - **flips logged** is `device.flipCount`.
   - **last save** is the round-trip ms of this client's last write, or "—" if there is none.
   - **live updates** counts device snapshots received since the screen opened, excluding the first.
3. **FLIP HISTORY:** the last 20 events for this device, newest first.
   - Each row shows the avatar, the email (or "You"), an ON (yellow) / OFF (navy) / "60%" (chip) badge, and the time with seconds ("2:41:07 PM").
   - Rows are separated by dashed dividers, and new rows fade in.

---

## Phase 0: Shared contract (run once, before splitting)

### Step 0.1: Scaffold the workspace

**Tasks**

1. Create the root `package.json` with workspaces `["packages/*", "apps/*"]`.
2. Add a strict `tsconfig.base.json`, and Vitest configured with `globals: true`.
3. Create `packages/contract/src/index.ts`.
4. The contract package must be pure TypeScript:
   - no Node-only APIs (`fs`, `crypto`, `process`)
   - no dependency on `react`, `react-native` or `firebase`

**Test:** `sanity.test.ts` asserts `1 + 1 === 2`.

**Run:** `npm install && npm run test -w packages/contract`.

### Step 0.2: Types and interface

Create `packages/contract/src/types.ts`:

```ts
export type ControlKind = "switch" | "slider";
export type DeviceType =
  | "light"
  | "plug"
  | "dimmer"
  | "fan"
  | "blinds"
  | "speaker";

export const DEVICE_TYPE_CONTROL: Record<DeviceType, ControlKind> = {
  light: "switch",
  plug: "switch",
  dimmer: "slider",
  fan: "slider",
  blinds: "slider",
  speaker: "slider",
};
export const DEVICE_TYPE_NOUN: Record<DeviceType, string> = {
  light: "Lights",
  plug: "Plug",
  dimmer: "Dimmer",
  fan: "Fan",
  blinds: "Blinds",
  speaker: "Volume",
};

/** Email is the user's name everywhere. */
export interface User {
  uid: string;
  email: string;
}
export interface Actor {
  uid: string;
  email: string;
}

interface DeviceBase {
  id: string;
  name: string; // 1–40 chars, trimmed
  type: DeviceType;
  createdAt: number; // epoch ms
  createdBy: string; // uid
  updatedAt: number;
  lastChangedBy: Actor;
  flipCount: number; // +1 on every setOn / setLevel
}
export interface SwitchDevice extends DeviceBase {
  control: "switch";
  on: boolean;
}
export interface SliderDevice extends DeviceBase {
  control: "slider";
  level: number;
} // int 0–100
export type Device = SwitchDevice | SliderDevice;

export type ActivityAction =
  | "added"
  | "turned_on"
  | "turned_off"
  | "set_level"
  | "removed";
export interface ActivityEvent {
  id: string;
  deviceId: string;
  deviceName: string;
  actor: Actor;
  action: ActivityAction;
  level?: number; // set_level only
  at: number; // epoch ms
}

export interface PresenceEntry {
  uid: string;
  email: string;
  lastSeen: number;
}

export interface SyncMeta {
  pendingWrites: boolean; // local write not yet confirmed by server
  fromCache: boolean;
}

export type Unsubscribe = () => void;

export type HomeApiErrorCode =
  | "auth/invalid-credentials"
  | "auth/email-in-use"
  | "auth/weak-password"
  | "auth/invalid-email"
  | "auth/not-signed-in"
  | "validation"
  | "not-found"
  | "permission-denied"
  | "unknown";

export class HomeApiError extends Error {
  constructor(
    public code: HomeApiErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export interface HomeApiOptions {
  presenceTtlMs?: number; // default 45_000
  presenceHeartbeatMs?: number; // default 15_000; 0 disables (tests)
}

export interface HomeApi {
  auth: {
    signUp(email: string, password: string): Promise<User>;
    signIn(email: string, password: string): Promise<User>;
    signOut(): Promise<void>;
    currentUser(): User | null;
    onAuthChanged(cb: (user: User | null) => void): Unsubscribe;
  };
  devices: {
    /** Full list, sorted by createdAt ascending. */
    subscribe(
      cb: (devices: Device[]) => void,
      onError?: (e: HomeApiError) => void,
    ): Unsubscribe;
    /** One device; emits null if it does not exist or was removed. */
    subscribeOne(
      id: string,
      cb: (device: Device | null, meta: SyncMeta) => void,
      onError?: (e: HomeApiError) => void,
    ): Unsubscribe;
    add(input: { name: string; type: DeviceType }): Promise<string>;
    setOn(id: string, on: boolean): Promise<void>; // switch only
    setLevel(id: string, level: number): Promise<void>; // slider only
    remove(id: string): Promise<void>;
  };
  activity: {
    /** Events for one device, newest first. Default limit 20. */
    subscribeForDevice(
      deviceId: string,
      cb: (events: ActivityEvent[]) => void,
      limit?: number,
    ): Unsubscribe;
  };
  presence: {
    /** Marks the current user as viewing deviceId and heartbeats. Returns leave(). */
    join(deviceId: string): Promise<() => Promise<void>>;
    /** Viewers whose lastSeen is within the TTL; re-evaluated at least every TTL/3. */
    subscribe(
      deviceId: string,
      cb: (viewers: PresenceEntry[]) => void,
    ): Unsubscribe;
  };
}
```

New devices start at `on: false` or `level: 0`, with `flipCount: 0`.

### Step 0.3: Validation and formatting helpers

**`validation.ts`**

| Helper                       | Behavior                                                   |
| ---------------------------- | ---------------------------------------------------------- |
| `validateEmail(email)`       | simple regex check; throws `HomeApiError('validation')`    |
| `validatePassword(password)` | at least 6 characters; throws `'auth/weak-password'`       |
| `validateDeviceName(name)`   | returns the trimmed name; throws `'validation'` if invalid |
| `validateLevel(n)`           | integer from 0 to 100; throws `'validation'`               |
| `isDeviceType(x)`            | type guard                                                 |

**`format.ts`**

| Helper                      | Example output                                                          |
| --------------------------- | ----------------------------------------------------------------------- |
| `headline(device)`          | "Lights on", "Lights off", "Fan 60%"                                    |
| `tileStateLine(device)`     | "Lights off", "Fan · 60%"                                               |
| `lastActionLine(event, me)` | "maya@x.com turned it on", or "You turned it on" when the actor is `me` |
| `badge(event)`              | `{ kind: 'on' \| 'off' \| 'level' \| 'added' \| 'removed', text }`      |
| `avatarLetter(email)`       | the first character, uppercased                                         |
| `avatarColorIndex(uid)`     | a stable value from 0 to 5                                              |

**Test (`validation.test.ts`, `format.test.ts`):**

- `"a@b"` and `"bad"` are rejected by `validateEmail`, and `"a@b.co"` is accepted
- passwords shorter than 6 characters are rejected
- names are trimmed, and empty or 41-character names are rejected
- `-1`, `101` and `50.5` are rejected, while `0` and `100` are accepted
- every `DeviceType` has both a control and a noun
- each format helper matches its example above
- `avatarColorIndex` is stable for the same uid and always within 0–5

**Run:** `npm run test -w packages/contract`.

### Step 0.4: Conformance test suite

Create `packages/contract/src/conformance.ts`, which exports `runHomeApiConformance(name, factory)`.

- `factory(opts: HomeApiOptions)` returns `{ clientA, clientB, reset() }`. The two clients share one backend.
- Write the suite using only the global `describe`, `it`, `expect`, `beforeEach` and `afterEach`, without importing them from `vitest`. That lets it run under both Vitest (backend) and Jest (mobile).
- Use only matchers both frameworks support: `toBe`, `toEqual`, `toHaveLength`, and `rejects.toMatchObject({ code })`.
- Include a `waitFor(predicate, timeout = 3000)` helper for real-time assertions.

**Auth**

1. Signing up returns `{ uid, email }`, and `currentUser()` matches.
2. A wrong password rejects with code `auth/invalid-credentials`.
3. Signing up with a duplicate email rejects with code `auth/email-in-use`.
4. Device calls made while signed out reject with code `auth/not-signed-in`.

**Devices**

5. `add` with a light creates a switch with `on: false` and `flipCount: 0`, and `subscribe` emits it.
6. `add` with a fan creates a slider with `level: 0`.
7. An invalid name rejects with code `validation`.
8. **Real-time:** A calls `setOn(id, true)`, and B's `subscribeOne` sees `on: true`, `lastChangedBy.email === A.email` and `flipCount: 1` within 3 s.
9. **Real-time:** B calls `setLevel(id, 75)`, and A sees `level: 75` within 3 s.
10. A wrong control kind or an out-of-range level rejects with code `validation`.
11. `subscribeOne` emits `meta.pendingWrites === true` at least once during A's own write, then `false`. Skip this check when the mock's latency is 0.
12. `remove` makes the device disappear for both clients, `subscribeOne` emits `null`, and a later `setOn` rejects with code `not-found`.

**Activity**

13. Each mutation writes exactly one event with the correct action and actor, and B receives it.
14. `subscribeForDevice(d1)` never includes events for d2. The order is newest first, and `limit` is respected (25 flips with limit 20 returns 20).

**Presence** (use `presenceTtlMs: 1500` and `presenceHeartbeatMs: 0`)

15. A joins d1, and B's `presence.subscribe(d1)` sees A within 3 s.
16. A calls `leave()`, and B sees A removed within 3 s.
17. A joins and never heartbeats. Within about 3 s after the TTL expires, B no longer sees A, even with no new writes. This tests the periodic re-evaluation.
18. Joining twice does not create duplicate entries.

**Unsubscribe**

19. After unsubscribing, no further callbacks happen. This applies to all subscriptions.

**Test:** the suite is validated later against real adapters, so here only verify that it compiles.

**Run:** `npx tsc --noEmit -p packages/contract`.

### Step 0.5: Freeze

1. Commit the contract.
2. From now on, both agents put change requests in `CONTRACT_CHANGES.md` and never edit `packages/contract` directly.

---

## Part A: Server agent

**Agent instructions:** Do steps S1–S8 in order. After each step, run its **Run** command. Do not continue until it passes. Fix the implementation, not the tests, unless a test contradicts the contract. Paste the test output after each step.

### S1: Firebase project and emulators

**Tasks**

1. Install `firebase-tools`.
2. Create `firebase.json` with:
   - the Auth emulator on port 9099 and the Firestore emulator on port 8080, both with `"host": "0.0.0.0"` so simulators and physical phones can reach them
   - the emulator UI on
   - no `hosting` section
3. Create `.firebaserc` with project `demo-funswitch`.
4. Create `packages/backend` with `firebase` and `@firebase/rules-unit-testing`.
5. Set the test script to `firebase emulators:exec --only auth,firestore "vitest run"`.

**Test:** `smoke.test.ts` writes `/smoke/ping` through the emulator and reads it back.

**Run:** `npm run test -w packages/backend`.

### S2: Data layout, rules and indexes

**Collections**

| Path                                | Fields                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `users/{uid}`                       | `email`, `createdAt`                                                    |
| `devices/{id}`                      | `Device` fields minus `id`; timestamps written with `serverTimestamp()` |
| `activity/{id}`                     | `ActivityEvent` fields minus `id`                                       |
| `presence/{deviceId}/viewers/{uid}` | `email`, `lastSeen` (server timestamp)                                  |

**Rules (`firestore.rules`)**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function signedIn() { return request.auth != null; }
    function validName(n) { return n is string && n.size() >= 1 && n.size() <= 40; }
    function actorIsMe(a) {
      return a.uid == request.auth.uid && a.email == request.auth.token.email;
    }

    match /users/{uid} {
      allow read: if signedIn();
      allow create, update: if signedIn() && request.auth.uid == uid;
    }

    match /devices/{id} {
      allow read: if signedIn();
      allow create: if signedIn()
        && validName(request.resource.data.name)
        && request.resource.data.createdBy == request.auth.uid
        && actorIsMe(request.resource.data.lastChangedBy)
        && request.resource.data.flipCount == 0
        && ((request.resource.data.control == 'switch'
              && request.resource.data.type in ['light','plug']
              && request.resource.data.on == false)
         || (request.resource.data.control == 'slider'
              && request.resource.data.type in ['dimmer','fan','blinds','speaker']
              && request.resource.data.level == 0));
      allow update: if signedIn()
        && actorIsMe(request.resource.data.lastChangedBy)
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['on','level','updatedAt','lastChangedBy','flipCount'])
        && request.resource.data.flipCount == resource.data.flipCount + 1
        && (resource.data.control == 'switch'
              ? request.resource.data.on is bool
              : (request.resource.data.level is int
                 && request.resource.data.level >= 0
                 && request.resource.data.level <= 100));
      allow delete: if signedIn();
    }

    match /activity/{id} {
      allow read: if signedIn();
      allow create: if signedIn() && actorIsMe(request.resource.data.actor);
      allow update, delete: if false;
    }

    match /presence/{deviceId}/viewers/{uid} {
      allow read: if signedIn();
      allow create, update, delete: if signedIn() && request.auth.uid == uid;
    }
  }
}
```

**Index (`firestore.indexes.json`):** collection `activity`, fields `deviceId ASC` and `at DESC`.

**Test (`rules.test.ts`, using `@firebase/rules-unit-testing`):**

- all unauthenticated access is denied
- valid creates for both control kinds are allowed
- these creates are denied:
  - a slider created with type `light`
  - a create with `createdBy` set to someone else
  - a create with `flipCount: 5`
- these updates are denied:
  - one that changes `name`
  - one with `level: 101` or `level: 50.5`
  - one that does not increment `flipCount` by exactly 1
  - one where `lastChangedBy.email` does not match the token
- updating or deleting activity is denied
- writing another user's presence document is denied

**Run:** `npm run test -w packages/backend -- rules`.

### S3: Adapter entry point and auth

The backend must not know about React Native. The app creates the Auth and Firestore instances and passes them in.

**Tasks**

1. Export the adapter from `packages/backend/src/index.ts`:

   ```ts
   export function createFirebaseApi(
     deps: { auth: Auth; db: Firestore },
     opts?: HomeApiOptions,
   ): HomeApi;
   ```

2. Export a Node-only helper from `packages/backend/src/node.ts`, for tests, the seed script and `actAs`:

   ```ts
   export function initForNode(
     config: FirebaseOptions,
     emulatorHost = "127.0.0.1",
   ): { auth: Auth; db: Firestore };
   ```

3. Implement `auth`:
   - **`signUp`** calls `createUserWithEmailAndPassword`, then writes `users/{uid}`.
   - **Error mapping** converts Firebase codes to contract codes:
     - `auth/invalid-credential`, `auth/wrong-password` and `auth/user-not-found` become `auth/invalid-credentials`
     - `auth/email-already-in-use` becomes `auth/email-in-use`
     - `auth/weak-password` and `auth/invalid-email` pass through
   - **`onAuthChanged`** returns users as `{ uid, email }`.

**Test**

- `auth.test.ts` runs conformance cases 1–3, plus checks that `signOut` triggers `onAuthChanged(null)` and that the `users/{uid}` document exists after sign-up.
- `imports.test.ts` fails if any file in `src/` other than `node.ts` imports `fs`, `firebase-admin` or `@react-native-async-storage/*`.

**Run:** `npm run test -w packages/backend -- auth imports`.

### S4: Devices adapter

**Tasks**

1. **`subscribe`** uses `onSnapshot(query(devices, orderBy('createdAt')))`. Read timestamps with `{ serverTimestamps: 'estimate' }`.
2. **`subscribeOne`** uses `onSnapshot(doc, { includeMetadataChanges: true })`. It emits `null` when the document doesn't exist. `meta` comes from `snapshot.metadata` (`hasPendingWrites`, `fromCache`).
3. **`add`** validates, derives `control`, and writes the device plus an `added` event in one `writeBatch`.
4. **`setOn` and `setLevel`** validate, then run a `runTransaction`:
   - read the device; throw `not-found` if it is missing, or `validation` if its control kind is wrong
   - update the value, `updatedAt`, `lastChangedBy` and `flipCount + 1`
   - create the activity event in the same transaction
5. **`remove`** reads the device (throwing `not-found` if missing), then deletes it and writes a `removed` event in a batch.
6. Every method throws `auth/not-signed-in` when there is no user.
7. Note in the README that React Native clients should create Firestore with `initializeFirestore(app, { experimentalForceLongPolling: true })` if listeners stall. The backend accepts any `Firestore` instance.

**Test (`devices.test.ts`):** conformance cases 4–12, using two `initForNode` instances (named `'A'` and `'B'`) signed in as different users.

**Run:** `npm run test -w packages/backend -- devices`.

### S5: Activity adapter

**Tasks:** `subscribeForDevice` uses `onSnapshot(query(activity, where('deviceId','==',id), orderBy('at','desc'), limit(n)))`.

**Test (`activity.test.ts`):** conformance cases 13–14.

**Run:** `npm run test -w packages/backend -- activity`.

### S6: Presence adapter

**Tasks**

1. **`join(deviceId)`** writes `{ email, lastSeen: serverTimestamp() }` to `presence/{deviceId}/viewers/{uid}`.
   - If `presenceHeartbeatMs > 0`, it starts an interval that refreshes `lastSeen`.
   - It returns `leave()`, which clears the interval and deletes the document.
2. **`subscribe(deviceId)`** combines two things:

   - an `onSnapshot` on the viewers collection
   - a `setInterval(ttl / 3)` that re-filters the cached list to entries where `Date.now() - lastSeen < ttl`

   Emit only when the filtered list changes. Clear both on unsubscribe.

**Test (`presence.test.ts`):** conformance cases 15–18.

**Run:** `npm run test -w packages/backend -- presence`.

### S7: Full conformance run

**Tasks:** Create `src/conformance.test.ts`, which calls `runHomeApiConformance('firebase', factory)`. `reset()` clears Firestore with `clearFirestoreData` and clears the Auth emulator with `DELETE /emulator/v1/projects/demo-funswitch/accounts`.

**Run:** `npm run test -w packages/backend`. Everything must be green.

### S8: Seed script, actAs tool and README

**Tasks**

1. Create `scripts/seed.ts`. Against the emulator only, it creates:
   - users `maya@demo.test`, `sam@demo.test` and `jas@demo.test` (password `password123`)
   - six devices covering all types, including one light named "Flip Room"
   - about 10 flips spread across the users, so the history and flip counts aren't empty
2. Create `scripts/actAs.ts`, a command-line tool that end-to-end tests use as "the other user":

   ```
   tsx scripts/actAs.ts --email sam@demo.test --password password123 \
     --device "Flip Room" --action on|off|level:60|join|leave|remove [--delay 3000]
   ```

3. Write a README that covers:
   - starting the emulators and seeding
   - using `actAs`
   - deploying rules and indexes (`firebase deploy --only firestore`)
   - the variables the app needs (`EXPO_PUBLIC_FIREBASE_*`, `EXPO_PUBLIC_USE_EMULATORS`, `EXPO_PUBLIC_EMULATOR_HOST`)

**Test**

- The seed script exits 0, and the emulator UI shows 3 users, 6 devices and about 16 activity documents.
- After seeding, `actAs --action on` makes "Flip Room" have `on: true` and raises its `flipCount` by 1.

**Run:**

```
npx firebase emulators:exec --only auth,firestore "npm run seed -w packages/backend && npm run actAs -w packages/backend -- --email sam@demo.test --password password123 --device 'Flip Room' --action on"
```

---

## Part B: UI agent (Expo SDK 58)

**Agent instructions**

- Do steps M1–M10 in order, following the design spec in section 1 and the reference images.
- Use only the `HomeApi` interface. Never import `firebase/*` outside `src/api/createApi.ts`.
- Install native packages with `npx expo install`, never plain `npm install`, so versions match SDK 58.
- Do not use deep `react-native/Libraries/*` imports, `expo-router/react-navigation` exports or `InteractionManager`. Type refs with instance types such as `ViewInstance` and `TextInputInstance`.
- After each step, run its **Run** command. Every Run includes `npx tsc --noEmit`. Do not continue until everything passes, and paste the output.

### M1: Scaffold the Expo SDK 58 app

**Tasks**

1. Create `apps/mobile` with `npx create-expo-app@latest`, choosing SDK 58 with the TypeScript and Expo Router template. Remove the example screens.
2. Check that Node is 22.13 or newer.
3. Add `@funswitch/contract` as a workspace dependency. Expo's Metro config resolves workspaces automatically, so don't add custom `watchFolders` unless resolution fails.
4. Install these with `npx expo install`:
   - `react-native-svg`, `react-native-reanimated`, `react-native-safe-area-context`
   - `@react-native-community/slider`, `@react-native-async-storage/async-storage`
   - `expo-font`, `@expo-google-fonts/inter`, `expo-haptics`
5. Set up Jest with `jest-expo` and `@testing-library/react-native`. Mock AsyncStorage with its official Jest mock.
6. Create the route layout:

   ```
   app/_layout.tsx                # ApiProvider, fonts, SafeAreaProvider
   app/(auth)/login.tsx
   app/(auth)/signup.tsx
   app/(app)/_layout.tsx          # protected Stack + header
   app/(app)/index.tsx            # Home grid
   app/(app)/devices/new.tsx      # Add Switch
   app/(app)/devices/[id].tsx     # Device screen
   ```

7. Add `src/theme/tokens.ts` and the shared components: `Header`, `UserPill`, `Avatar`, `Panel`, `SectionLabel` and `DashedDivider`.

**Test**

- `Login.test.tsx` renders the login screen and finds "funSwitch".
- `Avatar.test.tsx` checks that `jas@x.com` renders "J" and that the color is stable for the same uid.

**Run:** `npm test -w apps/mobile && npx tsc --noEmit -p apps/mobile && npx expo-doctor`.

### M2: Development build and Maestro smoke test

**Tasks**

1. Build and launch a development build with `npx expo run:ios` (or `run:android`).
2. Install the Maestro CLI.
3. Add `apps/mobile/e2e/flows/smoke.yaml`. It launches the app and asserts "funSwitch" is visible.
4. Give important elements a `testID` in kebab-case, such as `login-email`, `device-tile-<id>` and `wall-switch`.

**Test:** the smoke flow passes on one simulator.

**Run:** `maestro test apps/mobile/e2e/flows/smoke.yaml`.

### M3: Mock API, provider, hooks and Dev Simulator

**Tasks**

1. **`src/api/mockApi.ts`** creates the mock client from a shared `MockStore`. Two instances on one store behave like two clients. The mock has:
   - configurable latency (50–150 ms by default, 0 in tests)
   - `pendingWrites` reported on `subscribeOne` until the simulated save lands
   - the same validation, error codes and presence time-to-live logic as the contract
2. **`ApiProvider`, `useApi()` and `src/api/createApi.ts`** read `process.env.EXPO_PUBLIC_API_MODE`. `mock` is the default; `firebase` is a stub that throws "not wired yet" until integration.
3. **Hooks.** Each one cleans up its subscriptions on unmount.

| Hook                   | Returns / behavior                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `useAuth()`            | the current user and auth state                                                                 |
| `useDevices()`         | `{ data, loading, error }` for the device list                                                  |
| `useDevice(id)`        | `{ device, meta, loading, error, liveUpdates }`; `liveUpdates` counts snapshots after the first |
| `useDeviceHistory(id)` | the device's activity events                                                                    |
| `usePresence(id)`      | joins and leaves as described below, and returns the viewers                                    |
| `useTimedSave()`       | wraps a write promise and records `lastSaveMs` with `performance.now()`                         |

4. **Presence follows focus and app state.** `usePresence` joins in `useFocusEffect` and leaves on blur. It also listens to `AppState`: leave when the app goes to the background, and rejoin when it returns to the foreground.
5. **`DevSimulator` panel.** In mock mode only, show a floating bug button. It uses a second mock client on the same store, signed in as `sam@demo.test`, with these buttons:

   - "Sam flips this"
   - "Sam sets level 60"
   - "Sam joins / leaves"
   - "Sam adds a device"
   - "Sam deletes this"

   This lets one phone demonstrate real-time multi-user behavior without a backend.

**Test**

- `mockApi.conformance.test.ts` runs `runHomeApiConformance('mock', …)` under Jest with fake timers for presence. All 19 cases must pass.
- `hooks.test.tsx` checks that:
  - `liveUpdates` counts only remote updates after the first emit
  - `usePresence` leaves on unmount
  - `usePresence` leaves when `AppState` changes to `background` and rejoins when it changes to `active`
  - `useTimedSave` records a number greater than or equal to 0
- `DevSimulator.test.tsx` checks that pressing "Sam flips this" changes the device state and writes an activity event whose actor is Sam.

**Run:** `npm test -w apps/mobile && npx tsc --noEmit -p apps/mobile`.

### M4: Login and signup screens

**Tasks**

1. **Screens.** Build both screens as described in section 1. Configure the inputs:
   - email: `autoCapitalize="none"`, `keyboardType="email-address"`, `autoComplete="email"`
   - passwords: `secureTextEntry`
2. **Validation.** Validate on the client with `validateEmail`, `validatePassword` and the confirm-password match.
3. **Error messages.** Map error codes to these messages:

| Code                       | Message                                      |
| -------------------------- | -------------------------------------------- |
| `auth/invalid-credentials` | "Wrong email or password."                   |
| `auth/email-in-use`        | "An account with this email already exists." |
| `auth/weak-password`       | "Password must be at least 6 characters."    |
| `auth/invalid-email`       | "Enter a valid email."                       |

4. **Pending state.** While a request is pending, disable the submit button and show an `ActivityIndicator` on it.
5. **Navigation.**
   - A successful login or signup goes to Home.
   - Protect `app/(app)/_layout.tsx` with Expo Router's `Stack.Protected guard={!!user}`. If that guard isn't available in SDK 58's router, use `<Redirect href="/login" />` instead.
   - Show a splash or spinner while auth state is unknown.
   - Signed-in users opening `(auth)` screens are redirected to Home.
6. **Persistence.** The session survives an app restart. In mock mode, persist the mock session to AsyncStorage.
7. **Sign out.** `UserPill` → "Sign out" returns to the login screen.

**Test (`auth.test.tsx`):**

- a successful login reaches Home and shows the email in the header
- a wrong password shows its message
- a mismatched confirm password shows an error and never calls `signUp`
- a duplicate email shows its message
- the button is disabled while pending
- the protected redirect works
- sign-out works

**Run:** `npm test -w apps/mobile -- auth && npx tsc --noEmit -p apps/mobile`.

### M5: Home grid (image 1)

**Tasks**

1. **Add Switch button:** an "Add Switch" pill that goes to `/devices/new`.
2. **Grid:** a `FlatList` with responsive `numColumns`. Change the list's `key` whenever `numColumns` changes, as React Native requires.
3. **Tiles:** each `DeviceTile` is a `Pressable` square showing the switch icon, the name and `tileStateLine`. Set `accessibilityRole="button"` and `accessibilityLabel` to "{name}, {state}".
4. **States:** an empty state, 6 grey skeleton tiles while loading, and an error banner.
5. **Pull-to-refresh:** support `RefreshControl`. It only resubscribes, since data is already live.

**Test (`HomeScreen.test.tsx`):**

- the empty state renders with no devices
- 3 seeded devices render in order with the correct state lines
- **real-time:** client B adds a device and a fourth tile appears
- B turns a light on and its tile reads "Lights on"
- B removes a device and its tile disappears
- pressing a tile calls `router.push('/devices/<id>')`, with Expo Router's `router` mocked

**Run:** `npm test -w apps/mobile -- HomeScreen && npx tsc --noEmit -p apps/mobile`.

### M6: Add Switch screen

**Tasks**

1. Build a card styled like the login card, containing:
   - a name `TextInput`
   - six large pressable type chips with icons
   - helper text ("On/off switch" or "0–100 slider") from `DEVICE_TYPE_CONTROL`
   - "Create" and "Cancel" buttons
2. Validate with `validateDeviceName`.
3. On success, use `router.replace` to go to the new device's screen.

**Test (`AddSwitch.test.tsx`):**

- an empty name shows an error, and `add` is not called
- choosing "fan" shows the slider helper text
- a valid submit calls `add({ name: 'Desk Lamp', type: 'light' })` with the trimmed name, then `router.replace('/devices/<id>')`
- Cancel calls `router.back()`

**Run:** `npm test -w apps/mobile -- AddSwitch && npx tsc --noEmit -p apps/mobile`.

### M7: Device screen, main panel (image 2)

**Tasks**

1. **Header:** back mode with the device name.
2. **`Bulb`:** an SVG whose glow opacity is animated with Reanimated.
3. **Headline:** from `headline(device)`.
4. **`WallSwitch`** for switch devices:
   - it is a `Pressable` with `accessibilityRole="switch"` and `accessibilityState={{ checked }}`
   - it updates optimistically and saves through `useTimedSave`
   - on error it reverts and shows an inline error
   - it triggers a light haptic with `expo-haptics`
5. **`WallSlider`** for slider devices uses `@react-native-community/slider`:
   - `onValueChange` updates only local state and the headline preview
   - `onSlidingComplete` calls `setLevel` exactly once, rounded to an integer
   - remote values are ignored while the user is dragging
   - on error it reverts
6. **Last-action line:** the newest event from `useDeviceHistory`, formatted with `lastActionLine`, plus a relative time ("just now", "2m ago") refreshed every 30s.
7. **Sync pill:**
   - "Offline" when `useDevice` has an error
   - otherwise "Saving…" when `meta.pendingWrites` is true
   - otherwise "Live · in sync"
8. **"Delete switch":** shows an `Alert.alert` confirm, calls `remove`, then `router.replace('/')`. If the device becomes `null` remotely, show "This switch was removed" with a back button.

**Test (`DeviceMain.test.tsx`):**

- **Switch:** pressing it flips the headline and `accessibilityState` immediately and calls `setOn` once.
- **Errors:** a rejected write reverts the switch.
- **Remote flip:** client B's flip updates the headline and the last-action line ("sam@demo.test turned it on · just now").
- **Slider:**
  - `fireEvent(slider, 'onValueChange', 50)` and then `(…, 60)` make no calls
  - `fireEvent(slider, 'onSlidingComplete', 60)` makes exactly one `setLevel(id, 60)`, and the headline becomes "Fan 60%"
- **Sync pill:** shows "Saving…" and then "Live · in sync".
- **Delete:** with `Alert.alert` mocked to press "Delete", `remove` is called and the app navigates home.
- **Remote removal:** shows the removed state.

**Run:** `npm test -w apps/mobile -- DeviceMain && npx tsc --noEmit -p apps/mobile`.

### M8: Flip history panel

**Tasks**

1. Build `FlipHistory` using `useDeviceHistory(id)` with a limit of 20.
2. Render the rows with `.map()` inside the parent `ScrollView`, since it's 20 items at most and avoids nested virtualized lists.
3. Each row shows the avatar, the email (or "You" for the current user), a badge from `badge(event)`, and `toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })`.
4. Separate rows with `DashedDivider`, and fade new rows in with a Reanimated `FadeIn` entering animation.
5. When there is no history, show "No flips yet."

**Test (`FlipHistory.test.tsx`):**

- events render newest first with the correct ON/OFF/level badges and time format
- the current user's rows show "You"
- B's event appears at the top live
- events from other devices are excluded

**Run:** `npm test -w apps/mobile -- FlipHistory && npx tsc --noEmit -p apps/mobile`.

### M9: "In the room now" and "Database check" panels, plus layout

**Tasks**

1. **`RoomPresence`** uses `usePresence(id)`.
   - It renders "You" first, then the others sorted by email.
   - A chip gets the `accent` outline for 3 s when that user is the actor of a new history event.
2. **`DatabaseCheck`** shows three stat tiles:

| Tile         | Source                                                    |
| ------------ | --------------------------------------------------------- |
| flips logged | `device.flipCount`                                        |
| last save    | `lastSaveMs` from `useTimedSave`, shown as "84ms", or "—" |
| live updates | `liveUpdates` from `useDevice`                            |

3. **Responsive layout:** at width 900 or more, place the main panel and the right column side by side with `flexDirection: 'row'`. Below that, stack them in the order given in section 1.

**Test (`RightColumn.test.tsx`, using fake timers):**

- the "You" chip appears first
- client B joins and leaves, and its chip appears and disappears
- B's flip highlights B's chip, and the highlight is removed after 3 s
- flips logged goes from 0 to 1 after a flip
- last save shows "—" before my own flip and a value ending in "ms" after it
- live updates counts B's flip but not the screen load
- the layout renders in a row when `useWindowDimensions` is mocked to width 1024, and as a column at width 390

**Run:** `npm test -w apps/mobile -- RightColumn && npx tsc --noEmit -p apps/mobile`.

### M10: Maestro end-to-end test on the mock

**Tasks:** Write `e2e/flows/mock_full.yaml`, run against the development build with `EXPO_PUBLIC_API_MODE=mock`.

1. Sign up as `maya@demo.test`.
2. Add "Flip Room" (light) and "Ceiling Fan" (fan), and assert both tiles are visible.
3. Open Flip Room. Use the Dev Simulator: "Sam joins", then "Sam flips this". Assert:
   - a Sam chip appears
   - the headline reads "Lights on"
   - the text "sam@demo.test turned it on" is visible
   - flips logged = 1
4. Tap the switch. Assert "Lights off" and a "You" OFF row in the history.
5. Go back and assert the tile reads "Lights off".
6. Open Ceiling Fan and use "Sam sets level 60". Assert "Fan 60%".
7. Delete the fan, and assert its tile is gone.
8. Take screenshots of Home and the device screen with `takeScreenshot` for comparison with the mock-ups. Run once on an iPhone simulator and once on an iPad or Android tablet to check both layouts.

**Run:**

```
maestro test apps/mobile/e2e/flows/mock_full.yaml
npm test -w apps/mobile && npx tsc --noEmit -p apps/mobile && npx expo-doctor
```

---

## Part C: Integration

Run this after both agents finish.

### I1: Wire Firebase into the mobile app

**Tasks**

1. Add `@funswitch/backend` to `apps/mobile`.
2. In the `firebase` branch of `createApi.ts`:
   1. Call `initializeApp` with the `EXPO_PUBLIC_FIREBASE_*` variables.
   2. Initialize Auth with `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })`.
   3. Initialize Firestore with `initializeFirestore(app, { experimentalForceLongPolling: true })`.
   4. If `EXPO_PUBLIC_USE_EMULATORS=true`, call `connectAuthEmulator` and `connectFirestoreEmulator` with `EXPO_PUBLIC_EMULATOR_HOST`.
   5. Return `createFirebaseApi({ auth, db })`.
3. Choose the emulator host by device:

| Device           | `EXPO_PUBLIC_EMULATOR_HOST` |
| ---------------- | --------------------------- |
| iOS simulator    | `127.0.0.1`                 |
| Android emulator | `10.0.2.2`                  |
| Physical phone   | your computer's LAN IP      |

4. Add `apps/mobile/.env.emulator`:

   ```
   EXPO_PUBLIC_API_MODE=firebase
   EXPO_PUBLIC_USE_EMULATORS=true
   EXPO_PUBLIC_EMULATOR_HOST=127.0.0.1
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-funswitch
   EXPO_PUBLIC_FIREBASE_API_KEY=fake
   ```

5. Hide the Dev Simulator in firebase mode.

**Test (`createApi.test.ts`, with the Firebase modules mocked):**

- each mode returns the correct implementation
- the emulator host from the environment is passed to both connect functions

**Run:** `npm test -w apps/mobile -- createApi && npx tsc --noEmit -p apps/mobile`.

### I2: Cross-check conformance

**Run:**

```
npm run test -w packages/contract
npm run test -w packages/backend
npm test -w apps/mobile -- conformance
```

All 19 cases must pass under both Vitest and Jest. Resolve any differences against the contract. Log any genuine gap in `CONTRACT_CHANGES.md` and agree on it with both sides before patching.

### I3: Maestro end-to-end test against the emulator

**Tasks**

1. Write `e2e/run_firebase.sh`. It:
   - seeds the emulator
   - starts `actAs` in the background as Sam, with `--action on --delay 8000`
   - runs `e2e/flows/firebase_full.yaml`
2. In that flow, Maya logs in and opens Flip Room, then uses `extendedWaitUntil` (timeout 20s) to wait for:
   - "Lights on"
   - "sam@demo.test turned it on"
3. The flow then taps the switch. Afterwards the script runs `actAs --action leave` and checks the Firestore state through the emulator's REST API.

**Run:**

```
npx firebase emulators:exec --only auth,firestore "bash apps/mobile/e2e/run_firebase.sh"
```

### I4: Manual checklist and release build

**Manual steps**

1. Start the emulators and seed the data.
2. Run the development build with `--mode emulator` settings on an iOS simulator and an Android emulator at the same time, signed in as two different users.
3. Confirm each of these:
   - the screens match both mock-ups, on phone and tablet widths
   - flips sync both ways in under 1 s
   - the slider commits only on release
   - backgrounding the app removes your presence chip on the other device, and it returns when you reopen; force-killing the app removes the chip within about 45 s
   - the sync pill moves through "Saving…" to "Live · in sync"
   - the stats update, and history shows emails and times with seconds
   - the session survives killing and relaunching the app

**Release build**

1. Create a real Firebase project and enable Email/Password auth.
2. Set the `EXPO_PUBLIC_FIREBASE_*` variables as EAS environment variables.
3. Run:

   ```
   firebase deploy --only firestore
   eas build --profile preview --platform all
   ```

---

## Instruction block to paste into each agent

> You are the **[Server / UI]** agent for FunSwitch, an **Expo SDK 58 (React Native 0.88, React 19.2) app** with a Firebase backend. Your steps are Part **[A / B]** of `funswitch-plan.md`. Rules:
>
> 1. `packages/contract` is read-only. Request changes in `CONTRACT_CHANGES.md`.
> 2. Do the steps strictly in order. Run each step's **Run** command and paste the output. Do not continue until it passes. Never weaken a test unless it contradicts the contract, and explain why if you do.
> 3. There is no real hardware. Devices are only Firestore documents or mock store entries.
> 4. The user's name is their email. Do not add display names.
> 5. **(UI only)**
>    - Follow the section 1 design spec and the reference images.
>    - Use a development build, not Expo Go.
>    - Install native packages with `npx expo install`.
>    - Do not use deep `react-native/Libraries/*` imports, `expo-router/react-navigation` exports or `InteractionManager`.
>    - Type refs with the instance types (`ViewInstance`, `TextInputInstance`).
>    - Never import `firebase/*` outside `src/api/createApi.ts`.
> 6. **(Server only)**
>    - Test only against the emulator, with project `demo-funswitch`.
>    - Keep `packages/backend/src` free of Node-only and React Native-only imports, except `node.ts`.
> 7. Finish with a summary: what was built, the final test output, and any open contract requests.
