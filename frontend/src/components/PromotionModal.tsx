interface PromotionModalProps {
  color: 'w' | 'b';
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
}

const PIECES: { type: 'q' | 'r' | 'b' | 'n'; label: string; whiteEmoji: string; blackEmoji: string }[] = [
  { type: 'q', label: 'Queen', whiteEmoji: '♕', blackEmoji: '♛' },
  { type: 'r', label: 'Rook', whiteEmoji: '♖', blackEmoji: '♜' },
  { type: 'b', label: 'Bishop', whiteEmoji: '♗', blackEmoji: '♝' },
  { type: 'n', label: 'Knight', whiteEmoji: '♘', blackEmoji: '♞' },
];

export default function PromotionModal({ color, onSelect, onCancel }: PromotionModalProps) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-box glass">
        <div className="modal-icon">♟</div>
        <div className="modal-title">Promote Pawn</div>
        <div className="modal-subtitle">Choose a piece to promote to</div>
        <div className="promo-grid">
          {PIECES.map(({ type, label, whiteEmoji, blackEmoji }) => (
            <button
              key={type}
              id={`promote-${type}`}
              className="promo-btn"
              onClick={() => onSelect(type)}
            >
              {color === 'w' ? whiteEmoji : blackEmoji}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
