import { HomeApiError, type HomeApi, type HomeApiOptions, type User } from '@funswitch/contract';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, type Auth } from 'firebase/auth';
import { doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { mapped } from './errors';
import { createDevices } from './devices';
import { createActivity } from './activity';
import { createPresence } from './presence';

function userView(user: Auth['currentUser']): User | null {
  return user ? { uid: user.uid, email: user.email ?? '' } : null;
}

export function createFirebaseApi(deps: { auth: Auth; db: Firestore }, opts: HomeApiOptions = {}): HomeApi {
  const { auth, db } = deps;
  function requireUser(): User {
    const user = userView(auth.currentUser);
    if (!user) throw new HomeApiError('auth/not-signed-in');
    return user;
  }
  const presence = createPresence(db, () => userView(auth.currentUser), requireUser, opts);
  return {
    auth: {
      signUp: (email, password) => mapped(async () => {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', user.uid), { email: user.email, createdAt: serverTimestamp() });
        return userView(user)!;
      }),
      signIn: (email, password) => mapped(async () => userView((await signInWithEmailAndPassword(auth, email, password)).user)!),
      signOut: () => mapped(async () => {
        try { await presence.leaveAll(); } finally { await signOut(auth); }
      }),
      currentUser: () => userView(auth.currentUser),
      onAuthChanged: (callback) => onAuthStateChanged(auth, (user) => callback(userView(user))),
    },
    devices: createDevices(db, requireUser),
    activity: createActivity(db, requireUser),
    presence: presence.api,
  };
}
