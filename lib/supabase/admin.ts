import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy-initialized service role client for server-side operations
// This client bypasses Row Level Security
let _supabaseAdmin: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
    }

    _supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
  }

  return _supabaseAdmin
}

// For backwards compatibility, export as a getter
export const supabaseAdmin = {
  from: (table: string) => getSupabaseAdmin().from(table),
}
