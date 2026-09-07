# CampusOrbit — Deployment Guide

> **Read this first.** CampusOrbit cannot be fully deployed to Vercel alone
> without breaking three features. This guide explains why, then gives you the
> recommended split deployment step by step.

---

## 1. Why Vercel alone is not enough

Vercel runs your backend as **serverless functions**: each request spins up an
instance, handles the request, then dies. Nothing stays running between
requests. Three parts of CampusOrbit depend on an always-on process.

| Feature | Code | Why it breaks on Vercel |
|---|---|---|
| **Peer Rooms + Watch Together** | `server/src/services/socket.service.js` | Socket.IO holds a persistent connection. Vercel's WebSocket support is **public beta** and drops the connection at the function max duration (~5 min on Hobby). Worse, room presence is an **in-memory `Map`** — reconnects land on a different instance, so online counts and watch-sync desynchronise. |
| **Reminders / notifications** | `server/src/services/cron.service.js` | Three `cron.schedule()` timers (daily 07:00, hourly, every 30 min). A serverless function has no clock ticking in the background — these simply never fire. Vercel Cron is a separate feature, **UTC only**, and Hobby is capped at **1 run per day**. |
| **Document Wallet uploads** | `server/src/middleware/upload.js` | Multer uses `diskStorage`. Vercel's filesystem is ephemeral — uploaded files vanish when the function instance dies. |

Two more things must change regardless of where you deploy:

- **MongoDB** — `127.0.0.1:27017` won't exist in the cloud. You need MongoDB Atlas.
- **Cookies** — `COOKIE_SECURE=true` so the auth cookie is `secure` + `sameSite=none`.

---

## 2. Recommended architecture

```
   Browser
      |
      |-- https://campusorbit.vercel.app  ---> Vercel        (React static build)
      |
      |-- https://campusorbit-api.onrender.com --> Render    (Express + Socket.IO + cron)
                                                      |
                                                      v
                                              MongoDB Atlas
```

**Frontend on Vercel** (what Vercel is genuinely excellent at) and
**backend on a persistent host** — Render, Railway, or Fly.io. Everything works,
nothing is crippled, and the free tiers are enough for a demo.

