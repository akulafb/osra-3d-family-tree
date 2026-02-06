// TypeScript types for Supabase database schema
// These should match your actual Supabase table structure

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string; // UUID from auth.users
          node_id: string | null; // UUID - bound family node
          role: 'admin' | 'user';
          created_at: string;
        };
        Insert: {
          id: string;
          node_id?: string | null;
          role?: 'admin' | 'user';
          created_at?: string;
        };
        Update: {
          id?: string;
          node_id?: string | null;
          role?: 'admin' | 'user';
          created_at?: string;
        };
      };
      nodes: {
        Row: {
          id: string; // UUID
          name: string;
          family_cluster: string | null;
          created_by_user_id: string; // UUID
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          family_cluster?: string | null;
          created_by_user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          family_cluster?: string | null;
          created_by_user_id?: string;
          created_at?: string;
        };
      };
      links: {
        Row: {
          id: string; // UUID
          source_node_id: string; // UUID
          target_node_id: string; // UUID
          type: 'parent' | 'marriage';
          created_by_user_id: string; // UUID
          created_at: string;
        };
        Insert: {
          id?: string;
          source_node_id: string;
          target_node_id: string;
          type: 'parent' | 'marriage';
          created_by_user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_node_id?: string;
          target_node_id?: string;
          type?: 'parent' | 'marriage';
          created_by_user_id?: string;
          created_at?: string;
        };
      };
      node_invites: {
        Row: {
          id: string; // UUID
          node_id: string; // UUID
          token: string; // Unique invite token
          expires_at: string;
          claimed_by_user_id: string | null; // UUID
          created_by_user_id: string; // UUID
          created_at: string;
        };
        Insert: {
          id?: string;
          node_id: string;
          token: string;
          expires_at: string;
          claimed_by_user_id?: string | null;
          created_by_user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          node_id?: string;
          token?: string;
          expires_at?: string;
          claimed_by_user_id?: string | null;
          created_by_user_id?: string;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_within_1_degree: {
        Args: {
          target_node_id: string;
        };
        Returns: boolean;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
