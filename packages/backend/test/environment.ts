import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

export const projectId = 'demo-funswitch';
export async function testEnvironment() {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('Tests require Auth and Firestore emulators for demo-funswitch.');
  }
  return initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile(new URL('../../../firestore.rules', import.meta.url), 'utf8') },
  });
}
