# FunSwitch: Smart Home Controller Mock App Plan (v2)

## What changed from v1

- **New visual design.** The home page follows your grid wireframe (image 1). The device page follows the "Flip Room" design (image 2): a large bulb and switch on the left, and on the right the people viewing now, a database check panel and the flip history.
- **Navigation stays flat.** Home is one ungrouped grid. Tapping a tile opens that device's page, which holds its log.
- **Email is the user name.** There is no display name field anywhere. Avatars use the first letter of the email.
- **Login and signup pages** now have their own design and steps.
- **New backend features:**
  - presence, to fill "In the room now"
  - a per-device history query
  - a `flipCount` field on each device
  - a sync status for the "Live · in sync" pill
- **Removed:** the ‹ › arrows, global toasts and the global activity feed. None of them are in the new design.

---

## 0. Overview and assumptions

FunSwitch is a mock smart home controller. Users sign in with email and password, see a flat grid of devices, and control each one with an on/off switch or a 0–100 slider. All state lives in Firebase (Auth and Firestore), and every client updates in real time. No physical devices exist. A device is a Firestore document, and "turning it on" means changing a field.

The plan assumes:

1. **One shared home.** Every signed-in user sees and controls the same devices.
2. **Firestore is the database.** Its `onSnapshot` listeners provide the real-time updates.
3. **Each device type maps to one control.**

| Type    | Control | Headline noun |
| ------- | ------- | ------------- |
| light   | switch  | "Lights"      |
| plug    | switch  | "Plug"        |
| dimmer  | slider  | "Dimmer"      |
| fan     | slider  | "Fan"         |
| blinds  | slider  | "Blinds"      |
| speaker | slider  | "Volume"      |

4. **Stack.** TypeScript, React + Vite, Vitest, the Firebase Emulator Suite, and Playwright.

### Integration strategy

The agents share one contract package, `packages/contract`. It contains the types, the `HomeApi` interface and a conformance test suite.

- **Phase 0:** the contract is built once and frozen.
- **Server agent:** implements `HomeApi` on Firebase.
- **UI agent:** builds against an in-memory mock of the same interface.
- **Integration:** swaps the mock for the Firebase adapter with one environment variable.

```
funswitch/
  package.json              # npm workspaces
  firebase.json
  firestore.rules
  firestore.indexes.json
  packages/contract/        # Phase 0, frozen
  packages/backend/         # Server agent
  apps/web/                 # UI agent
  CONTRACT_CHANGES.md       # change requests only
```

---

## 1. Design spec (UI agent copies this; server agent ignores it)

### Design tokens

Put these in `apps/web/src/styles/tokens.css`.

| Token           | Value                                          | Use                                  |
| --------------- | ---------------------------------------------- | ------------------------------------ |
| `--bg`          | `#FFF1C7`                                      | warm cream page background           |
| `--card`        | `#FFFBEF`                                      | panels and tiles                     |
| `--card-border` | `#F3E3B0`                                      | panel borders                        |
| `--chip`        | `#E3E6F3`                                      | stat tiles and chips                 |
| `--ink`         | `#1F2340`                                      | headlines, OFF badge                 |
| `--ink-muted`   | `#6B6F86`                                      | labels                               |
| `--accent`      | `#FFC83D`                                      | ON badge, bulb glow, primary buttons |
| `--live`        | `#22A06B`                                      | "Live" dot                           |
| radius          | `20px` panels, `14px` tiles, `999px` pills     |                                      |
| font            | Inter / system sans; headline 56px, weight 800 |                                      |
| section labels  | 12px uppercase, letter-spacing 0.12em          | "IN THE ROOM NOW" style              |

Avatar color comes from a hash of the uid, picked from a palette of 6 colors (purple, pink, green, blue, orange, teal). The avatar letter is the first character of the email, uppercased.

### Header (every authenticated page)

- **Left:** a yellow dot followed by "funSwitch". On a device page this becomes a back arrow, a yellow dot and the device name. "Flip Room" in the mock-up is the device name.
- **Right:** a user pill with the avatar and the email, truncated with an ellipsis on narrow screens. It opens a small menu with "Sign out".

### Login and signup pages

- A centered card (max 400px) on `--bg`, with the yellow dot and "funSwitch" logo on top.
- **Login:** email, password, a full-width yellow "Log in" button, and the link "No account? Sign up".
- **Signup:** email, password, confirm password, a "Create account" button, and the link "Have an account? Log in".
- Errors appear inline in red under the form.

