import { PIECE_SYMBOLS, PIECE_VALUES } from '../lib/scoring';

interface CapturedPiecesProps {
  /** Pieces captured by this player (opponent's pieces they took) */
  captured: string[];
  /** Net score advantage for display (positive = this player leads) */
  advantage: number;
  /** Color identity of the player displaying this bar */
  color: 'white' | 'black';
}

/**
 * Renders a compact chess.com-style captured piece tray with score advantage.
 */
export default function CapturedPieces({ captured, advantage, color }: CapturedPiecesProps) {
  if (captured.length === 0 && advantage <= 0) return null;

  // Group by piece type, sort by value desc
  const groups: Record<string, number> = {};
  for (const p of captured) {
    groups[p] = (groups[p] || 0) + 1;
  }

  const sortedTypes = Object.keys(groups).sort(
    (a, b) => (PIECE_VALUES[b] || 0) - (PIECE_VALUES[a] || 0)
  );

  // For white player: they captured black pieces → show black piece symbols
  // For black player: they captured white pieces → show white piece symbols
  const symbolSet = color === 'white' ? 'black' : 'white';

  return (
    <div className="captured-pieces-row">
      <div className="captured-icons">
        {sortedTypes.map((type) => (
          <span key={type} className="captured-group">
            {Array.from({ length: groups[type] }).map((_, i) => (
              <span key={i} className="captured-icon">
                {PIECE_SYMBOLS[type]?.[symbolSet] || ''}
              </span>
            ))}
          </span>
        ))}
      </div>
      {advantage > 0 && (
        <span className="captured-score">+{advantage}</span>
      )}
    </div>
  );
}
