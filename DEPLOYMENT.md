# Deployment

Recommended setup:
- **Backend** → Railway (Docker-based, free trial credit)
- **Frontend** → Vercel (Next.js native, free tier)

The order matters: **deploy the backend first** so you have a URL to point
the frontend at.

---

## 1. Backend → Railway

### 1.1 Sign in
1. Go to **<https://railway.app>** and sign up with your GitHub account.
2. Authorize Railway to read your repos.

### 1.2 Create the project
1. Click **New Project** → **Deploy from GitHub repo**.
2. Pick the `Zsumb/greek-app` repo.
3. Railway will scan the repo and ask you to choose a service config.

### 1.3 Point Railway at the `backend/` directory
By default Railway tries to build the repo root. We have a monorepo, so we
need to tell it to use `backend/`:

1. In the new service, open **Settings**.
2. Under **Source**, set **Root Directory** = `backend`
3. Under **Build**, leave **Builder** = `Dockerfile` (Railway will pick up
   `backend/Dockerfile` automatically).
4. Click **Deploy** (or it will auto-trigger).

### 1.4 Generate a public URL
1. Open the service → **Settings** → **Networking**.
2. Click **Generate Domain**. Railway gives you a URL like
   `greek-app-backend-production.up.railway.app`.
3. **Copy this URL** — you'll paste it into Vercel in step 2.

### 1.5 Test the backend
Hit `/docs` on your new URL:

```
https://<your-railway-domain>/docs
```

You should see the FastAPI Swagger UI. Try `POST /position/greeks` with
the walkthrough payload:

```json
{
  "S": 500,
  "sigma": 0.20,
  "r": 0.05,
  "legs": [{"kind": "call", "strike": 500, "expiry_days": 30, "quantity": 1}]
}
```

Expected response: `delta ≈ 53.99`, `gamma ≈ 1.385`, etc.

---

## 2. Frontend → Vercel

### 2.1 Sign in
1. Go to **<https://vercel.com>** and sign up with your GitHub account.
2. Authorize Vercel.

### 2.2 Import the project
1. **Add New** → **Project** → import `Zsumb/greek-app`.
2. Vercel will detect Next.js automatically.

### 2.3 Configure the build
- **Root Directory:** click **Edit** → set to `frontend`
  (this is the critical step for our monorepo)
- **Framework Preset:** Next.js (auto-detected)
- **Build Command:** default (`next build`)
- **Output Directory:** default

### 2.4 Add environment variable
Under **Environment Variables**, add **one**:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://<your-railway-domain>` (from step 1.4, no trailing slash) |

### 2.5 Deploy
Click **Deploy**. First build takes ~2 minutes. You'll get a URL like
`https://greek-app.vercel.app`.

**Copy this URL** — you'll wire it back into Railway in step 3.

---

## 3. Wire CORS back to the frontend

Right now your backend only allows `localhost:3000`. Update it so your
Vercel URL is allowed:

1. Back in **Railway** → your backend service → **Variables**.
2. Add a new variable:

| Name | Value |
|---|---|
| `CORS_ORIGINS` | `https://greek-app.vercel.app` (use whatever Vercel gave you) |

3. Railway will redeploy automatically (~30 seconds).

**Want preview deployments to work too?** Set:
```
CORS_ORIGINS=https://greek-app.vercel.app,https://greek-app-*-zsumb.vercel.app
```
(comma-separated; the wildcard pattern matches Vercel preview branches)

---

## 4. Test the full stack

1. Visit your Vercel URL.
2. The "Live Greeks" panel should populate within a second (calling Railway).
3. Type a ticker in **Strategy Builder** → click **Fetch**. Spot, expiries,
   and IV should load.
4. Open **Time Machine** → drag a slider. The decomposition should update.

If the browser console shows CORS errors, double-check the `CORS_ORIGINS`
value in Railway matches your Vercel URL exactly (no trailing slash).

---

## 5. Auto-deploy on push

Both Vercel and Railway watch `main` by default. After this is set up,
`git push` to `main` automatically:
- Triggers a Vercel build (frontend)
- Triggers a Railway redeploy (backend, if the Dockerfile or `backend/`
  content changed)

Vercel also builds *preview deployments* for every branch and PR — you'll
get a unique URL per branch. Useful for iterating without breaking `main`.

---

## Cost notes

- **Vercel free tier** is more than enough for this app (no traffic).
- **Railway** has a $5/month trial credit. This backend will use ~$1-3/month
  with light use. Past the trial: you can switch to **Fly.io** (free tier,
  same `Dockerfile`) or **Render** with similar steps.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Vercel build fails with "no Next.js project found" | Root Directory not set to `frontend` |
| Railway build fails immediately | Root Directory not set to `backend` |
| Frontend loads but Greeks show error | `NEXT_PUBLIC_API_BASE_URL` wrong in Vercel, or `CORS_ORIGINS` doesn't match in Railway |
| Ticker fetch fails on Railway but works locally | yfinance can be flaky from cloud IPs; retry. Free Railway IPs aren't blocked but this is a known yfinance quirk. |
