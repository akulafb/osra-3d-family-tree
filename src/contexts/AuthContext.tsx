import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useUser, useSession, useAuth as useClerkAuth, useClerk } from '@clerk/clerk-react';
import { Database } from '../types/database';

type UserProfile = Database['public']['Tables']['users']['Row'];

interface AuthUser {
  id: string;
  email?: string;
  fullName: string | null;
  imageUrl: string;
  username: string | null;
}

interface AuthSession {
  id: string;
  accessToken: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isBound: boolean; // User has a node_id binding
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded: isClerkLoaded, user: clerkUser } = useUser();
  const { session: clerkSession } = useSession();
  const { signOut: clerkSignOut } = useClerkAuth();
  const { openSignIn } = useClerk();
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [supabaseToken, setSupabaseToken] = useState<string | null>(null);

  // Sync Supabase token from Clerk session
  useEffect(() => {
    async function updateToken() {
      if (clerkSession) {
        try {
          const token = await clerkSession.getToken({ template: 'supabase' });
          setSupabaseToken(token);
        } catch (error) {
          console.error('[AuthContext] Error getting Supabase token:', error);
          setSupabaseToken(null);
        }
      } else {
        setSupabaseToken(null);
      }
    }
    updateToken();
  }, [clerkSession]);

  // Fetch user profile from the users table using raw fetch (avoid websocket hang)
  const fetchUserProfile = useCallback(async (userId: string, authToken?: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Use provided token or fall back to anon key
      const token = authToken || supabaseKey;

      const response = await fetch(
        `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=*`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        setUserProfile(data[0]);
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      console.error('[AuthContext] Error fetching user profile:', error);
      setUserProfile(null);
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    if (!isClerkLoaded) return;

    if (clerkUser && supabaseToken) {
      fetchUserProfile(clerkUser.id, supabaseToken);
    } else if (!clerkUser) {
      setUserProfile(null);
      setIsProfileLoading(false);
    }
  }, [isClerkLoaded, clerkUser, supabaseToken, fetchUserProfile]);

  const signInWithGoogle = useCallback(async () => {
    // Open Clerk's built-in sign-in modal
    openSignIn();
  }, [openSignIn]);

  const signOut = useCallback(async () => {
    try {
      await clerkSignOut();
      setUserProfile(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }, [clerkSignOut]);

  const refreshUserProfile = useCallback(async () => {
    if (clerkUser && supabaseToken) {
      await fetchUserProfile(clerkUser.id, supabaseToken);
    }
  }, [clerkUser, supabaseToken, fetchUserProfile]);

  const value = useMemo(() => {
    const authUser: AuthUser | null = clerkUser ? {
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress,
      fullName: clerkUser.fullName ?? null,
      imageUrl: clerkUser.imageUrl,
      username: clerkUser.username ?? null,
    } : null;

    const authSession: AuthSession | null = clerkSession ? {
      id: clerkSession.id,
      accessToken: supabaseToken
    } : null;

    const isLoading = !isClerkLoaded || (!!clerkUser && isProfileLoading);
    const isAdmin = userProfile?.role === 'admin';
    const isBound = !!userProfile?.node_id;

    return {
      user: authUser,
      session: authSession,
      userProfile,
      isLoading,
      isAdmin,
      isBound,
      signInWithGoogle,
      signOut,
      refreshUserProfile,
    };
  }, [
    clerkUser,
    clerkSession,
    supabaseToken,
    userProfile,
    isClerkLoaded,
    isProfileLoading,
    signInWithGoogle,
    signOut,
    refreshUserProfile,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
