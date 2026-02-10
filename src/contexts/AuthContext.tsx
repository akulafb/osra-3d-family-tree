import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';

type UserProfile = Database['public']['Tables']['users']['Row'];

interface AuthContextType {
  user: User | null;
  session: Session | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile from the users table using raw fetch (avoid websocket hang)
  const fetchUserProfile = async (userId: string, authToken?: string) => {
    try {
      console.log('[AuthContext] Fetching profile for user:', userId);
      
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
        console.log('[AuthContext] Profile loaded:', { node_id: data[0].node_id, role: data[0].role });
        setUserProfile(data[0]);
      } else {
        console.log('[AuthContext] No profile found for user');
        setUserProfile(null);
      }
      
      // Done loading after profile fetch completes
      setIsLoading(false);
    } catch (error) {
      console.error('[AuthContext] Error fetching user profile:', error);
      setUserProfile(null);
      setIsLoading(false);
    }
  };

  // Initialize auth state
  useEffect(() => {
    console.log('[AuthContext] Initializing...');
    
    let isSubscribed = true;
    
    // Get initial session - use supabase.auth which is separate from REST API
    // Note: auth.getSession() doesn't rely on the problematic websocket
    console.log('[AuthContext] Fetching initial session...');
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isSubscribed) return;
      
      console.log('[AuthContext] Initial session result:', session ? 'Session found' : 'No session');
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id, session.access_token);
      } else {
        console.log('[AuthContext] No user in session, ending loading state.');
        setIsLoading(false);
      }
    }).catch((error) => {
      console.error('[AuthContext] CRITICAL: Error getting initial session:', error);
      setIsLoading(false);
    });

    // Listen for auth changes - but debounce to prevent loops
    let lastUserId: string | null = null;
    
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isSubscribed) return;
      
      console.log('[AuthContext] Auth state changed:', _event);
      
      // Only update if user actually changed or signed out
      const newUserId = newSession?.user?.id ?? null;
      
      if (newUserId === lastUserId && _event === 'SIGNED_IN') {
        console.log('[AuthContext] Same user, skipping duplicate fetch');
        return;
      }
      
      lastUserId = newUserId;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      if (newSession?.user) {
        await fetchUserProfile(newSession.user.id, newSession.access_token);
      } else {
        setUserProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async (customRedirect?: string) => {
    try {
      const redirectUrl = customRedirect || window.location.origin;
      console.log('[AuthContext] Initiating Google Sign-In with redirect:', redirectUrl);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUserProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const refreshUserProfile = async () => {
    if (user && session) {
      await fetchUserProfile(user.id, session.access_token);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    userProfile,
    isLoading,
    isAdmin: userProfile?.role === 'admin',
    isBound: !!userProfile?.node_id,
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
