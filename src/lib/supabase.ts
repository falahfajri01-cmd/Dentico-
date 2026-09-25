import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  // During build/SSR, return null to avoid requiring env vars
  if (typeof window === 'undefined' || process.env.NEXT_PHASE === 'phase-production-build') {
    return null;
  }
  
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase environment variables not set - running in demo mode');
      return null;
    }
    
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  
  return supabaseInstance;
}

// For backward compatibility - only use in client components
export const supabase = typeof window !== 'undefined' ? getSupabase() : null;