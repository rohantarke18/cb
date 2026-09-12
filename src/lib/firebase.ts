import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Cloud Firestore with project-configured database ID
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Firebase Storage for verified civic evidence & documents
export const storage = getStorage(app);

// Verification connection check
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, '_connection_test', 'status'));
  } catch (err: any) {
    // Expected if doc doesn't exist, as long as network reachable
  }
}

// Auth Helpers
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

export async function logoutFirebase() {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Logout error:', err);
  }
}

/**
 * Recursively removes all `undefined` values from an object or array,
 * preventing Firestore "Function setDoc() called with invalid data. Unsupported field value: undefined" errors.
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === undefined) {
    return null as any;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanFirestoreData(item)) as any;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      cleaned[key] = cleanFirestoreData(value);
    }
  }
  return cleaned as T;
}

export { app };
export type { FirebaseUser };
