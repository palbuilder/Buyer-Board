const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabaseEnv() {
  return {
    url: supabaseUrl,
    key: supabaseKey,
  };
}

export function hasSupabaseEnv() {
  return Boolean(supabaseUrl && supabaseKey);
}
