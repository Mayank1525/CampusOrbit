CampusOrbit

From confusion to career-ready.

CampusOrbit is a full-stack MERN platform designed for Indian engineering students preparing for placements, internships, and competitive exams.

Instead of scattered playlists, browser tabs, resumes, deadlines, applications, and study groups, CampusOrbit brings the preparation workflow into one system and answers a simple question:

What should I do next?

The platform combines structured learning paths, curated lessons, preparation tracking, placement eligibility, application management, resume building, interview practice, peer study rooms, live Google Meet sessions, and explainable progress metrics.

Status: Complete working reference implementation.
Persistence: MongoDB via Mongoose.
License: MIT.

Table of Contents

Why CampusOrbit

Core Features

Tech Stack

Application Screens

Architecture

Quick Start

Demo Accounts

Environment Variables

Docker

Data Model

API Overview

Realtime Architecture

Scheduled Jobs

Testing & Verification

Security

Design System & Accessibility

Known Limitations

Project Structure

License

Why CampusOrbit?

CampusOrbit is intentionally built around completion rather than engagement.

Product principles

Principle

Implementation

One active path at a time

Starting a new learning path pauses the previous one without deleting progress. Completed topics can transfer between paths.

One curated video per topic

Each lesson has one required primaryVideo, with a recommendation reason and verifier.

Maximum three tasks per day

todaysOrbit is capped server-side at three tasks.

Preparation, not prediction

The preparation score measures completed work; it never claims to predict selection probability.

Explainable eligibility

Every placement rule returns pass/fail status, required values, student values, and a human-readable explanation.

Honest AI

Without an API key, the platform uses clearly labelled Demo AI Mode powered by deterministic rules rather than pretending to be an LLM.

Authorised content only

AI generation requires an admin-supplied transcript. YouTube captions are not scraped.

Human review before publishing

Generated notes remain drafts until an administrator publishes them.

Private student documents

Wallet queries are scoped by userId; administrators see document categories rather than private files.

Honest application pipeline

Students control early stages; placement-cell stages are controlled by administrators.

Preparation Score

The platform uses the following preparation score:

lessons × 45
+ milestones × 30
+ quizzes × 15
+ proofs × 10

The result is capped at 100.

This score represents preparation progress only. It is not a prediction of placement or selection probability.

Core Features

Learning

Three-step onboarding wizard covering goal, level, and weekly time budget.

Recommendation engine with reasoning, weekly plan, and alternatives.

Four seeded learning paths:

MERN Developer

SDE / DSA

Frontend Developer

GATE CSE Foundation

Interactive 3D learning orbit built with React Three Fiber.

Milestone prerequisites, practice tasks, and proof-of-work submissions.

Single curated YouTube lesson per topic.

Persistent video playback progress.

Smart notes, flashcards, quizzes, and private notes.

Beginner and Hinglish explanations.

Timestamped learning sections and interview questions.

Spaced revision at 1 / 7 / 21 days.

Personal YouTube queue with server-side URL validation.

Automatic revision scheduling after failed quizzes.

Placement

Placement drive discovery and filtering.

Explainable eligibility engine based on:

Minimum CGPA

Allowed branches

Graduation year

Maximum backlogs

Skill and goal match scores.

Nine-stage application pipeline:

Saved

Preparing

Applied

Shortlisted

Assessment

Technical Round

HR Round

Selected

Rejected

Application timeline and administrative notes.

Private document wallet.

Per-drive document checklists.

Resume Studio with four templates.

Multi-page A4 PDF export.

Resume completeness scoring.

Interview Practice Studio with structured feedback and attempt history.

Community

Peer preparation rooms.

Threaded messages and reactions.

Pinned messages and shared resources.

Moderation and reporting.

Live typing indicators and online member counts.

Watch Together using Socket.IO.

Timestamp-based study points.

Live Google Meet sessions hosted by seniors/alumni or placement administrators.

RSVP management, seat limits, attendance tracking, countdowns, and post-session recaps.

Dedicated Live Sessions section with Upcoming, Past, and All views.

In-app notifications and announcements.

Placement Cell / Admin

Placement analytics and conversion metrics.

Skill-gap reporting.

Opportunity CRUD and publishing lifecycle.

Applicant filtering by branch, CGPA, backlogs, graduation year, skills, and profile completeness.

CSV export.

Lesson and transcript management.

AI content review and publishing workflow.

Interview question bank.

Room moderation.

Student directory.

Cohort announcements.

Application Screens

Area

Screens

