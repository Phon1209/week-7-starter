import { useCallback, useState } from 'react';

/** Wraps a write and records how long it took to round-trip. */
export function useTimedSave() {
  const [lastSaveMs, setLastSaveMs] = useState<number | null>(null);

  const run = useCallback(async <T,>(write: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    const result = await write();
    setLastSaveMs(Math.max(0, Math.round(performance.now() - start)));
    return result;
  }, []);

  return { lastSaveMs, run };
}

export type TimedSave = ReturnType<typeof useTimedSave>;
