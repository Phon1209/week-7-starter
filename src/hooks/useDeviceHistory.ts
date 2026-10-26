import { useEffect, useState } from 'react';
import type { ActivityEvent } from '@funswitch/contract';

import { useApi } from '@/api/ApiProvider';

const EMPTY: ActivityEvent[] = [];

export function useDeviceHistory(id: string, limit = 20) {
  const api = useApi();
  const [state, setState] = useState<{ forId: string | null; events: ActivityEvent[] }>({ forId: null, events: EMPTY });

  useEffect(() => api.activity.subscribeForDevice(id, (events) => setState({ forId: id, events }), limit), [api, id, limit]);

  const loaded = state.forId === id;
  return { events: loaded ? state.events : EMPTY, loading: !loaded };
}
