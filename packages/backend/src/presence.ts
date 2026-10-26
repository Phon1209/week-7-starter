import { HomeApiError, type Actor, type HomeApi, type HomeApiOptions, type PresenceEntry } from '@funswitch/contract';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, type DocumentReference, type Firestore } from 'firebase/firestore';
import { mapped } from './errors';
import { timestampMs, validateId } from './data';

interface Session {
  actor: Actor;
  ref: DocumentReference;
  refs: number;
  stopped: boolean;
  ready: Promise<void>;
  tail: Promise<void>;
  timer?: ReturnType<typeof setInterval>;
}

export function createPresence(db: Firestore, currentUser: () => Actor | null, requireUser: () => Actor, opts: HomeApiOptions) {
  const ttl = opts.presenceTtlMs ?? 45000;
  const heartbeat = opts.presenceHeartbeatMs ?? 15000;
  if (!Number.isFinite(ttl) || ttl <= 0 || !Number.isFinite(heartbeat) || heartbeat < 0) {
    throw new HomeApiError('validation', 'Presence TTL must be positive and heartbeat must be nonnegative.');
  }
  const sessions = new Map<string, Session>();
  async function stopSession(key: string, session: Session, remove: boolean): Promise<void> {
    if (session.stopped) return;
    session.stopped = true;
    if (session.timer) clearInterval(session.timer);
    if (sessions.get(key) === session) sessions.delete(key);
    await session.ready.catch(() => {});
    await session.tail;
    if (remove && currentUser()?.uid === session.actor.uid) await deleteDoc(session.ref);
  }
  const api: HomeApi['presence'] = {
    join: (deviceId) => mapped(async () => {
      const actor = requireUser(); validateId(deviceId);
      const key = `${deviceId}/${actor.uid}`;
      let session = sessions.get(key);
      if (!session) {
        const ref = doc(db, 'presence', deviceId, 'viewers', actor.uid);
        session = { actor, ref, refs: 0, stopped: false, ready: Promise.resolve(), tail: Promise.resolve() };
        const created = session;
        sessions.set(key, created);
        created.ready = setDoc(ref, { email: actor.email, lastSeen: serverTimestamp() }).then(() => {
          if (heartbeat > 0 && !created.stopped) {
            created.timer = setInterval(() => {
              if (currentUser()?.uid !== actor.uid) {
                void stopSession(key, created, false).catch(() => {});
                return;
              }
              // Serialize heartbeats so a delayed refresh cannot recreate a
              // presence document after leave() deletes it.
              created.tail = created.tail.then(async () => {
                if (!created.stopped) await updateDoc(ref, { lastSeen: serverTimestamp() });
              }).catch(() => {
                // A terminal refresh failure falls back to TTL expiry.
                if (created.timer) clearInterval(created.timer);
              });
            }, heartbeat);
          }
        });
      }
      session.refs++;
      try { await session.ready; } catch (error) {
        session.refs--;
        if (sessions.get(key) === session) sessions.delete(key);
        throw error;
      }
      const joined = session;
      let left = false;
      return () => mapped(async () => {
        if (left || joined.stopped) return;
        left = true;
        joined.refs--;
        if (joined.refs === 0) await stopSession(key, joined, true);
      });
    }),
    subscribe(deviceId, callback) {
      requireUser(); validateId(deviceId);
      let active = true;
      let cached: PresenceEntry[] = [];
      let last: string | undefined;
      const emit = () => {
        if (!active) return;
        const now = Date.now();
        const filtered = cached.filter((entry) => now - entry.lastSeen < ttl);
        const signature = JSON.stringify(filtered);
        if (signature !== last) { last = signature; callback(filtered); }
      };
      const timer = setInterval(emit, Math.max(1, ttl / 3));
      const stop = onSnapshot(collection(db, 'presence', deviceId, 'viewers'), (snapshot) => {
        cached = snapshot.docs.map((item) => {
          const data = item.data({ serverTimestamps: 'estimate' });
          return { uid: item.id, email: String(data.email), lastSeen: timestampMs(data.lastSeen) };
        }).sort((a, b) => a.uid.localeCompare(b.uid));
        emit();
      }, () => { cached = []; clearInterval(timer); emit(); });
      return () => { active = false; stop(); clearInterval(timer); };
    },
  };
  return {
    api,
    leaveAll: () => mapped(async () => {
      await Promise.all([...sessions].map(([key, session]) => stopSession(key, session, true)));
    }),
  };
}
