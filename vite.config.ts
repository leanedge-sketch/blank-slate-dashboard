// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Explicitly bake Supabase env into the Lovable / CI build when secrets exist at build time.
const mode =
  process.env.NODE_ENV === "production" ? "production" : "development";
const env = loadEnv(mode, process.cwd(), "");

const supabaseUrl =
  process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "";
const supabaseKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  env.VITE_SUPABASE_ANON_KEY ??
  "";

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "[vite] Supabase env missing at build — set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Lovable Secrets.",
  );
}

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
          env.VITE_SUPABASE_PUBLISHABLE_KEY ??
          supabaseKey,
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        process.env.VITE_SUPABASE_ANON_KEY ??
          env.VITE_SUPABASE_ANON_KEY ??
          supabaseKey,
      ),
    },
  },
});
