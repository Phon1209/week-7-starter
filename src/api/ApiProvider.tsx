import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { HomeApi, User } from '@funswitch/contract';

import type { ApiBundle } from './createApi';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

interface ApiContextValue extends ApiBundle {
  user: User | null;
  status: AuthStatus;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({ bundle, children }: { bundle: ApiBundle; children: ReactNode }) {
  const [auth, setAuth] = useState<{ user: User | null; status: AuthStatus }>({ user: null, status: 'loading' });

  useEffect(
    () => bundle.api.auth.onAuthChanged((user) => setAuth({ user, status: user ? 'signedIn' : 'signedOut' })),
    [bundle.api],
  );

  return <ApiContext.Provider value={{ ...bundle, ...auth }}>{children}</ApiContext.Provider>;
}

function useApiContext(): ApiContextValue {
  const value = useContext(ApiContext);
  if (!value) throw new Error('useApi must be used inside <ApiProvider>');
  return value;
}

export function useApi(): HomeApi {
  return useApiContext().api;
}

export function useSimulatorApi(): HomeApi | null {
  return useApiContext().simulator;
}

export function useAuth(): { user: User | null; status: AuthStatus } {
  const { user, status } = useApiContext();
  return { user, status };
}
