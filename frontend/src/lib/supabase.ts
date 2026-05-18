import { createClient } from "@supabase/supabase-js";

// Supabase configuration
// These should be set via environment variables in production
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "❌ Supabase URL or Anon Key not found. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables."
  );
} else {
  console.log("✅ Supabase client initialized");
  console.log("✅ URL:", supabaseUrl.substring(0, 30) + "...");
  console.log("✅ Key present:", supabaseAnonKey ? "Yes" : "No");
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  db: {
    schema: "public",
  },
});

