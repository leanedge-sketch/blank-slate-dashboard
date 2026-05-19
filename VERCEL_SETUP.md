# Full-stack deployment on Vercel (frontend + FastAPI backend)

This repo deploys **both** the Vite frontend and the FastAPI backend on a single Vercel project.

| Path | What runs |
|------|-----------|
| `/` | React app (`frontend/`) |
| `/api/*` | FastAPI (`api/index.py` → `backend/app/main.py`) |
| `/api/v1/auth/public-config` | Supabase config for the browser |
| `/api/docs` | Swagger UI |

## Critical: Vercel project settings

1. Open **Vercel → Project → Settings → General**.
2. Set **Root Directory** to **`.`** (repository root) — **not** `frontend`.
   - If Root Directory is `frontend`, only the UI deploys; `/api` will 404.
3. Production branch: **`main`**.

## Environment variables

Add these in **Settings → Environment Variables** for **Production, Preview, and Development**:

### Backend (required for `/api`)

| Name | Description |
|------|-------------|
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `OPENAI_API_KEY` | If using CRM AI features |

### Frontend build (optional — runtime fallback uses backend)

| Name | Description |
|------|-------------|
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same as `SUPABASE_KEY` |
| `VITE_FRONTEND_URL` | `https://your-app.vercel.app` (auth email redirects) |

### Do **not** set this unless you use an external API host

| Name | Notes |
|------|--------|
| `VITE_API_URL` | **Remove** if it points to Render. Leave unset so production uses `https://your-app.vercel.app/api/v1`. |

## Deploy

1. Push to `main` on GitHub.
2. Vercel redeploys automatically.
3. In the build log you should see **Python** dependency install (`pip install -r requirements.txt`) and the **Vite** frontend build.

## Verify backend

Replace `YOUR-APP` with your Vercel hostname:

```text
https://YOUR-APP.vercel.app/api/v1/auth/public-config
```

Expected: JSON with `url` and `anon_key`.

```text
https://YOUR-APP.vercel.app/api/docs
```

Expected: FastAPI Swagger UI.

## Local development

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

Frontend uses `http://localhost:8000/api/v1` automatically in dev.

## Troubleshooting

### Frontend works, `/api` returns 404

- Root Directory is set to `frontend` → change to repository root and redeploy.

### `VITE_API_URL` points to Render

- Delete `VITE_API_URL` in Vercel env vars so the app uses same-origin `/api/v1`.

### Backend 503 on `public-config`

- `SUPABASE_URL` or `SUPABASE_KEY` missing on Vercel → add server env vars and redeploy.

### Python build fails (size / timeout)

- Check deployment logs for package install errors.
- Heavy deps (pandas, PDF libs) are required for full CRM; Pro plan may help for memory/time limits.

### CORS errors

- Backend uses wildcard CORS middleware; if issues persist, confirm requests go to your Vercel `/api/v1` URL, not localhost.
