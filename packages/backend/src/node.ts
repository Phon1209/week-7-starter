import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, initializeAuth, inMemoryPersistence, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

let nextApp = 0;

/** Emulator-only entry point. Production/mobile code injects its own instances. */
export function initForNode(
  config: FirebaseOptions,
  emulatorHost = '127.0.0.1',
  appName = `funswitch-node-${++nextApp}`,
): { auth: Auth; db: Firestore } {
  if (config.projectId !== 'demo-funswitch') throw new Error('Node tools only support the demo-funswitch emulators.');
  if (!emulatorHost || emulatorHost.includes('/') || emulatorHost.includes(':')) throw new Error('Supply an emulator hostname without a scheme or port.');
  const app = initializeApp(config, appName);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  const db = getFirestore(app);
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
  return { auth, db };
}
