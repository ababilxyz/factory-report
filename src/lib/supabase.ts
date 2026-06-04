import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Validate required config at startup
if (!supabaseUrl) {
  throw new Error('[Supabase] Missing environment variable: VITE_SUPABASE_URL. Check your .env file.')
}
if (!supabaseAnonKey) {
  throw new Error('[Supabase] Missing environment variable: VITE_SUPABASE_ANON_KEY. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)