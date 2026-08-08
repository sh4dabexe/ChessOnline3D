# Product Requirements Document
# 3D Realtime Multiplayer Chess

**Version**: 2.0.0 | **Status**: Active Build | **Date**: August 2026 | **Project Path**: `D:\Coding\Projects\chess 3d`

> [!CAUTION]
> The Supabase **service role secret key** (`SUPABASE_SERVICE_ROLE_KEY`) is stored **only** in `backend/.env` and is **never** exposed to the browser or committed to version control. The frontend exclusively calls our own Express REST API — it never touches Supabase directly.

---

## Table of Contents

1. [Overview & Vision](#overview)
2. [LudoOnline Analysis & Supabase Transition](#analysis)
3. [Supabase Setup Guide](#supabase-setup)
4. [Functional Requirements](#functional-requirements)
5. [Non-Functional Requirements](#non-functional-requirements)
6. [Technical Stack](#technical-stack)
7. [Project Structure](#project-structure)
8. [Architecture Diagram](#architecture)
9. [Database Schema](#database-schema)
10. [Backend API Reference](#backend-api)
11. [Realtime Contract](#realtime-contract)
12. [Environment Variables](#env-vars)
13. [UI/UX Wireframes](#wireframes)
14. [Development Milestones](#milestones)
15. [Acceptance Criteria](#acceptance-criteria)
16. [Open Questions](#open-questions)

---

## 1. Overview & Vision

A **high-definition, 3D realtime multiplayer chess game** that runs entirely in the browser. It features:

- A fully rendered **3D chessboard** with premium wood/marble textures, realistic piece models (GLTF), dynamic shadows, and a fully interactive camera that orbits the board in 3D space.
- **Realtime multiplayer** where two players are matched in private rooms using a **unique 6-character room code** and a **shareable invite link**.
- An **in-game chat** panel where both players can send messages to each other during the game, powered by Supabase Realtime Broadcast (zero-latency, no database writes required for chat).
- **Full FIDE chess rules** enforced on the client via `chess.js`, with authoritative FEN state stored in Supabase.

### Target Users

| User | Description |
|------|-------------|
| Casual Gamer | Plays with friends via private invite links |
| Chess Enthusiast | Wants a premium visual and accurate rules experience |

### Non-Goals

- No AI / computer opponent
- No ELO rating system or leaderboards (v1)
- No mobile touch interface (v1 — desktop browser only)
- No video/audio calling

---

## 2. LudoOnline Code Analysis & Supabase Transition

Analyzed codebase: `D:\Coding\Projects\LudoOnline-main - Copy`

### 2.1 How LudoOnline Implements Rooms, Game State & Chat (Firebase)

| Feature | LudoOnline Firebase Pattern | File Reference |
|---------|----------------------------|---------------|
| **Room creation** | `generateRoomId()` creates a 6-char alphanumeric code; writes a full room document to `rooms/{roomId}` via `db.ref().set()` | `room-manager.js:16-61` |
| **Session persistence** | `sessionStorage` stores `uid`, `name`, `color`, `room` so page refreshes re-connect the player | `room-manager.js:55-58` |
| **Joining a room** | Reads `rooms/{roomId}/players`, counts current entries, checks max-players, and assigns the next unused color slot | `room-manager.js:65-113` |
| **Real-time state sync** | `db.ref('rooms/{roomId}').on('value', cb)` — fires `cb` on every database write, even small field updates | `room-manager.js:444-448` |
| **Turn advancement** | Writes `gameState/currentPlayerIndex` and `turnStartedAt` atomically with `db.ref('/').update(updates)` | `room-manager.js:387-397` |
| **Chat messages** | Pushes to `rooms/{roomId}/messages/{uid}_{ts}_{rand}` — the random suffix prevents key collision when two messages land in the same millisecond | `room-manager.js:457-469` |
| **Move lock** | `_movingLock` boolean prevents double-execution of the same move | `room-manager.js:12`, `186-196` |
| **Player miss / elimination** | After 3 missed turns, the player is flagged `eliminated: true` and removed from `playerOrder` | `room-manager.js:299-348` |

### 2.2 Firebase → Supabase Translation Map

> [!IMPORTANT]
> `@supabase/supabase-js` v2 uses a different import path. **Never use the old `@supabase/supabase-client`** (deprecated). Always import from `@supabase/supabase-js`.

| Capability | Firebase (LudoOnline) | Supabase Equivalent (Chess 3D) |
|-----------|----------------------|-------------------------------|
| Room document | `db.ref('rooms/ID').set({...})` | `supabase.from('rooms').insert({...})` |
| Real-time state | `ref.on('value', cb)` — full document on every change | `supabase.channel('room:ID').on('postgres_changes', {event:'UPDATE', table:'rooms'}, cb)` |
| Player presence / connection | Manual `players` dictionary with `eliminated` flag | `supabase.channel('room:ID').track({player_id, name, color})` via built-in Presence |
| In-game chat | DB write to `messages/` node; child-added listener | `channel.send({type:'broadcast', event:'chat', payload})` — ephemeral, no DB write needed |
| Atomic multi-path write | `db.ref('/').update({ 'a/b': x, 'c/d': y })` | Single `supabase.from('rooms').update({fen, status, ...}).eq('id', roomId)` |
| Disconnect cleanup | `onDisconnect().remove()` | Supabase Presence: automatic tracking of leave events |
| Move lock | Client-side `_movingLock` boolean | Same pattern — a React `useRef` lock + optimistic update with rollback on conflict |

---

## 3. Steps to Host Multiplayer via Supabase

### Step 1 — Create a Supabase Project

1. Sign in to [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Click **New Project**. Choose an organization, a project name (e.g., `chess3d`), and select the region closest to your players.
3. Set a strong **database password** and save it somewhere safe. You will need it for migrations.
4. Wait ~2 minutes for the project to provision.

### Step 2 — Install the Supabase CLI (Optional but Recommended)

```bash
npm install -g supabase
supabase login
supabase init        # in your project root
```

This allows you to manage migrations, seed data, and deploy Edge Functions locally before pushing to production.

### Step 3 — Run the Database Schema

Open the **SQL Editor** in your Supabase dashboard and run the full schema (see [Section 8](#database-schema)).

### Step 4 — Enable Realtime Replication

1. Go to **Database → Replication** in the Supabase sidebar.
2. Under the **supabase_realtime** publication, click **Edit** and enable replication for the `rooms` table.
3. This allows Supabase to push `INSERT`/`UPDATE`/`DELETE` events to subscribed frontend clients.

### Step 5 — Get Your API Keys

1. Go to **Settings → API**.
2. Copy the **`Project URL`** and the **`anon public`** key.
3. Store these in a `.env` file at the project root:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

> [!CAUTION]
> **Never commit `.env` to version control.** Add it to `.gitignore` immediately. The anon key is public-safe for reading, but exposing your `service_role` key would give anyone admin database access.

### Step 6 — Configure Row Level Security (RLS)

RLS policies control who can read and write which rows. The full RLS setup is included in the schema in Section 8. For a quick public-access sandbox (development only):

```sql
-- Development only — allows all anonymous reads and writes
create policy "dev_allow_all" on rooms
  for all using (true) with check (true);
```

For production, scope policies so only the room participants can write:

```sql
-- Only the white or black player can update their own room
create policy "players_can_update" on rooms
  for update using (
    auth.uid() = white_player_id OR
    auth.uid() = black_player_id
  );
```

### Step 7 — Initialize the Supabase Client in React

```bash
npm install @supabase/supabase-js
```

```typescript
// backend/src/supabase.ts  ← SERVER ONLY, never the browser
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // ← service-role key, server-side only
);
```

> [!WARNING]
> The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. It **must never** be sent to the browser. All Supabase writes go through our Express backend only.

### Step 8 — Frontend Supabase Client (Realtime Only)

The browser uses only the **anon key** and only for Supabase Realtime subscriptions (listening to board changes, chat broadcasts). All mutations go through the Express API.

```typescript
// frontend/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// anon key is safe to expose — it is read-only for realtime
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### Step 9 — Deploy

- **Backend** (Express): Deploy to [Railway](https://railway.app), [Render](https://render.com), or any Node.js host. Set all `backend/.env` variables as environment secrets.
- **Frontend** (Vite/React): Deploy to Vercel or Netlify. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL` as build environment variables.

---

## 4. Functional Requirements

### FR-1 — 3D Board & Scene

| ID | Requirement |
|----|-------------|
| FR-1.1 | Render an 8×8 chessboard as a 3D object with alternating high-res wood textures (walnut dark / maple light) and subtle edge bevel |
| FR-1.2 | Cast and receive realistic drop shadows from pieces onto the board surface |
| FR-1.3 | Ambient and directional lights create depth — lit from above-left with a warm tone |
| FR-1.4 | Optional: environment map / HDRI skybox for reflections on glossy piece surfaces |
| FR-1.5 | Board can display rank (1–8) and file (a–h) labels at the board edge, in 3D text |

### FR-2 — 3D Chess Pieces

| ID | Requirement |
|----|-------------|
| FR-2.1 | Load GLTF/GLB 3D piece models for all 12 piece types (6 per color) |
| FR-2.2 | White pieces: polished ivory / light marble material with specular highlights |
| FR-2.3 | Black pieces: dark walnut / obsidian material with subtle gloss |
| FR-2.4 | Each piece casts and receives dynamic shadows |
| FR-2.5 | Pieces have a subtle idle animation (e.g. very slow bob or rotation while selected) |

### FR-3 — Camera & Controls

| ID | Requirement |
|----|-------------|
| FR-3.1 | Orbit controls: left-drag to rotate, right-drag to pan, scroll to zoom |
| FR-3.2 | Default camera position: slightly elevated, centered on board, showing White's side |
| FR-3.3 | A **"Reset Camera"** button snaps the view back to the default position with smooth animation |
| FR-3.4 | When it is the opponent's turn, camera position does not auto-rotate (player can still explore) |

### FR-4 — Move Interaction

| ID | Requirement |
|----|-------------|
| FR-4.1 | Clicking a piece selects it — a glowing ring appears beneath it on the board |
| FR-4.2 | Valid destination squares display soft glowing indicators (green dot for empty, red ring for capture) |
| FR-4.3 | Click a highlighted destination to execute the move |
| FR-4.4 | Pieces animate smoothly along an arc trajectory from source to destination square |
| FR-4.5 | Captured pieces are removed with a fade-out or fall animation |
| FR-4.6 | Drag-and-drop is supported as an alternative input method |

### FR-5 — Chess Rules (FIDE Compliant)

| ID | Requirement |
|----|-------------|
| FR-5.1 | All standard piece movements enforced by `chess.js` |
| FR-5.2 | **Castling** (kingside and queenside) — both king and rook must be unmoved, path must be clear and unattacked |
| FR-5.3 | **En passant** — available only in the half-move immediately after an opposing double pawn push |
| FR-5.4 | **Pawn promotion** — a modal dialog appears when a pawn reaches the back rank; game pauses until selection |
| FR-5.5 | **Check detection** — the king square visually pulses red when in check |
| FR-5.6 | **Checkmate / Stalemate** — game ends with a result overlay |
| FR-5.7 | **Threefold repetition** and **50-move rule** auto-detection → draw offered |
| FR-5.8 | **Insufficient material** draw detection |

### FR-6 — Multiplayer Room System

| ID | Requirement |
|----|-------------|
| FR-6.1 | **Create Room**: generates a unique 6-character alphanumeric code (e.g. `HJ92KF`) and inserts a row into `rooms` |
| FR-6.2 | **Invite Link**: host can copy `https://domain.com/room/HJ92KF` to clipboard |
| FR-6.3 | Opening an invite link pre-fills the room code and attempts to join automatically |
| FR-6.4 | First player to create the room is White; second to join is Black |
| FR-6.5 | A third+ player connecting joins as a **spectator** (read-only board view, can still chat) |
| FR-6.6 | If a player disconnects, the game is paused and a reconnect banner appears |
| FR-6.7 | If the disconnected player does not reconnect within 2 minutes, the opponent is declared winner |

### FR-7 — In-Game Chat

| ID | Requirement |
|----|-------------|
| FR-7.1 | Chat panel displayed as a glassmorphism overlay on the right side of the canvas |
| FR-7.2 | Messages are sent via Supabase Broadcast (ephemeral — not stored to DB) |
| FR-7.3 | Each message shows the sender name, colored badge (White/Black), and timestamp |
| FR-7.4 | Max 200 characters per message |
| FR-7.5 | Game-event messages (e.g. "White moved Nf3", "Black is in check!") appear inline in the chat log |
| FR-7.6 | Pressing Enter submits the message |
| FR-7.7 | Emoji support in messages |

### FR-8 — Game Controls & Session Management

| ID | Requirement |
|----|-------------|
| FR-8.1 | **Resign** button: current player forfeits; opponent wins |
| FR-8.2 | **Offer Draw** button: sends draw offer via Broadcast; opponent accepts/declines |
| FR-8.3 | **Undo** is disabled in online multiplayer (no undo without opponent's consent) |
| FR-8.4 | **Rematch** button appears after game ends — both players must click it to start a new game with same room code |

---

## 5. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-1 | Performance | 60 FPS rendering on a mid-range GPU (GTX 1060 / RX 580 or newer) |
| NFR-2 | Latency | Game state updates (move sync) visible to opponent within 300 ms on a 50 Mbps connection |
| NFR-3 | Correctness | `chess.js` legal-move generation — validated by Perft(4) = 197,281 nodes |
| NFR-4 | Security | All database writes require a valid `room_code` match; RLS policies prevent cross-room writes |
| NFR-5 | Portability | Runs on Chrome 110+, Firefox 110+, and Edge 110+ without plugins |
| NFR-6 | Load Time | Initial page load < 5 seconds on a 20 Mbps connection (GLTF lazy-loaded after canvas mount) |
| NFR-7 | Accessibility | Keyboard navigation supported for move input as a fallback |

---

## 6. Technical Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Frontend Bundler** | Vite + React 18 + TypeScript | Fast HMR, tree-shaking, optimised builds |
| **3D Engine** | Three.js via React Three Fiber (R3F) | Declarative Three.js in JSX |
| **3D Helpers** | `@react-three/drei` | OrbitControls, GLTF loader, environment maps, Text3D |
| **Chess Logic** | `chess.js` v1.x | Battle-tested FIDE-compliant move generator |
| **Frontend State** | Zustand | Lightweight, minimal boilerplate |
| **Frontend Routing** | React Router v6 | `/` lobby, `/room/:code` game route |
| **Styling** | CSS Modules + CSS custom properties | Scoped styles; dark glassmorphism HUD |
| **Backend Runtime** | Node.js 20 + Express 5 | REST API server holding the service-role key securely |
| **Backend ORM** | `@supabase/supabase-js` | Supabase client with service-role key |
| **Database** | Supabase PostgreSQL | Persistent room & move storage |
| **Realtime** | Supabase Realtime (Broadcast + Presence) | Live move sync, online status, chat |
| **Type Safety** | TypeScript (shared types package) | End-to-end type safety across frontend and backend |

---

## 7. Project Structure

```
chess 3d/
├── backend/                        ← Express API server (Node.js)
│   ├── src/
│   │   ├── index.ts                ← Server entry point (port 4000)
│   │   ├── supabase.ts             ← Supabase admin client (service-role key)
│   │   ├── routes/
│   │   │   ├── rooms.ts            ← POST /rooms, GET /rooms/:code, PATCH /rooms/:id
│   │   │   └── health.ts           ← GET /health
│   │   └── middleware/
│   │       └── cors.ts             ← CORS allowing frontend origin
│   ├── .env                        ← SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
│   ├── .env.example                ← Template (safe to commit)
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                       ← Vite + React + R3F
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── lib/
│   │   │   ├── supabase.ts         ← Anon client for Realtime only
│   │   │   └── api.ts              ← Typed fetch wrappers for backend
│   │   ├── pages/
│   │   │   ├── Lobby.tsx           ← / route
│   │   │   └── Game.tsx            ← /room/:code route
│   │   ├── components/
│   │   │   ├── Board3D.tsx         ← R3F scene, board mesh, lights
│   │   │   ├── Piece3D.tsx         ← GLTF piece loader
│   │   │   ├── MoveHints.tsx       ← Valid square indicators
│   │   │   ├── ChatPanel.tsx       ← Glassmorphism chat HUD
│   │   │   └── GameOverModal.tsx
│   │   ├── store/
│   │   │   └── gameStore.ts        ← Zustand store
│   │   └── types/
│   │       └── index.ts            ← Shared Room, Move, Player types
│   ├── public/
│   │   └── models/                 ← GLTF chess piece files
│   ├── .env                        ← VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
│
└── prd.md
```

---

## 8. Architecture Diagram

```
┌────────────────────────────────────────────────┐
│              Browser (React + R3F)             │
│                                                │
│  /lobby → POST /api/rooms (create room)        │
│          → GET  /api/rooms/:code (join room)   │
│                                                │
│  /room/:code                                   │
│   ├── Three.js Canvas (Board, Pieces, Lights)  │
│   ├── chess.js (local rule enforcement)        │
│   ├── PATCH /api/rooms/:id  (push FEN move)    │
│   │                                            │
│   └── Supabase Realtime (anon key — read only) │
│        ├── postgres_changes → live FEN updates │
│        ├── broadcast ← chat messages           │
│        └── presence  ← online / offline        │
└──────────────────┬─────────────────────────────┘
                   │ HTTP REST
                   ▼
┌────────────────────────────────────────────────┐
│           Express Backend  (port 4000)         │
│                                                │
│  POST   /api/rooms          → create room      │
│  GET    /api/rooms/:code    → get room state   │
│  PATCH  /api/rooms/:id      → update FEN/status│
│  DELETE /api/rooms/:id      → close room       │
│                                                │
│  Uses: SUPABASE_SERVICE_ROLE_KEY (server only) │
└──────────────────┬─────────────────────────────┘
                   │ service-role key (bypasses RLS)
                   ▼
┌────────────────────────────────────────────────┐
│              Supabase Cloud                    │
│                                                │
│  PostgreSQL  → rooms table                     │
│  Realtime    → postgres_changes publication    │
│              → Broadcast / Presence channels   │
└────────────────────────────────────────────────┘
```

---

## 8. Database Schema

Run this in the **Supabase SQL Editor**:

```sql
-- Required extension for UUID generation
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Helper function: generate a 6-character uppercase room code
create or replace function generate_room_code()
returns varchar(6)
language plpgsql as $$
declare
  code varchar(6);
  exists boolean;
begin
  loop
    code := upper(substring(encode(gen_random_bytes(4), 'base64') from 1 for 6));
    code := regexp_replace(code, '[^A-Z0-9]', '', 'g');
    code := substring(code from 1 for 6);
    select count(*) > 0 into exists from rooms where room_code = code;
    exit when not exists and length(code) = 6;
  end loop;
  return code;
end;
$$;

-- Rooms table
create table if not exists rooms (
  id                  uuid                     primary key default gen_random_uuid(),
  room_code           varchar(6)               unique not null,

  -- Players
  white_player_id     text,
  white_player_name   varchar(50),
  black_player_id     text,
  black_player_name   varchar(50),

  -- Game State
  -- FEN max length: ~87 chars for the most complex positions. Using 100 as safe buffer.
  fen                 varchar(100)             not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn_moves           text[]                   not null default '{}',
  status              varchar(20)              not null default 'waiting'
                                               check (status in ('waiting', 'playing', 'finished')),
  winner              varchar(10)              check (winner in ('white', 'black', 'draw')),
  draw_offered_by     varchar(10)              check (draw_offered_by in ('white', 'black', null)),

  -- Timestamps
  last_move_at        timestamptz              default now(),
  created_at          timestamptz              not null default now()
);

-- Index for fast room_code lookups (used on every join)
create index idx_rooms_code on rooms(room_code);

-- Row Level Security
alter table rooms enable row level security;

-- Policy: Anyone can read rooms (for lobby display and spectators)
create policy "rooms_read_all" on rooms
  for select using (true);

-- Policy: Anyone can create a room (insert with any player_id)
create policy "rooms_insert_any" on rooms
  for insert with check (true);

-- Policy: Only white or black player can update a room
create policy "rooms_update_players" on rooms
  for update using (
    white_player_id = current_setting('request.jwt.claims', true)::json->>'sub'
    or
    black_player_id = current_setting('request.jwt.claims', true)::json->>'sub'
  );
```

> [!NOTE]
> Since this v1 uses anonymous sessions (no Auth), the update policy above is simplified. For the initial development build, replace `rooms_update_players` with the permissive dev policy and tighten once Supabase Auth is integrated.

---

## 10. Backend API Reference

All endpoints are prefixed with `/api`. The backend runs on `http://localhost:4000` in development.

### POST `/api/rooms` — Create Room

**Request body**:
```json
{ "playerName": "Magnus" }
```
**Response** `201`:
```json
{
  "id": "uuid",
  "room_code": "HJ92KF",
  "player_id": "uuid-for-this-client",
  "color": "white",
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
}
```

### GET `/api/rooms/:code` — Get Room State

**Response** `200`:
```json
{
  "id": "uuid",
  "room_code": "HJ92KF",
  "status": "waiting",
  "white_player_name": "Magnus",
  "black_player_name": null,
  "fen": "rnbqkbnr/...",
  "pgn_moves": []
}
```

### PATCH `/api/rooms/:id/join` — Join as Black

**Request body**:
```json
{ "playerName": "Hikaru" }
```
**Response** `200`:
```json
{ "player_id": "uuid-for-this-client", "color": "black" }
```

### PATCH `/api/rooms/:id/move` — Push a Move

**Request body**:
```json
{ "player_id": "uuid", "fen": "new-fen", "san": "Nf3" }
```
**Response** `200`:
```json
{ "ok": true, "pgn_moves": ["e4", "e5", "Nf3"] }
```

### PATCH `/api/rooms/:id/resign` — Resign

**Request body**:
```json
{ "player_id": "uuid" }
```
**Response** `200`:
```json
{ "ok": true, "winner": "black" }
```

### PATCH `/api/rooms/:id/draw` — Offer or Accept Draw

**Request body**:
```json
{ "player_id": "uuid", "action": "offer" }
// action: "offer" | "accept" | "decline"
```

---

## 11. Realtime Contract

### 11.1 Supabase Postgres Changes (Frontend, anon key)

```typescript
// frontend/src/lib/realtime.ts
const channel = supabase
  .channel(`room:${roomId}`)
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
    (payload) => {
      const { fen, status, winner } = payload.new;
      loadFen(fen);            // update chess.js + re-render pieces
      if (status === 'finished') showGameOverModal(winner);
    }
  )
  .subscribe();
```

### 11.2 Broadcast (Chat & Game Events)

```typescript
// IMPORTANT: Import from the correct package (v2)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Create a combined channel for the room (game events + chat)
const gameChannel = supabase.channel(`game:${roomCode}`, {
  config: { broadcast: { self: true } }  // receive own broadcasts for UI feedback
});

// --- Chat ---
gameChannel.on('broadcast', { event: 'chat' }, ({ payload }) => {
  appendMessage(payload);  // { sender, text, color, ts }
});

const sendChat = (sender: string, text: string, color: 'white' | 'black') => {
  gameChannel.send({
    type: 'broadcast',
    event: 'chat',
    payload: { sender, text: text.slice(0, 200), color, ts: Date.now() }
  });
};

// --- Presence (online/offline) ---
gameChannel
  .on('presence', { event: 'sync' }, () => {
    const state = gameChannel.presenceState();
    updatePlayerStatus(state);
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await gameChannel.track({ player_id: myPlayerId, name: myName, color: myColor });
    }
  });
```

---

## 10. UI/UX Wireframes

### 10.1 Lobby Screen

```
+─────────────────────────────────────────────────────────────────────+
│                                                                     │
│            ♔  3D Chess  ♛       [glassmorphism dark card]           │
│                                                                     │
│   ┌─────────────────────────────┐   ┌───────────────────────────┐  │
│   │    Create a Room            │   │    Join a Room            │  │
│   │                             │   │                           │  │
│   │  Name: [_______________]    │   │  Name: [_____________]   │  │
│   │                             │   │  Code: [_____________]   │  │
│   │  [  Create Room  ]          │   │                           │  │
│   │                             │   │  [  Join Room  ]          │  │
│   └─────────────────────────────┘   └───────────────────────────┘  │
│                                                                     │
+─────────────────────────────────────────────────────────────────────+
```

### 10.2 Game Screen Layout

```
+─────────────────────────────────────────────────────────────────────────────+
│  3D CANVAS AREA (Three.js / React Three Fiber)                │  SIDEBAR   │
│                                                               │            │
│    ┌──────────────────────────────────────────┐              │ ● White     │
│    │                                          │              │   Magnus    │
│    │         3D Board + Pieces                │              │ ● Black     │
│    │         (Orbit Controls)                 │              │   Hikaru    │
│    │                                          │              │            │
│    │  [selected piece glows]                  │              │ ────────── │
│    │  [valid moves: green dots / red rings]   │              │  CHAT      │
│    │                                          │              │            │
│    └──────────────────────────────────────────┘              │ [Hikaru]:  │
│                                                               │  nice move │
│   [Reset Camera]  [Resign]  [Offer Draw]  Room: HJ92KF [Copy]│            │
│                                                               │ [Magnus]:  │
│                                                               │  thanks!   │
│                                                               │            │
│                                                               │ [________] │
│                                                               │ [Send ↵]   │
+─────────────────────────────────────────────────────────────────────────────+
```

---

## 14. Development Milestones

| # | Milestone | Deliverables | Target |
|---|-----------|-------------|--------|
| M1 | **Project Setup** | `backend/` + `frontend/` scaffolded; `.env` files; TypeScript configs; shared types | Week 1 |
| M2 | **Express Backend** | All 5 REST endpoints working; Supabase service-role client; SQL schema applied | Week 1 |
| M3 | **3D Scene** | Board mesh with walnut/maple wood texture; GLTF piece models loaded; lighting and shadows | Week 2 |
| M4 | **Camera & Selection** | OrbitControls; raycasting click detection; piece selection glow; move hints | Week 3 |
| M5 | **Chess Rules** | `chess.js` integration; legal move generation; check/checkmate/stalemate; promotion modal | Week 4 |
| M6 | **Multiplayer Rooms** | Create room → invite link flow; join as Black; FEN sync via Realtime | Week 5 |
| M7 | **Chat System** | Broadcast chat panel; game-event messages; emoji support | Week 6 |
| M8 | **Presence & Reconnect** | Supabase Presence online/offline; 2-min reconnect timer; disconnect banner | Week 7 |
| M9 | **Polish & UX** | Piece arc animations; draw/resign/rematch flows; responsive sidebar | Week 8 |
| M10 | **Testing & Deploy** | Cross-browser testing; backend to Railway; frontend to Vercel; README | Week 9 |

---

## 12. Acceptance Criteria

- [ ] Two players on separate machines can connect to the same room via invite link
- [ ] All FIDE chess rules enforced correctly (validated by `chess.js`)
- [ ] Pieces render as high-quality 3D GLTF models with shadows
- [ ] A move made by Player A appears on Player B's board within 300 ms
- [ ] Chat messages are delivered instantly without page refresh
- [ ] Disconnected player detection works within 10 seconds
- [ ] Promotion modal appears and pauses the game until piece selected
- [ ] Game ends correctly with a result screen for checkmate, stalemate, resignation, and draw
- [ ] Invite link correctly routes a new visitor to the correct room
- [ ] Game runs at 60 FPS on a mid-range GPU in Chrome 110+

---

## 15. Environment Variables

### `backend/.env` (server-side — never commit)

```env
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>   # ← kept here, server only

# Server
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
```

### `backend/.env.example` (safe to commit)

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
```

### `frontend/.env` (browser-safe values only)

```env
# Supabase anon key — safe for browser (read-only realtime)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# Backend API
VITE_API_URL=http://localhost:4000/api
```

> [!NOTE]
> The frontend **never** holds the service-role key. It only holds the anon key (which has restricted RLS access) for subscribing to Supabase Realtime channels.

---

## 16. Open Questions

| # | Question | Status | Impact |
|---|----------|--------|--------|
| OQ-1 | GLTF piece models: free CC0 library (e.g. Sketchfab) or procedural Three.js? | ✅ **Resolved** — use CC0 GLTF from `lichess-org/lila` piece sets | Affects M3 |
| OQ-2 | Use Supabase Auth or purely anonymous UUIDs in v1? | ✅ **Resolved** — anonymous UUID stored in `localStorage`; Auth deferred to v2 | Affects M6 |
| OQ-3 | Optional chess clock in v1? | ⏳ Deferred to v2 | Adds ~1 week |
| OQ-4 | Do spectators get chat access? | ⏳ Open — spectators can read chat but not send messages (v1) | Affects FR-7 |
| OQ-5 | Hosting provider | ⏳ Open — backend on Railway, frontend on Vercel (recommended) | Affects M10 |
