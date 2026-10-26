import { runHomeApiConformance } from '@funswitch/contract/conformance';
import { createMockApi, createMockStore } from './mockApi';

runHomeApiConformance('mock', (opts) => {
  const store = createMockStore();
  const clientA = createMockApi(store, { ...opts, latencyMs: 5 });
  const clientB = createMockApi(store, { ...opts, latencyMs: 5 });
  return {
    clientA,
    clientB,
    reset: () => store.reset(),
    dispose: () => { clientA.dispose(); clientB.dispose(); },
  };
});
