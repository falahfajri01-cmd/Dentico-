/// <reference types="next" />
/// <reference types="next/image-types/global" />

interface EnvConfig {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  [key: string]: string | undefined;
}

interface Window {
  __ENV__: EnvConfig;
}