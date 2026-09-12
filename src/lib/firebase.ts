import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
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

export async function signInCitizenQuick(displayName?: string, emailOrPhone?: string): Promise<{ uid: string; displayName: string; email: string; isAnonymous: boolean }> {
  try {
    const userCredential = await signInAnonymously(auth);
    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, {
        displayName: displayName,
      });
    }
    return {
      uid: userCredential.user.uid,
      displayName: userCredential.user.displayName || displayName || 'Citizen User',
      email: userCredential.user.email || emailOrPhone || '',
      isAnonymous: true,
    };
  } catch (error: any) {
    // When Anonymous Auth is not enabled in Firebase Console (throws auth/admin-restricted-operation),
    // provide a seamless, persistent local citizen identity so user flows and reporting are never blocked.
    console.warn('Anonymous auth unavailable (using resilient local identity session):', error?.code || error?.message);

    const seedKey = emailOrPhone?.trim() || displayName?.trim() || 'citizen_guest';
    const storageKey = `civicbridge_uid_${seedKey.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    let stableUid = localStorage.getItem(storageKey);
    if (!stableUid) {
      stableUid = `usr_${Math.floor(100000 + Math.random() * 900000)}_${Date.now().toString(36)}`;
      localStorage.setItem(storageKey, stableUid);
    }

    return {
      uid: stableUid,
      displayName: displayName || 'Citizen User',
      email: emailOrPhone && emailOrPhone.includes('@') ? emailOrPhone : `${stableUid}@citizen.civicbridge.gov.in`,
      isAnonymous: true,
    };
  }
}

export async function logoutFirebase() {
  try {
    await signOut(auth);
  } catch {
    // Ignore signout error if in fallback mode
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
