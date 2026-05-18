// Utility to test Supabase connection and employees table
import { supabase } from "../lib/supabase";

export async function testSupabaseConnection() {
  console.log("🧪 Testing Supabase connection...");
  console.log("🧪 Supabase URL:", supabase.supabaseUrl);

  try {
    // Test 1: Simple query to any table
    console.log("🧪 Test 1: Checking if we can connect...");
    const { data: test1, error: error1 } = await supabase.rpc("version").single();
    console.log("🧪 Test 1 result:", { data: test1, error: error1 });

    // Test 2: Try to query employees table with limit
    console.log("🧪 Test 2: Querying employees table...");
    const { data: test2, error: error2 } = await supabase
      .from("employees")
      .select("*")
      .limit(1);
    console.log("🧪 Test 2 result:", { data: test2, error: error2 });

    // Test 3: Query with specific email
    console.log("🧪 Test 3: Querying for specific email...");
    const { data: test3, error: error3 } = await supabase
      .from("employees")
      .select("email, role, name")
      .eq("email", "sumeyasirmulach@gmail.com")
      .maybeSingle();
    console.log("🧪 Test 3 result:", { data: test3, error: error3 });

    return { test1, test2, test3, errors: { error1, error2, error3 } };
  } catch (error) {
    console.error("🧪 Connection test failed:", error);
    return { error };
  }
}

// Call this from browser console: testSupabaseConnection()

