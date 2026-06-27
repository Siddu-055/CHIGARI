/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, limit, query, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { UserProfile, UserRole } from '../types';
import { logActivity } from './activityLogger';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isSigningIn: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const loggedSessionRef = React.useRef(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const isRedAdminEmail = user.email === 'u02cs25s0055@klebcadwd.com';

          unsubscribeProfile = onSnapshot(userDocRef, async (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data() as UserProfile;
              let finalProfile = data;
              if (isRedAdminEmail && data.role !== 'red_admin') {
                finalProfile = { ...data, role: 'red_admin' as const };
                try {
                  await setDoc(userDocRef, { role: 'red_admin' }, { merge: true });
                } catch (setErr) {
                  console.error("Failed to update user role to red_admin in Firestore:", setErr);
                }
              }
              setProfile(finalProfile);
              setLoading(false);

              if (!loggedSessionRef.current) {
                loggedSessionRef.current = true;
                await logActivity(
                  finalProfile,
                  'USER_LOGIN',
                  `Active session loaded / restored for authenticated user ${finalProfile.email}`
                );
              }
            } else {
              // Create new profile
              const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
              const isFirstUser = usersSnap.empty;
              const role = isRedAdminEmail ? 'red_admin' : ((isFirstUser ? 'admin' : 'passenger') as any);

              const defaultWeeklyVisits = Math.floor(Math.random() * 5) + 3; // 3 to 7 visits/week

              const newProfile: UserProfile = {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || user.displayName || 'Anonymous',
                role,
                createdAt: new Date().toISOString(),
                photoURL: user.photoURL || '',
                theme: 'light',
                weeklyVisits: defaultWeeklyVisits,
              };

              try {
                await setDoc(userDocRef, newProfile);
              } catch (setErr) {
                console.error("Failed to write new user profile to Firestore:", setErr);
              }
              setProfile(newProfile);
              setLoading(false);
            }
          }, (err) => {
            console.error("Profile onSnapshot error:", err);
            // Fallback
            setProfile({
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'Anonymous',
              role: isRedAdminEmail ? 'red_admin' : 'passenger',
              createdAt: new Date().toISOString(),
              theme: 'light',
              weeklyVisits: 5,
            });
            setLoading(false);
          });
        } catch (err) {
          console.error("Error setting up profile snapshot:", err);
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  // Theme application effect
  useEffect(() => {
    const theme = profile?.theme || 'light';
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [profile?.theme]);

  const signIn = async () => {
    if (isSigningIn) return;
    
    setIsSigningIn(true);
    try {
      console.log("Initiating Google Sign-In popup...");
      const result = await signInWithPopup(auth, googleProvider);
      console.log("Sign-in successful", result.user.email);

      // Compute role for log
      const isRedAdminEmail = result.user.email === 'u02cs25s0055@klebcadwd.com';
      let computedRole = 'passenger';
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (userDoc.exists()) {
        computedRole = userDoc.data().role || 'passenger';
      } else {
        const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
        computedRole = isRedAdminEmail ? 'red_admin' : (usersSnap.empty ? 'admin' : 'passenger');
      }

      loggedSessionRef.current = true;
      await logActivity(
        null,
        'USER_LOGIN',
        `User ${result.user.email} successfully authenticated via Google Single Sign-On`,
        { uid: result.user.uid, email: result.user.email || '', role: computedRole }
      );
    } catch (error: any) {
      console.error('Sign-in error details:', error);
      
      let message = 'An unexpected error occurred during sign-in.';
      
      if (error.code === 'auth/popup-blocked') {
        message = 'The sign-in popup was blocked. Please allow popups for this site in your browser settings or try opening the app in a new tab.';
      } else if (error.code === 'auth/cancelled-popup-request') {
        message = 'Sign-in request was cancelled. Please try again.';
      } else if (error.code === 'auth/popup-closed-by-user') {
        message = 'The sign-in window was closed before completion.';
      } else if (error.code === 'auth/unauthorized-domain') {
        message = 'This domain is not authorized for Firebase Authentication. Please add the current URL to your Firebase Console "Authorized Domains".';
      } else if (error?.message) {
        message = `Authentication failed: ${error.message}`;
      }
      
      alert(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const logOut = async () => {
    try {
      if (profile) {
        await logActivity(
          profile,
          'USER_LOGOUT',
          `User ${profile.email} successfully logged out of the terminal session`
        );
      }
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isSigningIn, signIn, logOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
