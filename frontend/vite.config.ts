import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function pickEnv(
  key: string,
  fromFrontend: Record<string, string>,
  fromRoot: Record<string, string>,
): string {
  return process.env[key] ?? fromFrontend[key] ?? fromRoot[key] ?? "";
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const fromFrontend = loadEnv(mode, __dirname, "");
  const fromRoot = loadEnv(mode, repoRoot, "");

  const supabaseUrl = pickEnv("VITE_SUPABASE_URL", fromFrontend, fromRoot);
  const supabaseAnonKey =
    pickEnv("VITE_SUPABASE_ANON_KEY", fromFrontend, fromRoot) ||
    pickEnv("VITE_SUPABASE_PUBLISHABLE_KEY", fromFrontend, fromRoot);
  const supabasePublishableKey =
    pickEnv("VITE_SUPABASE_PUBLISHABLE_KEY", fromFrontend, fromRoot) ||
    supabaseAnonKey;

  const productionAppUrl =
    pickEnv("VITE_FRONTEND_URL", fromFrontend, fromRoot) ||
    "https://blank-slate-dashboard-plum.vercel.app";

  const rawApiUrl = pickEnv("VITE_API_URL", fromFrontend, fromRoot);
  // Production builds must not bake a Render backend URL.
  const productionApiUrl =
    rawApiUrl && !rawApiUrl.includes("onrender.com") ? rawApiUrl : "";

  console.log(
    `[vite] ${mode} build — VITE_SUPABASE_URL: ${supabaseUrl ? "set" : "MISSING"}, anon key: ${supabaseAnonKey ? "set" : "MISSING"}, frontend: ${productionAppUrl}, API: ${mode === "production" ? "Vercel same-origin" : rawApiUrl || "local"}`,
  );

  return {
    plugins: [react()],
    envDir: __dirname,
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(
        mode === "production" ? productionApiUrl : rawApiUrl,
      ),
      "import.meta.env.VITE_FRONTEND_URL": JSON.stringify(
        mode === "production" ? productionAppUrl : pickEnv("VITE_FRONTEND_URL", fromFrontend, fromRoot),
      ),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        pickEnv("VITE_SUPABASE_ANON_KEY", fromFrontend, fromRoot) ||
          supabaseAnonKey,
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY":
        JSON.stringify(supabasePublishableKey),
    },
    server: {
      port: 5173,
      host: true,
      strictPort: false,
    },
  };
});
