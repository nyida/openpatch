'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  fetchMe,
  getToken,
  login as apiLogin,
  oauthSignIn,
  setToken,
  signup as apiSignup,
} from './client';
import type { SubscriptionTier, UserProfile } from './types';

type AuthState = {
  ready: boolean;
  user: UserProfile | null;
  isSignedIn: boolean;
  isPro: boolean;
  emailVerified: boolean;
  signUp: (p: {
    email: string;
    password: string;
    displayName?: string;
  }) => Promise<{
    user: UserProfile;
    emailSent?: boolean;
    emailError?: string;
    verifyPreview?: string;
  }>;
  signIn: (p: { email: string; password: string }) => Promise<UserProfile>;
  signInWithGoogle: (idToken: string) => Promise<UserProfile>;
  signOut: () => void;
  refreshSession: () => Promise<void>;
  setTier: (tier: SubscriptionTier) => void;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  const refreshSession = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const res = await fetchMe();
      setUser(res.user);
    } catch {
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refreshSession().finally(() => setReady(true));
  }, [refreshSession]);

  const signUp = useCallback(
    async (p: { email: string; password: string; displayName?: string }) => {
      const res = await apiSignup(p);
      setToken(res.token);
      setUser(res.user);
      return {
        user: res.user,
        emailSent: res.emailSent,
        emailError: res.emailError,
        verifyPreview: res.verifyPreview,
      };
    },
    [],
  );

  const signIn = useCallback(async (p: { email: string; password: string }) => {
    const res = await apiLogin(p);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const signInWithGoogle = useCallback(async (idToken: string) => {
    const res = await oauthSignIn({ provider: 'google', idToken });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const setTier = useCallback((tier: SubscriptionTier) => {
    setUser((u) => (u ? { ...u, tier } : u));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      isSignedIn: Boolean(user),
      isPro: user?.tier === 'pro',
      emailVerified: Boolean(user?.emailVerified),
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      refreshSession,
      setTier,
    }),
    [
      ready,
      user,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      refreshSession,
      setTier,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useAuthOptional() {
  return useContext(Ctx);
}
