import { HomeApiError, type ActivityAction, type Actor, type Device } from '@funswitch/contract';
import { serverTimestamp, type DocumentSnapshot } from 'firebase/firestore';

export function validateId(id: string): void {
  if (typeof id !== 'string' || !id || id.includes('/')) throw new HomeApiError('validation', 'Invalid device ID.');
}
export function timestampMs(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis();
  return 0;
}
export function deviceView(snapshot: DocumentSnapshot): Device | null {
  if (!snapshot.exists()) return null;
  const data = snapshot.data({ serverTimestamps: 'estimate' });
  return { ...data, id: snapshot.id, createdAt: timestampMs(data.createdAt), updatedAt: timestampMs(data.updatedAt) } as Device;
}
export function eventData(deviceId: string, deviceName: string, actor: Actor, action: ActivityAction, level?: number) {
  return { deviceId, deviceName, actor, action, at: serverTimestamp(), ...(action === 'set_level' ? { level } : {}) };
}
