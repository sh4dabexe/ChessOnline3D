import { useMemo } from 'react';
import { Chess } from 'chess.js';
import { useGameStore } from '../store/gameStore';
import ChessClock from './ChessClock';
import CapturedPieces from './CapturedPieces';
import { computeCaptures } from '../lib/scoring';
import toast from 'react-hot-toast';

interface SidebarProps {
  onResign: () => void;
  onOfferDraw: () => void;
  isMyTurn: boolean;
  drawOfferedBy: string | null;
  onAcceptDraw: () => void;
  onDeclineDraw: () => void;
  currentTurn: 'white' | 'black';
}

export default function Sidebar({
  onResign,
  onOfferDraw,
  isMyTurn,
  drawOfferedBy,
  onAcceptDraw,
  onDeclineDraw,
  currentTurn,
}: SidebarProps) {
  const {
    roomCode, myColor, myName, opponentName,
    status, pgnMoves, fen,
  } = useGameStore();

  // Build move pairs for the PGN display
  const movePairs: { num: number; white?: string; black?: string }[] = [];
  pgnMoves.forEach((san, i) => {
    const idx = Math.floor(i / 2);
    if (!movePairs[idx]) movePairs[idx] = { num: idx + 1 };
    if (i % 2 === 0) movePairs[idx].white = san;
    else movePairs[idx].black = san;
  });

  const isBlackTurn = status === 'playing' && currentTurn === 'black';
  const isWhiteTurn = status === 'playing' && currentTurn === 'white';

  const copyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      toast.success('Room code copied!');
    }
  };

  // ── Compute captures & scores from current game history ──────────────────
  const captures = useMemo(() => {
    try {
      const c = new Chess();
      // Replay all PGN moves to get full verbose history
      for (const san of pgnMoves) {
        c.move(san);
      }
      return computeCaptures(c.history({ verbose: true }));
    } catch {
      return { whiteCaptured: [], blackCaptured: [], whiteScore: 0, blackScore: 0, scoreAdvantage: 0 };
    }
  }, [pgnMoves]);

  const whiteAdvantage = Math.max(0, captures.scoreAdvantage);
  const blackAdvantage = Math.max(0, -captures.scoreAdvantage);

  return (
    <div className="sidebar">
      {/* Top Room Header */}
      <div className="sidebar-room-header">
        <div className="sidebar-room-info">
          <span className="room-label">ROOM CODE</span>
          <span className="room-code-val">{roomCode || '------'}</span>
        </div>
        <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={copyCode} title="Copy Room Code">
          📋 Copy
        </button>
      </div>

      <div className="sidebar-divider" style={{ margin: '8px 0 14px' }} />

      {/* Players Header with Live Clocks */}
      <div className="sidebar-players">
        {/* Gold (Black) Player */}
        <div className={`player-card ${isBlackTurn ? 'active-turn' : ''}`}>
          <div className="player-avatar black">♛</div>
          <div className="player-info">
            <div className="player-name">{myColor === 'black' ? myName : opponentName || 'Waiting...'}</div>
            <div className="player-label">Gold</div>
          </div>
          <ChessClock color="black" isTurn={isBlackTurn} />
        </div>
        {/* Gold captured pieces tray */}
        <CapturedPieces
          captured={captures.blackCaptured}
          advantage={blackAdvantage}
          color="black"
        />

        {/* White Player */}
        <div className={`player-card ${isWhiteTurn ? 'active-turn' : ''}`} style={{ marginTop: 6 }}>
          <div className="player-avatar white">♔</div>
          <div className="player-info">
            <div className="player-name">{myColor === 'white' ? myName : opponentName || 'Waiting...'}</div>
            <div className="player-label">White</div>
          </div>
          <ChessClock color="white" isTurn={isWhiteTurn} />
        </div>
        {/* White captured pieces tray */}
        <CapturedPieces
          captured={captures.whiteCaptured}
          advantage={whiteAdvantage}
          color="white"
        />
      </div>

      <div className="sidebar-divider" />

      {/* Move History */}
      <div className="moves-section">
        <div className="moves-label">Move History</div>
        <div className="moves-grid">
          {movePairs.length === 0 && (
            <span style={{ color: 'var(--text-muted)', fontSize: 12, gridColumn: '1/-1' }}>No moves yet</span>
          )}
          {movePairs.map((pair) => (
            <div key={`pair-${pair.num}`} style={{ display: 'contents' }}>
              <span className="move-num">{pair.num}.</span>
              <span className="move-san">{pair.white || ''}</span>
              <span className="move-san">{pair.black || ''}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-divider" />

      {/* Draw offer banner */}
      {drawOfferedBy && drawOfferedBy !== myColor && (
        <div style={{ padding: '0 20px', marginBottom: 10 }}>
          <div style={{
            padding: '10px 14px',
            background: 'rgba(201,168,76,0.08)',
            border: '1px solid rgba(201,168,76,0.25)',
            borderRadius: 10,
            fontSize: 13,
            marginBottom: 8,
          }}>
            🤝 Opponent offered a draw
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-success" style={{ flex: 1 }} onClick={onAcceptDraw}>Accept</button>
            <button className="btn-danger" style={{ flex: 1 }} onClick={onDeclineDraw}>Decline</button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {status === 'playing' && myColor !== 'spectator' && (
        <div style={{ padding: '0 20px', marginBottom: 10, display: 'flex', gap: 8 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onOfferDraw} title="Offer a draw">
            🤝 Draw
          </button>
          <button className="btn-danger" style={{ flex: 1 }} onClick={onResign} title="Resign the game">
            🏳️ Resign
          </button>
        </div>
      )}

    </div>
  );
}
