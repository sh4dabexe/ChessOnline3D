interface ResignModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ResignModal({ onConfirm, onCancel }: ResignModalProps) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-box glass">
        <div className="modal-icon">🏳️</div>
        <div className="modal-title">Resign Match?</div>
        <div className="modal-subtitle">
          Are you sure you want to forfeit this game? Your opponent will be awarded the victory.
        </div>
        <div className="modal-actions">
          <button className="btn-danger" onClick={onConfirm} style={{ padding: '10px 22px', fontSize: 14 }}>
            Yes, Resign
          </button>
          <button className="btn-ghost" onClick={onCancel} style={{ padding: '10px 22px', fontSize: 14 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
