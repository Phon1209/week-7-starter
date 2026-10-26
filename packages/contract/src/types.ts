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
