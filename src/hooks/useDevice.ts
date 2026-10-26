import { useEffect, useState } from 'react';
import type { Device, HomeApiError, SyncMeta } from '@funswitch/contract';

import { useApi } from '@/api/ApiProvider';

interface DeviceState {
  forId: string | null;
  /** undefined while loading, null once the device does not exist. */
  device: Device | null | undefined;
  meta: SyncMeta;
  error: HomeApiError | null;
  /** Snapshots received after the first one. */
  liveUpdates: number;
}

const initial: DeviceState = { forId: null, device: undefined, meta: { pendingWrites: false, fromCache: false }, error: null, liveUpdates: -1 };

export function useDevice(id: string) {
  const api = useApi();
  const [stored, setState] = useState<DeviceState>(initial);
  // State left over from a previous id counts as "not loaded yet".
  const state = stored.forId === id ? stored : initial;

  useEffect(
    () =>
      api.devices.subscribeOne(
        id,
        (device, meta) =>
          setState((s) => ({ forId: id, device, meta, error: null, liveUpdates: s.forId === id ? s.liveUpdates + 1 : 0 })),
        (error) => setState((s) => ({ ...(s.forId === id ? s : initial), forId: id, error })),
      ),
    [api, id],
  );

  return {
    device: state.device,
    meta: state.meta,
    loading: state.device === undefined && !state.error,
    error: state.error,
    liveUpdates: Math.max(0, state.liveUpdates),
  };
}