### Home page (image 1)

- Show a centered, pill-shaped "Add Switch" button under the header.
- Below it, a grid of square tiles: 2 columns on mobile and up to 4 on desktop, with 16–24px gaps.
- Each tile contains three things:
  - a small switch icon, filled `--accent` when on/level > 0 and grey when off
  - the device name
  - a state line, e.g. "Lights off" / "Lights on" for switches and "Fan · 60%" for sliders
- Tapping a tile opens `/devices/:id`. There is no control on the tile itself.
- An empty state reads "No switches yet. Add one!" with the button.

### Device page (image 2)

The page has two columns on desktop (≥ 900px) and stacks them on mobile.

**Left panel (main card)**

1. A hanging bulb illustration (inline SVG). For switch devices, the glow uses `--accent` at opacity 1 when on and 0 when off. For slider devices, the opacity is `level / 100`. Transition time is 300ms.
2. A large headline: "Lights on" / "Lights off" for switches, and "Fan 60%" for sliders.
3. The control:
   - **Switch:** a wall-plate rocker, 150×190px, with screw dots. The rocker shows a yellow "ON" at the top when on and a navy "OFF" at the bottom when off. The whole plate is the click target.
   - **Slider:** a wall plate holding a vertical or wide horizontal range slider, with the value shown.
4. A last-action line: avatar, then "maya@x.com turned it on · just now". Relative time updates every 30s.
5. A sync pill:
   - "● Live · in sync" (green) when the listener is active and nothing is pending
   - "● Saving…" (amber) while a write is pending
   - "● Offline" (grey) when the listener has errored
6. A small text-style "Delete switch" button at the bottom, with a confirm dialog.

**Right column (three stacked panels)**

1. **IN THE ROOM NOW:** chips with an avatar and a name for each user currently viewing this device. The current user appears as "You", always first. A chip is outlined in `--accent` for 3s after that person flips the switch.
2. **DATABASE CHECK:** three stat tiles.
   - **flips logged** is `device.flipCount`.
   - **last save** is the round-trip ms of this client's last write, or "—" if there is none.
   - **live updates** counts device snapshots received since the page opened, excluding the first.
3. **FLIP HISTORY:** the last 20 events for this device, newest first.
   - Each row shows the avatar, the email (or "You"), an ON (yellow) / OFF (navy) / "60%" (chip) badge, and the time formatted with seconds ("2:41:07 PM").
   - Rows are separated by dashed dividers, and new rows animate in.

---

## Phase 0: Shared contract (run once, before splitting)

### Step 0.1: Scaffold the workspace

**Tasks**

1. Create the root `package.json` with workspaces `["packages/*", "apps/*"]`.
2. Add a strict `tsconfig.base.json` and Vitest.
3. Create `packages/contract/src/index.ts`.

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

Create `validation.ts`:

- `validateEmail(email)` uses a simple regex and throws `HomeApiError('validation')`. The UI uses it before calling `signIn` or `signUp`.
- `validatePassword(password)` requires at least 6 characters and throws `'auth/weak-password'`.
- `validateDeviceName(name)` returns the trimmed name.
- `validateLevel(n)` requires an integer from 0 to 100.
- `isDeviceType(x)` is a type guard.

Create `format.ts`:

- `headline(device)` returns "Lights on", "Lights off" or "Fan 60%".
- `tileStateLine(device)` returns "Lights off" or "Fan · 60%".
- `lastActionLine(event, me)` returns "maya@x.com turned it on". When the actor is `me`, it returns "You turned it on".
- `badge(event)` returns `{ kind: 'on' | 'off' | 'level' | 'added' | 'removed', text }`.
- `avatarLetter(email)` returns the uppercased first character.
- `avatarColorIndex(uid)` returns a stable value from 0 to 5.

**Test (`validation.test.ts`, `format.test.ts`):**

- `"a@b"` and `"bad"` are rejected by `validateEmail`, and `"a@b.co"` is accepted
- passwords shorter than 6 characters are rejected
- names are trimmed, and empty or 41-character names are rejected
- `-1`, `101` and `50.5` are rejected, while `0` and `100` are accepted
- every `DeviceType` has both a control and a noun
- each headline and line format matches its example above
- `avatarColorIndex` is stable for the same uid and always within 0–5

