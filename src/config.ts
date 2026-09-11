// Build-time configuration read from VITE_* env vars. Kept free of Firebase
// imports so local-only mode never loads the Firebase SDK.

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

/** Public base path of the deployed app ('/' on Firebase Hosting, '/PetHealth/' on GitHub Pages). */
export const basePath = env.BASE_URL ?? '/';
