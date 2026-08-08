import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useGameStore } from '../store/gameStore';

const TIME_OPTIONS = [
  { value: 1, label: '⚡ 1 min' },
  { value: 3, label: '⚡ 3 min' },
  { value: 5, label: '⌛ 5 min' },
  { value: 10, label: '🎯 10 min' },
  { value: 15, label: '⏳ 15 min' },
  { value: 30, label: '⏳ 30 min' },
  { value: 0, label: '♾️ Unlimited' },
];

const COLOR_OPTIONS: { value: 'white' | 'black' | 'random'; label: string }[] = [
  { value: 'white', label: '♔ White' },
  { value: 'black', label: '♛ Gold' },
  { value: 'random', label: '🎲 Random' },
];

export default function Lobby() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setSession = useGameStore((s) => s.setSession);

  const [createName, setCreateName] = useState('');
  const [timeControl, setTimeControl] = useState(10);
  const [preferredColor, setPreferredColor] = useState<'white' | 'black' | 'random'>('white');
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);

  // Prefill join code from URL query param (?code=HJ92KF) or hash
  useEffect(() => {
    const codeFromQuery = searchParams.get('code') || searchParams.get('join');
    if (codeFromQuery) setJoinCode(codeFromQuery.toUpperCase());
  }, [searchParams]);

  // ── Create room ──────────────────────────────────────────────────────────
  const handleCreateRoom = async () => {
    if (!createName.trim()) return toast.error('Please enter your name');
    setCreatingRoom(true);
    try {
      const res = await api.createRoom(createName.trim(), timeControl, preferredColor);
      setSession({
        roomId: res.id,
        roomCode: res.room_code,
        myPlayerId: res.player_id,
        myColor: res.color,
        myName: createName.trim(),
        opponentName: '',
        fen: res.fen,
        status: 'waiting',
        pgnMoves: [],
        timeControl: res.time_control,
        whiteTimeLeft: res.white_time_left,
        blackTimeLeft: res.black_time_left,
      });
      sessionStorage.setItem('chess3d_session', JSON.stringify({
        roomId: res.id,
        roomCode: res.room_code,
        myPlayerId: res.player_id,
        myColor: res.color,
        myName: createName.trim(),
      }));
      navigate(`/room/${res.room_code}`);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to create room');
    } finally {
      setCreatingRoom(false);
    }
  };

  // ── Join room ─────────────────────────────────────────────────────────────
  const handleJoinRoom = async () => {
    if (!joinName.trim()) return toast.error('Please enter your name');
    if (!joinCode.trim()) return toast.error('Please enter a room code');
    setJoiningRoom(true);
    try {
      const room = await api.getRoom(joinCode.trim().toUpperCase());
      if (room.status === 'finished') {
        toast.error('This game has already ended');
        return;
      }
      if (room.status === 'playing' && room.black_player_id && room.white_player_id) {
        toast('Joining as spectator', { icon: '👁️' });
        setSession({
          roomId: room.id,
          roomCode: room.room_code,
          myPlayerId: 'spectator_' + Date.now(),
          myColor: 'spectator',
          myName: joinName.trim(),
          opponentName: '',
          fen: room.fen,
          status: 'playing',
          pgnMoves: room.pgn_moves,
          timeControl: room.time_control,
          whiteTimeLeft: room.white_time_left,
          blackTimeLeft: room.black_time_left,
          timerLastUpdatedAt: room.timer_last_updated_at,
        });
        navigate(`/room/${room.room_code}`);
        return;
      }

      const res = await api.joinRoom(room.id, joinName.trim());
      const oppName = res.color === 'black' ? room.white_player_name : room.black_player_name;
      setSession({
        roomId: room.id,
        roomCode: room.room_code,
        myPlayerId: res.player_id,
        myColor: res.color,
        myName: joinName.trim(),
        opponentName: oppName || 'Opponent',
        fen: room.fen,
        status: 'playing',
        pgnMoves: room.pgn_moves,
        timeControl: room.time_control,
        whiteTimeLeft: room.white_time_left,
        blackTimeLeft: room.black_time_left,
        timerLastUpdatedAt: room.timer_last_updated_at,
      });
      sessionStorage.setItem('chess3d_session', JSON.stringify({
        roomId: room.id,
        roomCode: room.room_code,
        myPlayerId: res.player_id,
        myColor: res.color,
        myName: joinName.trim(),
      }));
      navigate(`/room/${room.room_code}`);
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg === 'Room not found') toast.error('Room not found — check the code');
      else if (msg.includes('full')) toast.error('Room is full');
      else toast.error(msg || 'Failed to join room');
    } finally {
      setJoiningRoom(false);
    }
  };

  return (
    <div className="lobby-page">
      {/* Header */}
      <div className="lobby-header">
        <h1 className="lobby-title">♟ Chess 3D</h1>
        <p className="lobby-subtitle">HD realtime multiplayer chess — invite a friend, play anywhere</p>
      </div>

      {/* Cards */}
      <div className="lobby-cards">
        {/* Create Room */}
        <div className="glass lobby-card">
          <h2>♔ Create Room</h2>
          <div className="form-group">
            <label>Your Name</label>
            <input
              id="create-name"
              type="text"
              placeholder="e.g. Magnus"
              maxLength={50}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
            />
          </div>

          {/* Color Selector */}
          <div className="form-group">
            <label>Play As</label>
            <div className="time-control-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`time-pill ${preferredColor === opt.value ? 'selected' : ''}`}
                  onClick={() => setPreferredColor(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Control Selector */}
          <div className="form-group">
            <label>Time Control (per player)</label>
            <div className="time-control-grid">
              {TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`time-pill ${timeControl === opt.value ? 'selected' : ''}`}
                  onClick={() => setTimeControl(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn-primary"
            onClick={handleCreateRoom}
            disabled={creatingRoom || !createName.trim()}
          >
            {creatingRoom ? '⏳ Creating...' : '🏠 Create Room'}
          </button>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Share the room code with a friend to invite them.
          </p>
        </div>

        {/* Join Room */}
        <div className="glass lobby-card">
          <h2>♛ Join Room</h2>
          <div className="form-group">
            <label>Your Name</label>
            <input
              id="join-name"
              type="text"
              placeholder="e.g. Hikaru"
              maxLength={50}
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
            />
          </div>
          <div className="form-group">
            <label>Room Code</label>
            <input
              id="join-code"
              type="text"
              placeholder="e.g. HJ92KF"
              maxLength={6}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              style={{ letterSpacing: '0.12em', fontWeight: 600 }}
            />
          </div>
          <button
            className="btn-primary"
            onClick={handleJoinRoom}
            disabled={joiningRoom || !joinName.trim() || !joinCode.trim()}
          >
            {joiningRoom ? '⏳ Joining...' : '🚀 Join Game'}
          </button>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', opacity: 0.6 }}>
        ♟ Full FIDE rules · Choice of Color · Live Clocks · HD 3D Board · Realtime Sync · In-Game Chat
      </p>
    </div>
  );
}
