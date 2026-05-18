// Test script to manually test employees query
// You can paste this into browser console to debug

export async function testEmployeesQueryDirectly() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  console.log("🧪 Testing direct REST API call...");
  console.log("URL:", supabaseUrl);
  console.log("Key present:", !!supabaseKey);
  
  try {
    const email = "sumeyasirmulach@gmail.com";
    const url = `${supabaseUrl}/rest/v1/employees?email=eq.${encodeURIComponent(email)}&select=email,role,name`;
    
    console.log("🧪 Making request to:", url);
    
    const startTime = Date.now();
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
    });
    
    const timeTaken = Date.now() - startTime;
    console.log(`🧪 Response received in ${timeTaken}ms`);
    console.log("🧪 Status:", response.status, response.statusText);
    console.log("🧪 Headers:", Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log("🧪 Response data:", data);
    
    return { response, data, timeTaken };
  } catch (error) {
    console.error("🧪 Direct API test failed:", error);
    return { error };
  }
}

