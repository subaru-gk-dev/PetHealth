// Firebase initialisation. When VITE_FIREBASE_* is not configured the app runs
// in local-only mode (IndexedDB on this device) so it can be tried without any
// cloud project.

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const isCloudEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

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
