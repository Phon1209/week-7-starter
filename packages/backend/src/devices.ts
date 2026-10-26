import {
  DEVICE_TYPE_CONTROL, HomeApiError, isDeviceType, validateDeviceName, validateLevel,
  type Actor, type Device, type HomeApi, type SyncMeta,
} from '@funswitch/contract';
import {
  collection, doc, increment, onSnapshot, orderBy, query, runTransaction, serverTimestamp, writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { deviceView, eventData, validateId } from './data';
import { mapError, mapped } from './errors';

export function createDevices(db: Firestore, requireUser: () => Actor): HomeApi['devices'] {
  const devices = collection(db, 'devices');
  const activity = collection(db, 'activity');
  const pending = new Map<string, number>();
  const listeners = new Map<string, Set<() => void>>();
  function markPending(id: string, delta: number): void {
    const count = (pending.get(id) ?? 0) + delta;
    if (count > 0) pending.set(id, count); else pending.delete(id);
    listeners.get(id)?.forEach((emit) => emit());
  }
  async function mutate(id: string, control: 'switch' | 'slider', value: boolean | number): Promise<void> {
    const actor = requireUser();
    validateId(id);
    if (control === 'slider') validateLevel(value as number);
    else if (typeof value !== 'boolean') throw new HomeApiError('validation', 'Switch state must be a boolean.');
    const ref = doc(devices, id), event = doc(activity);
    // Transactions bypass Firestore's local write queue. Track in-flight
    // transactions as well as snapshot.hasPendingWrites for accurate save status.
    markPending(id, 1);
    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) throw new HomeApiError('not-found');
        const device = snapshot.data();
        if (device.control !== control) throw new HomeApiError('validation', 'Wrong control for this device.');
        transaction.update(ref, {
          [control === 'switch' ? 'on' : 'level']: value,
          updatedAt: serverTimestamp(), lastChangedBy: actor, flipCount: increment(1),
        });
        transaction.set(event, eventData(id, device.name, actor,
          control === 'slider' ? 'set_level' : value ? 'turned_on' : 'turned_off',
          control === 'slider' ? value as number : undefined));
      });
    } finally { markPending(id, -1); }
  }
  return {
    subscribe(callback, onError) {
      requireUser();
      return onSnapshot(query(devices, orderBy('createdAt')), (snapshot) => {
        callback(snapshot.docs.map((item) => deviceView(item)!));
      }, (error) => onError?.(mapError(error)));
    },
    subscribeOne(id, callback, onError) {
      requireUser(); validateId(id);
      let active = true;
      let latest: { device: Device | null; meta: SyncMeta } | undefined;
      const emit = () => {
        if (active && latest) callback(latest.device, {
          ...latest.meta, pendingWrites: latest.meta.pendingWrites || (pending.get(id) ?? 0) > 0,
        });
      };
      const group = listeners.get(id) ?? new Set<() => void>();
      group.add(emit); listeners.set(id, group);
      const stop = onSnapshot(doc(devices, id), { includeMetadataChanges: true }, (snapshot) => {
        latest = { device: deviceView(snapshot), meta: { pendingWrites: snapshot.metadata.hasPendingWrites, fromCache: snapshot.metadata.fromCache } };
        emit();
      }, (error) => { if (active) onError?.(mapError(error)); });
      return () => {
        if (!active) return;
        active = false; stop(); group.delete(emit);
        if (group.size === 0 && listeners.get(id) === group) listeners.delete(id);
      };
    },
    add: (input) => mapped(async () => {
      const actor = requireUser();
      const name = validateDeviceName(input.name);
      if (!isDeviceType(input.type)) throw new HomeApiError('validation', 'Unknown device type.');
      const control = DEVICE_TYPE_CONTROL[input.type];
      const ref = doc(devices);
      const batch = writeBatch(db);
      batch.set(ref, {
        name, type: input.type, control, ...(control === 'switch' ? { on: false } : { level: 0 }),
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: actor.uid,
        lastChangedBy: actor, flipCount: 0,
      });
      batch.set(doc(activity), eventData(ref.id, name, actor, 'added'));
      await batch.commit();
      return ref.id;
    }),
    setOn: (id, on) => mapped(() => mutate(id, 'switch', on)),
    setLevel: (id, level) => mapped(() => mutate(id, 'slider', level)),
    remove: (id) => mapped(async () => {
      const actor = requireUser(); validateId(id);
      const ref = doc(devices, id), event = doc(activity);
      // Reading and deleting in one transaction prevents duplicate removal
      // events when two clients remove the same device concurrently.
      markPending(id, 1);
      try {
        await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(ref);
          if (!snapshot.exists()) throw new HomeApiError('not-found');
          transaction.delete(ref);
          transaction.set(event, eventData(id, snapshot.data().name, actor, 'removed'));
        });
      } finally { markPending(id, -1); }
    }),
  };
}
