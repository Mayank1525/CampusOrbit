# Running CampusOrbit — step by step

Written for **Windows / PowerShell** (your machine), with macOS/Linux notes where they differ.
Every command below was executed and verified before this guide was written.

Project location on your machine:

```
C:\Users\Mayank Vishvakarma\Desktop\CampusOrbit
```

---

## TL;DR — the 4 commands

Once the prerequisites are installed, this is the whole thing:

```powershell
cd "C:\Users\Mayank Vishvakarma\Desktop\CampusOrbit"
npm run install:all     # 1. install dependencies (once)
npm run seed            # 2. fill MongoDB with demo data (once)
npm run dev             # 3. start API :5000 + website :5173
```

Then open **http://localhost:5173** and log in with `student@campusorbit.dev` / `Student@123`.

Everything below is the same thing, explained, with the failure modes.

---

## Step 0 — Prerequisites

You need exactly two things: **Node.js** and **MongoDB**.

### Node.js 20.19+ (22 LTS recommended)

```powershell
node -v      # must print v20.19.0 or higher
npm -v       # must print 10.x or higher
```

If it's missing or too old, install **Node 22 LTS** from <https://nodejs.org>.
The project pins this in `.nvmrc` and enforces it via `engines` in all three `package.json` files.

### MongoDB — pick ONE of these three

You only need the database running on `localhost:27017`. Any of these works:

**Option A — MongoDB Community Server (simplest on Windows)**

1. Download from <https://www.mongodb.com/try/download/community>
2. Run the installer and tick **"Install MongoDB as a Service"** — it then starts automatically on boot and you never think about it again.
3. Confirm the service is alive:
   ```powershell
   Get-Service MongoDB
   ```
   You want `Status: Running`.

**Option B — Docker** (if you have Docker Desktop)

```powershell
npm run db:up      # docker compose up -d mongo
```
This starts Mongo 7 bound to `127.0.0.1:27017` only, so it is never exposed to your network.

**Option C — MongoDB Atlas** (free cloud tier, no local install)

Create a free cluster, then put your connection string into `server/.env` as `MONGODB_URI`.

> **Note:** you do **not** need `mongosh` (the Mongo shell) for any step in this guide.
> The seed script and the app talk to the database through the Node driver.

---

## Step 1 — Install dependencies

There are three `package.json` files (root, `server/`, `client/`). One command does all three:

```powershell
cd "C:\Users\Mayank Vishvakarma\Desktop\CampusOrbit"
npm run install:all
```

This runs a self-verifying installer: it installs all three, then checks that `vite` and the correct
native `@rollup/rollup-*` binary actually landed. If they didn't, it wipes and retries once
automatically. Takes 2–4 minutes on a first run.

<details>
<summary><b>If it fails with <code>Cannot find module @rollup/rollup-win32-x64-msvc</code></b></summary>

