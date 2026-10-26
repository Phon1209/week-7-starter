import { parseArgs } from 'node:util';
import { deleteDoc, doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { emulatorClient } from './emulator';

async function main() {
  const { values } = parseArgs({ options: {
    email: { type: 'string' }, password: { type: 'string' }, device: { type: 'string' },
    action: { type: 'string' }, delay: { type: 'string', default: '0' },
  } });
  if (!values.email || !values.password || !values.device || !values.action) {
    throw new Error('Usage: --email EMAIL --password PASSWORD --device NAME --action on|off|level:60|join|leave|remove [--delay MS]');
  }
  const delay = Number(values.delay);
  if (!Number.isInteger(delay) || delay < 0) throw new Error('Delay must be a nonnegative integer in milliseconds.');
  const action = values.action;
  if (!['on', 'off', 'join', 'leave', 'remove'].includes(action) && !/^level:\d{1,3}$/.test(action)) throw new Error('Invalid action.');
  const client = await emulatorClient();
  const { api, db } = client;
  try {
    const user = await api.auth.signIn(values.email, values.password);
    const matches = await getDocs(query(collection(db, 'devices'), where('name', '==', values.device)));
    if (matches.size !== 1) throw new Error(`Expected one device named ${values.device}; found ${matches.size}.`);
    const id = matches.docs[0].id;
    if (delay > 0) await new Promise<void>((resolve) => setTimeout(resolve, delay));
    if (action === 'on' || action === 'off') await api.devices.setOn(id, action === 'on');
    else if (action.startsWith('level:')) await api.devices.setLevel(id, Number(action.slice(6)));
    else if (action === 'remove') await api.devices.remove(id);
    else if (action === 'join') await api.presence.join(id);
    else await deleteDoc(doc(db, 'presence', id, 'viewers', user.uid));
    const snapshot = await getDoc(doc(db, 'devices', id));
    const device = snapshot.data();
    console.log(JSON.stringify({ action, device: values.device, exists: snapshot.exists(), on: device?.on, level: device?.level, flipCount: device?.flipCount }));
  } finally { await client.close(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'Action failed.'); process.exitCode = 1; });
