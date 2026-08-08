import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Chess } from 'chess.js';
import { supabase } from '../supabase.js';

const router = Router();

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface ChatMessageRecord {
  id: string;
  type: 'chat' | 'event';
  sender?: string;
  color?: string;
  text: string;
  ts: number;
}

export interface RoomRecord {
  id: string;
  room_code: string;
  white_player_id: string | null;
  white_player_name: string | null;
  black_player_id: string | null;
  black_player_name: string | null;
  fen: string;
  pgn_moves: string[];
  status: 'waiting' | 'playing' | 'finished';
  winner: string | null;
  draw_offered_by: string | null;
  rematch_requested_by: string | null;
  time_control: number; // in minutes (0 = unlimited)
  white_time_left: number; // in seconds
  black_time_left: number; // in seconds
  timer_last_updated_at: string;
  chat_messages: ChatMessageRecord[];
  last_move_at: string;
  created_at: string;
}

const memoryRooms = new Map<string, RoomRecord>();

async function insertRoom(roomData: Partial<RoomRecord>): Promise<RoomRecord> {
  const timeControl = roomData.time_control ?? 10;
  const initialSeconds = timeControl > 0 ? timeControl * 60 : 0;
  const now = new Date().toISOString();

  const record: RoomRecord = {
    id: roomData.id || uuidv4(),
    room_code: roomData.room_code || 'DEFAULT',
    white_player_id: roomData.white_player_id || null,
    white_player_name: roomData.white_player_name || null,
    black_player_id: roomData.black_player_id || null,
    black_player_name: roomData.black_player_name || null,
    fen: roomData.fen || STARTING_FEN,
    pgn_moves: roomData.pgn_moves || [],
    status: roomData.status || 'waiting',
    winner: roomData.winner || null,
    draw_offered_by: roomData.draw_offered_by || null,
    rematch_requested_by: roomData.rematch_requested_by || null,
    time_control: timeControl,
    white_time_left: initialSeconds,
    black_time_left: initialSeconds,
    timer_last_updated_at: now,
    chat_messages: [],
    last_move_at: now,
    created_at: now,
  };

  try {
    const isPlaceholder = process.env.SUPABASE_URL?.includes('FILL_YOUR_PROJECT_URL');
    if (!isPlaceholder) {
      const { data, error } = await supabase
        .from('rooms')
        .insert(record)
        .select()
        .single();
      if (!error && data) {
        memoryRooms.set(record.id, data as RoomRecord);
        memoryRooms.set(record.room_code, data as RoomRecord);
        return data as RoomRecord;
      }
    }
  } catch (e) {
    console.warn('Supabase DB unavailable, using in-memory store:', (e as Error).message);
  }

  memoryRooms.set(record.id, record);
  memoryRooms.set(record.room_code, record);
  return record;
}

async function getRoomByCode(code: string): Promise<RoomRecord | null> {
  const codeUpper = code.toUpperCase();
  try {
    const isPlaceholder = process.env.SUPABASE_URL?.includes('FILL_YOUR_PROJECT_URL');
    if (!isPlaceholder) {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', codeUpper)
        .maybeSingle();
      if (!error && data) return data as RoomRecord;
    }
  } catch (e) {
    // fallback
  }
  return memoryRooms.get(codeUpper) || null;
}

async function getRoomById(id: string): Promise<RoomRecord | null> {
  try {
    const isPlaceholder = process.env.SUPABASE_URL?.includes('FILL_YOUR_PROJECT_URL');
    if (!isPlaceholder) {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) return data as RoomRecord;
    }
  } catch (e) {
    // fallback
  }
  return memoryRooms.get(id) || null;
}

async function updateRoom(id: string, updates: Partial<RoomRecord>): Promise<RoomRecord | null> {
  const room = await getRoomById(id);
  if (!room) return null;

  Object.assign(room, updates);
  memoryRooms.set(room.id, room);
  memoryRooms.set(room.room_code, room);

  try {
    const isPlaceholder = process.env.SUPABASE_URL?.includes('FILL_YOUR_PROJECT_URL');
    if (!isPlaceholder) {
      await supabase.from('rooms').update(updates).eq('id', id);
    }
  } catch (e) {
    // fallback
  }
  return room;
}

/** Generate a unique 6-char uppercase alphanumeric room code */
async function generateRoomCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const existing = await getRoomByCode(code);
    if (!existing) return code;
  }
  throw new Error('Could not generate unique room code after 20 attempts');
}

/** Determine the color of a player given their player_id and a room row */
function colorOf(room: RoomRecord, playerId: string): 'white' | 'black' | null {
  if (room.white_player_id === playerId) return 'white';
  if (room.black_player_id === playerId) return 'black';
  return null;
}

