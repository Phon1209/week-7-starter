import { doc, getDoc } from 'firebase/firestore';
import { waitFor } from '@funswitch/contract/conformance';
import { fixture } from '../test/fixture';

let f: Awaited<ReturnType<typeof fixture>>;
beforeEach(async () => { f = await fixture(); await f.reset(); });
afterEach(async () => {
  await f.clientA.auth.signOut(); await f.clientB.auth.signOut();
  await f.reset(); await f.dispose?.();
});
it('signs up with email and persists the user profile', async () => {
  const user = await f.clientA.auth.signUp('maya@demo.test', 'password123');
  expect(user.uid.length > 0).toBe(true);
  expect(user.email).toBe('maya@demo.test');
  expect(f.clientA.auth.currentUser()).toEqual(user);
  const profile = (await getDoc(doc(f.depsA.db, 'users', user.uid))).data();
  expect(profile?.email).toBe(user.email);
  expect(typeof profile?.createdAt.toMillis()).toBe('number');
});
it('maps invalid credentials and duplicate email errors', async () => {
  await f.clientA.auth.signUp('maya@demo.test', 'password123');
  await f.clientA.auth.signOut();
  await expect(f.clientA.auth.signIn('maya@demo.test', 'wrong-password')).rejects.toMatchObject({ code: 'auth/invalid-credentials' });
  await expect(f.clientB.auth.signUp('maya@demo.test', 'password123')).rejects.toMatchObject({ code: 'auth/email-in-use' });
  await f.clientA.auth.signIn('maya@demo.test', 'password123');
  expect(f.clientA.auth.currentUser()?.email).toBe('maya@demo.test');
});
it('maps invalid email and weak password errors', async () => {
  await expect(f.clientA.auth.signUp('bad', 'password123')).rejects.toMatchObject({ code: 'auth/invalid-email' });
  await expect(f.clientA.auth.signUp('maya@demo.test', 'short')).rejects.toMatchObject({ code: 'auth/weak-password' });
});
it('notifies sign-out and stops auth callbacks after unsubscribe', async () => {
  await f.clientA.auth.signUp('maya@demo.test', 'password123');
  const received: Array<ReturnType<typeof f.clientA.auth.currentUser>> = [];
  const stop = f.clientA.auth.onAuthChanged((user) => received.push(user));
  await waitFor(() => received.length > 0);
  await f.clientA.auth.signOut();
  await waitFor(() => received.at(-1) === null);
  stop();
  const count = received.length;
  await f.clientA.auth.signIn('maya@demo.test', 'password123');
  expect(received).toHaveLength(count);
});
