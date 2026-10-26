import { HomeApiError, type HomeApiErrorCode } from '@funswitch/contract';

export function mapError(error: unknown): HomeApiError {
  if (error instanceof HomeApiError) return error;
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const codes: Record<string, HomeApiErrorCode> = {
    'auth/invalid-credential': 'auth/invalid-credentials',
    'auth/wrong-password': 'auth/invalid-credentials',
    'auth/user-not-found': 'auth/invalid-credentials',
    'auth/email-already-in-use': 'auth/email-in-use',
    'auth/weak-password': 'auth/weak-password',
    'auth/invalid-email': 'auth/invalid-email',
    'permission-denied': 'permission-denied',
    'firestore/permission-denied': 'permission-denied',
    'not-found': 'not-found',
    'firestore/not-found': 'not-found',
  };
  return new HomeApiError(codes[code] ?? 'unknown', error instanceof Error ? error.message : 'Firebase request failed.');
}

export async function mapped<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch (error) { throw mapError(error); }
}
