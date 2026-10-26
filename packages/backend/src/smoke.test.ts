import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let environment: RulesTestEnvironment;

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run tests with Firebase emulators:exec.');
  environment = await initializeTestEnvironment({ projectId: 'demo-funswitch' });
});
afterAll(async () => { await environment?.cleanup(); });

it('writes and reads /smoke/ping through the emulator', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    const ref = doc(context.firestore(), 'smoke/ping');
    await setDoc(ref, { message: 'pong' });
    expect((await getDoc(ref)).data()).toEqual({ message: 'pong' });
  });
});
