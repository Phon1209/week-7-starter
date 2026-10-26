import assert from 'node:assert/strict';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { emulatorClient } from '../scripts/emulator';

const client = await emulatorClient();
try {
  await client.api.auth.signIn('maya@demo.test', 'password123');
  const [users, devices, events, room] = await Promise.all([
    getDocs(collection(client.db, 'users')), getDocs(collection(client.db, 'devices')),
    getDocs(collection(client.db, 'activity')), getDocs(query(collection(client.db, 'devices'), where('name', '==', 'Flip Room'))),
  ]);
  assert.equal(users.size, 3);
  assert.equal(devices.size, 6);
  assert.equal(events.size, 17);
  assert.equal(room.size, 1);
  assert.equal(room.docs[0].data().on, true);
  assert.equal(room.docs[0].data().flipCount, 3);
  assert.equal(room.docs[0].data().lastChangedBy.email, 'sam@demo.test');
  assert.equal(devices.docs.reduce((sum, item) => sum + item.data().flipCount, 0), 11);
  console.log('Verified seed + actAs: 3 users, 6 devices, 17 events; Flip Room is on with flipCount 3 and Sam as actor.');
} finally { await client.close(); }
