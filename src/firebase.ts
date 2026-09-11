// Firebase initialisation. Only imported (dynamically) from the cloud modules,
// so local-only builds never pull the SDK into the initial bundle.
// Only Auth and Firestore are used; photos are stored in Firestore too.

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { firebaseConfig, isCloudEnabled } from './config';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

export function getFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (!isCloudEnabled) {
    throw new Error('Firebase is not configured (see .env.example).');
  }
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    // Offline persistence: entries and photos written without network are
    // queued and synced when the device is back online.
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  }
  return { app, auth: auth!, db: db! };
}

export const googleProvider = new GoogleAuthProvider();