**Run:** `npm run test -w packages/contract`.

### Step 0.4: Conformance test suite

Create `packages/contract/src/conformance.ts`, which exports `runHomeApiConformance(name, factory)`.

`factory(opts: HomeApiOptions)` returns `{ clientA, clientB, reset() }`. The two clients share one backend. Use a `waitFor(predicate, timeout = 3000)` helper for real-time assertions.

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
11. `subscribeOne` emits `meta.pendingWrites === true` at least once during A's own write, then `false`. Skip this check for the mock if its latency is 0.
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

**Agent instructions:** Do steps S1–S8 in order. After each step, run its **Run** command. Do not continue until it passes. Fix the implementation, not the tests, unless a test contradicts the contract. Paste test output after each step.

### S1: Firebase project and emulators

**Tasks**

1. Install `firebase-tools`.
2. Create `firebase.json` with the Auth emulator on port 9099, the Firestore emulator on port 8080, the emulator UI on, and hosting pointing to `apps/web/dist`.
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

**Test (`rules.test.ts`):**

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
  - one where the `lastChangedBy.email` does not match the token
- updating or deleting activity is denied
- writing another user's presence document is denied

**Run:** `npm run test -w packages/backend -- rules`.

### S3: Auth adapter

**Tasks:** In `packages/backend/src/index.ts`, create `createFirebaseApi(app, opts?)` and `connectToEmulators(app)`, starting with `auth`:

1. **`signUp`** calls `createUserWithEmailAndPassword`, then writes `users/{uid}`.
2. **Error mapping** converts Firebase codes to contract codes:
   - `auth/invalid-credential`, `auth/wrong-password` and `auth/user-not-found` become `auth/invalid-credentials`
   - `auth/email-already-in-use` becomes `auth/email-in-use`
   - `auth/weak-password` and `auth/invalid-email` pass through
3. **`onAuthChanged`** returns users as `{ uid, email }`.

**Test (`auth.test.ts`):** conformance cases 1–3, plus checks that `signOut` triggers `onAuthChanged(null)` and that the `users/{uid}` document exists after sign-up.

**Run:** `npm run test -w packages/backend -- auth`.

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

**Test (`devices.test.ts`):** conformance cases 4–12, using two Firebase app instances (`'A'` and `'B'`) signed in as different users.

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

### S8: Seed script and README

**Tasks**

1. Create `scripts/seed.ts`. Against the emulator only, it creates:
   - users `maya@demo.test`, `sam@demo.test` and `jas@demo.test` (password `password123`)
   - six devices covering all types
   - about 10 flips spread across the users, so the history and flip counts aren't empty
2. Write a README that covers starting the emulators, seeding, deploying rules and indexes, and the `VITE_FIREBASE_*` and `VITE_USE_EMULATORS` variables.

**Test:** the seed script exits 0, and the emulator UI shows 3 users, 6 devices and about 16 activity documents.

**Run:** `npx firebase emulators:exec --only auth,firestore "npm run seed -w packages/backend"`.

---

## Part B: UI agent

**Agent instructions:** Do steps U1–U9 in order, following the design spec in section 1. Use only the `HomeApi` interface. Never import `firebase/*` outside `src/api/createApi.ts`. After each step, run its **Run** command. Do not continue until it passes. Paste test output after each step.

### U1: Scaffold, routes and design tokens

**Tasks**

1. Create `apps/web` with Vite + React + TypeScript, `react-router-dom`, Vitest + Testing Library + jsdom, and Playwright.
2. Add `tokens.css` and base styles from section 1.
3. Set up the routes:

| Route          | Page          | Access    |
| -------------- | ------------- | --------- |
| `/login`       | LoginPage     | public    |
| `/signup`      | SignupPage    | public    |
| `/`            | HomePage      | protected |
| `/devices/new` | AddSwitchPage | protected |
| `/devices/:id` | DevicePage    | protected |

4. Build the shared components: `Header` (with back mode), `UserPill`, `Avatar` (using `avatarLetter` and `avatarColorIndex`), `Panel` and `SectionLabel`.

**Test:** `App.test.tsx` renders `/login` and finds "funSwitch". `Avatar.test.tsx` checks that `jas@x.com` renders "J" and that the same uid always gets the same color class.

**Run:** `npm run test -w apps/web`.

