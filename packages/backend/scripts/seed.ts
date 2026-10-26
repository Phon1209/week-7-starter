import { HomeApiError, type DeviceType } from '@funswitch/contract';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { emulatorClient } from './emulator';

const emails = ['maya@demo.test', 'sam@demo.test', 'jas@demo.test'];
const devices: Array<{ name: string; type: DeviceType }> = [
  { name: 'Flip Room', type: 'light' }, { name: 'Desk Plug', type: 'plug' },
  { name: 'Reading Dimmer', type: 'dimmer' }, { name: 'Ceiling Fan', type: 'fan' },
  { name: 'Window Blinds', type: 'blinds' }, { name: 'Living Room Speaker', type: 'speaker' },
];

async function main() {
  const client = await emulatorClient();
  const { api, db } = client;
  try {
    for (const email of emails) {
      try { await api.auth.signUp(email, 'password123'); } catch (error) {
        if (!(error instanceof HomeApiError) || error.code !== 'auth/email-in-use') throw error;
        await api.auth.signIn(email, 'password123');
      }
    }
    await api.auth.signIn(emails[0], 'password123');
    const ids: string[] = [];
    for (const input of devices) {
      const existing = await getDocs(query(collection(db, 'devices'), where('name', '==', input.name)));
      if (existing.size > 1 || (existing.size === 1 && existing.docs[0].data().type !== input.type)) {
        throw new Error(`Existing device conflicts with seed: ${input.name}`);
      }
      ids.push(existing.empty ? await api.devices.add(input) : existing.docs[0].id);
    }
    const flips = [
      { device: 0, user: 0, value: true }, { device: 1, user: 1, value: true },
      { device: 2, user: 2, value: 35 }, { device: 3, user: 0, value: 60 },
      { device: 4, user: 1, value: 80 }, { device: 5, user: 2, value: 45 },
      { device: 0, user: 1, value: false }, { device: 2, user: 0, value: 70 },
      { device: 3, user: 2, value: 25 }, { device: 5, user: 1, value: 65 },
    ];
    const ordinals = new Map<number, number>();
    for (const flip of flips) {
      const ordinal = (ordinals.get(flip.device) ?? 0) + 1;
      ordinals.set(flip.device, ordinal);
      const id = ids[flip.device];
      const current = (await getDoc(doc(db, 'devices', id))).data();
      // Rerunning the seed keeps existing devices and does not duplicate flips.
      if (current && current.flipCount >= ordinal) continue;
      await api.auth.signIn(emails[flip.user], 'password123');
      if (typeof flip.value === 'boolean') await api.devices.setOn(id, flip.value);
      else await api.devices.setLevel(id, flip.value);
    }
    const counts = await Promise.all(['users', 'devices', 'activity'].map(async (path) => (await getDocs(collection(db, path))).size));
    console.log(`Seeded demo-funswitch: ${counts[0]} user profiles, ${counts[1]} devices, ${counts[2]} activity events.`);
    console.log('Demo sign-in: maya@demo.test, sam@demo.test, jas@demo.test; password: password123');
  } finally { await client.close(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'Seed failed.'); process.exitCode = 1; });
