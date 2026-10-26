import { useCallback, useEffect, useState } from 'react';
import type { Device, HomeApiError } from '@funswitch/contract';

import { useApi } from '@/api/ApiProvider';

export function useDevices() {
  const api = useApi();
  const [data, setData] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HomeApiError | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(
    () =>
      api.devices.subscribe(
        (devices) => {
          setData(devices);
          setLoading(false);
          setError(null);
        },
        (e) => {
          setError(e);
          setLoading(false);
        },
      ),
    [api, generation],
  );

  /** Data is already live; this only resubscribes (pull-to-refresh). */
  const refresh = useCallback(() => setGeneration((g) => g + 1), []);

  return { data, loading, error, refresh };
}
