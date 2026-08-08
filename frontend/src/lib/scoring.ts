/**
 * Chess piece point values (standard international scoring)
 */
export const PIECE_VALUES: Record<string, number> = {
  p: 1,  // Pawn
  n: 3,  // Knight
  b: 3,  // Bishop
  r: 5,  // Rook
  q: 9,  // Queen
  k: 0,  // King (never actually captured)
};

/** Unicode symbols for captured pieces (white = uppercase, black = lowercase) */
export const PIECE_SYMBOLS: Record<string, { white: string; black: string }> = {
  p: { white: '♙', black: '♟' },
  n: { white: '♘', black: '♞' },
  b: { white: '♗', black: '♝' },
  r: { white: '♖', black: '♜' },
  q: { white: '♕', black: '♛' },
};

export interface CaptureState {
  whiteCaptured: string[];   // pieces captured BY white (i.e. black pieces lost), e.g. ['p','p','r']
  blackCaptured: string[];   // pieces captured BY black (i.e. white pieces lost)
  whiteScore: number;
  blackScore: number;
  scoreAdvantage: number;    // positive = white leads, negative = black leads
}

/**
 * Derives captured pieces and scores from verbose chess.js history
 */
export function computeCaptures(history: { captured?: string; color: string }[]): CaptureState {
  const whiteCaptured: string[] = []; // black pieces taken by white
  const blackCaptured: string[] = []; // white pieces taken by black

  for (const move of history) {
    if (move.captured) {
      if (move.color === 'w') {
        whiteCaptured.push(move.captured);
      } else {
        blackCaptured.push(move.captured);
      }
    }
  }

  const whiteScore = whiteCaptured.reduce((s, p) => s + (PIECE_VALUES[p] || 0), 0);
  const blackScore = blackCaptured.reduce((s, p) => s + (PIECE_VALUES[p] || 0), 0);

  return {
    whiteCaptured,
    blackCaptured,
    whiteScore,
    blackScore,
    scoreAdvantage: whiteScore - blackScore,
  };
}