### U2: Mock API and provider

**Tasks**

1. Create `src/api/mockApi.ts` exporting `createMockApi(store?, opts?)`. It should:
   - keep users, devices, activity and presence in a shared `MockStore`, so two instances on one store act as two clients
   - notify subscribers through an internal event emitter
   - sync across tabs through `BroadcastChannel('funswitch-mock')`
   - simulate configurable latency (default 50–150 ms, 0 in tests)
   - set `pendingWrites: true` on `subscribeOne` until the simulated save lands
   - follow the same validation, error codes and presence TTL logic as the contract
2. Build `ApiProvider` and `useApi()`, plus `createApi.ts`. `VITE_API_MODE=mock` is the default; the `firebase` mode is a stub until integration.
3. Write the hooks. Each cleans up its subscriptions on unmount.

| Hook                   | Returns / behavior                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `useAuth()`            | the current user and auth state                                                                 |
| `useDevices()`         | `{ data, loading, error }` for the device list                                                  |
| `useDevice(id)`        | `{ device, meta, loading, error, liveUpdates }`; `liveUpdates` counts snapshots after the first |
| `useDeviceHistory(id)` | the device's activity events                                                                    |
| `usePresence(id)`      | joins on mount, leaves on unmount, and returns the viewers                                      |
| `useTimedSave()`       | wraps a write promise and records `lastSaveMs` with `performance.now()`                         |

**Test**

- `mockApi.conformance.test.ts` runs `runHomeApiConformance('mock', ...)`, and all 19 cases pass. Use fake timers for presence TTL.
- `hooks.test.tsx` checks that:
  - `useDevice` increments `liveUpdates` on remote changes but not on the first emit
  - `usePresence` calls `leave` on unmount
  - `useTimedSave` records a number greater than or equal to 0

**Run:** `npm run test -w apps/web`.

### U3: Login and signup pages

**Tasks**

1. Build both pages as described in section 1.
2. Validate on the client with `validateEmail`, `validatePassword` and the confirm-password match. Map error codes to messages:

| Code                       | Message                                      |
| -------------------------- | -------------------------------------------- |
| `auth/invalid-credentials` | "Wrong email or password."                   |
| `auth/email-in-use`        | "An account with this email already exists." |
| `auth/weak-password`       | "Password must be at least 6 characters."    |
| `auth/invalid-email`       | "Enter a valid email."                       |

3. The submit button is disabled and shows a spinner while pending.
4. A successful login or signup navigates to `/`.
5. Signed-in users visiting `/login` or `/signup` are redirected to `/`.
6. `ProtectedRoute` redirects signed-out users to `/login`, keeping the intended path (`?next=`).
7. `UserPill` shows the email, and its "Sign out" option returns to `/login`.

**Test (`auth.test.tsx`):**

- a successful login lands on `/` with the email in the header
- a wrong password shows its message
- a mismatched confirm password shows an error and never calls `signUp`
- a duplicate email shows its message
- the button is disabled while pending
- a protected route redirects and then returns to `next` after login
- sign-out works
- a signed-in user visiting `/login` is redirected

**Run:** `npm run test -w apps/web -- auth`.

### U4: Home page grid (image 1)

**Tasks**

1. Add the "Add Switch" pill button, which goes to `/devices/new`.
2. Build the tile grid with responsive columns (2 → 3 → 4).
3. Each `DeviceTile` shows the switch icon (filled when on or level > 0), the name and `tileStateLine`. The whole tile is a link, with `aria-label` set to "{name}, {state}".
4. Add the empty state, a loading skeleton of 6 grey tiles, and an error banner.

**Test (`HomePage.test.tsx`):**

- the empty state renders with no devices
- 3 seeded devices render in order with the correct state lines
- **real-time:** client B adds a device and a fourth tile appears
- B turns a light on, and that tile changes to "Lights on" with the filled icon
- B removes a device and its tile disappears
- clicking a tile navigates to `/devices/:id`

**Run:** `npm run test -w apps/web -- HomePage`.

### U5: Add Switch page

**Tasks**

1. Build a card styled like the login card, containing:
   - a name input
   - a type picker of 6 large tappable chips with icons
   - helper text ("On/off switch" or "0–100 slider") from `DEVICE_TYPE_CONTROL`
   - "Create" and "Cancel" buttons