// ── POST /api/rooms — create a new room ─────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const { playerName, timeControl, preferredColor } = req.body as {
      playerName?: string;
      timeControl?: number;
      preferredColor?: 'white' | 'black' | 'random';
    };
    if (!playerName?.trim()) {
      res.status(400).json({ error: 'playerName is required' });
      return;
    }

    const roomCode = await generateRoomCode();
    const playerId = uuidv4();

    let chosenColor: 'white' | 'black' = 'white';
    if (preferredColor === 'black') chosenColor = 'black';
    else if (preferredColor === 'random') chosenColor = Math.random() < 0.5 ? 'white' : 'black';

    const roomData: Partial<RoomRecord> = {
      room_code: roomCode,
      fen: STARTING_FEN,
      status: 'waiting',
      time_control: typeof timeControl === 'number' ? timeControl : 10,
    };

    if (chosenColor === 'white') {
      roomData.white_player_id = playerId;
      roomData.white_player_name = playerName.trim().slice(0, 50);
    } else {
      roomData.black_player_id = playerId;
      roomData.black_player_name = playerName.trim().slice(0, 50);
    }

    const data = await insertRoom(roomData);

    res.status(201).json({
      id: data.id,
      room_code: data.room_code,
      player_id: playerId,
      color: chosenColor,
      fen: data.fen,
      time_control: data.time_control,
      white_time_left: data.white_time_left,
      black_time_left: data.black_time_left,
    });
  } catch (err: unknown) {
    console.error('POST /rooms error:', err);
    res.status(500).json({ error: (err as Error).message || 'Failed to create room' });
  }
});

// ── GET /api/rooms/:code — get room by code ──────────────────────────────────
router.get('/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const room = await getRoomByCode(code);

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (room.status === 'playing' && room.time_control > 0) {
      const now = Date.now();
      const lastUpdate = new Date(room.timer_last_updated_at || room.last_move_at).getTime();
      const elapsedSec = Math.max(0, Math.floor((now - lastUpdate) / 1000));
      const turn = room.fen.split(' ')[1];

      let timedOut = false;
      let timedOutColor: 'white' | 'black' | null = null;

      if (turn === 'w') {
        const remaining = Math.max(0, room.white_time_left - elapsedSec);
        if (remaining <= 0) {
          room.white_time_left = 0;
          timedOut = true;
          timedOutColor = 'white';
        }
      } else {
        const remaining = Math.max(0, room.black_time_left - elapsedSec);
        if (remaining <= 0) {
          room.black_time_left = 0;
          timedOut = true;
          timedOutColor = 'black';
        }
      }

      if (timedOut && timedOutColor) {
        // ── Score-based timeout win ─────────────────────────────────────────
        // Replay all moves with chess.js to get exact captured piece types
        const VALS: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
        let whiteScore = 0;
        let blackScore = 0;

        try {
          const replayBoard = new Chess();
          for (const san of room.pgn_moves) {
            const moveResult = replayBoard.move(san);
            if (moveResult && moveResult.captured) {
              const capturedVal = VALS[moveResult.captured] || 0;
              if (moveResult.color === 'w') {
                whiteScore += capturedVal; // White captured a black piece
              } else {
                blackScore += capturedVal; // Black captured a white piece
              }
            }
          }
        } catch {
          // PGN replay failed — fallback: opponent wins
        }

        // Determine winner: higher score wins; if tied, standard rule — opponent of timed-out player wins
        let winner: string;
        if (whiteScore > blackScore) {
          winner = 'white';
        } else if (blackScore > whiteScore) {
          winner = 'black';
        } else {
          winner = timedOutColor === 'white' ? 'black' : 'white';
        }

        room.status = 'finished';
        room.winner = winner;
        const timeoutUpdates: Partial<RoomRecord> = {
          status: 'finished',
          winner,
        };
        if (timedOutColor === 'white') timeoutUpdates.white_time_left = 0;
        else timeoutUpdates.black_time_left = 0;
        await updateRoom(room.id, timeoutUpdates);
      }
    }

    res.json(room);
  } catch (err: unknown) {
    console.error('GET /rooms/:code error:', err);
    res.status(500).json({ error: 'Failed to get room' });
  }
});



