import { HomeApiError, type Actor, type ActivityEvent, type HomeApi } from '@funswitch/contract';
import { collection, limit, onSnapshot, orderBy, query, where, type Firestore } from 'firebase/firestore';
import { timestampMs, validateId } from './data';

export function createActivity(db: Firestore, requireUser: () => Actor): HomeApi['activity'] {
  return {
    subscribeForDevice(deviceId, callback, count = 20) {
      requireUser(); validateId(deviceId);
      if (!Number.isInteger(count) || count < 1) throw new HomeApiError('validation', 'History limit must be a positive integer.');
      return onSnapshot(query(collection(db, 'activity'), where('deviceId', '==', deviceId), orderBy('at', 'desc'), limit(count)), (snapshot) => {
        callback(snapshot.docs.map((item) => {
          const data = item.data({ serverTimestamps: 'estimate' });
          return { ...data, id: item.id, at: timestampMs(data.at) } as ActivityEvent;
        }));
      }, () => callback([]));
    },
  };
}
