import type { ActivityEvent } from '@funswitch/contract';
import { waitFor } from '@funswitch/contract/conformance';
import { fixture } from '../test/fixture';

let f: Awaited<ReturnType<typeof fixture>>;
let stops: Array<() => void>;
beforeEach(async () => {
  f = await fixture(); await f.reset(); stops = [];
  await f.clientA.auth.signUp('maya@demo.test', 'password123');
  await f.clientB.auth.signUp('sam@demo.test', 'password123');
});
afterEach(async () => {
  stops.forEach((stop) => stop());
  await f.clientA.auth.signOut(); await f.clientB.auth.signOut();
  await f.reset(); await f.dispose?.();
});
function history(id: string, count?: number) {
  const state = { value: [] as ActivityEvent[] };
  stops.push(f.clientB.activity.subscribeForDevice(id, (value) => { state.value = value; }, count));
  return state;
}
it('emits one event for each mutation with the correct actor and action', async () => {
  const id = await f.clientA.devices.add({ name: 'Room', type: 'light' });
  const state = history(id);
  await waitFor(() => state.value.length === 1);
  expect(state.value[0]).toMatchObject({ deviceId: id, deviceName: 'Room', action: 'added', actor: f.clientA.auth.currentUser() });
  await f.clientA.devices.setOn(id, true);
  await waitFor(() => state.value.length === 2);
  expect(state.value[0].action).toBe('turned_on');
  await f.clientB.devices.setOn(id, false);
  await waitFor(() => state.value.length === 3);
  expect(state.value[0]).toMatchObject({ action: 'turned_off', actor: f.clientB.auth.currentUser() });
  await f.clientA.devices.remove(id);
  await waitFor(() => state.value.length === 4);
  expect(state.value.map((event) => event.action)).toEqual(['removed', 'turned_off', 'turned_on', 'added']);
  expect(state.value[0].at).toBeGreaterThan(0);
});
it('records slider levels and leaves no event after rejected writes', async () => {
  const id = await f.clientA.devices.add({ name: 'Fan', type: 'fan' });
  const state = history(id);
  await f.clientB.devices.setLevel(id, 60);
  await waitFor(() => state.value.length === 2);
  expect(state.value[0]).toMatchObject({ action: 'set_level', level: 60, actor: f.clientB.auth.currentUser() });
  await expect(f.clientA.devices.setLevel(id, 101)).rejects.toMatchObject({ code: 'validation' });
  expect(state.value).toHaveLength(2);
});
it('isolates devices, sorts newest first and respects default and custom limits', async () => {
  const id = await f.clientA.devices.add({ name: 'Room', type: 'light' });
  const other = await f.clientA.devices.add({ name: 'Other', type: 'light' });
  const state = history(id), short = history(id, 3), all = history(id, 30);
  for (let i = 0; i < 25; i++) await f.clientA.devices.setOn(id, i % 2 === 0);
  await f.clientA.devices.setOn(other, true);
  await waitFor(() => all.value.length === 26 && state.value.length === 20 && short.value.length === 3
    && short.value[0].id === all.value[0].id && state.value[0].id === all.value[0].id);
  expect(state.value.every((event) => event.deviceId === id)).toBe(true);
  expect(state.value.every((event, i, list) => i === 0 || list[i - 1].at >= event.at)).toBe(true);
  expect(short.value.map((event) => event.id)).toEqual(state.value.slice(0, 3).map((event) => event.id));
}, 30000);
