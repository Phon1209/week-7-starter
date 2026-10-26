import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, initializeFirestore } from 'firebase/firestore';
import { createFirebaseApi } from '@funswitch/backend';
import type { HomeApi } from '@funswitch/contract';

import { createMockApi, createMockStore } from './mockApi';

export type ApiMode = 'mock' | 'firebase';

export interface ApiBundle {
  mode: ApiMode;
  api: HomeApi;
  /** A second client on the same mock store, signed in as Sam. Mock mode only. */
  simulator: HomeApi | null;
}

export function createApi(mode: string = process.env.EXPO_PUBLIC_API_MODE ?? 'firebase'): ApiBundle {
  if (mode === 'firebase') {
    const useEmulators = process.env.EXPO_PUBLIC_USE_EMULATORS !== 'false';
    const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? (useEmulators ? 'demo-funswitch' : undefined);
    const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? (useEmulators ? 'fake' : undefined);
    const host = process.env.EXPO_PUBLIC_EMULATOR_HOST ?? (Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1');
    if (!projectId || !apiKey) throw new Error('Set the Firebase project ID and API key in apps/mobile/.env.');
    if (useEmulators && (!host || host.includes('/') || host.includes(':'))) {
      throw new Error('EXPO_PUBLIC_EMULATOR_HOST must be a hostname without a scheme or port.');
    }

    // Reuse initialized services during rerenders and Fast Refresh. Emulator
    // connections must be made only once, before any service is used.
    const existing = getApps().find((app) => app.name === '[DEFAULT]');
    if (existing) {
      return { mode: 'firebase', api: createFirebaseApi({ auth: FirebaseAuth.getAuth(existing), db: getFirestore(existing) }), simulator: null };
    }
    const app = initializeApp({
      apiKey,
      projectId,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    });
    // Firebase's public types omit this export from its React Native entry.
    const nativeAuth = FirebaseAuth as typeof FirebaseAuth & {
      getReactNativePersistence(storage: typeof AsyncStorage): FirebaseAuth.Persistence;
    };
    const auth = FirebaseAuth.initializeAuth(app, {
      persistence: Platform.OS === 'web'
        ? FirebaseAuth.browserLocalPersistence
        : nativeAuth.getReactNativePersistence(AsyncStorage),
    });
    const db = initializeFirestore(app, { experimentalForceLongPolling: true });
    if (useEmulators) {
      FirebaseAuth.connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
      connectFirestoreEmulator(db, host, 8080);
    }
    return { mode: 'firebase', api: createFirebaseApi({ auth, db }), simulator: null };
  }
  if (mode !== 'mock') throw new Error(`Unknown API mode: ${mode}. Use mock or firebase.`);
  const store = createMockStore({ storage: AsyncStorage });
  return {
    mode: 'mock',
    api: createMockApi(store, { sessionKey: 'main' }),
    simulator: createMockApi(store, { sessionKey: 'simulator' }),
  };
}