Learning

Dashboard, My Path, Path Navigator, Learn, Lesson Detail, Video Queue, Notes, Progress

Placement

Opportunities, Opportunity Detail, Applications, Documents, Resume Studio

Interview

Interview Practice

Community

Rooms, Room Detail, Live Sessions, Notifications

Account

Profile, Settings

Authentication

Login, Register, Onboarding

Administration

Overview, Opportunities, Applicants, Content, AI Review, Interview Bank, Rooms, Students, Announcements

Tech Stack

Frontend

React 18

Vite

React Router

Tailwind CSS

Framer Motion

React Three Fiber

Drei

Three.js

Recharts

Socket.IO Client

Axios

React Hook Form

Lucide React

jsPDF

html2canvas

Backend

Node.js 20

Express

Mongoose

Socket.IO

JWT authentication

HTTP-only cookies

bcryptjs

Multer

node-cron

Zod

express-rate-limit

Morgan

Database

MongoDB 7

Mongoose 8

Mongoose is the persistence layer. Application data is stored in MongoDB rather than JSON files, browser localStorage, or in-memory arrays.

Language & Scope

The project is implemented in JavaScript.

It does not use:

TypeScript

Next.js

Firebase

Supabase

SQL

Python

PHP

🎯 Experience at a Glance

<div align="center">

<img src="https://skillicons.dev/icons?i=react,vite,tailwind,nodejs,express,mongodb,js,socketio,docker,git&perline=10" alt="Technology stack icons" />

<br/><br/>

<img src="https://github-readme-stats.vercel.app/api?username=Mayank1525&show_icons=true&hide_border=true&rank_icon=github&theme=transparent" alt="GitHub stats" />

</div>

Architecture

┌──────────────────────────────────────────────────────────────┐
│                         React SPA                             │
│                                                              │
│  AuthContext      ToastContext      useSocket                 │
│  API Services     Learning Orbit    Application Pages         │
└───────────────────────┬──────────────────────┬───────────────┘
                        │ HTTP                 │ WebSocket
                        │ Cookie Auth          │ Socket.IO
                        ▼                      ▼
┌──────────────────────────────────────────────────────────────┐
│                         Express API                           │
│                                                              │
│  Routes → Middleware → Controllers → Services → Models       │
│                                                              │
│  Auth / Validation / Rate Limiting / Uploads                  │
│                                                              │
│  Eligibility │ AI │ Notifications │ Socket │ Cron │ Progress │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                           MongoDB                             │
│                    22 Mongoose models                         │
└──────────────────────────────────────────────────────────────┘

Authentication

JWT authentication uses an HTTP-only co_token cookie with a default seven-day lifetime.

The protected middleware also accepts:

Authorization: Bearer <token>

for scripts and automated tests.

Passwords are stored using bcrypt hashing.

Validation

Mutating API routes pass request bodies through Zod validation before reaching controllers.

API responses follow a consistent structure:

{
  "success": true,
  "message": "Request completed successfully",
  "data": {}
}

Quick Start

Prerequisites

Node.js 18+; development is tested on Node.js 20.x.

MongoDB 7 running locally, or Docker.

Installation

From the project root:

npm run install:all

Create the server environment file:

cp server/.env.example server/.env

For a local MongoDB instance, the default connection configuration is sufficient.

Seed demo data

npm run seed

The seed process creates demo learning paths, lessons, placement drives, rooms, and users.

Start development

npm run dev

Default endpoints:

Service

URL

React / Vite

http://localhost:5173

Express API

http://localhost:5000

Health Check

http://localhost:5000/api/health

The Vite development server proxies /api and /socket.io to Express, allowing the frontend to communicate through a same-origin development URL.

Production build

npm run serve

The production setup builds the Vite client and serves the generated SPA from Express.

The result is a single application running on port 5000.

Preflight verification

npm run verify

This checks Node.js, dependencies, environment configuration, MongoDB connectivity, and required ports.

Troubleshooting

Rollup native dependency error

If Vite reports an error such as:

Cannot find module @rollup/rollup-win32-x64-msvc

run:

npm run fix:install

Rollup uses platform-specific optional native dependencies. A lockfile generated on a different operating system can result in the required binary being absent.

The repair command removes the relevant node_modules and lockfiles and reinstalls dependencies for the current platform.

Manual repair

From each package directory:

rm -rf node_modules package-lock.json
npm install

On Windows PowerShell, remove the corresponding directories/files using the appropriate PowerShell commands.