2. Validate with `validateDeviceName`.
3. On success, navigate to the new device's page.

**Test (`AddSwitchPage.test.tsx`):**

- an empty name shows an error, and `add` is not called
- picking "fan" shows the slider helper text
- a valid submit calls `add({ name: 'Desk Lamp', type: 'light' })` with the trimmed name and navigates to `/devices/<id>`
- Cancel returns to `/`

**Run:** `npm run test -w apps/web -- AddSwitchPage`.

### U6: Device page, left panel (image 2)

**Tasks**

1. Set the header to back mode, showing the device name.
2. **`Bulb`** is an SVG whose glow opacity follows the device state, with a 300ms transition.
3. The headline uses `headline(device)`.
4. **`WallSwitch`** for switch devices:
   - it uses `role="switch"` and `aria-checked`, and responds to click and Space/Enter
   - it updates optimistically and calls `setOn` through `useTimedSave`
   - on error it reverts and shows an inline error
5. **`WallSlider`** for slider devices:
   - it holds local state while dragging and ignores remote values meanwhile
   - it calls `setLevel` once on release or keyboard commit (debounced 150ms) through `useTimedSave`
   - on error it reverts
6. **Last-action line:** the newest event from `useDeviceHistory`, formatted with `lastActionLine` plus a relative time ("just now", "2m ago") that refreshes every 30s.
7. **Sync pill:**
   - "Offline" when `useDevice` has an error
   - otherwise "Saving…" when `meta.pendingWrites` is true
   - otherwise "Live · in sync"
8. **"Delete switch"** opens a confirm dialog, calls `remove`, and navigates to `/`. If the device becomes `null` remotely, show "This switch was removed" and a back link.

**Test (`DevicePageLeft.test.tsx`):**

- the headline shows "Lights off", and clicking the switch makes it "Lights on" immediately, with `aria-checked` true and `setOn(id, true)` called once
- a rejected write reverts the switch
- B's flip updates the headline and the last-action line ("sam@demo.test turned it on · just now")
- a slider drag of 20 → 50 → 60 followed by release produces exactly one `setLevel(id, 60)`, and the headline becomes "Fan 60%"
- the sync pill shows "Saving…" while pending and "Live · in sync" after the save lands
- delete navigates home
- a remote removal shows the removed message

**Run:** `npm run test -w apps/web -- DevicePageLeft`.

### U7: Device page, flip history panel

**Tasks**

1. Build `FlipHistory` using `useDeviceHistory(id)` with a limit of 20.
2. Each row shows the avatar, the email (or "You" for the current user), a badge from `badge(event)`, and `toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })`.
3. Rows have dashed dividers, and new rows get a fade-in.
4. When there is no history, show "No flips yet."

**Test (`FlipHistory.test.tsx`):**

- 5 seeded events render newest first with the correct ON/OFF/level badges and the time format
- the current user's rows show "You"
- an event from B appears at the top without a reload
- events for another device never appear

**Run:** `npm run test -w apps/web -- FlipHistory`.

### U8: Device page, "In the room now" and "Database check"

**Tasks**

1. **`RoomPresence`** uses `usePresence(id)`.
   - It renders "You" first, then the others sorted by email.
   - A chip gets the accent outline for 3 s when that user is the actor of a new history event.
2. **`DatabaseCheck`** shows three stat tiles:

| Tile         | Source                                              |
| ------------ | --------------------------------------------------- |
| flips logged | `device.flipCount`                                  |
| last save    | `lastSaveMs` from `useTimedSave`, as "84ms", or "—" |
| live updates | `liveUpdates` from `useDevice`                      |

3. On desktop, use a two-column layout (left 1fr, right 1fr). Below 900px, stack the panels.

**Test (`RightColumn.test.tsx`, using fake timers):**

- opening the page shows a "You" chip
- when client B joins the same device, a "sam@…" chip appears, and it disappears after B leaves
- B flips the switch, the Sam chip gets the highlight class, and the class is removed after 3 s
- flips logged rises from 0 to 1 after a flip
- last save shows a value ending in "ms" after my own flip and "—" before it
- live updates increments on B's flip but not on page load

**Run:** `npm run test -w apps/web -- RightColumn`.

### U9: End-to-end test on the mock

**Tasks:** Configure Playwright with `VITE_API_MODE=mock` and write `e2e/mock.spec.ts`. Page 1 and page 2 share the same browser context, so BroadcastChannel keeps them in sync.

