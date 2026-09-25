import { createClient, SupabaseClient } from '@supabase/supabase-js';

// These are replaced at build time by Next.js for static export
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  
  // During build/SSR, return null to avoid requiring env vars
  if (!isBrowser) {
    return null;
  }
  
  if (!supabaseInstance) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase environment variables not set - running in demo mode');
      return null;
    }
    
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    } catch (err) {
      console.error('Failed to create Supabase client:', err);
      return null;
    }
  }
  
  return supabaseInstance;
}

// For backward compatibility - only use in client components
export const supabase = getSupabase();