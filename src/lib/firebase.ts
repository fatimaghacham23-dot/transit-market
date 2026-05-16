import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const requiredEnv = (key: keyof ImportMetaEnv) => {
  const value = import.meta.env[key];

  if (!value) {
    throw new Error(`Missing Firebase environment variable: ${key}. Add it to .env.local locally and to Vercel environment variables in production.`);
  }

  return value;
};

export const firebaseConfig: FirebaseOptions = {
  apiKey: requiredEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requiredEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requiredEnv('VITE_FIREBASE_PROJECT_ID'),
  messagingSenderId: requiredEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requiredEnv('VITE_FIREBASE_APP_ID'),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

// Use the new Firebase project's default Firestore database.
export const db = getFirestore(app);
export const auth = getAuth(app);
