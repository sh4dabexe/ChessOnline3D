# Implementation Plan — 3D Realtime Multiplayer Chess

## What We're Building

A full-stack webapp from scratch across two directories:

```
chess 3d/
├── backend/    Express 5 + TypeScript (Supabase service-role key lives here)
└── frontend/   Vite + React 18 + React Three Fiber + chess.js
```

---

## User Review Required

> [!IMPORTANT]
> **We need two more values before we can build and run**:
>
> 1. **`SUPABASE_URL`** — Your project's URL, found in Supabase dashboard → Settings → API.
>    It looks like: `https://xxxx.supabase.co`
>
> 2. **`VITE_SUPABASE_ANON_KEY`** — The safe public anon key (not the service role key).
>    It's a long JWT starting with `eyJhbGci...`
>
> You've already provided the **service role secret key** which will go in `backend/.env`.
> These two extra values are needed for the **Supabase Realtime** (frontend listens to board changes).
>
> While you gather those, we can still build all the code — just fill `.env` files when ready.

> [!CAUTION]
> The service-role key you provided (`sb_secret_...`) will be stored **only** in `backend/.env`
> and will never be committed to git or sent to the browser.

---

## Phase 1 — Backend (Express + Supabase Admin)

### Files to Create

| File | Purpose |
|------|---------|
| `backend/package.json` | Express, cors, dotenv, @supabase/supabase-js, tsx |
| `backend/tsconfig.json` | TypeScript config |
| `backend/.env.example` | Template |
| `backend/.gitignore` | Ignores .env |
| `backend/src/index.ts` | Entry: mounts routes, starts server on port 4000 |
| `backend/src/supabase.ts` | Admin Supabase client (service-role key) |
| `backend/src/middleware/cors.ts` | CORS for frontend origin |
| `backend/src/routes/health.ts` | GET /health |
| `backend/src/routes/rooms.ts` | POST, GET, PATCH (join/move/resign/draw) |

---

## Phase 2 — Database

### SQL to run in Supabase SQL Editor

Full `rooms` table with:
- UUID primary key
- `room_code` (6-char, unique, indexed)
- White / Black player IDs and names
- `fen` field (current board state)
- `pgn_moves` text array
- `status` ('waiting' | 'playing' | 'finished')
- `winner`, `draw_offered_by`
- Timestamps
- RLS policies (public read, backend writes via service-role)

---

## Phase 3 — Frontend (Vite + React + Three.js)

### Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/main.tsx` | React root |
| `frontend/src/App.tsx` | Router (/ Lobby, /room/:code Game) |
| `frontend/src/lib/supabase.ts` | Anon client (realtime only) |
| `frontend/src/lib/api.ts` | Typed fetch calls to backend |
| `frontend/src/store/gameStore.ts` | Zustand state (FEN, players, chat, turn) |
| `frontend/src/types/index.ts` | Shared TS types |
| `frontend/src/pages/Lobby.tsx` | Create room / Join room |
| `frontend/src/pages/Game.tsx` | Full game page |
| `frontend/src/components/Board3D.tsx` | R3F Canvas, board mesh, lighting |
| `frontend/src/components/Piece3D.tsx` | 3D pieces (procedural geometry, no GLTF needed) |
| `frontend/src/components/MoveHints.tsx` | Glowing destination indicators |
| `frontend/src/components/ChatPanel.tsx` | Glassmorphism chat sidebar |
| `frontend/src/components/GameOverModal.tsx` | Winner overlay |
| `frontend/src/components/PromotionModal.tsx` | Pawn promotion choice |

### 3D Piece Strategy
Since CC0 GLTF models require download, we'll **procedurally build all 12 piece types** using Three.js geometry (Cylinder, Sphere, Lathe, CylinderGeometry) — giving premium-looking pieces with no external assets needed.

---

## Verification Plan

1. Run `npm run dev` in both `backend/` and `frontend/`
2. Open two browser windows, create a room in one, join in the other via invite link
3. Verify moves sync in real time
4. Verify chat messages appear instantly
5. Verify game ends properly on checkmate
