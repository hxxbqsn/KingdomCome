import { createClient } from '@supabase/supabase-js';

const env = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env;
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = url && key ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
}) : null;

export const normalizeUsername = (value: string) => value.trim().toLowerCase();
export const validUsername = (value: string) => /^[a-z0-9_-]{3,24}$/.test(normalizeUsername(value));
