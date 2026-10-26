import type { Device, SyncMeta } from '@funswitch/contract';
import { waitFor } from '@funswitch/contract/conformance';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { fixture } from '../test/fixture';

let f: Awaited<ReturnType<typeof fixture>>;
let stops: Array<() => void>;
beforeEach(async () => { f = await fixture(); await f.reset(); stops = []; });
afterEach(async () => {
  stops.forEach((stop) => stop());
  await f.clientA.auth.signOut(); await f.clientB.auth.signOut();
  await f.reset(); await f.dispose?.();
});
async function users() {
  await f.clientA.auth.signUp('maya@demo.test', 'password123');
  await f.clientB.auth.signUp('sam@demo.test', 'password123');
}
function watch(id: string, client = f.clientB) {
  const state: { value?: Device | null; meta?: SyncMeta } = {};
  stops.push(client.devices.subscribeOne(id, (value, meta) => { state.value = value; state.meta = meta; }));
  return state;
}
it('rejects every signed-out device method', async () => {
  const api = f.clientA.devices;
  for (const call of [() => api.add({ name: 'Room', type: 'light' }), () => api.setOn('missing', true), () => api.setLevel('missing', 50), () => api.remove('missing')]) {
    await expect(call()).rejects.toMatchObject({ code: 'auth/not-signed-in' });
  }
  expect(() => api.subscribe(() => {})).toThrow(expect.objectContaining({ code: 'auth/not-signed-in' }));
  expect(() => api.subscribeOne('missing', () => {})).toThrow(expect.objectContaining({ code: 'auth/not-signed-in' }));
});
it('creates both control kinds and emits a sorted full list', async () => {
  await users();
  let list: Device[] = [];
  stops.push(f.clientB.devices.subscribe((value) => { list = value; }));
  const light = await f.clientA.devices.add({ name: '  Room  ', type: 'light' });
  const fan = await f.clientA.devices.add({ name: 'Fan', type: 'fan' });
  await waitFor(() => list.length === 2);
  expect(list.map((device) => device.id)).toEqual([light, fan]);
  expect(list[0]).toMatchObject({ name: 'Room', type: 'light', control: 'switch', on: false, flipCount: 0 });
  expect(list[1]).toMatchObject({ type: 'fan', control: 'slider', level: 0, flipCount: 0 });
  expect(list[0].createdAt).toBeGreaterThan(0);
});
it('rejects invalid names and device types', async () => {
  await users();
  for (const name of ['', ' ', 'x'.repeat(41)]) await expect(f.clientA.devices.add({ name, type: 'light' })).rejects.toMatchObject({ code: 'validation' });
  // Runtime input can arrive from an untyped UI or external caller.
  await expect(f.clientA.devices.add({ name: 'Room', type: 'invalid' as 'light' })).rejects.toMatchObject({ code: 'validation' });
});
it('syncs switch and slider changes in both directions', async () => {
  await users();
  const light = await f.clientA.devices.add({ name: 'Room', type: 'light' });
  const fan = await f.clientA.devices.add({ name: 'Fan', type: 'fan' });
  const lightState = watch(light), fanState = watch(fan, f.clientA);
  await f.clientA.devices.setOn(light, true);
  await f.clientB.devices.setLevel(fan, 75);
  await waitFor(() => lightState.value?.control === 'switch' && lightState.value.on && fanState.value?.control === 'slider' && fanState.value.level === 75);
  expect(lightState.value).toMatchObject({ flipCount: 1, lastChangedBy: { email: 'maya@demo.test' } });
  expect(fanState.value).toMatchObject({ flipCount: 1, lastChangedBy: { email: 'sam@demo.test' } });
});
it('rejects wrong controls, invalid levels and non-boolean switch values', async () => {
  await users();
  const light = await f.clientA.devices.add({ name: 'Room', type: 'light' });
  const fan = await f.clientA.devices.add({ name: 'Fan', type: 'fan' });
  await expect(f.clientA.devices.setOn(fan, true)).rejects.toMatchObject({ code: 'validation' });
  await expect(f.clientA.devices.setLevel(light, 50)).rejects.toMatchObject({ code: 'validation' });
  for (const level of [-1, 101, 50.5]) await expect(f.clientA.devices.setLevel(fan, level)).rejects.toMatchObject({ code: 'validation' });
  await expect(f.clientA.devices.setOn(light, 'yes' as unknown as boolean)).rejects.toMatchObject({ code: 'validation' });
});
it('reports pending transaction metadata then confirmed state', async () => {
  await users();
  const id = await f.clientA.devices.add({ name: 'Room', type: 'light' });
  const received: SyncMeta[] = [];
  stops.push(f.clientA.devices.subscribeOne(id, (_value, meta) => received.push(meta)));
  await waitFor(() => received.some((meta) => !meta.pendingWrites));
  received.length = 0;
  await f.clientA.devices.setOn(id, true);
  await waitFor(() => received.some((meta) => meta.pendingWrites) && received.at(-1)?.pendingWrites === false);
});
it('removes a device for both clients and rejects future writes', async () => {
  await users();
  const id = await f.clientA.devices.add({ name: 'Room', type: 'light' });
  const a = watch(id, f.clientA), b = watch(id);
  await waitFor(() => !!a.value && !!b.value);
  await f.clientA.devices.remove(id);
  await waitFor(() => a.value === null && b.value === null);
  await expect(f.clientB.devices.setOn(id, true)).rejects.toMatchObject({ code: 'not-found' });
  await expect(f.clientB.devices.remove(id)).rejects.toMatchObject({ code: 'not-found' });
});
it('keeps a new listener active when an old unsubscribe is called twice', async () => {
  await users();
  const id = await f.clientA.devices.add({ name: 'Room', type: 'light' });
  const oldStop = f.clientA.devices.subscribeOne(id, () => {});
  oldStop();
  const pending: boolean[] = [];
  stops.push(f.clientA.devices.subscribeOne(id, (_device, meta) => pending.push(meta.pendingWrites)));
  await waitFor(() => pending.length > 0);
  oldStop();
  pending.length = 0;
  await f.clientA.devices.setOn(id, true);
  await waitFor(() => pending.includes(true) && pending.at(-1) === false);
});
it('keeps flip counts and events consistent under concurrent writes', async () => {
  await users();
  const id = await f.clientA.devices.add({ name: 'Room', type: 'light' });
  const state = watch(id);
  await Promise.all([f.clientA.devices.setOn(id, true), f.clientB.devices.setOn(id, false)]);
  await waitFor(() => state.value?.flipCount === 2);
  const events = await getDocs(query(collection(f.depsA.db, 'activity'), where('deviceId', '==', id)));
  expect(events.size).toBe(3);
});
it('creates one removal event when two clients delete concurrently', async () => {
  await users();
  const id = await f.clientA.devices.add({ name: 'Room', type: 'light' });
  const outcomes = await Promise.allSettled([f.clientA.devices.remove(id), f.clientB.devices.remove(id)]);
  expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
  const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
  expect(rejected?.status === 'rejected' && rejected.reason.code).toBe('not-found');
  const events = await getDocs(query(collection(f.depsA.db, 'activity'), where('deviceId', '==', id)));
  expect(events.docs.filter((event) => event.data().action === 'removed')).toHaveLength(1);
});
