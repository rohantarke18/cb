import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import {
  auth,
  db,
  signInWithGoogle,
  logoutFirebase,
  testFirestoreConnection,
  cleanFirestoreData,
} from '../lib/firebase';
import {
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auditLogService } from '../services/auditLogService';

const SUPER_ADMIN_EMAILS = [
  'rohantarke07@gmail.com',
  'admin@civicbridge.gov.in',
];

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  isAdminOrOfficer: boolean;
  isSuperAdmin: boolean;
  isDeptAdmin: boolean;
  isOfficer: boolean;
  isExpert: boolean;
  loading: boolean;
  loginWithGoogle: () => Promise<User>;
  loginWithEmail: (email: string, pass: string) => Promise<User>;
  registerWithEmail: (email: string, pass: string, name: string, phone?: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUserProfile: (updates: {
    name?: string;
    phone?: string;
    avatar?: string;
    wardOrDistrict?: string;
  }) => Promise<void>;
  provisionOfficialUser: (
    uidOrEmail: string,
    newRole: UserRole,
    department?: string,
    designation?: string
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to load or provision Firestore user profile
  const syncUserProfile = async (fbUser: FirebaseUser): Promise<User> => {
    const userRef = doc(db, 'users', fbUser.uid);
    const snap = await getDoc(userRef);
    const emailLower = (fbUser.email || '').toLowerCase().trim();
    const isDesignatedSuperAdmin = SUPER_ADMIN_EMAILS.includes(emailLower);

    if (snap.exists()) {
      const data = snap.data() as User;
      let effectiveRole: UserRole = data.role || 'citizen';
      if (isDesignatedSuperAdmin && effectiveRole !== 'super_admin') {
        effectiveRole = 'super_admin';
        await updateDoc(userRef, { role: 'super_admin', updatedAt: new Date().toISOString() });
      }

      const verifiedUser: User = {
        ...data,
        id: fbUser.uid,
        name: data.name || fbUser.displayName || 'Citizen User',
        email: fbUser.email || data.email || '',
        role: effectiveRole,
        avatar: fbUser.photoURL || data.avatar,
      };
      return verifiedUser;
    } else {
      // First-time user profile creation: designated super admins get super_admin, all others strictly get citizen
      const initialRole: UserRole = isDesignatedSuperAdmin ? 'super_admin' : 'citizen';
      const newUser: User = {
        id: fbUser.uid,
        name: fbUser.displayName || 'Citizen User',
        email: fbUser.email || '',
        role: initialRole,
        avatar: fbUser.photoURL || undefined,
        wardOrDistrict: 'Ward 8 (CIDCO / Kranti Chowk)',
        department: isDesignatedSuperAdmin ? 'Central Municipal Administration' : undefined,
        designation: isDesignatedSuperAdmin ? 'Chief Administrative Officer' : undefined,
      };

      await setDoc(
        userRef,
        cleanFirestoreData({
          ...newUser,
          createdAt: new Date().toISOString(),
        }),
        { merge: true }
      );
      return newUser;
    }
  };

  // Initialize and listen to real Firebase Auth state
  useEffect(() => {
    testFirestoreConnection();

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const verifiedUser = await syncUserProfile(fbUser);
        setUser(verifiedUser);
      } catch (err) {
        console.error('Error synchronizing user profile with Firestore:', err);
        // Fallback minimal authenticated user
        setUser({
          id: fbUser.uid,
          name: fbUser.displayName || 'Citizen User',
          email: fbUser.email || '',
          role: SUPER_ADMIN_EMAILS.includes((fbUser.email || '').toLowerCase()) ? 'super_admin' : 'citizen',
          avatar: fbUser.photoURL || undefined,
        });
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async (): Promise<User> => {
    const fbUser = await signInWithGoogle();
    const verifiedUser = await syncUserProfile(fbUser);
    setUser(verifiedUser);
    return verifiedUser;
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    name: string,
    phone?: string
  ): Promise<User> => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    const fbUser = cred.user;
    const cleanName = name.trim() || 'Citizen User';
    const emailLower = email.trim().toLowerCase();
    const isSuper = SUPER_ADMIN_EMAILS.includes(emailLower);

    // Registration ALWAYS creates a citizen (unless predefined super admin bootstrap)
    const initialRole: UserRole = isSuper ? 'super_admin' : 'citizen';

    const userData: User = {
      id: fbUser.uid,
      name: cleanName,
      email: fbUser.email || email.trim(),
      phone: phone || '',
      role: initialRole,
      wardOrDistrict: 'Ward 8 (CIDCO / Kranti Chowk)',
      department: isSuper ? 'Central Municipal Administration' : undefined,
      designation: isSuper ? 'Chief Administrative Officer' : undefined,
    };

    const userRef = doc(db, 'users', fbUser.uid);
    await setDoc(
      userRef,
      cleanFirestoreData({
        ...userData,
        createdAt: new Date().toISOString(),
      }),
      { merge: true }
    );

    setUser(userData);
    return userData;
  };

  const loginWithEmail = async (email: string, pass: string): Promise<User> => {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    const verifiedUser = await syncUserProfile(cred.user);
    setUser(verifiedUser);
    return verifiedUser;
  };

  const logout = async () => {
    try {
      await logoutFirebase();
    } catch (e) {
      console.warn('Logout notice:', e);
    }
    setUser(null);
  };

  /**
   * Safe profile update: users can only modify personal information, NEVER their role or department
   */
  const updateUserProfile = async (updates: {
    name?: string;
    phone?: string;
    avatar?: string;
    wardOrDistrict?: string;
  }) => {
    if (!user) return;
    const sanitized = {
      ...(updates.name ? { name: updates.name.trim() } : {}),
      ...(updates.phone !== undefined ? { phone: updates.phone.trim() } : {}),
      ...(updates.avatar ? { avatar: updates.avatar } : {}),
      ...(updates.wardOrDistrict ? { wardOrDistrict: updates.wardOrDistrict } : {}),
      updatedAt: new Date().toISOString(),
    };

    const updated = { ...user, ...sanitized };
    setUser(updated);

    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, cleanFirestoreData(sanitized));
    } catch (e) {
      console.warn('Error updating user profile in Firestore:', e);
    }
  };

  /**
   * Secure official provisioning: only administrators can invoke this to update role/department in Firestore
   */
  const provisionOfficialUser = async (
    targetUid: string,
    newRole: UserRole,
    department?: string,
    designation?: string
  ) => {
    if (!user || (user.role !== 'super_admin' && user.role !== 'department_admin')) {
      throw new Error('Unauthorized: Only administrators can provision official roles.');
    }

    const updates: Record<string, any> = {
      role: newRole,
      department: department || '',
      designation: designation || '',
      updatedAt: new Date().toISOString(),
    };

    const targetRef = doc(db, 'users', targetUid);
    await updateDoc(targetRef, cleanFirestoreData(updates));

    auditLogService.logAction(
      'ROLE_PROVISIONED',
      'user',
      targetUid,
      `Official role provisioned: "${newRole}" (Department: ${department || 'N/A'}, Designation: ${designation || 'N/A'}) by ${user.name} (${user.role}).`,
      {
        uid: user.id,
        name: user.name,
        role: user.role,
      }
    ).catch(() => {});
  };

  const role = user?.role || 'citizen';
  const isAuthenticated = !!user;
  const isSuperAdmin = role === 'super_admin';
  const isDeptAdmin = role === 'department_admin' || isSuperAdmin;
  const isOfficer = role === 'officer' || isDeptAdmin;
  const isExpert = role === 'expert' || isSuperAdmin;
  const isAdminOrOfficer = isOfficer || isExpert;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated,
        isAdminOrOfficer,
        isSuperAdmin,
        isDeptAdmin,
        isOfficer,
        isExpert,
        loading,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
        updateUserProfile,
        provisionOfficialUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
