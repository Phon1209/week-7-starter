import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HomeApi } from '@funswitch/contract';

import { createMockApi, createMockStore } from './mockApi';

export type ApiMode = 'mock' | 'firebase';

export interface ApiBundle {
  mode: ApiMode;
  api: HomeApi;
  /** A second client on the same mock store, signed in as Sam. Mock mode only. */
  simulator: HomeApi | null;
}

export function createApi(mode: string = process.env.EXPO_PUBLIC_API_MODE ?? 'mock'): ApiBundle {
  if (mode === 'firebase') {
    // Integration step I1 wires @funswitch/backend in here. This is the only
    // file allowed to import firebase/*.
    throw new Error('Firebase API mode is not wired yet (see Plan.md, Part C / I1).');
  }
  const store = createMockStore({ storage: AsyncStorage });
  return {
    mode: 'mock',
    api: createMockApi(store, { sessionKey: 'main' }),
    simulator: createMockApi(store, { sessionKey: 'simulator' }),
  };
}
