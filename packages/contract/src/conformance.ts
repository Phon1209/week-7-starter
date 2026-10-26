import type { ActivityEvent, Device, HomeApi, HomeApiOptions, PresenceEntry, SyncMeta, Unsubscribe } from './types';

// Runner globals are declared locally so importing this suite does not require
// Vitest or Jest types in the consuming app. Only shared matchers are used.
type Assertion = {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toHaveLength(expected: number): void;
  rejects: { toMatchObject(expected: { code: string }): Promise<void> };
};
declare const describe: (name: string, run: () => void) => void;
declare const it: (name: string, run: () => void | Promise<void>, timeout?: number) => void;
declare const expect: (actual: unknown) => Assertion;
declare const beforeEach: (run: () => void | Promise<void>) => void;
declare const afterEach: (run: () => void | Promise<void>) => void;

export interface ConformanceFixture {
  clientA: HomeApi;
  clientB: HomeApi;
  reset(): Promise<void> | void;
  /** Set to 0 only for a mock with no simulated write latency. */
  latencyMs?: number;
  /** Optional teardown for Firebase app instances or mock resources. */
  dispose?(): Promise<void> | void;
}
export type ConformanceFactory = (opts: HomeApiOptions) => ConformanceFixture | Promise<ConformanceFixture>;

