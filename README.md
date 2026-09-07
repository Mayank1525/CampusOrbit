# CampusOrbit

> **From confusion to career-ready.**
> One path at a time, one curated video per topic, and an honest number for how prepared you actually are.

CampusOrbit is a complete MERN platform for Indian engineering students preparing for placements,
internships and competitive exams. It replaces the usual chaos — forty browser tabs, six half-finished
playlists, a resume in Google Docs, deadlines in a WhatsApp group — with a single system that knows
what you should do next.

Everything in this repository runs. There are no mock screens, no dead buttons and no fake downloads.

---

## Table of contents

- [What makes it different](#what-makes-it-different)
- [Screens](#screens)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Demo credentials](#demo-credentials)
- [Docker](#docker)
- [Environment variables](#environment-variables)
- [Architecture](#architecture)
- [Feature guide](#feature-guide)
- [Data model](#data-model)
- [API reference](#api-reference)
- [Socket.IO events](#socketio-events)
- [Scheduled jobs](#scheduled-jobs)
- [Testing](#testing)
- [Design system](#design-system)
- [Known limitations](#known-limitations)
- [Project structure](#project-structure)

---

## What makes it different

Most student platforms optimise for engagement. CampusOrbit optimises for **finishing**, and it is
deliberately honest about what it does not know.

| Principle | How it is enforced in code |
|---|---|
| **One path at a time** | Starting a new path pauses the old one. Progress is never deleted, and milestones covering topics you already completed transfer automatically. |
| **One curated video per topic** | `Lesson.primaryVideo` is a single required object, not an array. Every video carries a `reasonForRecommendation` and a `verifiedBy` field shown to the student. No playlist paralysis. |
| **At most 3 tasks a day** | `todaysOrbit` is hard-capped at three items server-side. Finish them and the dashboard tells you that you are genuinely done. |
| **Preparation score, never job odds** | The score is `lessons·45 + milestones·30 + quizzes·15 + proofs·10`, capped at 100. CampusOrbit **never** predicts your chance of being selected — no honest system can. |
| **Explainable eligibility** | A plain-JavaScript rule engine returns a per-rule pass/fail with the required value, your value and a human sentence. Ineligible drives stay visible so you know exactly what to fix. |
| **Honest AI** | With no API key the app runs in **Demo AI Mode**, labelled everywhere it appears. Output comes from a deterministic rule engine — it is never presented as a language model. |
| **Authorised transcripts only** | AI generation is hard-blocked (HTTP 400) on any lesson without an admin-supplied transcript. CampusOrbit does not scrape YouTube captions. |
| **Human review gate** | Generated notes are `draft` and filtered out of every student query until an admin publishes them. |
| **Private documents** | Every wallet query is scoped by `userId`. Admins see a checklist of *which categories* you have, never the files. |
| **Honest pipeline** | Students can self-move through Saved → Preparing → Applied. Everything beyond that is set by the placement cell, so the board reflects reality. |

---

## Screens

Student experience across the 3D learning orbit, the lesson player, the placement hub and the peer rooms:

| | |
|---|---|
| **Dashboard** — Today's Orbit, streak, "what should I do next" | **My Path** — interactive R3F learning orbit |
| **Lesson** — the one curated video, smart notes, flashcards, quiz | **Placement Hub** — eligibility explained per drive |
| **Resume Studio** — 4 templates, live preview, real PDF export | **Peer Rooms** — Socket.IO chat + Watch Together |
| **Admin Overview** — pipeline conversion, skill gap | **AI Review** — publish gate for generated content |

---

## Tech stack

**Frontend** — React 18 (Vite), React Router 6, Tailwind CSS, Framer Motion, React Three Fiber +
Drei + Three.js, Recharts, Socket.IO client, Axios, React Hook Form, Lucide React, jsPDF + html2canvas.

**Backend** — Node 20, Express 4, Mongoose 8, Socket.IO 4, JWT in HTTP-only cookies, bcryptjs,
Multer, node-cron, Zod validation, express-rate-limit, Morgan.

**Database** — MongoDB 7 via Mongoose. **Mongoose is the only persistence layer.** No JSON files,
no localStorage substitutes, no in-memory arrays. Everything survives a refresh and a backend restart.

**Language** — JavaScript only. No TypeScript, no Next.js, no Firebase/Supabase/SQL, no Python or PHP.

---

## Quick start

### Prerequisites

- Node.js 18+ (tested on 20.x)
- MongoDB 7 running locally, **or** Docker (see [Docker](#docker))

### Install and run

```bash
# 1. install root, server and client (self-verifying, auto-repairs npm bugs)
npm run install:all

# 2. configure the server
cp server/.env.example server/.env
#    the defaults work out of the box for a local MongoDB on 27017

# 3. seed the demo data (4 paths, 20 lessons, 7 drives, 5 rooms, 6 users)
npm run seed

# 4. run API + client together
npm run dev
```

| Service | URL |
|---|---|
| React client (Vite dev server) | http://localhost:5173 |
| Express API + Socket.IO | http://localhost:5000 |
| Health check | http://localhost:5000/api/health |

The Vite dev server proxies `/api` and `/socket.io` to Express, so the client always talks to a
same-origin URL and the HTTP-only auth cookie works without CORS gymnastics.

### Production build

```bash
npm run serve      # vite build, then Express serves the SPA + API on :5000
```

Express serves `client/dist` as static files with an SPA fallback for every non-`/api` route, so the
whole product runs from **one port** in production.

### If anything looks wrong

```bash
npm run verify      # preflight: Node version, deps, .env, MongoDB, ports
```

It prints a tick or a cross for every prerequisite and tells you the exact
command that fixes each failure.

### Troubleshooting

**`Cannot find module @rollup/rollup-win32-x64-msvc`** (or `...-darwin-arm64`, `...-linux-x64-gnu`)

```bash
npm run fix:install
```

Rollup, which powers Vite, ships its native binary as a **separate optional dependency per
platform**. A long-standing npm bug ([npm/cli#4828](https://github.com/npm/cli/issues/4828)) makes
npm skip that package when a `package-lock.json` generated on one OS is installed on another — so a
lockfile committed from Linux or macOS can leave a Windows machine without
`@rollup/rollup-win32-x64-msvc`, and Vite refuses to start. The API is unaffected, which is why you
may see Express boot happily while only the client crashes.

`npm run fix:install` deletes `node_modules` **and** `package-lock.json` in the root, `server/` and
`client/`, then reinstalls so npm resolves the binaries for *your* platform. The manual equivalent:

```bash
# from the project root, per package
rm -rf node_modules package-lock.json           # PowerShell: rd /s /q node_modules & del package-lock.json
npm install
```

> This repo is deliberately **not** an npm workspace. `server/` and `client/` install independently
> with their own lockfiles, because hoisting to a shared root made the optional-dependency bug far
> more likely to bite.

---

## Demo credentials

| Role | Email | Password | What to look at |
|---|---|---|---|
| **Student** | `student@campusorbit.dev` | `Student@123` | Aarav Sharma — CSE 2026, 8.2 CGPA. Fully onboarded with an active MERN path, 2 milestones done, 2 resumes, 5 wallet documents, 5 revision tasks, 5 interview attempts. |
| **Admin** | `admin@campusorbit.dev` | `Admin@123` | The Placement Cell panel: analytics, drive CRUD, applicant filters, CSV export, AI review queue. |
| **Senior** | `senior@campusorbit.dev` | `Senior@123` | Ishita Verma, alumni 2024. Can host Watch Together sessions and moderate rooms. |

Additional students, all `Student@123`:

- `rohan@campusorbit.dev`, `sneha@campusorbit.dev` — populate the applicant lists
- `karan@campusorbit.dev` — **6.1 CGPA, 2 backlogs, onboarding incomplete.** Sign in as Karan to see
  the eligibility engine explain exactly why he cannot apply to the Quantel SDE-1 drive.

> Admin accounts cannot be self-registered. `POST /api/auth/register` silently downgrades
> `role: 'admin'` to `student` — placement-cell accounts are created by the seed script or an
> existing admin.

---

## Docker

```bash
# database only — run the app with npm run dev
docker compose up -d mongo

# full stack: MongoDB + the built app on http://localhost:5000
docker compose up --build

# seed inside Docker
docker compose run --rm seed
```

The `app` service is a two-stage build: stage one compiles the Vite client, stage two installs
production server dependencies and serves the built SPA from Express. One container, one port.

> **Note:** Docker was not available in the environment this project was developed in, so
> `docker-compose.yml` and the `Dockerfile` are written to spec but have not been executed here.
> The non-Docker path (`npm run install:all && npm run seed && npm run dev`) is fully verified.

---

## Environment variables

`server/.env` — copy from `server/.env.example`:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | API port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/campusorbit` | Mongoose connection string |
| `JWT_SECRET` | *(dev value)* | **Change this in production.** Signs the auth token. |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS allow-list for the dev client |
| `UPLOAD_DIR` | `uploads` | Multer destination for wallet files |
| `GEMINI_API_KEY` | *(empty)* | Leave empty to run in Demo AI Mode |


---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  React SPA (Vite)                                            │
│  ├─ AuthContext ......... session, login, profile updates    │
│  ├─ ToastContext ........ global notifications               │
│  ├─ useSocket ........... one shared Socket.IO connection    │
│  ├─ services/api.js ..... axios instance, 1:1 route mirror   │
│  └─ R3F LearningOrbit ... 3D milestone visualisation         │
└───────────────┬──────────────────────────┬───────────────────┘
                │ HTTP (cookie auth)       │ WebSocket
                ▼                          ▼
┌──────────────────────────────────────────────────────────────┐
│  Express                                                     │
│  routes → middleware(auth, validate, rateLimit, upload)      │
│         → controllers → services → Mongoose models           │
│                                                              │
│  services/                                                   │
│   ├─ eligibility ... explainable rules + match score         │
│   ├─ ai ............ Demo-Mode generation, honest labelling  │
│   ├─ notification .. dedupe-keyed in-app notifications       │
│   ├─ socket ........ rooms, presence, watch-together sync    │
│   └─ cron .......... reminders, expiry, revision checks      │
└───────────────────────────┬──────────────────────────────────┘
                            ▼
                    MongoDB (22 collections)
```

**Auth.** JWT in an HTTP-only cookie (`co_token`, 7 days). The `protect` middleware also accepts
`Authorization: Bearer` so scripts and tests can authenticate. Passwords are bcrypt-hashed.

**Validation.** Every mutating route runs a Zod schema through the `validate` middleware before the
controller sees the body. Errors return a consistent `{ success, message, details }` shape.

**Responses.** All API responses are `{ success, message, data }`.

---

## Feature guide

### Learning

- **Onboarding wizard** — three steps (goal, level, time budget) then a recommendation with the
  reasoning shown, a week-by-week plan, and up to three alternatives with "why not this one".
- **Path Navigator** — four seeded paths: MERN Developer (9 milestones), SDE/DSA (4),
  Frontend Developer (3), GATE CSE Foundation (4). Switching preserves progress and transfers
  completed topics.
- **3D Learning Orbit** — React Three Fiber. Completed milestones are glowing cyan octahedrons,
  the current one is a pulsing violet sphere with a ring, locked ones are dim planets. Drag to
  rotate, scroll to zoom, hover for a tooltip, click to open the milestone panel. A 2D list view
  and a `prefers-reduced-motion` fallback are always available.
- **Milestone detail** — why it matters, prerequisites, lessons, practice task, proof-of-work
  submission, what comes next, and the live drives that ask for those exact skills.
- **Lesson player** — the single curated video embedded via the YouTube IFrame API, with playback
  position persisted to MongoDB every few seconds so you resume where you stopped. Smart notes,
  flashcards (3D flip deck), a 5-question quiz and your own private notes sit in a tabbed panel.
- **Smart Notes** — summary, key concepts, definitions, timestamped sections, practical examples,
  interview questions, a beginner explanation, a **Hinglish** explanation and a 60-second revision
  summary. Bookmark, schedule revision, or hit "explain simpler".
- **Quizzes** — correct answers are stripped from the payload before submission and only revealed
  in the review. Failing a quiz automatically schedules a revision for tomorrow.
- **Spaced revision** — 1 / 7 / 21 days. Completing stage *n* auto-creates stage *n+1*. Reschedule
  instead of skipping when life happens.
- **My Video Queue** — paste any YouTube URL (watch, youtu.be, /embed/, /shorts/ or a bare ID). The
  server validates it, extracts the ID, pulls public oEmbed metadata, and tracks your own progress
  and notes. Always labelled as *your personal resource* — it never replaces the curated video.

### Placement

- **Placement Hub** — browse and filter drives by type, company, skill and location. Every card
  shows an eligibility verdict and a skill/goal match score.
- **Eligibility engine** — `minCgpa`, `allowedBranches`, `allowedGraduationYears`, `maxBacklogs`.
  Each rule returns required vs yours plus a plain sentence. Ineligible drives stay visible.
- **Application pipeline** — nine stages on a kanban board: Saved, Preparing, Applied, Shortlisted,
  Assessment, Technical Round, HR Round, Selected, Rejected. Every move is timelined with who
  changed it and when.
- **Document Wallet** — upload files (PDF/DOC/DOCX/images, 5 MB) or save links, categorised so that
  per-drive checklists fill themselves in. Private to you at the query level.
- **Resume Studio** — four templates (Orbit Modern, ATS Minimal, Developer Grid, Academic Focus)
  rendering one dataset. Switch templates without losing a word, pick an accent colour, duplicate,
  set a default, and export a **real multi-page A4 PDF** via html2canvas + jsPDF. A ten-check
  completeness score explains exactly what is missing.
- **Interview Practice Studio** — text only, no camera or microphone. Structured feedback scores
  technical accuracy, clarity and structure out of 10, lists the concepts you missed, notes whether
  you used a real project example, and rewrites the answer outline. Full attempt history with trends.

### Community

- **Peer Prep Rooms** — five seeded rooms. Structured group chat: threaded replies, emoji
  reactions, pinned messages, a shared resource list, reporting and moderation, live typing
  indicators and an online count. **CampusOrbit hosts no calls itself — no WebRTC, no DMs** — a
  deliberate scope decision.
- **Live Sessions on Google Meet** — seniors/alumni and the placement cell schedule a session in a
  room by pasting a **Google Meet link**; CampusOrbit owns the scheduling layer around it: RSVPs
  (going / maybe / can't make it), seat caps, countdowns, a Google Calendar "add event" link, and
  attendance recorded when a member clicks through. The link is only revealed once the session is
  live *and* you have RSVP'd, so it cannot leak from a public listing. Hosts get **Go live**,
  **End session**, **Cancel**, an attendance roster and a post-session recap note.
  Only `meet.google.com` and `g.co/meet` URLs are accepted — Zoom/Teams links are rejected with an
  explanation. Session types: mock interview, doubt clearing, guest talk, resume review, group
  study, other. Students can never host; the API enforces this independently of the UI.
- **Live Sessions — a dedicated section** (`/live-sessions`, its own nav entry under Community).
  Every session across every room in one place: headline counters (live now / upcoming / your
  RSVPs / total), a full-width **"Happening right now"** hero for anything currently live, scope
  tabs (Upcoming · Past · All), one-click session-type chips, a debounced search, and a
  **"Hosted by me"** filter for hosts. Alumni and the placement cell host straight from this page —
  the schedule form includes a **room picker**, so you choose which room's members get notified
  without navigating there first. A compact strip on **Peer Prep Rooms** still surfaces what's live
  and links through with *See all*.
- **Watch Together** — the host starts a session and everyone watches the same video at the same
  second. Play, pause and seek broadcast over Socket.IO with `serverTime` for drift correction;
  late joiners get the wall-clock-adjusted position. Only the host or a moderator controls playback;
  anyone can request a re-sync. Messages can be pinned to an exact video timestamp, and moderators
  can pin study points that everyone can jump to.
- **Notifications** — driven by real node-cron jobs, not decorative badges.

### Placement cell (admin)

Analytics with pipeline conversion and a skill-gap report · drive CRUD with a live eligibility-reach
preview · applicant filtering by branch, CGPA, backlogs, graduation year, skill and profile
completeness · stage moves with notes · CSV export · lesson and transcript management · the AI
review/publish gate · interview question bank with scoring keywords · room moderation · student
directory · announcements.

---

## Data model

Twenty-two Mongoose models:

| Model | Purpose |
|---|---|
| `User` | Auth, role, profile (15 completion checks), streak, bookmarks |
| `LearningPath` | Track metadata, outcomes, goal tags, accent colour |
| `Milestone` | Order, why-it-matters, prerequisites, proof task, orbit coordinates |
| `Lesson` | Single `primaryVideo`, authorised transcript, practice task, takeaways |
| `StudentProgress` | Embedded per-lesson and per-milestone progress, completed topics |
| `Note` | AI and personal notes, Hinglish/beginner variants, draft/published |
| `Flashcard` | Front/back/difficulty, generated per lesson |
| `Quiz` / `QuizAttempt` | Questions with hidden `correctIndex`; graded attempts |
| `RevisionTask` | Spaced repetition at stages 1/7/21 days |
| `Opportunity` | Drive details, eligibility rules, rounds, required documents |
| `Application` | Stage, timeline, eligibility snapshot, document checklist |
| `Document` | Private wallet files and links |
| `Resume` | Full structured resume + `completeness()` method |
| `InterviewQuestion` / `InterviewAttempt` | Bank with scoring keywords; attempts with feedback |
| `PeerRoom` | Members, moderators, rules, resources, pinned messages |
| `Message` | Text/resource/timestamp/system, reactions, reports |
| `WatchSession` | Video state, `currentPosition()` drift correction, study points |
| `Notification` | Dedupe-keyed in-app alerts |
| `Announcement` | Cohort broadcasts |
| `VideoQueueItem` | Personal YouTube queue |

---

## API reference

All routes are prefixed `/api` and return `{ success, message, data }`.
🔒 = authenticated · 👑 = admin only

<details>
<summary><strong>Auth</strong></summary>

| Method | Route | Description |
|---|---|---|
| POST | `/auth/register` | Register. `{fullName, email, password, role?}`. `admin` is downgraded to `student`. |
| POST | `/auth/login` | Sets the `co_token` cookie, returns the user, token and updated streak |
| POST | `/auth/logout` 🔒 | Clears the session cookie |
| GET | `/auth/me` 🔒 | Current user |
</details>

<details>
<summary><strong>Users</strong></summary>

| Method | Route | Description |
|---|---|---|
| PATCH | `/users/profile` 🔒 | `{fullName?, onboardingCompleted?, profile?}` — profile is shallow-merged |
| GET | `/users/stats` 🔒 | Aggregate counts for the current user |
| GET | `/users` 👑 | List students with filters |
| PATCH | `/users/:id/toggle-active` 👑 | Enable/disable an account |
| GET | `/users/public/:id` 🔒 | Public profile |
</details>

<details>
<summary><strong>Paths & lessons</strong></summary>

| Method | Route | Description |
|---|---|---|
| GET | `/paths` | All paths with milestone/lesson counts |
| GET | `/paths/:idOrSlug` | Path with milestones, nested lessons, totals and your progress |
| POST | `/paths/recommend` 🔒 | `{goal, level, weeklyHours, timelineWeeks}` → recommendation, reasons, plan, alternatives |
| GET | `/paths/my-progress` 🔒 | Every path you have started, with `preparationScore` |
| POST | `/paths/:pathId/start` 🔒 | Start a path, transferring completed topics |
| POST | `/paths/switch` 🔒 | Switch the active path (pauses the previous one) |
| GET | `/paths/milestone/:id` 🔒 | Milestone with lessons, related drives, next milestone |
| POST | `/paths/milestone/:milestoneId/complete` 🔒 | Complete a milestone, optionally with a proof URL |
| POST/PATCH/DELETE | `/paths`, `/paths/:id`, `/paths/milestones/...` 👑 | Path & milestone CRUD |
| GET | `/lessons/:id` 🔒 | Lesson, notes, flashcards, quiz (answers stripped), navigation, your progress |
| POST | `/lessons/:id/progress` 🔒 | Save playback position and percent |
| POST | `/lessons/:id/complete` 🔒 | Complete a lesson (enforces the quiz requirement) |
| GET/POST/PATCH/DELETE | `/lessons` 👑 | Lesson CRUD |
</details>

<details>
<summary><strong>Notes, quizzes & revision</strong></summary>

| Method | Route | Description |
|---|---|---|
| GET | `/notes/ai-status` | AI mode, label and honesty notice |
| GET | `/notes/mine` 🔒 | Your notes and bookmarked AI notes |
| POST | `/notes/personal` 🔒 | Create a personal note on a lesson |
| PATCH/DELETE | `/notes/:id` 🔒 | Update or delete |
| POST | `/notes/:id/bookmark` · `/revision` · `/simplify` · `/highlight` 🔒 | Note actions |
| POST | `/notes/generate/:lessonId` 👑 | Generate notes/flashcards/quiz — **400 without an authorised transcript** |
| GET | `/notes/review` 👑 | Review queue |
| PATCH | `/notes/:id/publish` 👑 | Publish a draft to students |
| GET | `/quizzes/:id` 🔒 · POST `/quizzes/:id/submit` 🔒 | Take and submit a quiz |
| GET | `/quizzes/attempts/mine` 🔒 | Attempt history |
| GET/POST | `/revisions`, `/revisions/:id/complete\|skip\|reschedule` 🔒 | Spaced revision |
</details>

<details>
<summary><strong>Placement</strong></summary>

| Method | Route | Description |
|---|---|---|
| GET | `/opportunities` 🔒 | Filter by search/type/company/skill/location/sort. Students never see drafts. |
| GET | `/opportunities/:id` 🔒 | Drive with eligibility result, document checklist, match score |
| GET | `/opportunities/matches` · `/bookmarks` 🔒 | Recommended and saved drives |
| POST | `/opportunities/:id/bookmark` 🔒 | Toggle a bookmark |
| POST/PATCH/DELETE | `/opportunities`, `/opportunities/:id` 👑 | Drive CRUD |
| POST | `/opportunities/:id/publish` · `/expire` 👑 | Lifecycle |
| GET | `/opportunities/:id/eligible-students` 👑 | Who qualifies, and why the rest do not |
| GET | `/applications/mine` 🔒 · GET `/applications/:id` 🔒 | Your pipeline |
| POST | `/applications` 🔒 | Apply — blocked with reasons if ineligible |
| PATCH | `/applications/:id/my-stage` 🔒 | Saved/Preparing/Applied only (403 beyond) |
| DELETE | `/applications/:id` 🔒 | Withdraw |
| GET | `/applications/applicants` 👑 | Filter by branch, CGPA, backlogs, year, skill, completeness |
| PATCH | `/applications/:id/stage` · `/admin-note` 👑 | Move a stage, leave a note |
| GET | `/applications/export` 👑 | CSV export |
</details>

<details>
<summary><strong>Resumes, documents & interview</strong></summary>

| Method | Route | Description |
|---|---|---|
| GET/POST | `/resumes` 🔒 | List (with `completenessScore`) and create prefilled from your profile |
| GET/PATCH/DELETE | `/resumes/:id` 🔒 | Read, update, delete |
| POST | `/resumes/:id/duplicate` · `/default` 🔒 | Duplicate, set default |
| GET | `/documents` 🔒 | Your private wallet |
| POST | `/documents/upload` 🔒 | Multipart upload (5 MB) |
| POST | `/documents/link` 🔒 | Save a link |
| GET | `/documents/checklist/:opportunityId` 🔒 | Checklist for a specific drive |
| GET | `/documents/proof-of-work` 🔒 | Milestone proof submissions |
| GET | `/documents/:id/download` 🔒 | Download (owner only) |
| GET | `/interview/questions` 🔒 | Filter by role/topic/difficulty/category |
| POST | `/interview/answer` 🔒 | Submit an answer, get structured feedback |
| GET | `/interview/attempts` 🔒 | History, trend, weakest and strongest topics |
| GET/POST/PATCH/DELETE | `/interview/admin/questions` 👑 | Question bank CRUD |
</details>

<details>
<summary><strong>Rooms, notifications & dashboard</strong></summary>

| Method | Route | Description |
|---|---|---|
| GET | `/rooms` 🔒 · GET `/rooms/:idOrSlug` 🔒 | Rooms with counts; room with messages and watch state |
| POST | `/rooms/:id/join` · `/leave` · `/messages` · `/resources` 🔒 | Membership, REST message fallback, resources |
| GET | `/rooms/:id/summary` 🔒 | AI room summary (labelled Demo Mode) |
| POST | `/rooms/messages/:id/react` · `/pin` · `/report` 🔒 | Message actions (pin requires moderator) |
| GET/POST | `/rooms/:id/meet` 🔒 | List a room's Meet sessions; schedule one (senior/admin only) |
| GET | `/rooms/meet/upcoming` 🔒 | Live + upcoming sessions across every room (compact strip) |
| GET | `/rooms/meet/browse` 🔒 | Powers the Live Sessions section. Query: `scope=upcoming\|past\|all`, `type`, `hosted=me`, `q`. Returns sessions + headline stats + `canHost` |
| GET/PATCH/DELETE | `/rooms/meet/:sessionId` 🔒 | Fetch, edit or cancel a session (host/admin) |
| POST | `/rooms/meet/:sessionId/rsvp` 🔒 | RSVP `going` / `maybe` / `not-going` |
| POST | `/rooms/meet/:sessionId/join` 🔒 | Reveal the Meet link and record attendance |
| POST | `/rooms/meet/:sessionId/start` · `/end` 🔒 | Host goes live / ends the session |
| POST | `/rooms/meet/:sessionId/recap` 🔒 | Host posts recap notes after the session |
| GET | `/rooms/meet/:sessionId/attendance` 🔒 | Attendance roster (host/admin only) |
| POST | `/rooms/:id/watch` 🔒 | Start a Watch Together session (moderator/senior/admin) |
| POST | `/rooms/watch/:sessionId/end` · `/study-point` 🔒 | End a session, pin a study point |
| GET/POST/PATCH/DELETE | `/rooms`, `/rooms/:id`, `/rooms/moderation/...` 👑 | Room CRUD and moderation |
| GET | `/notifications` 🔒 · POST `/:id/read` · `/read-all` 🔒 | In-app notifications |
| GET/POST/PATCH/DELETE | `/notifications/announcements` 🔒👑 | Announcements |
| GET | `/dashboard/student` 🔒 | Today's Orbit, what-next, orbit nodes, deadlines, matches, streak |
| GET | `/dashboard/charts` 🔒 | 30-day activity, path breakdown, quiz performance |
| GET | `/dashboard/admin/analytics` 👑 | KPIs, conversion, skill gap, eligibility reach |
| GET | `/dashboard/admin/student/:id` 👑 | Per-student detail |
| POST | `/admin/run-reminders` 👑 | Trigger the cron reminder sweep manually |
| GET | `/health` · `/ai-status` | Public status endpoints |
</details>

---

## Socket.IO events

Path `/socket.io`. Authenticated via the handshake `auth.token` or the `co_token` cookie.
Rooms are keyed `room:<id>` and `watch:<sessionId>`.

**Client → server:** `join-room`, `leave-room`, `send-message`, `typing`, `react-message`,
`join-watch-session`, `leave-watch-session`, `sync-video-state`, `video-play`, `video-pause`,
`video-seek`, `request-resync`, `send-timestamp-message`

**Server → client:** `connected`, `presence-update`, `member-joined`, `new-message`, `user-typing`,
`message-reaction`, `watch-participant-joined`, `watch-participant-left`, `video-state-changed`,
`video-play`, `video-pause`, `video-seek`, `video-resync`

Playback control is restricted to the session host, room moderators and admins; the server rejects
anyone else. Every playback payload carries `serverTime` so clients can correct for network drift,
and `WatchSession.currentPosition()` advances the stored position by elapsed wall-clock time while
playing, so a late joiner lands at the right second.

---

## Scheduled jobs

`node-cron`, started with the server:

| Schedule | Job |
|---|---|
| Daily 07:00 | Revisions due, deadlines within 3 days, profiles under 80%, pending quizzes |
| Hourly | Auto-expire opportunities past their deadline |
| Every 30 min | Revision due-date checks |

Every notification carries a `dedupeKey`, so re-running a job never produces duplicates.
Admins can trigger the sweep manually from the Notifications page or `POST /api/admin/run-reminders`.

---

## Testing

```bash
npm test                            # API + Socket.IO suites
node server/test-api.mjs            # 192 assertions across every REST route
node server/test-socket.mjs         # 33 assertions on realtime behaviour
node server/test-client-endpoints.mjs   # 33 — every endpoint the client pages call
node server/test-chat-2session.mjs      # 7  — two live sessions exchanging messages
node server/test-watch-sync.mjs         # 15 — host/viewer playback synchronisation
node server/test-race-conditions.mjs    # 9  — concurrent writes / duplicate-key copy
node server/test-onboarding-loop.mjs    # 11 — onboarding completes atomically, no redirect loop
node server/test-meet.mjs               # 77 — Meet sessions: link parsing, RSVP, link secrecy, attendance, browse
```

**377 assertions, all passing.** Run every suite at once with `npm run test:all`. The suites are idempotent and re-runnable against a seeded database (`test-meet.mjs` removes the sessions it creates on the way out).

A browser-level Playwright suite covers the Live Sessions section end to end — **49 assertions** across auth-removal verification, the dedicated section, filters, RSVP, link validation, host controls and role separation:

```bash
npm run dev                         # API + Vite must both be up
node uitest-meet.mjs                # 49 assertions in a real Chromium
```

> `authLimiter` permits 50 auth requests per 15 minutes. Running all suites
> back to back exhausts it and later tests see `429` — restart the API to reset,
> or use `E2E_TEST_MODE=true` (ignored when `NODE_ENV=production`).

Verified end to end:

- ✅ Install, seed, start both servers
- ✅ Register, login, logout, session expiry (401 after logout)
- ✅ Onboarding wizard → recommendation → path start
- ✅ Lesson progress, quiz gating, milestone completion, topic transfer on path switch
- ✅ Primary video renders and playback position persists
- ✅ Video queue URL validation (rejects non-YouTube 400, duplicates 409, accepts `youtu.be`)
- ✅ Notes, flashcards, quizzes, spaced revision with auto-scheduled next stage
- ✅ Eligibility blocks an ineligible student with the exact failing rule
- ✅ Resume PDF export produces a valid multi-page A4 `%PDF-` file
- ✅ Interview feedback returns every structured field
- ✅ Peer chat verified with **two concurrent Socket.IO sessions** (message, typing, reaction, persistence)
- ✅ Watch Together verified host↔viewer: seek, play, drift-corrected re-sync, timestamp messages, permission denial
- ✅ **Google Meet sessions**: only seniors/admins can host (enforced server-side), non-Meet links rejected, the Meet link stays hidden until the session is live *and* you have RSVP'd, attendance recorded on join, seat caps honoured, attendance roster restricted to the host
- ✅ **Meet UI in a real browser**: schedule from the dedicated section → appears for other users → RSVP → join, host controls render only for the host, students never see a Host button
- ✅ **Auth removal verified**: `/auth/google`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/config` all return 404; no Google button or "Forgot password?" link anywhere in the UI
- ✅ Applicant filters, stage moves, CSV export
- ✅ Admin publish flow (draft invisible to students → published → visible)
- ✅ Production `vite build` succeeds; Express serves the SPA with deep-link fallback
- ✅ **Data survives a full backend restart** (verified with a probe document across a process kill)
- ✅ All 32 screens rendered in a headless browser with zero JavaScript exceptions

---

## Design system

Deep navy-black space background with violet, indigo, cyan and coral highlights. Glassmorphism
panels, gradient borders, layered glow, spring physics on hover and page transitions, an animated
starfield and aurora blobs.

The 3D is used **where it adds meaning** — the learning orbit, resume template cards, the animated
watch panel — and deliberately not in forms, chat, filters or tables, which stay plain and fast.

Accessibility: semantic landmarks, labelled inputs, visible focus rings, `aria-label` on icon-only
controls, contrast-checked text, and full `prefers-reduced-motion` support plus a manual
**Reduce motion** toggle in Settings that disables orbit rotation, particle drift and spring
transitions.

---

## Security

`npm audit` reports **0 vulnerabilities** in both `server/` and `client/`.

| Package | Version | Why |
|---|---|---|
| express | 5.x | 4.x pulled a vulnerable `qs`/`body-parser` chain |
| node-cron | 4.x | 3.x depended on a vulnerable `uuid` |
| multer | 2.x | 1.x is end-of-life with open advisories |
| vite | 7.x | `esbuild` dev-server request advisory |
| react-router-dom | 7.x | open-redirect + constructor-injection advisories |
| jspdf | 4.x | bundled a vulnerable `dompurify` |

The container image is hardened too: `node:22-alpine` with `apk upgrade`,
dependencies installed via `npm ci --omit=dev`, a non-root user with no shell,
`dumb-init` for signal handling, `no-new-privileges`, a read-only root
filesystem, and MongoDB bound to loopback so it is never exposed to the LAN.

---

## Known limitations

Stated up front rather than buried:

1. **CampusOrbit hosts no video or audio calls itself — no WebRTC, no direct messages.** Peer Rooms
   are structured group study, a deliberate scope decision. Live sessions run on **Google Meet**:
   the host pastes an existing Meet link and CampusOrbit handles scheduling, RSVPs, reminders and
   attendance around it. There is **no Google Calendar API / OAuth integration** — no link is
   created for you, and "Add to Calendar" is a plain pre-filled Google Calendar URL. Attendance
   records the moment a member clicks *Join Google Meet*; CampusOrbit cannot verify that they
   actually stayed in the call.
2. **No payments** anywhere in the product.
3. **AI runs in Demo Mode without an API key**, and is labelled as such on every surface where it
   appears. The rule engine is deterministic and genuinely useful, but it is not a language model
   and is never described as one.
4. **AI generation requires an authorised transcript.** CampusOrbit does not scrape YouTube captions;
   the API returns 400 on lessons without one.
5. **Watch Together cannot control a blocked player.** If a viewer's video is stopped by an ad or a
   browser autoplay policy, sync drifts — the Re-sync button is the escape hatch.
6. **Video progress is polled** from the YouTube IFrame API every few seconds, so the last few
   seconds before a tab closes may not persist.
7. **CampusOrbit never predicts your chance of being selected.** The preparation score measures
   completed work, nothing more.
8. **Uploads are capped at 5 MB** and stored on the server filesystem, not object storage.
9. **Docker was not executable in the development environment**, so the compose file and Dockerfile
   are written to spec but unverified here.
10. **The YouTube IFrame API needs network access.** Offline, the player shows an honest error with
    a link out instead of a broken frame.

---

## Project structure

```
campusorbit/
├── package.json              # workspace root — dev, seed, build, test scripts
├── docker-compose.yml        # MongoDB + app + one-shot seeder
├── Dockerfile                # two-stage: build client → serve from Express
│
├── server/
│   ├── src/
│   │   ├── config/           # env, db connection
│   │   ├── models/           # 22 Mongoose models + barrel
│   │   ├── middleware/       # auth, validate, errorHandler, rateLimit, upload
│   │   ├── controllers/      # 17 controllers
│   │   ├── routes/           # 16 route files
│   │   ├── services/         # eligibility, ai, notification, socket, cron, progress
│   │   ├── utils/            # apiResponse, youtube helpers
│   │   ├── data/             # seed source data
│   │   ├── seed.js           # idempotent seeder
│   │   ├── app.js            # express app, static SPA, health
│   │   └── server.js         # http + socket.io bootstrap
│   ├── test-api.mjs          # 192 assertions
│   ├── test-socket.mjs       # 33 assertions
│   ├── test-client-endpoints.mjs
│   ├── test-chat-2session.mjs
│   ├── test-watch-sync.mjs
│   ├── test-race-conditions.mjs
│   └── test-onboarding-loop.mjs
│
└── client/
    ├── vite.config.js        # /api + /socket.io proxy, manual chunks
    ├── tailwind.config.js    # space palette, glow shadows, keyframes
    └── src/
        ├── main.jsx, App.jsx, index.css
        ├── services/api.js   # 1:1 mirror of the backend routes
        ├── context/          # AuthContext, ToastContext
        ├── hooks/            # useSocket
        ├── layouts/          # AppLayout (sidebar, topbar, mobile nav)
        ├── components/
        │   ├── ui/           # Primitives, Modal, Drawer
        │   ├── three/        # StarField, LearningOrbit (R3F)
        │   ├── resume/       # 4 print-ready templates
        │   ├── YouTubePlayer.jsx, QuizRunner.jsx, NoteViewer.jsx
        │   ├── FlashcardDeck.jsx, MilestonePanel.jsx, OpportunityCard.jsx
        │   └── ErrorBoundary.jsx
        └── pages/
            ├── Landing, Dashboard, MyPath, PathNavigator, Learn, LessonDetail
            ├── VideoQueue, Notes, Progress, Opportunities, OpportunityDetail
            ├── Applications, ResumeStudio, Documents, InterviewPractice
            ├── Rooms, RoomDetail, Notifications, Profile, Settings, NotFound
            ├── auth/          # Login, Register, Onboarding
            └── admin/         # Overview, Opportunities, Applicants, Content,
                               # AIReview, InterviewBank, Rooms, Students,
                               # Announcements
```

---

## License

MIT — built as a complete, working reference implementation of a MERN student platform.
