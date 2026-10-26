import type { PresenceEntry } from '@funswitch/contract';
import { waitFor } from '@funswitch/contract/conformance';
import { fixture } from '../test/fixture';

let f: Awaited<ReturnType<typeof fixture>>;
let stops: Array<() => void>;
let leaves: Array<() => Promise<void>>;
beforeEach(async () => { f = await fixture({ presenceTtlMs: 1500, presenceHeartbeatMs: 0 }); await f.reset(); stops = []; leaves = []; });
afterEach(async () => {
  stops.forEach((stop) => stop());
  for (const leave of leaves) await leave();
  await f.clientA.auth.signOut(); await f.clientB.auth.signOut();
  await f.reset(); await f.dispose?.();
});
async function room() {
  await f.clientA.auth.signUp('maya@demo.test', 'password123');
  await f.clientB.auth.signUp('sam@demo.test', 'password123');
  return f.clientA.devices.add({ name: 'Room', type: 'light' });
}
function viewers(id: string) {
  const state = { value: [] as PresenceEntry[] };
  stops.push(f.clientB.presence.subscribe(id, (value) => { state.value = value; }));
  return state;
}
it('propagates a viewer to another client and removes it on leave', async () => {
  const id = await room(), state = viewers(id);
  const leave = await f.clientA.presence.join(id); leaves.push(leave);
  await waitFor(() => state.value.length === 1);
  expect(state.value[0]).toMatchObject({ uid: f.clientA.auth.currentUser()?.uid, email: 'maya@demo.test' });
  await leave();
  await waitFor(() => state.value.length === 0);
  await leave(); // leave is idempotent
});
it('expires stale viewers without new snapshots', async () => {
  const id = await room(), state = viewers(id);
  leaves.push(await f.clientA.presence.join(id));
  await waitFor(() => state.value.length === 1);
  await waitFor(() => state.value.length === 0, 4500);
});
it('coalesces concurrent joins and leaves after the final reference', async () => {
  const id = await room(), state = viewers(id);
  const [first, second] = await Promise.all([f.clientA.presence.join(id), f.clientA.presence.join(id)]);
  leaves.push(first, second);
  await waitFor(() => state.value.length === 1);
  await first();
  expect(state.value).toHaveLength(1);
  await second();
  await waitFor(() => state.value.length === 0);
});
it('cleans up active presence on sign-out', async () => {
  const id = await room(), state = viewers(id);
  leaves.push(await f.clientA.presence.join(id));
  await waitFor(() => state.value.length === 1);
  await f.clientA.auth.signOut();
  await waitFor(() => state.value.length === 0);
});
it('stops callbacks and TTL reevaluation after unsubscribe', async () => {
  const id = await room();
  let count = 0;
  const stop = f.clientB.presence.subscribe(id, () => { count++; }); stops.push(stop);
  await waitFor(() => count > 0);
  stop(); const initial = count;
  leaves.push(await f.clientA.presence.join(id));
  await new Promise<void>((resolve) => setTimeout(resolve, 1700));
  expect(count).toBe(initial);
});
it('refreshes presence with heartbeats and stops them on leave', async () => {
  await f.dispose?.();
  f = await fixture({ presenceTtlMs: 500, presenceHeartbeatMs: 100 }); await f.reset();
  const id = await room(), state = viewers(id);
  const leave = await f.clientA.presence.join(id); leaves.push(leave);
  await waitFor(() => state.value.length === 1);
  const firstSeen = state.value[0].lastSeen;
  await new Promise<void>((resolve) => setTimeout(resolve, 800));
  expect(state.value).toHaveLength(1);
  expect(state.value[0].lastSeen).toBeGreaterThan(firstSeen);
  await leave();
  await waitFor(() => state.value.length === 0);
  await new Promise<void>((resolve) => setTimeout(resolve, 200));
  expect(state.value).toHaveLength(0);
});
