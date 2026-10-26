import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

// This is an explicit read-only production check. Emulator scripts never load .env.
const envPath = new URL('../../../.env', import.meta.url);
if (existsSync(envPath)) loadEnvFile(envPath.pathname);

async function main() {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) throw new Error('Set EXPO_PUBLIC_FIREBASE_API_KEY and EXPO_PUBLIC_FIREBASE_PROJECT_ID in the root .env.');
  const request = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    return { response, body };
  };
  const config = await request(`https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(apiKey)}`);
  if (!config.response.ok) throw new Error(`Firebase Auth configuration check failed (HTTP ${config.response.status}).`);
  console.log('Firebase Auth configuration: reachable.');
  let token: string | undefined;
  const email = process.env.FIREBASE_CHECK_EMAIL, password = process.env.FIREBASE_CHECK_PASSWORD;
  if (Boolean(email) !== Boolean(password)) throw new Error('Set both FIREBASE_CHECK_EMAIL and FIREBASE_CHECK_PASSWORD for authenticated reads.');
  if (email && password) {
    const login = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    if (!login.response.ok) throw new Error(`Existing-user sign-in failed (HTTP ${login.response.status}).`);
    token = login.body.idToken;
  }
  const firestore = await request(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/devices?pageSize=1`,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  if (!token && firestore.response.status === 403) {
    console.log('Firestore devices: sign-in required. Add optional FIREBASE_CHECK_EMAIL/PASSWORD locally to check an existing user.');
    return;
  }
  if (!firestore.response.ok) throw new Error(`Firestore check failed (HTTP ${firestore.response.status}).`);
  console.log(`Firestore devices: read succeeded (${token ? 'signed in' : 'without sign-in'}); ${firestore.body.documents?.length ?? 0} documents read, limit 1.`);
  if (!token) console.log('The configured project currently allows unauthenticated reads of devices.');
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'Firebase check failed.'); process.exitCode = 1; });