server/ and client/ intentionally install independently rather than using an npm workspace.

Demo Accounts

Role

Email

Password

Purpose

Student

student@campusorbit.dev

Student@123

Fully onboarded student experience

Admin

admin@campusorbit.dev

Admin@123

Placement-cell administration

Senior

senior@campusorbit.dev

Senior@123

Alumni/senior community experience

Additional seeded students use Student@123:

rohan@campusorbit.dev
sneha@campusorbit.dev
karan@campusorbit.dev

karan@campusorbit.dev is intentionally configured with a 6.1 CGPA, two backlogs, and incomplete onboarding to demonstrate the explainable eligibility engine.

Security: Demo credentials are intended for local development/testing only. Never use them in production.

Administrators cannot self-register. Registration requests attempting to use role: "admin" are downgraded to student.

Environment Variables

Configure server/.env using server/.env.example.

Variable

Default

Purpose

PORT

5000

API port

MONGODB_URI

mongodb://127.0.0.1:27017/campusorbit

MongoDB connection

JWT_SECRET

Development value

JWT signing secret; replace in production

JWT_EXPIRES_IN

7d

Token lifetime

COOKIE_SECURE

false

Enable behind HTTPS

CLIENT_ORIGIN

http://localhost:5173

Development CORS origin

UPLOAD_DIR

uploads

Document upload directory

GEMINI_API_KEY

Empty

Enables external AI generation when configured

For production:

Use a strong, unique JWT_SECRET.

Enable secure cookies behind HTTPS.

Configure the correct frontend origin.

Never commit .env files or secrets to source control.

Docker

MongoDB only

docker compose up -d mongo

Then run the application normally:

npm run dev

Full stack

docker compose up --build

The full stack exposes the application on:

http://localhost:5000

Seed the database

docker compose run --rm seed

Container architecture

The application image uses a two-stage build:

Build the Vite frontend.

Install production server dependencies and serve the generated SPA through Express.

The target architecture is a single application container with a single exposed port.

Docker was not available in the original development environment, so the Docker configuration was written to specification but was not executed there. The non-Docker development path was verified separately.

Data Model

CampusOrbit uses 22 Mongoose models:

Model

Responsibility

User

Authentication, profile, role, streaks, bookmarks

LearningPath

Learning-track metadata and outcomes

Milestone

Ordered learning milestones and prerequisites

Lesson

Curated video, transcript, practice task, takeaways

StudentProgress

Per-student lesson/milestone progress

Note

AI-generated and personal notes

Flashcard

Lesson flashcards

Quiz

Quiz questions with protected answers

QuizAttempt

Graded quiz attempts

RevisionTask

Spaced-repetition tasks

Opportunity

Placement-drive information and eligibility rules

Application

Application stage and timeline

Document

Private student documents and links

Resume

Structured resume data and completeness

InterviewQuestion

Interview question bank

InterviewAttempt

Answers and structured feedback

PeerRoom

Community room configuration

Message

Room messages and reactions

WatchSession

Synchronized video sessions

Notification

Deduplicated in-app notifications

Announcement

Cohort-wide broadcasts

VideoQueueItem

Personal YouTube resources

API Overview

All API endpoints are prefixed with:

/api

Responses use:

{
  "success": true,
  "message": "...",
  "data": {}
}

Authentication

Method

Endpoint

Access

POST

/auth/register

Public

POST

/auth/login

Public

POST

/auth/logout

Authenticated

GET

/auth/me

Authenticated

Learning

Method

Endpoint

Access

GET

/paths

Public

GET

/paths/:idOrSlug

Public

POST

/paths/recommend

Authenticated

GET

/paths/my-progress

Authenticated

POST

/paths/:pathId/start

Authenticated

POST

/paths/switch

Authenticated

GET

/paths/milestone/:id

Authenticated

POST

/paths/milestone/:milestoneId/complete

Authenticated

GET

/lessons/:id

Authenticated

POST

/lessons/:id/progress

Authenticated

POST

/lessons/:id/complete

Authenticated

Notes, Quizzes & Revision

Method

Endpoint

Access

GET

/notes/ai-status

Public

GET

/notes/mine

Authenticated

POST

/notes/personal

Authenticated

POST

/notes/generate/:lessonId

Admin

GET

/notes/review

Admin

PATCH

/notes/:id/publish

Admin

GET

/quizzes/:id

Authenticated

POST

/quizzes/:id/submit

Authenticated

GET

/quizzes/attempts/mine

Authenticated

GET/POST

/revisions

