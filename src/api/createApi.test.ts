/// <reference types="jest" />
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApi } from './createApi';

const mockApp = { name: '[DEFAULT]' };
const mockAuth = {};
const mockDb = {};
const mockFirebaseApi = { kind: 'firebase' };

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('firebase/app', () => ({ getApps: jest.fn(() => []), initializeApp: jest.fn(() => mockApp) }));
jest.mock('firebase/auth', () => ({
  initializeAuth: jest.fn(() => mockAuth), getAuth: jest.fn(() => mockAuth),
  connectAuthEmulator: jest.fn(), getReactNativePersistence: jest.fn(() => 'native-persistence'),
  browserLocalPersistence: 'browser-persistence',
}));
jest.mock('firebase/firestore', () => ({
  initializeFirestore: jest.fn(() => mockDb), getFirestore: jest.fn(() => mockDb), connectFirestoreEmulator: jest.fn(),
}));
jest.mock('@funswitch/backend', () => ({ createFirebaseApi: jest.fn(() => mockFirebaseApi) }));

// Keep Firebase imports confined to createApi.ts, including in tests.
const app = jest.requireMock('firebase/app');
const auth = jest.requireMock('firebase/auth');
const firestore = jest.requireMock('firebase/firestore');
const originalEnv = { ...process.env };
const originalPlatform = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  app.getApps.mockReturnValue([]);
  Platform.OS = 'ios';
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('EXPO_PUBLIC_')) delete process.env[key];
  }
});
afterAll(() => { process.env = originalEnv; Platform.OS = originalPlatform; });

it('creates two independent mock clients without initializing Firebase', () => {
  const bundle = createApi('mock');
  expect(bundle.mode).toBe('mock');
  expect(bundle.simulator).not.toBeNull();
  expect(bundle.simulator).not.toBe(bundle.api);
  expect(app.initializeApp).not.toHaveBeenCalled();
});

it('defaults to Firebase emulators with persistent native auth', () => {
  expect(createApi()).toEqual({ mode: 'firebase', api: mockFirebaseApi, simulator: null });
  expect(app.initializeApp).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'demo-funswitch', apiKey: 'fake' }));
  expect(auth.getReactNativePersistence).toHaveBeenCalledWith(AsyncStorage);
  expect(auth.initializeAuth).toHaveBeenCalledWith(mockApp, { persistence: 'native-persistence' });
  expect(firestore.initializeFirestore).toHaveBeenCalledWith(mockApp, { experimentalForceLongPolling: true });
  expect(auth.connectAuthEmulator).toHaveBeenCalledWith(mockAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
});

it('passes the configured host to both emulators', () => {
  process.env.EXPO_PUBLIC_EMULATOR_HOST = '192.168.1.42';
  createApi('firebase');
  expect(auth.connectAuthEmulator).toHaveBeenCalledWith(mockAuth, 'http://192.168.1.42:9099', { disableWarnings: true });
  expect(firestore.connectFirestoreEmulator).toHaveBeenCalledWith(mockDb, '192.168.1.42', 8080);
});

it('uses the Android emulator host by default', () => {
  Platform.OS = 'android';
  createApi('firebase');
  expect(firestore.connectFirestoreEmulator).toHaveBeenCalledWith(mockDb, '10.0.2.2', 8080);
});

it('uses browser persistence on web', () => {
  Platform.OS = 'web';
  createApi('firebase');
  expect(auth.initializeAuth).toHaveBeenCalledWith(mockApp, { persistence: 'browser-persistence' });
  expect(auth.getReactNativePersistence).not.toHaveBeenCalled();
});

it('uses real Firebase configuration when emulators are disabled', () => {
  process.env.EXPO_PUBLIC_USE_EMULATORS = 'false';
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'production-project';
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'public-api-key';
  createApi('firebase');
  expect(app.initializeApp).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'production-project', apiKey: 'public-api-key' }));
  expect(auth.connectAuthEmulator).not.toHaveBeenCalled();
  expect(firestore.connectFirestoreEmulator).not.toHaveBeenCalled();
});

it('reuses initialized Firebase services without reconnecting emulators', () => {
  app.getApps.mockReturnValue([mockApp]);
  createApi('firebase');
  expect(auth.getAuth).toHaveBeenCalledWith(mockApp);
  expect(firestore.getFirestore).toHaveBeenCalledWith(mockApp);
  expect(app.initializeApp).not.toHaveBeenCalled();
  expect(auth.connectAuthEmulator).not.toHaveBeenCalled();
  expect(firestore.connectFirestoreEmulator).not.toHaveBeenCalled();
});

it('rejects invalid modes, malformed hosts, and missing production configuration', () => {
  expect(() => createApi('invalid')).toThrow('Unknown API mode');
  process.env.EXPO_PUBLIC_EMULATOR_HOST = 'http://localhost:8080';
  expect(() => createApi('firebase')).toThrow('hostname');
  process.env.EXPO_PUBLIC_USE_EMULATORS = 'false';
  expect(() => createApi('firebase')).toThrow('project ID and API key');
});