// ── PATCH /api/rooms/:id/join — second player joins ──────────────────────────
router.patch('/:id/join', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { playerName } = req.body as { playerName?: string };
    if (!playerName?.trim()) {
      res.status(400).json({ error: 'playerName is required' });
      return;
    }

    const room = await getRoomById(id);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    if (room.status !== 'waiting') {
      res.status(409).json({ error: 'Room is full or game already started' });
      return;
    }

    const playerId = uuidv4();
    const now = new Date().toISOString();

    // Assign remaining color to joining guest
    let assignedColor: 'white' | 'black' = 'black';
    const updates: Partial<RoomRecord> = {
      status: 'playing',
      timer_last_updated_at: now,
      last_move_at: now,
    };

    if (!room.white_player_id) {
      assignedColor = 'white';
      updates.white_player_id = playerId;
      updates.white_player_name = playerName.trim().slice(0, 50);
    } else {
      assignedColor = 'black';
      updates.black_player_id = playerId;
      updates.black_player_name = playerName.trim().slice(0, 50);
    }

    await updateRoom(id, updates);

    res.json({ player_id: playerId, color: assignedColor });
  } catch (err: unknown) {
    console.error('PATCH /rooms/:id/join error:', err);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// ── PATCH /api/rooms/:id/move — push a move ──────────────────────────────────
router.patch('/:id/move', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { player_id, fen, san, status: clientStatus, winner: clientWinner } = req.body as {
      player_id?: string;
      fen?: string;
      san?: string;
      status?: 'waiting' | 'playing' | 'finished';
      winner?: string | null;
    };

    if (!player_id || !fen || !san) {
      res.status(400).json({ error: 'player_id, fen, and san are required' });
      return;
    }

    const room = await getRoomById(id);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    if (room.status !== 'playing') {
      res.status(409).json({ error: 'Game is not in playing state' });
      return;
    }

    const playerColor = colorOf(room, player_id);
    if (!playerColor) {
      res.status(403).json({ error: 'You are not a player in this room' });
      return;
    }
    const fenTurn = room.fen.split(' ')[1];
    const expectedColor = fenTurn === 'w' ? 'white' : 'black';
    if (playerColor !== expectedColor) {
      res.status(403).json({ error: 'Not your turn' });
      return;
    }

    const now = Date.now();
    const lastUpdate = new Date(room.timer_last_updated_at || room.last_move_at).getTime();
    const elapsedSec = Math.max(0, Math.floor((now - lastUpdate) / 1000));

    let wTime = room.white_time_left;
    let bTime = room.black_time_left;
    let status: 'waiting' | 'playing' | 'finished' = clientStatus || room.status;
    let winner = clientWinner !== undefined ? clientWinner : room.winner;

    if (room.time_control > 0) {
      if (playerColor === 'white') {
        wTime = Math.max(0, wTime - elapsedSec);
        if (wTime === 0) { status = 'finished'; winner = 'black'; }
      } else {
        bTime = Math.max(0, bTime - elapsedSec);
        if (bTime === 0) { status = 'finished'; winner = 'white'; }
      }
    }

    const newMoves = [...(room.pgn_moves || []), san];
    const nowIso = new Date().toISOString();

    await updateRoom(id, {
      fen,
      pgn_moves: newMoves,
      last_move_at: nowIso,
      timer_last_updated_at: nowIso,
      white_time_left: wTime,
      black_time_left: bTime,
      status,
      winner,
      draw_offered_by: null,
    });

    res.json({ ok: true, pgn_moves: newMoves, white_time_left: wTime, black_time_left: bTime });
  } catch (err: unknown) {
    console.error('PATCH /rooms/:id/move error:', err);
    res.status(500).json({ error: 'Failed to push move' });
  }
});

// ── POST /api/rooms/:id/chat — push a chat message ───────────────────────────
router.post('/:id/chat', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sender, color, text, type } = req.body as {
      sender?: string;
      color?: string;
      text?: string;
      type?: 'chat' | 'event';
    };

    if (!text?.trim()) {
      res.status(400).json({ error: 'text is required' });
      return;
    }

    const room = await getRoomById(id);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const msg: ChatMessageRecord = {
      id: uuidv4(),
      type: type || 'chat',
      sender: sender || 'Player',
      color: color || 'white',
      text: text.trim().slice(0, 200),
      ts: Date.now(),
    };

    const updatedMessages = [...(room.chat_messages || []), msg];
    await updateRoom(id, { chat_messages: updatedMessages });

    res.status(201).json(msg);
  } catch (err: unknown) {
    console.error('POST /rooms/:id/chat error:', err);
    res.status(500).json({ error: 'Failed to send chat message' });
  }
});

