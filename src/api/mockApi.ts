import {
  DEVICE_TYPE_CONTROL,
  HomeApiError,
  isDeviceType,
  validateDeviceName,
  validateEmail,
  validateLevel,
  validatePassword,
  type ActivityAction,
  type ActivityEvent,
  type Device,
  type HomeApi,
  type HomeApiOptions,
  type PresenceEntry,
  type SyncMeta,
  type Unsubscribe,
  type User,
} from '@funswitch/contract';

/** Minimal key-value storage (AsyncStorage satisfies this). */
export interface MockStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

interface StoredUser extends User {
  password: string;
}

interface PersistedState {
  users: StoredUser[];
  devices: Device[];
  events: StoredEvent[];
  seq: number;
  sessions: Record<string, User>;
}

interface StoredEvent {
  event: ActivityEvent;
  seq: number; // tie-breaker when two events share a millisecond
}

/**
 * The shared "backend" for mock clients. Two clients created on one store
 * behave like two signed-in users on the same Firestore database.
 */
export interface MockStore {
  users: Map<string, StoredUser>; // keyed by lowercased email
  devices: Map<string, Device>;
  events: StoredEvent[];
  presence: Map<string, Map<string, PresenceEntry>>;
  sessions: Record<string, User>;
  seq: number;
  isReady: boolean;
  ready: Promise<void>;
  subscribe(listener: () => void): Unsubscribe;
  notify(): void;
  nextId(prefix: string): string;
  reset(): void;
}

export function createMockStore(options: { storage?: MockStorage; storageKey?: string } = {}): MockStore {
  const { storage, storageKey = 'funswitch-mock-store' } = options;
  const listeners = new Set<() => void>();

  const store: MockStore = {
    users: new Map(),
    devices: new Map(),
    events: [],
    presence: new Map(),
    sessions: {},
    seq: 0,
    isReady: !storage,
    ready: Promise.resolve(),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify() {
      persist();
      [...listeners].forEach((listener) => listener());
    },
    nextId(prefix) {
      store.seq += 1;
      return `${prefix}_${Date.now().toString(36)}${store.seq.toString(36)}`;
    },
    reset() {
      store.users.clear();
      store.devices.clear();
      store.events = [];
      store.presence.clear();
      store.sessions = {};
      store.notify();
    },
  };

  function persist(): void {
    if (!storage || !store.isReady) return;
    const state: PersistedState = {
      users: [...store.users.values()],
      devices: [...store.devices.values()],
      events: store.events,
      seq: store.seq,
      sessions: store.sessions,
    };
    storage.setItem(storageKey, JSON.stringify(state)).catch(() => {});
  }

  if (storage) {
    store.ready = storage
      .getItem(storageKey)
      .then((raw) => {
        if (!raw) return;
        const state = JSON.parse(raw) as PersistedState;
        state.users.forEach((user) => store.users.set(user.email.toLowerCase(), user));
        state.devices.forEach((device) => store.devices.set(device.id, device));
        store.events = state.events;
        store.seq = state.seq;
        store.sessions = state.sessions;
      })
      .catch(() => {})
      .finally(() => {
        store.isReady = true;
      });
  }
  return store;
}

export interface MockApiOptions extends HomeApiOptions {
  /** Simulated write latency: a fixed ms value or a [min, max] range. Default 50–150 ms. */
  latencyMs?: number | [number, number];
  /** When set, this client's session is persisted in the store under this key. */
  sessionKey?: string;
}

