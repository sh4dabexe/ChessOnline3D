import { useState } from 'react';

interface JoinRoomModalProps {
  roomCode: string;
  creatorName?: string;
  timeControl?: number;
  isFull: boolean;
  onJoin: (name: string) => void;
  loading: boolean;
}

export default function JoinRoomModal({
  roomCode,
  creatorName,
  timeControl,
  isFull,
  onJoin,
  loading,
}: JoinRoomModalProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onJoin(name.trim());
  };

  const tcLabel = timeControl === 0 ? 'Unlimited' : `${timeControl} min`;

  return (
    <div className="modal-overlay">
      <div className="modal-box glass" style={{ maxWidth: 440, padding: '32px 36px' }}>
        <div className="modal-icon" style={{ fontSize: 44, marginBottom: 12 }}>
          {isFull ? '👁️' : '⚔️'}
        </div>

        <div className="modal-title" style={{ fontSize: 24, marginBottom: 4 }}>
          {isFull ? 'Watch Match' : 'Join Chess Game'}
        </div>

        <div className="modal-subtitle" style={{ fontSize: 13, marginBottom: 20 }}>
          {creatorName ? (
            <>
              Room <strong style={{ color: 'var(--gold)' }}>{roomCode}</strong> created by{' '}
              <strong style={{ color: '#fff' }}>{creatorName}</strong> ({tcLabel})
            </>
          ) : (
            <>
              Entering room <strong style={{ color: 'var(--gold)' }}>{roomCode}</strong>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              YOUR NAME
            </label>
            <input
              type="text"
              placeholder="Enter your display name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoFocus
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border)',
                color: '#fff',
                fontSize: 15,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={!name.trim() || loading}
            style={{
              width: '100%',
              padding: '13px',
              fontSize: 15,
              fontWeight: 700,
              borderRadius: 10,
              marginTop: 4,
            }}
          >
            {loading ? 'Joining…' : isFull ? '👁️ Spectate Game' : '⚔️ Join Game'}
          </button>
        </form>
      </div>
    </div>
  );
}
