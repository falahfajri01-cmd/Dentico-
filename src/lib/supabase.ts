import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from window.__ENV__ which is set by public/env-config.js (generated at build time)
// Fallback to process.env for Next.js dev mode
function getEnv(key: string): string | undefined {
  if (typeof window !== 'undefined' && window.__ENV__) {
    return window.__ENV__[key];
  }
  // Fallback for dev mode - Next.js provides process.env.NEXT_PUBLIC_* at runtime
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  
  // During build/SSR, return null to avoid requiring env vars
  if (!isBrowser) {
    return null;
  }
  
  if (!supabaseInstance) {
    const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    
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