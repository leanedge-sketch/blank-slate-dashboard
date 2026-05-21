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

/** Never bake legacy Vercel/Render URLs into production auth redirects. */
function sanitizeProductionFrontendUrl(url: string): string {
  const canonical = "https://blank-slate-dashboard-plum.vercel.app";
  const trimmed = url.trim();
  if (!trimmed) return canonical;
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("gcsx") ||
    lower.includes("integrated-deal") ||
    lower.includes("onrender.com")
  ) {
    return canonical;
  }
  return trimmed.replace(/\/$/, "");
}

const CANONICAL_HOST_INLINE_SCRIPT = `<script id="canonical-host-redirect">(function(){var c="blank-slate-dashboard-plum.vercel.app",h=location.hostname;if(h===c)return;if(h==="integrated-deal-and-product-system.vercel.app"||(h.endsWith(".vercel.app")&&h.indexOf("blank-slate-dashboard")===0&&h!==c)){location.replace("https://"+c+location.pathname+location.search+location.hash)}})();</script>`;

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

  const CANONICAL_PRODUCTION_URL = "https://blank-slate-dashboard-plum.vercel.app";
  const rawFrontendUrl = pickEnv("VITE_FRONTEND_URL", fromFrontend, fromRoot);
  const devFrontendUrl = rawFrontendUrl || "";
  const productionAppUrl = sanitizeProductionFrontendUrl(rawFrontendUrl);

  const rawApiUrl = pickEnv("VITE_API_URL", fromFrontend, fromRoot);
  // Production builds must not bake a Render backend URL.
  const productionApiUrl =
    rawApiUrl && !rawApiUrl.includes("onrender.com") ? rawApiUrl : "";

  console.log(
    `[vite] ${mode} build — VITE_SUPABASE_URL: ${supabaseUrl ? "set" : "MISSING"}, anon key: ${supabaseAnonKey ? "set" : "MISSING"}, frontend: ${productionAppUrl}, API: ${mode === "production" ? "Vercel same-origin" : rawApiUrl || "local"}`,
  );

  const buildStamp = new Date().toISOString();

  return {
    plugins: [
      react(),
      {
        name: "html-cache-bust",
        transformIndexHtml(html: string) {
          let out = html.replace(
            "<html",
            `<html data-build="${buildStamp}"`,
          );
          if (mode === "production" && !out.includes("canonical-host-redirect")) {
            out = out.replace("<head>", `<head>${CANONICAL_HOST_INLINE_SCRIPT}`);
          }
          return out;
        },
      },
    ],
    envDir: __dirname,
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(
        mode === "production" ? productionApiUrl : rawApiUrl,
      ),
      "import.meta.env.VITE_FRONTEND_URL": JSON.stringify(
        mode === "production" ? productionAppUrl : devFrontendUrl,
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