1. Page 1 signs up as `maya@demo.test`, adds "Flip Room" (light) and "Ceiling Fan" (fan), and sees two tiles reading "Lights off" and "Fan · 0%".
2. Page 2 signs up as `jas@demo.test`, opens Flip Room, and sees two presence chips once page 1 also opens it.
3. Page 2 flips the switch on. Within 2 s, page 1 shows:
   - the headline "Lights on"
   - the last-action line "jas@demo.test turned it on"
   - a history row with an ON badge
   - flips logged = 1
4. Page 1 goes back home, and the Flip Room tile reads "Lights on".
5. Page 1 sets the fan to 60, and page 2's tile reads "Fan · 60%".
6. Page 2 deletes the fan, and the tile disappears on page 1.
7. Take screenshots of the home page and the device page at 390px and 1280px widths, and save them under `e2e/screenshots/` for visual comparison against the mock-ups.

**Run:**

```
npx playwright test -c apps/web e2e/mock.spec.ts
npm run test -w apps/web && npm run build -w apps/web
```

---

## Part C: Integration

### I1: Wire the Firebase adapter

**Tasks**

1. Add `@funswitch/backend` to `apps/web`.
2. In `createApi.ts`, the `firebase` branch initializes from the `VITE_FIREBASE_*` variables, calls `connectToEmulators` if `VITE_USE_EMULATORS=true`, and returns `createFirebaseApi(app)`.
3. Add `apps/web/.env.emulator`:

   ```
   VITE_API_MODE=firebase
   VITE_USE_EMULATORS=true
   VITE_FIREBASE_PROJECT_ID=demo-funswitch
   VITE_FIREBASE_API_KEY=fake
   ```

**Test:** `createApi.test.ts` checks that each mode returns the correct implementation.

**Run:** `npm run test -w apps/web -- createApi`.

### I2: Cross-check conformance

**Run:**

```
npm run test -w packages/contract
npm run test -w packages/backend
npm run test -w apps/web -- conformance
```

Both implementations must pass all 19 cases. Resolve any differences against the contract. Log any genuine gap in `CONTRACT_CHANGES.md` and agree on it before patching.

### I3: End-to-end test on the emulator

**Tasks:** Create `e2e/firebase.spec.ts`. It repeats the U9 scenario, with two differences:

- it uses two separate browser contexts, so sync comes from Firestore and not BroadcastChannel
- it clears the emulators before running

Add a Playwright `webServer` entry that runs `vite --mode emulator`.

**Run:**

```
npx firebase emulators:exec --only auth,firestore "npx playwright test -c apps/web e2e/firebase.spec.ts"
```

### I4: Manual checklist and optional deploy

**Manual steps**

1. Start the emulators, seed the data, and run `npm run dev -w apps/web -- --mode emulator`.
2. Sign in as two users in two different browsers.
3. Confirm each of these:
   - the home page matches image 1 and the device page matches image 2
   - flips sync both ways in under 1 s
   - presence chips appear and disappear as people open and leave a device, including closing a tab: the chip disappears within about 45 s
   - the sync pill moves through "Saving…" to "Live · in sync"
   - the stats update
   - history shows emails and seconds
   - refreshing keeps you logged in

**Optional deploy**

1. Create a real Firebase project and enable Email/Password auth.
2. Fill `.env.production`.
3. Run:

   ```
   npm run build -w apps/web && firebase deploy --only hosting,firestore
   ```

---

## Instruction block to paste into each agent

> You are the **[Server / UI]** agent for FunSwitch. Your steps are Part **[A / B]** of the plan. Rules:
>
> 1. `packages/contract` is read-only. Request changes in `CONTRACT_CHANGES.md`.
> 2. Do the steps strictly in order. After each step, run its **Run** command and paste the output. Do not continue until it passes. Never weaken a test to make it pass unless it contradicts the contract, and if so, explain why.
> 3. There is no real hardware. Devices are only Firestore documents or mock store entries.
> 4. The user's name is their email. Do not add display names.
> 5. **(UI only)** Follow the design spec in section 1 and the reference images. Never import `firebase/*` outside `api/createApi.ts`.
> 6. **(Server only)** Test only against the emulator, with project `demo-funswitch`.
> 7. Finish with a summary: what was built, the final test output, and any open contract requests.
