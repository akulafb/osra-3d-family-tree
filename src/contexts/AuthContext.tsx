import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useUser, useSession, useAuth as useClerkAuth, useClerk } from '@clerk/clerk-react';
import { createClerkSupabaseClient } from '../lib/supabase';
import { Database } from '../types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

type UserProfile = Database['public']['Tables']['users']['Row'];

interface AuthContextType {
  user: any; 
  session: any;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isBound: boolean; // User has a node_id binding
  authSupabase: SupabaseClient<Database> | null;
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

  // Authenticated Supabase client
  const authSupabase = useMemo(() => {
    if (supabaseToken) {
      return createClerkSupabaseClient(supabaseToken);
    }
    return null;
  }, [supabaseToken]);

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
  const fetchUserProfile = async (userId: string, authToken?: string) => {
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
  };

  // Initialize auth state
  useEffect(() => {
    if (!isClerkLoaded) return;

    if (clerkUser && supabaseToken) {
      fetchUserProfile(clerkUser.id, supabaseToken);
    } else if (!clerkUser) {
      setUserProfile(null);
      setIsProfileLoading(false);
    }
  }, [isClerkLoaded, clerkUser, supabaseToken]);

  const signInWithGoogle = async () => {
    // Open Clerk's built-in sign-in modal
    openSignIn();
  };

  const signOut = async () => {
    try {
      await clerkSignOut();
      setUserProfile(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const refreshUserProfile = async () => {
    if (clerkUser && supabaseToken) {
      await fetchUserProfile(clerkUser.id, supabaseToken);
    }
  };

  const value: AuthContextType = {
    user: clerkUser ? {
      ...clerkUser,
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress
    } : null,
    session: clerkSession ? {
      ...clerkSession,
      access_token: supabaseToken
    } : null,
    userProfile,
    isLoading: !isClerkLoaded || (!!clerkUser && isProfileLoading),
    isAdmin: userProfile?.role === 'admin',
    isBound: !!userProfile?.node_id,
    authSupabase,
    signInWithGoogle,
    signOut,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
