import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { testEnvironment } from '../test/environment';

let env: RulesTestEnvironment;
const actor = { uid: 'maya', email: 'maya@demo.test' };
const initial = (slider = false) => ({
  name: 'Room', type: slider ? 'fan' : 'light', control: slider ? 'slider' : 'switch',
  ...(slider ? { level: 0 } : { on: false }), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  createdBy: actor.uid, lastChangedBy: actor, flipCount: 0,
});
const me = () => env.authenticatedContext(actor.uid, { email: actor.email }).firestore();
beforeAll(async () => { env = await testEnvironment(); });
beforeEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env?.cleanup(); });

it('denies unauthenticated access to every collection', async () => {
  const db = env.unauthenticatedContext().firestore();
  for (const path of ['users/maya', 'devices/light', 'activity/event', 'presence/light/viewers/maya', 'smoke/ping']) {
    await assertFails(getDoc(doc(db, path)));
    await assertFails(setDoc(doc(db, path), initial()));
    await assertFails(deleteDoc(doc(db, path)));
  }
});
it.each([false, true])('allows a valid device create (slider=%s)', async (slider) => {
  await assertSucceeds(setDoc(doc(me(), 'devices/room'), initial(slider)));
});
it.each([
  { type: 'light', control: 'slider', level: 0 }, { createdBy: 'sam' }, { flipCount: 5 },
  { on: 'false' }, { extra: true }, { name: '' }, { name: 'x'.repeat(41) },
])('denies invalid creates: %j', async (patch) => {
  await assertFails(setDoc(doc(me(), 'devices/room'), { ...initial(), ...patch }));
});
it.each([
  { name: 'Changed' }, { flipCount: 0 }, { flipCount: 2 }, { level: 10 },
  { lastChangedBy: { ...actor, email: 'forged@demo.test' } },
])('denies invalid switch updates: %j', async (patch) => {
  const ref = doc(me(), 'devices/room');
  await setDoc(ref, initial());
  await assertFails(updateDoc(ref, { on: true, updatedAt: serverTimestamp(), lastChangedBy: actor, flipCount: 1, ...patch }));
});
it.each([101, 50.5, -1])('denies invalid slider level %s', async (level) => {
  const ref = doc(me(), 'devices/room');
  await setDoc(ref, initial(true));
  await assertFails(updateDoc(ref, { level, updatedAt: serverTimestamp(), lastChangedBy: actor, flipCount: 1 }));
});
it('allows a valid control update by another signed-in user', async () => {
  await setDoc(doc(me(), 'devices/room'), initial());
  const db = env.authenticatedContext('sam', { email: 'sam@demo.test' }).firestore();
  await assertSucceeds(updateDoc(doc(db, 'devices/room'), {
    on: true, updatedAt: serverTimestamp(), lastChangedBy: { uid: 'sam', email: 'sam@demo.test' }, flipCount: 1,
  }));
});
it('allows own profile writes and denies another user profile', async () => {
  await assertSucceeds(setDoc(doc(me(), 'users/maya'), { email: actor.email, createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(me(), 'users/sam'), { email: actor.email, createdAt: serverTimestamp() }));
});
it('allows actor events, denies forgery and makes activity immutable', async () => {
  const ref = doc(me(), 'activity/event');
  const event = { deviceId: 'room', deviceName: 'Room', actor, action: 'turned_on', at: serverTimestamp() };
  await assertSucceeds(setDoc(ref, event));
  await assertFails(updateDoc(ref, { action: 'turned_off' }));
  await assertFails(deleteDoc(ref));
  await assertFails(setDoc(doc(me(), 'activity/forged'), { ...event, actor: { uid: 'sam', email: 'sam@demo.test' } }));
});
it('allows own presence writes and denies another user presence', async () => {
  const data = { email: actor.email, lastSeen: serverTimestamp() };
  const own = doc(me(), 'presence/room/viewers/maya');
  await assertSucceeds(setDoc(own, data));
  await assertSucceeds(deleteDoc(own));
  await assertFails(setDoc(doc(me(), 'presence/room/viewers/sam'), data));
  await assertFails(deleteDoc(doc(me(), 'presence/room/viewers/sam')));
});
