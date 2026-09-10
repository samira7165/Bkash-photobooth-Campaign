# AI Photobooth — Dream Job

Single Next.js app: frontend UI + API routes + queue processing, all in one.

## Architecture

```
┌──────────────────────────────────────────┐
│  Next.js App  (localhost:3000)           │
│                                          │
│  app/page.tsx        ← Kiosk UI         │
│  app/api/sessions/*  ← REST endpoints   │
│  app/api/images/*    ← Image serving    │
│                                          │
│  lib/db.ts           ← Prisma + MySQL   │
│  lib/queue.ts        ← DB-polling queue │
│  lib/ai-generation.ts ← AI provider     │
│  lib/sms.ts          ← SMS gateway      │
└──────────────────────────────────────────┘
                 │
            ┌────▼────┐
            │  MySQL  │
            └─────────┘
```

No Redis needed — uses database polling. A `setInterval` worker (`lib/queue.ts`)
polls the `sessions` table every 5 seconds for rows with status `queued` and
processes them one at a time.

## User Flow

1. **Info** → name (required), phone (required), email (optional), gender
2. **Dream Job** → pick from 12 jobs or type a custom one
3. **Camera** → capture photo via webcam
4. **Queue** → session marked "queued"; the DB-polling worker picks it up
5. **AI Generation** → transforms the photo into dream job portrait
6. **SMS** → user gets a text with a link to retrieve their image
7. **Done** → "check your SMS" confirmation screen

## Prerequisites

- Node.js 18+
- MySQL 8+

## Setup

```bash
# 1. Create MySQL database
mysql -e "CREATE DATABASE photobooth CHARACTER SET utf8mb4;"

# 2. Install and configure
cp .env.example .env     # fill in your DB credentials
npm install
npx prisma db push       # creates the sessions table

# 3. Run
npm run dev
```

Open `http://localhost:3000` — that's it, one app, one port.

## API Endpoints

| Method | Path                                     | Description                |
|--------|------------------------------------------|----------------------------|
| POST   | /api/sessions                            | Create session (user info) |
| POST   | /api/sessions/[id]/job                   | Select dream job           |
| POST   | /api/sessions/[id]/image                 | Upload captured photo      |
| GET    | /api/sessions/[id]                       | Get session status         |
| GET    | /api/images/search?phone=...             | Search images by phone     |
| GET    | /api/images/file/[sessionId]/[type]      | Serve image file           |
| GET    | /api/admin/queue-status                  | Queue + DB stats           |

## Integration Points

### AI Image Generation
Edit `lib/ai-generation.ts` — replace the placeholder with your AI API
(Replicate, Stability, ComfyUI, RunPod, etc). Receives the original
image path, selected job, and gender.

### SMS Gateway
Edit `lib/sms.ts` — replace with your SMS provider
(SSL Wireless, BulkSMS BD, Twilio, etc).

### OTP Verification (TODO)
Scaffolded in `lib/sms.ts` — `sendOtp()` and `verifyOtp()`.
Store OTP in the database with an expiry.

### Short URL (TODO)
The retrieval URL is sent directly in the SMS. Swap with a
URL shortener when ready.

## Session Status Flow

```
created → job_selected → image_captured → queued → processing → generated → sms_sent
                                                                    ↘ failed
```

## Project Structure

```
photobooth/
  app/
    layout.tsx                          # root layout + fonts
    page.tsx                            # kiosk UI (client component)
    globals.css                         # all styles
    api/
      sessions/route.ts                 # POST create session
      sessions/[id]/route.ts            # GET session
      sessions/[id]/job/route.ts        # POST select job
      sessions/[id]/image/route.ts      # POST upload + queue
      images/search/route.ts            # GET by phone
      images/file/[sessionId]/[type]/   # GET serve image
      admin/queue-status/route.ts       # GET stats
  components/
    StepInfo.tsx                        # name, phone, email, gender
    StepDreamJob.tsx                    # 12 jobs + Other
    StepCamera.tsx                      # webcam capture
    StepDone.tsx                        # SMS confirmation
  services/
    api.ts                              # frontend fetch calls
  lib/
    db.ts                               # Prisma client singleton
    queue.ts                            # DB-polling queue + processor
    ai-generation.ts                    # AI image generation
    sms.ts                              # SMS + OTP scaffold
    utils.ts                            # helpers
  prisma/
    schema.prisma                       # MySQL schema
```