export async function waitFor(predicate: () => boolean, timeout = 3000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Condition was not met within ${timeout}ms`);
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
}

export function runHomeApiConformance(name: string, factory: ConformanceFactory): void {
  describe(`${name} HomeApi conformance`, () => {
    let fixture: ConformanceFixture;
    let a: HomeApi;
    let b: HomeApi;
    let subscriptions: Unsubscribe[];
    let leaves: Array<() => Promise<void>>;
    const emailA = 'maya@conformance.test';
    const emailB = 'sam@conformance.test';
    const password = 'password123';

    beforeEach(async () => {
      subscriptions = [];
      leaves = [];
      fixture = await factory({ presenceTtlMs: 1500, presenceHeartbeatMs: 0 });
      a = fixture.clientA;
      b = fixture.clientB;
      await a.auth.signOut();
      await b.auth.signOut();
      await fixture.reset();
    });
    afterEach(async () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
      try {
        for (const leave of leaves) await leave();
      } finally {
        try {
          await a.auth.signOut();
          await b.auth.signOut();
          await fixture.reset();
        } finally { await fixture.dispose?.(); }
      }
    });
    async function signInBoth(): Promise<void> {
      await a.auth.signUp(emailA, password);
      await b.auth.signUp(emailB, password);
    }
    function devices(client: HomeApi): { value: Device[] } {
      const state = { value: [] as Device[] };
      subscriptions.push(client.devices.subscribe((value) => { state.value = value; }));
      return state;
    }
    function one(client: HomeApi, id: string): { value: Device | null | undefined; meta?: SyncMeta } {
      const state: { value: Device | null | undefined; meta?: SyncMeta } = { value: undefined };
      subscriptions.push(client.devices.subscribeOne(id, (value, meta) => { state.value = value; state.meta = meta; }));
      return state;
    }
    function history(id: string, limit?: number): { value: ActivityEvent[] } {
      const state = { value: [] as ActivityEvent[] };
      subscriptions.push(b.activity.subscribeForDevice(id, (value) => { state.value = value; }, limit));
      return state;
    }
    function viewers(id: string): { value: PresenceEntry[] } {
      const state = { value: [] as PresenceEntry[] };
      subscriptions.push(b.presence.subscribe(id, (value) => { state.value = value; }));
      return state;
    }
    async function join(id: string): Promise<() => Promise<void>> {
      const leave = await a.presence.join(id);
      leaves.push(leave);
      return leave;
    }

    it('1: signup returns the current user with email', async () => {
      const user = await a.auth.signUp(emailA, password);
      expect(typeof user.uid === 'string' && user.uid.length > 0).toBe(true);
      expect(user.email).toBe(emailA);
      expect(a.auth.currentUser()).toEqual(user);
    });
    it('2: rejects a wrong password', async () => {
      await a.auth.signUp(emailA, password);
      await a.auth.signOut();
      await expect(a.auth.signIn(emailA, 'wrong-password')).rejects.toMatchObject({ code: 'auth/invalid-credentials' });
    });
    it('3: rejects duplicate email signup', async () => {
      await a.auth.signUp(emailA, password);
      await expect(b.auth.signUp(emailA, password)).rejects.toMatchObject({ code: 'auth/email-in-use' });
    });
    it('4: rejects signed-out device mutations', async () => {
      for (const call of [
        () => a.devices.add({ name: 'Room', type: 'light' }),
        () => a.devices.setOn('missing', true), () => a.devices.setLevel('missing', 50),
        () => a.devices.remove('missing'),
      ]) await expect(call()).rejects.toMatchObject({ code: 'auth/not-signed-in' });
    });
    it('5: creates a switch off with zero flips and emits the sorted list', async () => {
      await signInBoth();
      const list = devices(b);
      const first = await a.devices.add({ name: '  Room  ', type: 'light' });
      const second = await a.devices.add({ name: 'Plug', type: 'plug' });
      await waitFor(() => list.value.length === 2);
      expect(list.value.map((device) => device.id)).toEqual([first, second]);
      expect(list.value[0].name).toBe('Room');
      expect(list.value[0].control).toBe('switch');
      expect(list.value[0].control === 'switch' && list.value[0].on).toBe(false);
      expect(list.value[0].flipCount).toBe(0);
      expect(list.value[0].createdBy).toBe(a.auth.currentUser()?.uid);
    });
    it('6: creates a slider at zero', async () => {
      await signInBoth();
      const id = await a.devices.add({ name: 'Fan', type: 'fan' });
      const state = one(b, id);
      await waitFor(() => state.value?.control === 'slider');
      expect(state.value?.control === 'slider' && state.value.level).toBe(0);
      expect(state.value?.flipCount).toBe(0);
    });
    it('7: rejects invalid names', async () => {
      await signInBoth();
      for (const name of ['', '   ', 'x'.repeat(41)]) {
        await expect(a.devices.add({ name, type: 'light' })).rejects.toMatchObject({ code: 'validation' });
      }
    });
    it('8: synchronizes switch changes, actor and flip count to B', async () => {
      await signInBoth();
      const id = await a.devices.add({ name: 'Room', type: 'light' });
      const state = one(b, id);
      await a.devices.setOn(id, true);
      await waitFor(() => state.value?.control === 'switch' && state.value.on && state.value.flipCount === 1);
      expect(state.value?.lastChangedBy.email).toBe(emailA);
    });
    it('9: synchronizes slider changes from B to A', async () => {
      await signInBoth();
      const id = await a.devices.add({ name: 'Fan', type: 'fan' });
      const state = one(a, id);
      await b.devices.setLevel(id, 75);
      await waitFor(() => state.value?.control === 'slider' && state.value.level === 75);
      expect(state.value?.lastChangedBy.email).toBe(emailB);
      expect(state.value?.flipCount).toBe(1);
    });
    it('10: rejects wrong controls and invalid levels', async () => {
      await signInBoth();
      const light = await a.devices.add({ name: 'Room', type: 'light' });
      const fan = await a.devices.add({ name: 'Fan', type: 'fan' });
      await expect(a.devices.setOn(fan, true)).rejects.toMatchObject({ code: 'validation' });
      await expect(a.devices.setLevel(light, 50)).rejects.toMatchObject({ code: 'validation' });
      for (const level of [-1, 101, 50.5]) await expect(a.devices.setLevel(fan, level)).rejects.toMatchObject({ code: 'validation' });
    });
    it('11: emits pending writes followed by server confirmation', async () => {
      if (fixture.latencyMs === 0) return;
      await signInBoth();
      const id = await a.devices.add({ name: 'Room', type: 'light' });
      const pending: boolean[] = [];
      subscriptions.push(a.devices.subscribeOne(id, (_device, meta) => { pending.push(meta.pendingWrites); }));
      await waitFor(() => pending.includes(false));
      pending.length = 0;
      await a.devices.setOn(id, true);
      await waitFor(() => pending.includes(true) && pending[pending.length - 1] === false);
    });
    it('12: removal disappears on both clients and later writes reject', async () => {
      await signInBoth();
      const id = await a.devices.add({ name: 'Room', type: 'light' });
      const listA = devices(a), listB = devices(b), state = one(b, id);
      await waitFor(() => listA.value.length === 1 && listB.value.length === 1 && !!state.value);
      await a.devices.remove(id);
      await waitFor(() => listA.value.length === 0 && listB.value.length === 0 && state.value === null);
      await expect(a.devices.setOn(id, true)).rejects.toMatchObject({ code: 'not-found' });
    });
    it('13: every mutation creates exactly one event with the actor and action', async () => {
      await signInBoth();
      const light = await a.devices.add({ name: 'Room', type: 'light' });
      const fan = await a.devices.add({ name: 'Fan', type: 'fan' });
      const lights = history(light), fans = history(fan);
      await new Promise<void>((resolve) => setTimeout(resolve, 2));
      await a.devices.setOn(light, true);
      await new Promise<void>((resolve) => setTimeout(resolve, 2));
      await b.devices.setOn(light, false);
      await b.devices.setLevel(fan, 60);
      await new Promise<void>((resolve) => setTimeout(resolve, 2));
      await a.devices.remove(light);
      await waitFor(() => lights.value.length === 4 && fans.value.length === 2);
      expect(lights.value.map((e) => e.action)).toEqual(['removed', 'turned_off', 'turned_on', 'added']);
      expect(lights.value.map((e) => e.actor)).toEqual([a.auth.currentUser(), b.auth.currentUser(), a.auth.currentUser(), a.auth.currentUser()]);
      expect(fans.value[0].action).toBe('set_level');
      expect(fans.value[0].level).toBe(60);
      expect(fans.value[0].actor).toEqual(b.auth.currentUser());
      expect(lights.value.every((e) => e.deviceId === light && e.deviceName === 'Room')).toBe(true);
      expect(new Set(lights.value.map((e) => e.id)).size).toBe(4);
    });
    it('14: isolates history, orders newest first and respects limits', async () => {
      await signInBoth();
      const id = await a.devices.add({ name: 'Room', type: 'light' });
      const other = await a.devices.add({ name: 'Other', type: 'light' });
      const defaults = history(id), limited = history(id, 3), all = history(id, 30);
      for (let i = 0; i < 25; i++) await a.devices.setOn(id, i % 2 === 0);
      await a.devices.setOn(other, true);
      await waitFor(() => all.value.length === 26 && defaults.value.length === 20 && limited.value.length === 3
        && defaults.value[0]?.id === all.value[0]?.id && limited.value[0]?.id === all.value[0]?.id);
      expect(defaults.value.every((e) => e.deviceId === id)).toBe(true);
      expect(defaults.value.every((e, i, list) => i === 0 || list[i - 1].at >= e.at)).toBe(true);
      expect(limited.value.map((e) => e.id)).toEqual(defaults.value.slice(0, 3).map((e) => e.id));
    }, 30000);
    it('15: propagates presence to another client', async () => {
      await signInBoth();
      const id = await a.devices.add({ name: 'Room', type: 'light' });
      const state = viewers(id);
      await join(id);
      await waitFor(() => state.value.length === 1);
      expect(state.value[0].uid).toBe(a.auth.currentUser()?.uid);
      expect(state.value[0].email).toBe(emailA);
    });
    it('16: removes presence after leaving', async () => {
      await signInBoth();
      const id = await a.devices.add({ name: 'Room', type: 'light' });
      const state = viewers(id), leave = await join(id);
      await waitFor(() => state.value.length === 1);
      await leave();
      leaves = leaves.filter((entry) => entry !== leave);
      await waitFor(() => state.value.length === 0);
    });
    it('17: expires stale presence without new writes', async () => {
      await signInBoth();
      const id = await a.devices.add({ name: 'Room', type: 'light' });
      const state = viewers(id);
      await join(id);
      await waitFor(() => state.value.length === 1);
      await waitFor(() => state.value.length === 0, 4500);
    }, 10000);
    it('18: joining twice creates no duplicate viewers', async () => {
      await signInBoth();
      const id = await a.devices.add({ name: 'Room', type: 'light' });
      const state = viewers(id);
      await join(id);
      await join(id);
      await waitFor(() => state.value.length > 0);
      expect(state.value).toHaveLength(1);
    });
    it('19: unsubscribing stops every subscription callback', async () => {
      await signInBoth();
      const id = await a.devices.add({ name: 'Room', type: 'light' });
      const counts = [0, 0, 0, 0, 0];
      const stops = [
        b.auth.onAuthChanged(() => { counts[0]++; }),
        b.devices.subscribe(() => { counts[1]++; }),
        b.devices.subscribeOne(id, () => { counts[2]++; }),
        b.activity.subscribeForDevice(id, () => { counts[3]++; }),
        b.presence.subscribe(id, () => { counts[4]++; }),
      ];
      subscriptions.push(...stops);
      await waitFor(() => counts.every((count) => count > 0));
      stops.forEach((stop) => stop());
      const before = [...counts];
      const live = one(a, id), events = history(id), room = viewers(id);
      await a.devices.setOn(id, true);
      await join(id);
      await waitFor(() => live.value?.flipCount === 1 && events.value.length === 2 && room.value.length === 1);
      // Stop B's verification listeners before signing B out.
      subscriptions.splice(-3).forEach((stop) => stop());
      await b.auth.signOut();
      await waitFor(() => b.auth.currentUser() === null);
      // Also cross the TTL boundary to catch leaked presence intervals.
      await new Promise<void>((resolve) => setTimeout(resolve, 1600));
      expect(counts).toEqual(before);
    }, 15000);
  });
}
