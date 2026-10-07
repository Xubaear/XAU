import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Secure Firebase configuration loaded from Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Defensive runtime validation to catch missing environment secrets early
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    "⚠️ [Firebase Security Alert] Missing required Firebase configuration keys!\n" +
    "Ensure .env or .env.local exists in your project root with VITE_FIREBASE_* variables.\n" +
    "Refer to .env.example for required fields."
  );
}

// Initialize Firebase App & Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export default app;
