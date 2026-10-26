import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { PresenceEntry } from '@funswitch/contract';

import { useApi } from '@/api/ApiProvider';

/**
 * Joins presence while the screen is focused and the app is in the foreground,
 * and returns everyone currently viewing the device.
 */
export function usePresence(id: string) {
  const api = useApi();
  const [viewers, setViewers] = useState<PresenceEntry[]>([]);

  useEffect(() => api.presence.subscribe(id, setViewers), [api, id]);

  useFocusEffect(
    useCallback(() => {
      let wanted = false;
      let leave: (() => Promise<void>) | null = null;
      let joining = false;

      const release = () => {
        const fn = leave;
        leave = null;
        fn?.().catch(() => {});
      };
      const join = () => {
        wanted = true;
        if (leave || joining) return;
        joining = true;
        api.presence
          .join(id)
          .then((fn) => {
            leave = fn;
            if (!wanted) release(); // left while the join was in flight
          })
          .catch(() => {})
          .finally(() => (joining = false));
      };
      const stop = () => {
        wanted = false;
        release();
      };

      join();
      const sub = AppState.addEventListener('change', (next) => {
        if (next === 'active') join();
        else if (next === 'background') stop();
      });
      return () => {
        sub.remove();
        stop();
      };
    }, [api, id]),
  );

  return viewers;
}