Authenticated

AI generation returns 400 when a lesson does not contain an authorised transcript.

Placement

Method

Endpoint

Access

GET

/opportunities

Authenticated

GET

/opportunities/:id

Authenticated

GET

/opportunities/matches

Authenticated

POST

/opportunities/:id/bookmark

Authenticated

POST

/applications

Authenticated

GET

/applications/mine

Authenticated

PATCH

/applications/:id/my-stage

Authenticated

GET

/applications/applicants

Admin

PATCH

/applications/:id/stage

Admin

GET

/applications/export

Admin

Resumes, Documents & Interview

Method

Endpoint

Access

GET/POST

/resumes

Authenticated

GET/PATCH/DELETE

/resumes/:id

Authenticated

GET

/documents

Authenticated

POST

/documents/upload

Authenticated

POST

/documents/link

Authenticated

GET

/documents/checklist/:opportunityId

Authenticated

GET

/interview/questions

Authenticated

POST

/interview/answer

Authenticated

GET

/interview/attempts

Authenticated

Rooms & Live Sessions

Method

Endpoint

Access

GET

/rooms

Authenticated

GET

/rooms/:idOrSlug

Authenticated

POST

/rooms/:id/join

Authenticated

POST

/rooms/:id/messages

Authenticated

GET

/rooms/:id/meet

Authenticated

POST

/rooms/:id/meet

Senior/Admin

GET

/rooms/meet/upcoming

Authenticated

GET

/rooms/meet/browse

Authenticated

POST

/rooms/meet/:sessionId/rsvp

Authenticated

POST

/rooms/meet/:sessionId/join

Authenticated

POST

/rooms/meet/:sessionId/start

Host/Admin

POST

/rooms/meet/:sessionId/end

Host/Admin

GET

/rooms/meet/:sessionId/attendance

Host/Admin

Only meet.google.com and g.co/meet links are accepted for live sessions.

Dashboard

Method

Endpoint

Access

GET

/dashboard/student

Authenticated

GET

/dashboard/charts

Authenticated

GET

/dashboard/admin/analytics

Admin

GET

/dashboard/admin/student/:id

Admin

GET

/health

Public

GET

/ai-status

Public

Realtime Architecture

Socket.IO is served at:

/socket.io

Authentication is supported through the handshake token or HTTP-only cookie.

Client → Server

join-room
leave-room
send-message
typing
react-message

join-watch-session
leave-watch-session
sync-video-state
video-play
video-pause
video-seek
request-resync
send-timestamp-message

Server → Client

connected
presence-update
member-joined
new-message
user-typing
message-reaction

watch-participant-joined
watch-participant-left
video-state-changed
video-play
video-pause
video-seek
video-resync

Watch Together

Playback state includes serverTime to compensate for network drift.

Playback control is restricted to:

Session host

Room moderators

Administrators

Late joiners receive a wall-clock-adjusted playback position.

Scheduled Jobs

node-cron runs the following jobs:

Frequency

Responsibility

Daily at 07:00

Due revisions, approaching deadlines, incomplete profiles, pending quizzes

Hourly

Expire placement opportunities after their deadline

Every 30 minutes

Revision due-date checks

Notifications use a dedupeKey, preventing duplicate notifications when jobs are rerun.

Administrators can manually trigger the notification sweep:

POST /api/admin/run-reminders

Testing & Verification

The project includes API, Socket.IO, integration, race-condition, onboarding, and browser-level verification.

npm test

Individual suites include:

node server/test-api.mjs
node server/test-socket.mjs
node server/test-client-endpoints.mjs
node server/test-chat-2session.mjs
node server/test-watch-sync.mjs
node server/test-race-conditions.mjs
node server/test-onboarding-loop.mjs
node server/test-meet.mjs

Run the complete test set:

npm run test:all

The documented automated suites contain 377 assertions, all passing in the verified environment.

A Playwright browser suite covers the Live Sessions workflow:

npm run dev
node uitest-meet.mjs

The browser suite contains 49 assertions covering authentication removal, Live Sessions, filters, RSVP, link validation, host controls, and role separation.

Verified workflows

Registration, login, logout, and session expiry

Onboarding and path recommendation

Learning progress and quiz gating

Milestone completion and topic transfer

Persistent video playback

YouTube URL validation

Notes, flashcards, quizzes, and spaced revision

Explainable placement eligibility

Resume PDF generation

Structured interview feedback

Two-session Socket.IO chat

Watch Together synchronization

