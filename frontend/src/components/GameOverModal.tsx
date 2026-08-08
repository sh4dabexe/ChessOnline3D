import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

export default function GameOverModal() {
  const navigate = useNavigate();
  const {
    winner, myColor, myPlayerId, roomId, status, reset,
    rematchRequestedBy, setRematchRequestedBy,
  } = useGameStore();

  if (status !== 'finished') return null;

  const isWinner = winner === myColor;
  const isDraw = winner === 'draw';

  const emoji = isDraw ? '🤝' : isWinner ? '🏆' : '😔';
  const title = isDraw ? "It's a Draw!" : isWinner ? 'You Win!' : 'You Lose';
  const subtitle =
    isDraw ? 'A hard-fought game. Well played by both sides.'
    : isWinner ? 'Magnificent play. Your opponent has been defeated.'
    : 'A noble effort. Better luck next time!';

  const isMyRequest = rematchRequestedBy === myColor;
  const isOpponentRequest = rematchRequestedBy && rematchRequestedBy !== myColor && rematchRequestedBy !== 'spectator';

  const handleRequestRematch = async () => {
    if (!roomId || !myPlayerId) return;
    try {
      await api.rematchRequest(roomId, myPlayerId, 'offer');
      setRematchRequestedBy(myColor);
      toast('Rematch requested! Waiting for opponent...', { icon: '🔄' });
    } catch (err) {
      toast.error('Could not send rematch request');
    }
  };

  const handleAcceptRematch = async () => {
    if (!roomId || !myPlayerId) return;
    try {
      await api.rematchRequest(roomId, myPlayerId, 'accept');
      toast.success('Rematch accepted! Colors swapped.');
    } catch (err) {
      toast.error('Could not accept rematch');
    }
  };

  const handleDeclineRematch = async () => {
    if (!roomId || !myPlayerId) return;
    try {
      await api.rematchRequest(roomId, myPlayerId, 'decline');
      setRematchRequestedBy(null);
      toast('Rematch declined');
    } catch (err) {
      toast.error('Could not decline rematch');
    }
  };

  const handleLeave = () => {
    reset();
    navigate('/');
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleLeave()}>
      <div className="modal-box glass">
        <div className="modal-icon">{emoji}</div>
        <div className="modal-title">{title}</div>
        <div className="modal-subtitle">{subtitle}</div>

        {/* Rematch request banners */}
        {isOpponentRequest && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(201,168,76,0.12)',
            border: '1px solid rgba(201,168,76,0.35)',
            borderRadius: 10,
            fontSize: 14,
            marginBottom: 20,
          }}>
            🔄 Opponent requested a rematch!
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn-success" style={{ flex: 1 }} onClick={handleAcceptRematch}>
                Accept
              </button>
              <button className="btn-danger" style={{ flex: 1 }} onClick={handleDeclineRematch}>
                Decline
              </button>
            </div>
          </div>
        )}

        {isMyRequest && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 13,
            color: 'var(--text-muted)',
            marginBottom: 20,
          }}>
            ⏳ Waiting for opponent to accept rematch...
          </div>
        )}

        <div className="modal-actions">
          {myColor !== 'spectator' && !isMyRequest && !isOpponentRequest && (
            <button className="btn-primary" onClick={handleRequestRematch}>
              🔄 Rematch
            </button>
          )}
          <button className="btn-ghost" onClick={handleLeave}>
            🏠 Leave
          </button>
        </div>
      </div>
    </div>
  );
}
