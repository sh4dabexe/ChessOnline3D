import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';

interface ChessClockProps {
  color: 'white' | 'black';
  isTurn: boolean;
}

export default function ChessClock({ color, isTurn }: ChessClockProps) {
  const {
    timeControl,
    whiteTimeLeft,
    blackTimeLeft,
    status,
    timerLastUpdatedAt,
  } = useGameStore();

  const initialSec = color === 'white' ? whiteTimeLeft : blackTimeLeft;
  const [displaySeconds, setDisplaySeconds] = useState(initialSec);

  // Local live countdown ticker during active turn
  useEffect(() => {
    if (timeControl === 0 || status !== 'playing' || !isTurn) {
      setDisplaySeconds(initialSec);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - timerLastUpdatedAt) / 1000;
      const current = Math.max(0, initialSec - elapsed);
      setDisplaySeconds(current);
    }, 100);

    return () => clearInterval(interval);
  }, [timeControl, status, isTurn, initialSec, timerLastUpdatedAt]);

  if (timeControl === 0) {
    return <div className="clock-badge unlimited">♾️ Unlimited</div>;
  }

  const formatTime = (totalSec: number) => {
    if (totalSec <= 0) return '0:00';
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    const tenths = Math.floor((totalSec % 1) * 10);

    if (totalSec < 10 && isTurn) {
      // Show tenths of a second when < 10s on active turn like Chess.com
      return `${secs}.${tenths}`;
    }

    const secStr = secs < 10 ? `0${secs}` : `${secs}`;
    return `${mins}:${secStr}`;
  };

  const isLowTime = displaySeconds < 30 && status === 'playing';
  const isTimeOut = displaySeconds <= 0 && status === 'playing';

  return (
    <div
      className={`clock-badge ${color} ${isTurn ? 'active' : ''} ${
        isLowTime ? 'low-time' : ''
      } ${isTimeOut ? 'timeout' : ''}`}
    >
      <span className="clock-icon">⏱️</span>
      <span className="clock-time">{formatTime(displaySeconds)}</span>
    </div>
  );
}