> If you must keep everything on Vercel, see [Section 7](#7-alternative-everything-on-vercel).

---

## 3. Step 1 — MongoDB Atlas (both approaches need this)

1. Sign up at <https://www.mongodb.com/cloud/atlas> → **Create** a free **M0** cluster.
2. **Database Access** → Add New Database User. Username `campusorbit`, generate a
   strong password, role **Read and write to any database**. Save the password.
3. **Network Access** → Add IP Address → **Allow Access from Anywhere** (`0.0.0.0/0`).
   Render and Vercel don't publish fixed egress IPs on free tiers.
4. **Connect** → **Drivers** → copy the URI. It looks like:

   ```
   mongodb+srv://campusorbit:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

5. Insert the password and add the database name `campusorbit` before the `?`:

   ```
   mongodb+srv://campusorbit:YOURPASS@cluster0.xxxxx.mongodb.net/campusorbit?retryWrites=true&w=majority
   ```

### Seed Atlas from your laptop

```powershell
cd server
# PowerShell
$env:MONGODB_URI="mongodb+srv://campusorbit:YOURPASS@cluster0.xxxxx.mongodb.net/campusorbit?retryWrites=true&w=majority"
npm run seed
```

You should see `✅ Seed complete` with 6 users, 4 paths, 26 lessons.

---

## 4. Step 2 — Backend on Render

1. Push the project to GitHub if you haven't:

   ```powershell
   git init
   git add .
   git commit -m "CampusOrbit"
   git branch -M main
   git remote add origin https://github.com/YOURNAME/CampusOrbit.git
   git push -u origin main
   ```

   > `.gitignore` already excludes `node_modules` and `.env` — verify `server/.env`
   > is **not** in the commit before pushing.

2. Go to <https://render.com> → **New** → **Web Service** → connect your repo.

3. Configure:

   | Field | Value |
   |---|---|
   | Root Directory | `server` |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | Free |

4. **Environment** → add these variables:

   ```
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb+srv://campusorbit:YOURPASS@cluster0.xxxxx.mongodb.net/campusorbit?retryWrites=true&w=majority
   JWT_SECRET=<a long random string — generate a new one, do not reuse the dev secret>
   JWT_EXPIRES_IN=7d
   COOKIE_SECURE=true
   CLIENT_ORIGIN=https://campusorbit.vercel.app
   GEMINI_API_KEY=
   UPLOAD_DIR=uploads

   RESET_TOKEN_TTL_MIN=30
   ```

   Generate a secret with:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   > Leave `GEMINI_API_KEY` **blank** so the UI honestly shows "Demo AI Mode".
   > See [Section 8](#8-known-limitations-to-state-openly).

5. Deploy. Note your URL, e.g. `https://campusorbit-api.onrender.com`.

6. Verify:
   ```powershell
   curl https://campusorbit-api.onrender.com/api/health
   ```

> **Render free tier sleeps after 15 min idle.** The first request then takes
> ~50s to wake. Fine for a demo — mention it, or use a paid instance.

---

## 5. Step 3 — Two code changes for the split

Right now the client uses **relative URLs**, which only works when the API is on
the same origin. Split deployment needs absolute URLs.

### 5a. `client/src/services/api.js`

```js
// before
baseURL: '/api',

// after
baseURL: import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api',
```

### 5b. `client/src/hooks/useSocket.js`

```js
// before
sharedSocket = io({
  path: '/socket.io',
  ...

// after
sharedSocket = io(import.meta.env.VITE_API_URL || undefined, {
  path: '/socket.io',
  ...
```

Both keep the relative fallback, so **local `npm run dev` keeps working unchanged**.

---

## 6. Step 4 — Frontend on Vercel

1. <https://vercel.com> → **Add New** → **Project** → import the same repo.

2. Configure:

   | Field | Value |
   |---|---|
   | Framework Preset | Vite |
   | Root Directory | `client` |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |

3. **Environment Variables** → add:

   ```
   VITE_API_URL = https://campusorbit-api.onrender.com
   ```

   > No trailing slash. `VITE_` prefix is required or Vite won't expose it.

4. SPA routing — create `client/vercel.json` so deep links like
   `/dashboard` don't 404 on refresh:

   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```

5. Deploy.

6. **Go back to Render** and set `CLIENT_ORIGIN` to your real Vercel URL, then
   redeploy the backend. CORS + cookies won't work until this matches exactly.

### Verify

- Open the Vercel URL → login with `student@campusorbit.dev` / `Student@123`
- DevTools → Application → Cookies → `co_token` present, `Secure`, `SameSite=None`
- Open a Peer Room in two browsers → messages appear in both
- DevTools → Network → WS → connection status `101 Switching Protocols`

---

## 7. Alternative: everything on Vercel

Possible since Vercel's WebSocket beta (June 2026), but with real degradation.
Only choose this if a single platform is a hard requirement.

**What you must change:**

1. **Client socket must be WebSocket-only.** Vercel does not support Socket.IO's
   long-polling fallback:
   ```js
   transports: ['websocket'],   // remove 'polling'
   ```
2. **Move presence out of memory.** `presence` in `socket.service.js` is a `Map`.
   Across instances it must live in Redis (Vercel Marketplace) or online counts
   and watch-sync will be wrong.
3. **Replace node-cron with Vercel Cron.** Delete the `cron.schedule()` calls and
   add to `vercel.json`:
   ```json
   { "crons": [{ "path": "/api/admin/run-reminders", "schedule": "0 7 * * *" }] }
   ```
   The endpoint already exists. **Hobby allows only 1 cron/day, UTC only** — the
   hourly and 30-minute jobs are not possible without Pro.
4. **Replace disk uploads with blob storage.** Swap Multer `diskStorage` for
   `memoryStorage` + Vercel Blob / Cloudinary / S3.

**Accept:** sockets drop at the function max duration (~5 min on Hobby) and
clients must reconnect.

---

## 8. Known limitations to state openly

If you're presenting or submitting this, say these plainly — they're all fine,
but claiming otherwise would be dishonest:

1. **AI is rule-based, not a real LLM.** There is no outbound AI API call anywhere
   in `server/src/`. With `GEMINI_API_KEY` blank the UI correctly says
   **"Demo AI Mode"**. **Do not set a fake key** — the label flips to "Live AI"
   and the notice claims "Responses are generated live" while the output stays
   deterministic.
2. **Docker was never executed.** The `Dockerfile` and `docker-compose.yml` are
   validated by inspection and YAML parsing only.
3. **Render free tier cold-starts** after 15 minutes idle.
4. **Uploads are ephemeral** unless you move to blob storage.

---

## 9. Quick reference

| Variable | Where | Value |
|---|---|---|
| `MONGODB_URI` | Render | Atlas SRV string ending `/campusorbit` |
| `JWT_SECRET` | Render | fresh 48-byte random hex |
| `COOKIE_SECURE` | Render | `true` |
| `CLIENT_ORIGIN` | Render | exact Vercel URL, no trailing slash |
| `GEMINI_API_KEY` | Render | leave blank |
| `VITE_API_URL` | Vercel | Render URL, no trailing slash |

**Demo credentials**

| Role | Email | Password |
|---|---|---|
| Student | `student@campusorbit.dev` | `Student@123` |
| Admin | `admin@campusorbit.dev` | `Admin@123` |
| Senior | `senior@campusorbit.dev` | `Senior@123` |

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Login returns 200 but you stay logged out | Cookie rejected | `COOKIE_SECURE=true` and `CLIENT_ORIGIN` must match the Vercel URL exactly |
| CORS error in console | Origin mismatch | Fix `CLIENT_ORIGIN` on Render, redeploy |
| `/dashboard` 404s on refresh | No SPA rewrite | Add `client/vercel.json` (Step 6.4) |
| Socket never connects | Wrong URL or transport | Check `VITE_API_URL`; Network → WS should show `101` |
| First request takes ~50s | Render free tier cold start | Expected; upgrade or warn viewers |
| `MongoServerError: bad auth` | Password/URL encoding | Re-copy from Atlas; URL-encode special characters |
| Seed fails with `E11000 ... student_1_opportunity_1` | Stale index from an old schema | Drop the DB, then reseed (see below) |

**Drop and reseed** (no `mongosh` needed — run from the `server` folder):

```powershell
cd server
node -e "const m=require('mongoose');m.connect(process.env.MONGODB_URI).then(()=>m.connection.db.dropDatabase()).then(()=>{console.log('dropped');return m.disconnect()})"
npm run seed
```