Google Meet scheduling, RSVP, access control, and attendance

Applicant filtering and CSV export

Admin content publishing workflow

Production Vite build

SPA deep-link fallback

Persistence across backend restart

Headless rendering of all 32 documented screens

Security

The project documentation records:

npm audit → 0 vulnerabilities

The application includes:

HTTP-only JWT cookies

bcrypt password hashing

Zod request validation

Rate limiting

Private document authorization

Server-side role enforcement

Server-side eligibility enforcement

Protected administrative operations

Restricted Watch Together controls

Google Meet URL validation

Draft/publish separation for generated content

Production container hardening

The documented container configuration includes:

node:22-alpine

Package upgrades

Production-only dependency installation

Non-root execution

No shell for the application user

dumb-init

no-new-privileges

Read-only root filesystem

MongoDB bound to loopback

Design System & Accessibility

CampusOrbit uses a space-inspired glassmorphism design system:

Deep navy-black backgrounds

Violet, indigo, cyan, and coral accents

Glass panels

Gradient borders

Layered glow effects

Animated starfield and aurora elements

Spring-based interactions

3D effects are used selectively where they provide product value, particularly in:

Learning Orbit

Resume template previews

Watch Together

Forms, filters, tables, and chat remain intentionally lightweight.

Accessibility

The interface includes:

Semantic landmarks

Labelled form inputs

Visible focus states

Accessible icon-only controls

Contrast-checked text

prefers-reduced-motion support

Manual Reduce Motion setting

Known Limitations

The following limitations are intentional and documented rather than hidden.

No native video/audio calling
CampusOrbit does not implement WebRTC or direct messaging. Live sessions use Google Meet links supplied by authorised hosts.

No Google Calendar API integration
The Add to Calendar feature uses a pre-filled Google Calendar URL. CampusOrbit does not create calendar events through OAuth.

Attendance is click-based
Attendance records when a user clicks Join Google Meet. The platform cannot verify how long they remain in the meeting.

No payments
Payment functionality is outside the current product scope.

Demo AI Mode without an API key
The fallback AI implementation is deterministic and clearly labelled. It is not represented as a language model.

Authorised transcript requirement
AI generation is blocked when a lesson lacks an admin-supplied transcript.

Watch Together depends on player availability
Browser autoplay restrictions or blocked playback can cause synchronization drift. Re-sync is provided as the recovery mechanism.

Video progress is periodically persisted
A few seconds of progress immediately before a tab closes may not be stored.

Preparation score is not a selection prediction
It measures completed preparation work only.

File uploads are limited to 5 MB
Documents are stored on the server filesystem rather than object storage.

Docker was not executed in the original development environment
The Dockerfile and Compose configuration were written to specification but were not verified there.

YouTube requires network access
Offline users receive an explicit error and an external link rather than a broken player.

Project Structure

campusorbit/
├── package.json
├── docker-compose.yml
├── Dockerfile
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── models/              # 22 Mongoose models
│   │   ├── middleware/          # Auth, validation, errors, rate limits, uploads
│   │   ├── controllers/         # API controllers
│   │   ├── routes/               # API routes
│   │   ├── services/             # Eligibility, AI, notifications, sockets, cron
│   │   ├── utils/
│   │   ├── data/                 # Seed data
│   │   ├── seed.js
│   │   ├── app.js
│   │   └── server.js
│   ├── test-api.mjs
│   ├── test-socket.mjs
│   ├── test-client-endpoints.mjs
│   ├── test-chat-2session.mjs
│   ├── test-watch-sync.mjs
│   ├── test-race-conditions.mjs
│   └── test-onboarding-loop.mjs
│
└── client/
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── services/
        ├── context/
        ├── hooks/
        ├── layouts/
        ├── components/
        │   ├── ui/
        │   ├── three/
        │   ├── resume/
        │   └── ...
        └── pages/
            ├── auth/
            └── admin/

👨‍💻 Author & Credits

<div align="center">

Mayank Vishwakarma

<a href="https://github.com/Mayank1525">
  <img src="https://img.shields.io/badge/GitHub-Mayank1525-181717?style=for-the-badge&logo=github" alt="GitHub"/>
</a>
<a href="https://www.linkedin.com/in/mayank-vishwakarma-1636771b6/">
  <img src="https://img.shields.io/badge/LinkedIn-Mayank%20Vishwakarma-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn"/>
</a>

</div>

License

MIT License.

CampusOrbit is provided as a complete, working reference implementation of a MERN-based student preparation and placement platform.
