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
      // #region agent log
      fetch('http://127.0.0.1:7735/ingest/e2ae643e-1184-40a1-9f61-75bc5e06ec80',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9ceeb1'},body:JSON.stringify({sessionId:'9ceeb1',runId:'loading-stuck',hypothesisId:'L1',location:'AuthContext.tsx:46',message:'updateToken start',data:{hasClerkSession:!!clerkSession},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (clerkSession) {
        try {
          console.log('[AuthContext] Fetching Supabase token from Clerk...');
          const token = await clerkSession.getToken({ template: 'supabase' });
          // #region agent log
          fetch('http://127.0.0.1:7735/ingest/e2ae643e-1184-40a1-9f61-75bc5e06ec80',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9ceeb1'},body:JSON.stringify({sessionId:'9ceeb1',runId:'loading-stuck',hypothesisId:'L1',location:'AuthContext.tsx:52',message:'updateToken success',data:{hasToken:!!token},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          console.log('[AuthContext] Supabase token received:', token ? 'YES (starts with ' + token.substring(0, 10) + '...)' : 'NO');
          setSupabaseToken(token);
        } catch (error) {
          // #region agent log
          fetch('http://127.0.0.1:7735/ingest/e2ae643e-1184-40a1-9f61-75bc5e06ec80',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9ceeb1'},body:JSON.stringify({sessionId:'9ceeb1',runId:'loading-stuck',hypothesisId:'L1',location:'AuthContext.tsx:56',message:'updateToken error',data:{error:String(error)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
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
      console.log('[AuthContext] Fetching user profile for:', userId);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const token = authToken || supabaseKey;
      console.log('[AuthContext] Using token type:', authToken ? 'Clerk JWT' : 'Anon Key');

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
        const errorBody = await response.text();
        console.error('[AuthContext] Fetch profile failed:', response.status, response.statusText, errorBody);
        throw new Error(`Failed to fetch profile: ${response.statusText} - ${errorBody}`);
      }

      const data = await response.json();
      console.log('[AuthContext] Profile data received:', data);
      
      if (data && data.length > 0) {
        setUserProfile(data[0]);
      } else {
        console.warn('[AuthContext] No profile found in DB for user:', userId);
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
    // #region agent log
    fetch('http://127.0.0.1:7735/ingest/e2ae643e-1184-40a1-9f61-75bc5e06ec80',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9ceeb1'},body:JSON.stringify({sessionId:'9ceeb1',runId:'loading-stuck',hypothesisId:'L2',location:'AuthContext.tsx:109',message:'init auth effect',data:{isClerkLoaded,hasClerkUser:!!clerkUser,hasSupabaseToken:!!supabaseToken,isProfileLoading},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!isClerkLoaded) return;

    if (clerkUser && supabaseToken) {
      fetchUserProfile(clerkUser.id, supabaseToken);
    } else if (!clerkUser) {
      setUserProfile(null);
      setIsProfileLoading(false);
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7735/ingest/e2ae643e-1184-40a1-9f61-75bc5e06ec80',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9ceeb1'},body:JSON.stringify({sessionId:'9ceeb1',runId:'loading-stuck',hypothesisId:'L3',location:'AuthContext.tsx:118',message:'stuck branch candidate',data:{hasClerkUser:!!clerkUser,hasSupabaseToken:!!supabaseToken,isProfileLoading},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