// ── PATCH /api/rooms/:id/resign — a player resigns ───────────────────────────
router.patch('/:id/resign', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { player_id } = req.body as { player_id?: string };
    if (!player_id) {
      res.status(400).json({ error: 'player_id is required' });
      return;
    }

    const room = await getRoomById(id);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const playerColor = colorOf(room, player_id);
    if (!playerColor) {
      res.status(403).json({ error: 'You are not a player in this room' });
      return;
    }

    const winner = playerColor === 'white' ? 'black' : 'white';
    await updateRoom(id, { status: 'finished', winner });

    res.json({ ok: true, winner });
  } catch (err: unknown) {
    console.error('PATCH /rooms/:id/resign error:', err);
    res.status(500).json({ error: 'Failed to resign' });
  }
});

// ── PATCH /api/rooms/:id/draw — offer / accept / decline draw ────────────────
router.patch('/:id/draw', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { player_id, action } = req.body as {
      player_id?: string;
      action?: 'offer' | 'accept' | 'decline';
    };

    if (!player_id || !action) {
      res.status(400).json({ error: 'player_id and action are required' });
      return;
    }

    const room = await getRoomById(id);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const playerColor = colorOf(room, player_id);
    if (!playerColor) {
      res.status(403).json({ error: 'You are not a player in this room' });
      return;
    }

    if (action === 'offer') {
      await updateRoom(id, { draw_offered_by: playerColor });
      res.json({ ok: true, draw_offered_by: playerColor });
    } else if (action === 'accept') {
      await updateRoom(id, { status: 'finished', winner: 'draw', draw_offered_by: null });
      res.json({ ok: true, winner: 'draw' });
    } else if (action === 'decline') {
      await updateRoom(id, { draw_offered_by: null });
      res.json({ ok: true, draw_offered_by: null });
    } else {
      res.status(400).json({ error: 'action must be offer, accept, or decline' });
    }
  } catch (err: unknown) {
    console.error('PATCH /rooms/:id/draw error:', err);
    res.status(500).json({ error: 'Failed to process draw action' });
  }
});

// ── PATCH /api/rooms/:id/rematch-request — interactive rematch offer/accept ──
router.patch('/:id/rematch-request', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { player_id, action } = req.body as {
      player_id?: string;
      action?: 'offer' | 'accept' | 'decline';
    };

    if (!player_id || !action) {
      res.status(400).json({ error: 'player_id and action are required' });
      return;
    }

    const room = await getRoomById(id);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const playerColor = colorOf(room, player_id);
    if (!playerColor) {
      res.status(403).json({ error: 'You are not a player in this room' });
      return;
    }

    if (action === 'offer') {
      await updateRoom(id, { rematch_requested_by: playerColor });
      res.json({ ok: true, rematch_requested_by: playerColor });
    } else if (action === 'decline') {
      await updateRoom(id, { rematch_requested_by: null });
      res.json({ ok: true, rematch_requested_by: null });
    } else if (action === 'accept') {
      const initialSeconds = room.time_control > 0 ? room.time_control * 60 : 0;
      const now = new Date().toISOString();

      await updateRoom(id, {
        fen: STARTING_FEN,
        pgn_moves: [],
        status: 'playing',
        winner: null,
        draw_offered_by: null,
        rematch_requested_by: null,
        white_time_left: initialSeconds,
        black_time_left: initialSeconds,
        timer_last_updated_at: now,
        last_move_at: now,
        white_player_id: room.black_player_id,
        white_player_name: room.black_player_name,
        black_player_id: room.white_player_id,
        black_player_name: room.white_player_name,
      });
      res.json({ ok: true });
    }
  } catch (err: unknown) {
    console.error('PATCH /rooms/:id/rematch-request error:', err);
    res.status(500).json({ error: 'Failed to process rematch request' });
  }
});

// Legacy direct rematch endpoint for backward compatibility
router.patch('/:id/rematch', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { player_id } = req.body as { player_id?: string };
    if (!player_id) {
      res.status(400).json({ error: 'player_id is required' });
      return;
    }

    const room = await getRoomById(id);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const initialSeconds = room.time_control > 0 ? room.time_control * 60 : 0;
    const now = new Date().toISOString();

    await updateRoom(id, {
      fen: STARTING_FEN,
      pgn_moves: [],
      status: 'playing',
      winner: null,
      draw_offered_by: null,
      rematch_requested_by: null,
      white_time_left: initialSeconds,
      black_time_left: initialSeconds,
      timer_last_updated_at: now,
      last_move_at: now,
      white_player_id: room.black_player_id,
      white_player_name: room.black_player_name,
      black_player_id: room.white_player_id,
      black_player_name: room.white_player_name,
    });

    res.json({ ok: true });
  } catch (err: unknown) {
    console.error('PATCH /rooms/:id/rematch error:', err);
    res.status(500).json({ error: 'Failed to start rematch' });
  }
});

export default router;
