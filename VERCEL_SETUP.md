# Vercel Frontend Setup with Render Backend

## ✅ Step 1: Update Frontend API Configuration

The frontend code has been updated to use `VITE_API_URL` environment variable.

## ✅ Step 2: Add Environment Variable in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://integrated-deal-and-product-system-idps.onrender.com/api/v1`
   
   **IMPORTANT**: Make sure this is set for **ALL environments** (Production, Preview, Development) in Vercel.
   - **Environment**: Select all (Production, Preview, Development)

## ✅ Step 3: Update Backend CORS (On Render)

Your backend needs to allow requests from your Vercel frontend domain.

### Option A: Add via Render Environment Variables (Recommended)

1. Go to your Render dashboard
2. Select your backend service
3. Go to **Environment** tab
4. Add environment variable:
   - **Key**: `CORS_ORIGINS`
   - **Value**: `http://localhost:5173,https://your-app.vercel.app`
     - Replace `your-app.vercel.app` with your actual Vercel domain
     - You can add multiple domains separated by commas
   - Example: `http://localhost:5173,https://my-app.vercel.app,https://my-app-git-main.vercel.app`

5. **Redeploy** your backend service on Render

### Option B: Update config.py directly (if you prefer)

If you want to hardcode it, update `backend/app/config.py`:

```python
CORS_ORIGINS: List[str] = [
    "http://localhost:5173",
    "https://your-app.vercel.app",  # Add your Vercel domain here
    "https://your-app-git-main.vercel.app",  # Preview deployments
]
```

Then commit and push to trigger a redeploy.

## ✅ Step 4: Configure Vercel Project Settings

1. In Vercel dashboard, go to **Settings** → **General**
2. Set **Root Directory** to `frontend` (if deploying from monorepo)
3. Verify **Build Command**: `npm run build`
4. Verify **Output Directory**: `dist`
5. Verify **Install Command**: `npm install`

## ✅ Step 5: Deploy

1. Push your changes to GitHub (the updated `api.ts` file)
2. Vercel will automatically redeploy
3. Check the deployment logs to ensure build succeeds

## 🔍 Testing

After deployment:

1. Visit your Vercel frontend URL
2. Open browser DevTools → Network tab
3. Try making an API call (e.g., load customers)
4. Check if requests go to: `https://integrated-deal-and-product-system-idps.onrender.com/api/v1/...`
5. If you see CORS errors, double-check the `CORS_ORIGINS` setting on Render

## 📝 Quick Checklist

- [ ] Added `VITE_API_URL` in Vercel environment variables
- [ ] Added `CORS_ORIGINS` in Render environment variables (with your Vercel domain)
- [ ] Set Vercel root directory to `frontend` (if monorepo)
- [ ] Redeployed backend on Render
- [ ] Redeployed frontend on Vercel
- [ ] Tested API calls from production frontend

## 🐛 Troubleshooting

### CORS Errors
- Make sure your Vercel domain is in `CORS_ORIGINS` on Render
- Include both `https://your-app.vercel.app` and `https://your-app-git-*.vercel.app` (for preview deployments)
- Redeploy backend after changing CORS settings

### API Not Found (404)
- Verify the backend URL is correct: `https://integrated-deal-and-product-system-idps.onrender.com/api/v1`
- Check that your backend is running on Render
- Test the backend directly: `https://integrated-deal-and-product-system-idps.onrender.com/api/docs`

### Environment Variable Not Working
- Make sure variable name is exactly `VITE_API_URL` (case-sensitive)
- Vite requires `VITE_` prefix for client-side variables
- Redeploy after adding environment variables