This is a known npm bug ([npm/cli#4828](https://github.com/npm/cli/issues/4828)) with optional
native dependencies on Windows. There is a repair script:

```powershell
npm run fix:install
```

Do **not** hand-edit `package-lock.json` — that makes it worse.
</details>

---

## Step 2 — Configure the environment

```powershell
Copy-Item server\.env.example server\.env
```

*(macOS/Linux: `cp server/.env.example server/.env`)*

The defaults work as-is for local development. Open `server/.env` and change one thing:

```ini
JWT_SECRET=put_any_long_random_string_here
```

**Everything else is optional.** In particular:

| Variable | Leave blank means |
|---|---|
| `GEMINI_API_KEY` | App runs in honest **"Demo AI Mode"** with seeded fallbacks. Labelled as such on every AI surface — it never pretends to be a real model. |

Only edit `MONGODB_URI` if you chose Atlas (Option C) or run Mongo on a non-default port.


---

## Step 3 — Seed the database

```powershell
npm run seed
```

This is **required** — the app is not interesting against an empty database. It creates:

- 6 user accounts (3 roles), 4 learning paths, 20 milestones, 26 lessons
- 7 opportunities, 5 peer rooms with 29 messages, **4 Google Meet sessions**
- 260 flashcards, quizzes, notes, revision tasks, resumes, interview questions, notifications

The script is **idempotent** — safe to re-run any time you want a clean slate.

You'll know it worked when it prints the collection counts and the demo credentials table.

<details>
<summary><b>If seeding fails with <code>E11000 duplicate key error</code></b></summary>

You have a stale index from an older schema version. `deleteMany` doesn't drop indexes, so the fix
is to drop the whole database and re-seed:

```powershell
cd server
node -e "const m=require('mongoose');m.connect('mongodb://127.0.0.1:27017/campusorbit').then(()=>m.connection.db.dropDatabase()).then(()=>{console.log('Database dropped');return m.disconnect()})"
cd ..
npm run seed
```

⚠️ The `node -e` command **must** be run from inside the `server` folder — that's where `mongoose`
is installed. Running it from the project root fails with `Cannot find module 'mongoose'`.
</details>

---

## Step 4 — Start the app

```powershell
npm run dev
```

This starts **both** servers in one terminal with colour-coded prefixes:

```
[API] 🚀 CampusOrbit API running on http://0.0.0.0:5000
[API]    MongoDB     : mongodb://127.0.0.1:27017/campusorbit
[API]    Socket.IO   : ready
[API]    AI mode     : Demo AI Mode (seeded fallback)
[WEB]   ➜  Local:   http://localhost:5173/
```

### 👉 Open **http://localhost:5173**

Use `5173`, **not** `5000`. Port 5000 is the bare API — visiting it in a browser shows JSON, not the
site. The Vite dev server on 5173 proxies `/api` and the Socket.IO connection through to 5000 for you.

Both servers hot-reload: edit a file and the change appears without restarting.

**To stop:** `Ctrl+C` in that terminal.

Prefer separate terminals? `npm run dev:server` and `npm run dev:client` in two windows.

---

## Step 5 — Log in

| Role | Email | Password | What you'll see |
|---|---|---|---|
| **Student** | `student@campusorbit.dev` | `Student@123` | Aarav Sharma — the main demo account. Dashboard, active MERN path, applications, resumes. |
| **Admin** | `admin@campusorbit.dev` | `Admin@123` | Placement cell — drive CRUD, applicant pipeline, CSV export, analytics, AI publish gate. |
| **Senior** | `senior@campusorbit.dev` | `Senior@123` | Ishita Verma, alumni — **can host Google Meet sessions** and moderate rooms. |

Extra students, all `Student@123`:

- `rohan@campusorbit.dev`, `sneha@campusorbit.dev` — normal students
- `karan@campusorbit.dev` — **onboarding deliberately incomplete**, 6.1 CGPA, 2 backlogs. Use this one to see the eligibility engine *reject* someone and explain exactly which rule failed.

---

## What to actually click (a 5-minute tour)

1. **Dashboard** — Today's Orbit (3 tasks), streak, "What should I do next?", and the 3D Learning Orbit. Drag it, hover a node for milestone info, click to open the detail panel.
2. **Path Navigator → My Path** — milestone detail with why-it-matters, prereqs and a proof task. Try switching paths; completed topics transfer.
3. **Learn** — open a lesson. One curated primary video per topic, with a stated reason for the recommendation. Progress persists.
4. **Placement Hub** — filter drives, hit one you're not eligible for and read the explanation. Bookmark, apply, then watch it move through the pipeline in **My Applications**.
5. **Resume Studio** — build a resume, switch between the 4 templates (data survives), change the accent, then **Export PDF** — a real multi-page A4 file lands in Downloads.
6. **Peer Prep Rooms** → **DSA Arrays and Strings** → **Live** tab — the Google Meet feature. As the student you can RSVP; log in as the **senior** to see the **Host** button, schedule a session, and view attendance.
7. **Watch Together** — open the same room in two browsers (one normal, one incognito, different accounts) to see play/pause/seek sync live.

---

## Optional — running the tests

The API must be running first. In a **second** terminal:

```powershell
npm run test:all
```

**377 assertions across 8 suites**, all passing. Individually:

```powershell
npm run test:api      # 192 — every REST route
npm run test:socket   #  33 — realtime behaviour
npm run test:meet     #  77 — Live Sessions (Google Meet)
```

> **Expected gotcha:** the login rate limiter allows 50 auth attempts per 15 minutes. Running the
> suites back-to-back exhausts it and later tests fail with `429` at *"Student login succeeds"*.
> That's the limiter doing its job, not a broken test. **Restart the API to reset it**, or start the
> API with `E2E_TEST_MODE=true` (which is ignored when `NODE_ENV=production`).

There's also a browser suite (46 assertions) for the Meet UI — needs both servers up:

```powershell
node uitest-meet.mjs
```

---

## Optional — production build

```powershell
npm run serve
```

This builds the React app and serves it from Express as a single process on **http://localhost:5000**
(deep links included). In production mode you use port 5000, not 5173.

To build only: `npm run build` → output in `client/dist`.

> On a low-RAM machine (~2 GB), **stop the dev server before building** — Vite and the dev server
> together can trigger an out-of-memory kill. A clean build takes ~22 seconds.

---

## Optional — everything in Docker

```powershell
npm run docker:up                      # Mongo + app, http://localhost:5000
docker compose run --rm seed           # seed it (one-shot container)
npm run docker:down                    # tear down
```

---

## Troubleshooting

**Run the preflight check first — it diagnoses most problems in one shot:**

```powershell
npm run verify
```

It checks your Node version, all three `node_modules`, the vite and rollup binaries, `server/.env`,
and probes ports 27017 / 5000 / 5173 — then prints the exact fix command for anything broken.

| Symptom | Cause and fix |
|---|---|
| `MongooseServerSelectionError` / `ECONNREFUSED 27017` | MongoDB isn't running. `Get-Service MongoDB` (Option A) or `npm run db:up` (Docker). |
| `EADDRINUSE :5000` or `:5173` | An old server is still alive. Close the other terminal, or:<br>`Get-Process -Name node \| Stop-Process -Force` |
| Site loads but everything is empty | You skipped `npm run seed`. |
| Blank page / `Failed to fetch` | You opened `:5000` instead of **`:5173`** in dev mode. |
| `Cannot find module @rollup/rollup-win32-x64-msvc` | `npm run fix:install` |
| Seed fails, `E11000 duplicate key` | Stale index — see the drop-database fix in Step 3. |
| Login suddenly returns `429` | Rate limiter tripped. Restart the API. |
| Everything is broken after a git pull | `npm run install:all` then `npm run seed`. |

---

## Where things live

| File | What it's for |
|---|---|
| `README.md` | Full docs — architecture, all 132 API endpoints, features, known limitations |
| `DEPLOYMENT.md` | Deploying to Render / Vercel / MongoDB Atlas |
| `server/.env` | Your local config (never committed) |
| `server/src/seed.js` | The demo data |
