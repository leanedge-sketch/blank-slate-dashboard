import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";
import { CANONICAL_PRODUCTION_URL } from "./src/lib/canonical-host";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function pickEnv(
  key: string,
  fromFrontend: Record<string, string>,
  fromRoot: Record<string, string>,
): string {
  return process.env[key] ?? fromFrontend[key] ?? fromRoot[key] ?? "";
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

  // Production always uses plum — VITE_FRONTEND_URL on Vercel is not required.
  const devFrontendUrl = pickEnv("VITE_FRONTEND_URL", fromFrontend, fromRoot);

  const rawApiUrl = pickEnv("VITE_API_URL", fromFrontend, fromRoot);
  // Production builds must not bake a Render backend URL.
  const productionApiUrl =
    rawApiUrl && !rawApiUrl.includes("onrender.com") ? rawApiUrl : "";

  console.log(
    `[vite] ${mode} build — VITE_SUPABASE_URL: ${supabaseUrl ? "set" : "MISSING"}, anon key: ${supabaseAnonKey ? "set" : "MISSING"}, frontend: ${mode === "production" ? CANONICAL_PRODUCTION_URL : devFrontendUrl || "(origin)"}, API: ${mode === "production" ? "Vercel same-origin" : rawApiUrl || "local"}`,
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
          if (!out.includes("stale-chunk-reload")) {
            const staleChunkReload = `<script id="stale-chunk-reload">(function(){var k="stale-chunk-reload";window.addEventListener("error",function(e){var t=e.target;if(t&&t.tagName==="SCRIPT"&&t.type==="module"){if(sessionStorage.getItem(k)!=="1"){sessionStorage.setItem(k,"1");location.reload();}}},true);window.addEventListener("vite:preloadError",function(e){e.preventDefault();if(sessionStorage.getItem(k)!=="1"){sessionStorage.setItem(k,"1");location.reload();}});})();</script>`;
            out = out.replace("</head>", `${staleChunkReload}</head>`);
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
        mode === "production" ? CANONICAL_PRODUCTION_URL : devFrontendUrl,
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
