// Firebase initialisation. Only imported (dynamically) from the cloud modules,
// so local-only builds never pull the SDK into the initial bundle.

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { firebaseConfig, isCloudEnabled } from './config';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

export function getFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage } {
  if (!isCloudEnabled) {
    throw new Error('Firebase is not configured (see .env.example).');
  }
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    // Offline persistence: entries written without network are queued and
    // synced when the device is back online.
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    storage = getStorage(app);
  }
  return { app, auth: auth!, db: db!, storage: storage! };
}

export const googleProvider = new GoogleAuthProvider();
