import { deleteApp } from 'firebase/app';
import { terminate } from 'firebase/firestore';
import { createFirebaseApi } from '../src/index';
import { initForNode } from '../src/node';

export async function emulatorClient() {
  const host = process.env.FUNSWITCH_EMULATOR_HOST ?? '127.0.0.1';
  const response = await fetch(`http://${host}:9099/emulator/v1/projects/demo-funswitch/config`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Start the demo-funswitch Auth and Firestore emulators first.');
  const deps = initForNode({ projectId: 'demo-funswitch', apiKey: 'fake' }, host);
  const api = createFirebaseApi(deps, { presenceHeartbeatMs: 0 });
  async function close() {
    await terminate(deps.db);
    await deleteApp(deps.auth.app);
  }
  return { ...deps, api, close };
}
