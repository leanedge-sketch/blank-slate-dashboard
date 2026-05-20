# Vercel: Frontend + Backend (same project)

This repo deploys **both** the React app (`frontend/`) and the FastAPI backend (`api/index.py` → `backend/`) on one Vercel project. The browser talks to the API at **`https://<your-app>.vercel.app/api/v1`**.

Do **not** point `VITE_API_URL` at Render unless you intentionally use an external backend.

## Architecture

```
Browser  →  https://your-app.vercel.app/          (Vite SPA, frontend/)
         →  https://your-app.vercel.app/api/v1/*  (Python serverless, api/index.py)
```

`frontend/src/lib/api-base.ts` uses same-origin `/api/v1` on `*.vercel.app` when `VITE_API_URL` is unset.

## 1. Vercel project settings

In [Vercel Dashboard](https://vercel.com) → your project → **Settings**:

| Setting | Value |
|--------|--------|
| **Root Directory** | Leave as **repository root** (not `frontend` alone) |
| **Framework** | Vite (or auto from `vercel.json`) |
| **Build Command** | Handled by root `vercel.json` (`experimentalServices.frontend`) |
| **Output** | `frontend/dist` |

Import/connect the GitHub repo: `leanedge-sketch/blank-slate-dashboard`.

## 2. Environment variables (required)

**Settings → Environment Variables** → add for **Production**, **Preview**, and **Development**:

### Backend (runtime — no `VITE_` prefix)

These are read by FastAPI in `api/index.py` / `backend/app/config.py`:

| Name | Description |
|------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase **anon** key |
| `SUPABASE_SERVICE_KEY` | Supabase **service role** key (employee checks, admin) |
| `OPENAI_API_KEY` | OpenAI API key (AI features) |

Optional: `OPENAI_CHAT_MODEL`, `TELEGRAM_BOT_TOKEN`, `GOOGLE_PSE_API_KEY`, etc. (see `backend/app/config.py`).

### Frontend (build-time — optional if backend vars are set)

If these are set, Supabase works without calling the API at startup:

| Name | Description |
|------|-------------|
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same as anon key (or use `VITE_SUPABASE_ANON_KEY`) |

If `VITE_*` are missing at build time, the app loads config from **`GET /api/v1/auth/public-config`** (requires `SUPABASE_URL` + `SUPABASE_KEY` on the server).

### Do not set (unless you use an external API)

| Name | Notes |
|------|--------|
| `VITE_API_URL` | **Remove** if it points to Render. Leave unset so production uses `https://<app>.vercel.app/api/v1`. |

## 3. Deploy

1. Push to `main` (or your production branch).
2. Vercel redeploys automatically.
3. After changing env vars, trigger **Redeploy** (env changes need a new build for `VITE_*`; server vars apply on next function cold start).

## 4. Verify backend is connected

Replace `<your-app>` with your Vercel hostname:

1. **Health (via API mount):**  
   `https://<your-app>.vercel.app/api/v1` routes are under FastAPI; try docs:  
   `https://<your-app>.vercel.app/api/docs`
2. **Public Supabase config:**  
   `https://<your-app>.vercel.app/api/v1/auth/public-config`  
   Should return `{"url":"...","anon_key":"..."}` (not 503).
3. **Frontend:** Open the app → DevTools → Network. API calls should go to `https://<your-app>.vercel.app/api/v1/...`, not `localhost` or `onrender.com`.

## 5. Local development

```bash
# Terminal 1 — backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Frontend uses `http://localhost:8000/api/v1` by default.

## Troubleshooting

### CORS errors
Backend uses permissive CORS (`ReflectingWildcardCORSMiddleware`). If you still see CORS issues, confirm the request URL is your Vercel domain, not a third-party API.

### 503 on `/api/v1/auth/public-config`
Set `SUPABASE_URL` and `SUPABASE_KEY` on Vercel (server env), then redeploy.

### API calls go to Render or localhost in production
Delete `VITE_API_URL` on Vercel or set it to `https://<your-app>.vercel.app/api/v1`.

### Supabase error on load
Set either:
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` at build time, **or**
- `SUPABASE_URL` + `SUPABASE_KEY` for runtime bootstrap via `/api/v1/auth/public-config`.

### Python function timeout / cold start
Heavy AI routes may need a longer limit. Adjust `functions` in root `vercel.json` if needed.

### Monorepo build fails
Ensure root `vercel.json` is used (not only `frontend/vercel.json`). Root file wires `frontend` + `api/index.py`.
