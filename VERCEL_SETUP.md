# Vercel-only deployment (recommended)

Use **one** production stack: React on Vercel + FastAPI at `/api`. Do **not** use Render for this app.

| | URL |
|---|-----|
| **App** | https://blank-slate-dashboard-plum.vercel.app |
| **API** | https://blank-slate-dashboard-plum.vercel.app/api/v1 |

```
Browser  →  https://blank-slate-dashboard-plum.vercel.app/
         →  https://blank-slate-dashboard-plum.vercel.app/api/v1/*
```

The frontend ignores `VITE_API_URL` values that point at `*.onrender.com` and uses the Vercel API instead.

## Vercel project

- **Project:** `blank-slate-dashboard`
- **Repo:** `leanedge-sketch/blank-slate-dashboard`
- **Root:** repository root (uses root `vercel.json`)

## Required environment variables

Set in Vercel → **Settings → Environment Variables** (Production + Preview):

### Backend (runtime)

| Name | Description |
|------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `OPENAI_API_KEY` | Valid key from https://platform.openai.com/api-keys |

Optional: `RESEND_API_KEY` + `EMAIL_FROM` (or SMTP_*) — sends a **confirmation** email after password change (not required for the change to work).

### Frontend (build)

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same as anon key |
| `VITE_FRONTEND_URL` | `https://blank-slate-dashboard-plum.vercel.app` |

### Do not set

| Name | Why |
|------|-----|
| `VITE_API_URL` → Render | Causes AI/auth to hit an old Render backend. Leave unset. |

## Supabase Auth

**Authentication → URL configuration:**

- **Site URL:** `https://blank-slate-dashboard-plum.vercel.app`
- **Redirect URLs:** `https://blank-slate-dashboard-plum.vercel.app/**`

## Deploy

Push to `main` → Vercel redeploys automatically.

Manual: `npx vercel deploy --prod` from repo root.

## Verify

1. Open https://blank-slate-dashboard-plum.vercel.app (hard refresh: `Ctrl+Shift+R`).
2. DevTools → **Network** → trigger “Generate AI profile”.
3. Request host must be `blank-slate-dashboard-plum.vercel.app`, **not** `onrender.com`.
4. API smoke test: https://blank-slate-dashboard-plum.vercel.app/api/v1/auth/public-config → `200`.

## Local development

```bash
# Terminal 1 — API
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Frontend uses `http://localhost:8000/api/v1`.

## Troubleshooting

### OpenAI 401 `invalid_api_key`

Update `OPENAI_API_KEY` on **Vercel** (not Render) with a new key from OpenAI, then redeploy.

### Still calling Render

Remove `VITE_API_URL` on Vercel if it points to `onrender.com`. Redeploy. Use only the plum URL.

### Profile menu / old UI

Hard refresh or incognito on the plum URL.

### Vercel still opens an old URL (gcsx, integrated-deal, etc.)

You do **not** need a new Vercel project. You have **multiple URLs** pointing at different deployments:

| URL | Status |
|-----|--------|
| **https://blank-slate-dashboard-plum.vercel.app** | ✅ Use this — current production |
| `blank-slate-dashboard-gcsx.vercel.app` | Old alias on the same project → redirects to plum after deploy |
| `integrated-deal-and-product-system.vercel.app` | **Different** old project — old UI bundle |

**Fix (5 minutes in Vercel dashboard):**

1. Open project **blank-slate-dashboard** (not integrated-deal).
2. **Settings → Domains**
   - Ensure `blank-slate-dashboard-plum.vercel.app` is listed.
   - Click **⋯** → **Set as Production Domain** (or mark as primary).
3. **Settings → Environment Variables** (Production)
   - Set `VITE_FRONTEND_URL` = `https://blank-slate-dashboard-plum.vercel.app`
   - Remove `VITE_API_URL` if it contains `onrender.com`.
4. **Redeploy** the latest `main` commit (Deployments → … → Redeploy).
5. **Supabase** → Authentication → URL configuration:
   - Site URL: `https://blank-slate-dashboard-plum.vercel.app`
   - Redirect URLs: `https://blank-slate-dashboard-plum.vercel.app/**`
6. Bookmark only the **plum** URL. Ignore links from the old **integrated-deal** project.

Optional: In the **integrated-deal-and-product-system** Vercel project, remove the Git connection or delete the project so that URL stops serving stale builds.

After the next deploy, visiting `blank-slate-dashboard-gcsx.vercel.app` redirects to plum (server + in-app redirect).

### Change password — no confirmation email

**Profile → Change password** works without email config. To also send a confirmation to the user’s inbox, set on Vercel:

- `RESEND_API_KEY` — from [Resend](https://resend.com)
- `EMAIL_FROM` — verified sender, e.g. `LeanChem Connect <noreply@yourdomain.com>`

(or SMTP_*). Redeploy after adding variables.
