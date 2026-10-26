/// <reference types="jest" />
import { render } from '@testing-library/react-native';
import RootLayout from '../app/_layout';

let mockAuthState = { user: null as { uid: string; email: string } | null, status: 'loading' };
let mockFontsLoaded = true;

jest.mock('./createApi', () => ({ createApi: jest.fn(() => ({})) }));
jest.mock('./ApiProvider', () => ({
  ApiProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => mockAuthState,
}));
jest.mock('@expo-google-fonts/inter', () => ({ useFonts: () => [mockFontsLoaded, null] }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const Stack = ({ children }: { children: React.ReactNode }) => React.createElement(View, { testID: 'router' }, children);
  Stack.Protected = function Protected({ children }: { children: React.ReactNode }) { return children; };
  Stack.Screen = function Screen() { return null; };
  return { Stack };
});

beforeEach(() => {
  mockAuthState = { user: null, status: 'loading' };
  mockFontsLoaded = true;
});

it('waits for restored authentication before mounting route guards', async () => {
  const screen = await render(<RootLayout />);
  expect(screen.getByTestId('auth-loading')).toBeTruthy();
  expect(screen.queryByTestId('router')).toBeNull();
  mockAuthState = { user: { uid: 'maya', email: 'maya@demo.test' }, status: 'signedIn' };
  await screen.rerender(<RootLayout />);
  expect(screen.queryByTestId('auth-loading')).toBeNull();
  expect(screen.getByTestId('router')).toBeTruthy();
});

it('mounts login routes after auth confirms there is no saved session', async () => {
  mockAuthState.status = 'signedOut';
  expect((await render(<RootLayout />)).getByTestId('router')).toBeTruthy();
});

it('keeps the loading screen visible until fonts are ready', async () => {
  mockAuthState.status = 'signedOut';
  mockFontsLoaded = false;
  const screen = await render(<RootLayout />);
  expect(screen.getByTestId('auth-loading')).toBeTruthy();
  expect(screen.queryByTestId('router')).toBeNull();
});
