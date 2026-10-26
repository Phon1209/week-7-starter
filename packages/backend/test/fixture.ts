import { deleteApp } from 'firebase/app';
import { terminate } from 'firebase/firestore';
import type { ConformanceFixture } from '@funswitch/contract/conformance';
import type { HomeApiOptions } from '@funswitch/contract';
import { initForNode } from '../src/node';
import { createFirebaseApi } from '../src/index';
import { projectId, testEnvironment } from './environment';

export async function fixture(opts: HomeApiOptions = {}) {
  const env = await testEnvironment();
  const a = initForNode({ projectId, apiKey: 'fake' });
  const b = initForNode({ projectId, apiKey: 'fake' });
  async function reset() {
    await env.clearFirestore();
    const response = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/accounts`, { method: 'DELETE' });
    if (!response.ok) throw new Error(`Auth emulator reset failed: ${response.status}`);
  }
  async function dispose() {
    await Promise.all([terminate(a.db), terminate(b.db)]);
    await Promise.all([deleteApp(a.auth.app), deleteApp(b.auth.app)]);
    await env.cleanup();
  }
  const result: ConformanceFixture = {
    clientA: createFirebaseApi(a, opts), clientB: createFirebaseApi(b, opts), reset, dispose,
  };
  return { ...result, depsA: a, depsB: b };
}