export type MockHomeApi = HomeApi & { dispose(): void };

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function createMockApi(store: MockStore = createMockStore(), opts: MockApiOptions = {}): MockHomeApi {
  const latency = opts.latencyMs ?? [50, 150];
  const ttl = opts.presenceTtlMs ?? 45_000;
  const heartbeatMs = opts.presenceHeartbeatMs ?? 15_000;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const current = new Map<string, symbol>(); // deviceId -> token of the latest join()
  const intervals = new Set<ReturnType<typeof setInterval>>();
  const authListeners = new Set<(user: User | null) => void>();
  // Latency-compensated local values, like Firestore's pending writes.
  const overlays = new Map<string, { device: Device; pending: number }>();

  let me: User | null = null;
  const hydrate = () => {
    if (opts.sessionKey) me = store.sessions[opts.sessionKey] ?? null;
  };
  if (store.isReady) hydrate();
  else store.ready.then(hydrate);

  function pickLatency(): number {
    return typeof latency === 'number' ? latency : latency[0] + Math.random() * (latency[1] - latency[0]);
  }
  function wait(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        resolve();
      }, ms);
      timers.add(timer);
    });
  }
  function requireUser(): User {
    if (!me) throw new HomeApiError('auth/not-signed-in');
    return me;
  }
  function setUser(user: User | null): void {
    me = user;
    if (opts.sessionKey) {
      if (user) store.sessions[opts.sessionKey] = user;
      else delete store.sessions[opts.sessionKey];
    }
    [...authListeners].forEach((listener) => listener(me));
    store.notify();
  }
  function view(id: string): Device | undefined {
    return overlays.get(id)?.device ?? store.devices.get(id);
  }
  function addEvent(device: Device, actor: User, action: ActivityAction, level?: number): void {
    store.seq += 1;
    const event: ActivityEvent = {
      id: store.nextId('evt'),
      deviceId: device.id,
      deviceName: device.name,
      actor: { uid: actor.uid, email: actor.email },
      action,
      ...(action === 'set_level' ? { level } : {}),
      at: Date.now(),
    };
    store.events.push({ event, seq: store.seq });
  }

  /** Shows the change locally with pendingWrites, then "lands" it after the simulated latency. */
  async function commit(id: string, change: (current: Device, actor: User) => Device, action: (next: Device) => [ActivityAction, number?]): Promise<void> {
    const actor = requireUser();
    const ms = pickLatency();
    if (ms > 0) {
      const base = view(id)!;
      overlays.set(id, { device: change(base, actor), pending: (overlays.get(id)?.pending ?? 0) + 1 });
      store.notify();
      await wait(ms);
      const overlay = overlays.get(id);
      if (overlay && --overlay.pending <= 0) overlays.delete(id);
    }
    const current = store.devices.get(id);
    if (!current) {
      store.notify();
      throw new HomeApiError('not-found');
    }
    const next = change(current, actor);
    store.devices.set(id, next);
    const [kind, level] = action(next);
    addEvent(next, actor, kind, level);
    store.notify();
  }

  function existing(id: string): Device {
    const device = store.devices.get(id);
    if (!device) throw new HomeApiError('not-found');
    return device;
  }

  /** Recomputes a value on every store change and calls cb only when it differs. */
  function watch<T>(compute: () => T, cb: (value: T) => void, key: (value: T) => unknown = (v) => v, onRun?: (run: () => void) => void): Unsubscribe {
    let active = true;
    let last: unknown = Symbol('none');
    const run = () => {
      if (!active) return;
      const value = compute();
      const k = key(value);
      if (sameJson(k, last)) return;
      last = JSON.parse(JSON.stringify(k ?? null));
      cb(value);
    };
    const stop = store.subscribe(run);
    onRun?.(run);
    if (store.isReady) run();
    else store.ready.then(run);
    return () => {
      active = false;
      stop();
    };
  }

  const api: MockHomeApi = {
    auth: {
      async signUp(email, password) {
        await store.ready;
        try {
          validateEmail(email);
        } catch {
          throw new HomeApiError('auth/invalid-email');
        }
        validatePassword(password);
        await wait(pickLatency());
        const key = email.toLowerCase();
        if (store.users.has(key)) throw new HomeApiError('auth/email-in-use');
        const user: StoredUser = { uid: store.nextId('uid'), email, password };
        store.users.set(key, user);
        setUser({ uid: user.uid, email: user.email });
        return { uid: user.uid, email: user.email };
      },
      async signIn(email, password) {
        await store.ready;
        await wait(pickLatency());
        const user = store.users.get(email.toLowerCase());
        if (!user || user.password !== password) throw new HomeApiError('auth/invalid-credentials');
        setUser({ uid: user.uid, email: user.email });
        return { uid: user.uid, email: user.email };
      },
      async signOut() {
        setUser(null);
      },
      currentUser: () => me,
      onAuthChanged(cb) {
        let active = true;
        const listener = (user: User | null) => active && cb(user);
        authListeners.add(listener);
        if (store.isReady) cb(me);
        else store.ready.then(() => listener(me));
        return () => {
          active = false;
          authListeners.delete(listener);
        };
      },
    },

    devices: {
      subscribe(cb) {
        return watch(() => [...store.devices.keys()].map((id) => view(id)!).sort((a, b) => a.createdAt - b.createdAt), cb);
      },
      subscribeOne(id, cb) {
        return watch(
          () => ({ device: view(id) ?? null, meta: { pendingWrites: overlays.has(id), fromCache: false } as SyncMeta }),
          ({ device, meta }) => cb(device, meta),
        );
      },
      async add({ name, type }) {
        const actor = requireUser();
        const trimmed = validateDeviceName(name);
        if (!isDeviceType(type)) throw new HomeApiError('validation', 'Unknown device type.');
        await wait(pickLatency());
        const now = Date.now();
        const base = {
          id: store.nextId('dev'),
          name: trimmed,
          type,
          createdAt: now,
          createdBy: actor.uid,
          updatedAt: now,
          lastChangedBy: { uid: actor.uid, email: actor.email },
          flipCount: 0,
        };
        const device: Device = DEVICE_TYPE_CONTROL[type] === 'switch' ? { ...base, control: 'switch', on: false } : { ...base, control: 'slider', level: 0 };
        store.devices.set(device.id, device);
        addEvent(device, actor, 'added');
        store.notify();
        return device.id;
      },
      async setOn(id, on) {
        requireUser();
        if (typeof on !== 'boolean') throw new HomeApiError('validation');
        if (existing(id).control !== 'switch') throw new HomeApiError('validation', 'Not a switch.');
        await commit(
          id,
          (d, actor) => ({ ...d, on, updatedAt: Date.now(), lastChangedBy: { uid: actor.uid, email: actor.email }, flipCount: d.flipCount + 1 }) as Device,
          () => [on ? 'turned_on' : 'turned_off'],
        );
      },
      async setLevel(id, level) {
        requireUser();
        validateLevel(level);
        if (existing(id).control !== 'slider') throw new HomeApiError('validation', 'Not a slider.');
        await commit(
          id,
          (d, actor) => ({ ...d, level, updatedAt: Date.now(), lastChangedBy: { uid: actor.uid, email: actor.email }, flipCount: d.flipCount + 1 }) as Device,
          () => ['set_level', level],
        );
      },
      async remove(id) {
        const actor = requireUser();
        existing(id);
        await wait(pickLatency());
        const device = existing(id);
        store.devices.delete(id);
        overlays.delete(id);
        addEvent(device, actor, 'removed');
        store.notify();
      },
    },

    activity: {
      subscribeForDevice(deviceId, cb, limit = 20) {
        return watch(
          () =>
            store.events
              .filter(({ event }) => event.deviceId === deviceId)
              .sort((a, b) => b.event.at - a.event.at || b.seq - a.seq)
              .slice(0, limit)
              .map(({ event }) => ({ ...event })),
          cb,
        );
      },
    },

    presence: {
      async join(deviceId) {
        const user = requireUser();
        await wait(pickLatency());
        const token = Symbol(deviceId);
        const beat = () => {
          let viewers = store.presence.get(deviceId);
          if (!viewers) store.presence.set(deviceId, (viewers = new Map()));
          viewers.set(user.uid, { uid: user.uid, email: user.email, lastSeen: Date.now() });
          store.notify();
        };
        beat();
        current.set(deviceId, token);
        const interval = heartbeatMs > 0 ? setInterval(beat, heartbeatMs) : null;
        if (interval) intervals.add(interval);
        return async () => {
          if (interval) {
            clearInterval(interval);
            intervals.delete(interval);
          }
          // A later join() of the same device owns the entry now.
          if (current.get(deviceId) !== token) return;
          current.delete(deviceId);
          store.presence.get(deviceId)?.delete(user.uid);
          store.notify();
        };
      },
      subscribe(deviceId, cb) {
        const compute = () =>
          [...(store.presence.get(deviceId)?.values() ?? [])]
            .filter((entry) => Date.now() - entry.lastSeen < ttl)
            .sort((a, b) => a.email.localeCompare(b.email));
        let recheck = () => {};
        const stop = watch(compute, cb, (list) => list.map((entry) => entry.uid), (run) => (recheck = run));
        // Re-evaluate the TTL even when nothing is written.
        const interval = setInterval(() => recheck(), Math.max(50, ttl / 3));
        intervals.add(interval);
        return () => {
          stop();
          clearInterval(interval);
          intervals.delete(interval);
        };
      },
    },

    dispose() {
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      timers.clear();
      intervals.clear();
      authListeners.clear();
    },
  };
  return api;
}
