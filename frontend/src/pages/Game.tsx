import { useEffect, useCallback, useRef, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Chess } from 'chess.js';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { sound } from '../lib/sound';
import { useGameStore } from '../store/gameStore';
import type { ChatMessage } from '../types';

import { Board, MoveHints } from '../components/Board3D';
import { ChessPiece3D } from '../components/ChessPiece3D';
import Sidebar from '../components/Sidebar';
import FloatingChat from '../components/ChatPanel';
import GameOverModal from '../components/GameOverModal';
import PromotionModal from '../components/PromotionModal';
import ResignModal from '../components/ResignModal';
import JoinRoomModal from '../components/JoinRoomModal';

// ── Coordinate helper ─────────────────────────────────────────────────────────
function isPawnPromotion(chess: Chess, from: string, to: string): boolean {
  const piece = chess.get(from as `${'a'|'b'|'c'|'d'|'e'|'f'|'g'|'h'}${'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'}`);
  if (!piece || piece.type !== 'p') return false;
  const toRank = parseInt(to[1]);
  return (piece.color === 'w' && toRank === 8) || (piece.color === 'b' && toRank === 1);
}

// ── Game Page ─────────────────────────────────────────────────────────────────
export default function Game() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [showResignModal, setShowResignModal] = useState(false);
  const [joinRoomData, setJoinRoomData] = useState<{
    room: Awaited<ReturnType<typeof api.getRoom>>;
    loading: boolean;
  } | null>(null);

  const {
    roomId, roomCode, myPlayerId, myColor, myName,
    fen, status, drawOfferedBy, pgnMoves,
    selectedSquare, legalMoves, pendingPromotion,
    setSession, setFen, setStatus, setWinner,
    setDrawOfferedBy, setPgnMoves, setOpponentName,
    selectSquare, setPendingPromotion, addMessage, reset,
  } = useGameStore();

  // ── chess.js instance ─────────────────────────────────────────────────────
  const chess = useMemo(() => new Chess(fen), [fen]);

  // ── Restore session on page refresh or join via link ─────────────────────
  useEffect(() => {
    if (roomId || !code) return;
    const cleanCode = code.toUpperCase();
    const saved = sessionStorage.getItem('chess3d_session');

    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.roomCode?.toUpperCase() === cleanCode) {
          api.getRoom(cleanCode).then((room) => {
            setSession({
              roomId: room.id,
              roomCode: room.room_code,
              myPlayerId: s.myPlayerId,
              myColor: s.myColor,
              myName: s.myName,
              opponentName:
                s.myColor === 'white'
                  ? room.black_player_name || ''
                  : room.white_player_name || '',
              fen: room.fen,
              status: room.status === 'waiting' ? 'waiting' : room.status === 'finished' ? 'finished' : 'playing',
              pgnMoves: room.pgn_moves,
              timeControl: room.time_control,
              whiteTimeLeft: room.white_time_left,
              blackTimeLeft: room.black_time_left,
              timerLastUpdatedAt: room.timer_last_updated_at,
            });
            if (room.winner) setWinner(room.winner as 'white' | 'black' | 'draw');
            if (room.draw_offered_by) setDrawOfferedBy(room.draw_offered_by as 'white' | 'black');
          }).catch(() => {
            toast.error('Room not found');
            navigate('/');
          });
          return;
        }
      } catch {
        // Invalid session JSON, fallback to link join
      }
    }

    // No matching session saved — fetch room to show Join Modal
    api.getRoom(cleanCode).then((room) => {
      if (room.status === 'finished') {
        toast.error('This game has already ended');
        navigate('/');
        return;
      }
      setJoinRoomData({ room, loading: false });
    }).catch(() => {
      toast.error('Room not found — check your link');
      navigate('/');
    });
  }, [code, roomId]);

  // ── Handle direct room join from shared link ────────────────────────────
  const handleDirectJoin = async (joinName: string) => {
    if (!joinRoomData || !code) return;
    setJoinRoomData((prev) => (prev ? { ...prev, loading: true } : null));
    const room = joinRoomData.room;

    try {
      const isFull = !!(room.black_player_id && room.white_player_id);
      if (isFull) {
        toast('Joining as spectator', { icon: '👁️' });
        const sess = {
          roomId: room.id,
          roomCode: room.room_code,
          myPlayerId: 'spectator_' + Date.now(),
          myColor: 'spectator' as const,
          myName: joinName,
          opponentName: '',
          fen: room.fen,
          status: room.status === 'waiting' ? ('waiting' as const) : ('playing' as const),
          pgnMoves: room.pgn_moves,
          timeControl: room.time_control,
          whiteTimeLeft: room.white_time_left,
          blackTimeLeft: room.black_time_left,
          timerLastUpdatedAt: room.timer_last_updated_at,
        };
        setSession(sess);
        sessionStorage.setItem(
          'chess3d_session',
          JSON.stringify({
            roomId: room.id,
            roomCode: room.room_code,
            myPlayerId: sess.myPlayerId,
            myColor: sess.myColor,
            myName: sess.myName,
          })
        );
        setJoinRoomData(null);
        return;
      }

      const res = await api.joinRoom(room.id, joinName);
      const oppName = res.color === 'black' ? room.white_player_name : room.black_player_name;
      const sess = {
        roomId: room.id,
        roomCode: room.room_code,
        myPlayerId: res.player_id,
        myColor: res.color,
        myName: joinName,
        opponentName: oppName || 'Opponent',
        fen: room.fen,
        status: 'playing' as const,
        pgnMoves: room.pgn_moves,
        timeControl: room.time_control,
        whiteTimeLeft: room.white_time_left,
        blackTimeLeft: room.black_time_left,
        timerLastUpdatedAt: room.timer_last_updated_at,
      };
      setSession(sess);
      sessionStorage.setItem(
        'chess3d_session',
        JSON.stringify({
          roomId: room.id,
          roomCode: room.room_code,
          myPlayerId: res.player_id,
          myColor: res.color,
          myName: joinName,
        })
      );
      setJoinRoomData(null);
      toast.success('Joined room!');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to join room');
      setJoinRoomData((prev) => (prev ? { ...prev, loading: false } : null));
    }
  };

  // ── Supabase Realtime subscription ────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !roomCode) return;

    const channel = supabase.channel(`game:${roomCode}`, {
      config: { broadcast: { self: false } },
    });

    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      (payload) => {
        const r = payload.new as {
          fen: string; status: string; winner: string;
          draw_offered_by: string; pgn_moves: string[];
          white_player_name: string; black_player_name: string;
        };
        setFen(r.fen);
        setPgnMoves(r.pgn_moves || []);
        if (r.status === 'finished') {
          setStatus('finished');
          setWinner(r.winner as 'white' | 'black' | 'draw');
        } else if (r.status === 'playing') {
          setStatus('playing');
        }
        setDrawOfferedBy(r.draw_offered_by as 'white' | 'black' | null);
        const oppName =
          myColor === 'white' ? r.black_player_name : r.white_player_name;
        if (oppName) setOpponentName(oppName);
      }
    );

    channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
      addMessage(payload as ChatMessage);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roomId, roomCode]);

  // ── Polling fallback to ensure instant room updates (opponent join, move sync, clocks, chat) ──
  useEffect(() => {
    if (!code || !roomId) return;

    const interval = setInterval(async () => {
      try {
        const room = await api.getRoom(code);

        if (room.status === 'playing' && (status === 'waiting' || status === 'finished')) {
          setStatus('playing');
          setWinner(null);
          useGameStore.getState().setRematchRequestedBy(null);

          const currentMyColor =
            room.white_player_id === myPlayerId ? 'white' :
            room.black_player_id === myPlayerId ? 'black' : 'spectator';

          const currentMyName = currentMyColor === 'white' ? room.white_player_name : room.black_player_name;
          const currentOppName = currentMyColor === 'white' ? room.black_player_name : room.white_player_name;

          useGameStore.setState({
            myColor: currentMyColor,
            myName: currentMyName || useGameStore.getState().myName,
            opponentName: currentOppName || 'Opponent',
          });

          if (status === 'finished') {
            toast.success('Rematch started! Colors swapped.');
          } else {
            toast.success('Opponent joined! Game started.');
          }
          sound.playMove();
        }
        if (room.status === 'finished' && status !== 'finished') {
          setStatus('finished');
          if (room.winner) {
            setWinner(room.winner as 'white' | 'black' | 'draw');
            if (room.winner === myColor) sound.playVictory();
            else sound.playDefeat();
          }
        }

        const oppName = myColor === 'white' ? room.black_player_name : room.white_player_name;
        if (oppName) setOpponentName(oppName);

        if (room.fen && room.fen !== fen) {
          // Opponent moved
          setFen(room.fen);
          sound.playMove();
        }
        if (room.pgn_moves && room.pgn_moves.length !== pgnMoves.length) {
          setPgnMoves(room.pgn_moves);
        }
        if (room.draw_offered_by !== drawOfferedBy) {
          setDrawOfferedBy(room.draw_offered_by as 'white' | 'black' | null);
        }
        if (room.rematch_requested_by !== useGameStore.getState().rematchRequestedBy) {
          useGameStore.getState().setRematchRequestedBy((room.rematch_requested_by as 'white' | 'black' | null) || null);
        }

        if (typeof room.white_time_left === 'number' && typeof room.black_time_left === 'number') {
          useGameStore.getState().setClocks(
            room.white_time_left,
            room.black_time_left,
            room.timer_last_updated_at
          );
        }

        if (room.chat_messages && Array.isArray(room.chat_messages)) {
          room.chat_messages.forEach((msg) => addMessage(msg as ChatMessage));
        }
      } catch (e) {
        // ignore
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [code, roomId, status, fen, pgnMoves.length, drawOfferedBy, myColor]);

  // ── Square / piece click handler ─────────────────────────────────────────
  const handleSquareClick = useCallback((sq: string) => {
    if (status !== 'playing' || myColor === 'spectator') return;
    const isMyTurn = chess.turn() === (myColor === 'white' ? 'w' : 'b');

    if (!isMyTurn && !selectedSquare) return;

    const piece = chess.get(sq as `${'a'|'b'|'c'|'d'|'e'|'f'|'g'|'h'}${'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'}`);

    if (piece && piece.color === chess.turn() && isMyTurn) {
      const moves = chess.moves({ square: sq as `${'a'|'b'|'c'|'d'|'e'|'f'|'g'|'h'}${'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'}`, verbose: true });
      const dests = moves.map((m) => m.to);
      selectSquare(sq, dests);
      return;
    }

    if (selectedSquare && legalMoves.includes(sq)) {
      if (isPawnPromotion(chess, selectedSquare, sq)) {
        setPendingPromotion({ from: selectedSquare, to: sq });
        return;
      }
      executeMove(selectedSquare, sq);
      return;
    }

    selectSquare(null);
  }, [chess, status, myColor, selectedSquare, legalMoves]);

  const executeMove = async (from: string, to: string, promotion?: string) => {
    if (!roomId || !myPlayerId) return;

    const moveArgs: { from: string; to: string; promotion?: string } = { from, to };
    if (promotion) moveArgs.promotion = promotion;

    const result = chess.move(moveArgs);
    if (!result) { toast.error('Invalid move'); return; }

    // Play Sound Effect
    if (result.captured) {
      sound.playCapture();
    } else {
      sound.playMove();
    }

    const newFen = chess.fen();
    const san = result.san;
    selectSquare(null);

    try {
      await api.pushMove(roomId, myPlayerId, newFen, san);
      setFen(newFen);
      setPgnMoves([...pgnMoves, san]);

      addMessage({
        id: uuidv4(),
        type: 'event',
        text: `${myColor === 'white' ? '⬜' : '⬛'} ${myName} played ${san}`,
        ts: Date.now(),
      });

      if (chess.isCheckmate()) {
        sound.playVictory();
        toast.success('Checkmate!');
      } else if (chess.isCheck()) {
        sound.playCheck();
        toast('Check! ♟', { icon: '⚠️' });
      } else if (chess.isStalemate()) {
        toast('Stalemate — it\'s a draw!');
      } else if (chess.isDraw()) {
        toast('Draw by repetition or 50-move rule');
      }
    } catch (err) {
      toast.error((err as Error).message || 'Move failed');
      chess.undo();
    }
  };

  const handlePromotionSelect = (piece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    setPendingPromotion(null);
    executeMove(pendingPromotion.from, pendingPromotion.to, piece);
  };

  // ── Chat send ─────────────────────────────────────────────────────────────
  const handleSendChat = useCallback(async (text: string) => {
    const color = myColor === 'spectator' ? 'white' : myColor;
    const msg: ChatMessage = {
      id: uuidv4(),
      type: 'chat',
      sender: myName,
      color,
      text,
      ts: Date.now(),
    };
    channelRef.current?.send({
      type: 'broadcast',
      event: 'chat',
      payload: msg,
    });
    addMessage(msg);

    if (roomId) {
      try {
        await api.sendChat(roomId, myName, color, text, 'chat');
      } catch (e) {
        // ignore
      }
    }
  }, [myName, myColor, roomId]);

  // ── Game action handlers ───────────────────────────────────────────────────
  const handleConfirmResign = async () => {
    setShowResignModal(false);
    if (!roomId || !myPlayerId) return;
    try {
      const res = await api.resign(roomId, myPlayerId);
      setStatus('finished');
      setWinner(res.winner as 'white' | 'black' | 'draw');
      sound.playDefeat();
      toast('You resigned from the game', { icon: '🏳️' });
    } catch (err) {
      toast.error('Resign failed');
    }
  };

  const handleOfferDraw = async () => {
    if (!roomId || !myPlayerId) return;
    try {
      await api.draw(roomId, myPlayerId, 'offer');
      toast('Draw offer sent', { icon: '🤝' });
    } catch (err) {
      toast.error('Failed to offer draw');
    }
  };

  const handleAcceptDraw = async () => {
    if (!roomId || !myPlayerId) return;
    try {
      await api.draw(roomId, myPlayerId, 'accept');
    } catch (err) {
      toast.error('Failed to accept draw');
    }
  };

  const handleDeclineDraw = async () => {
    if (!roomId || !myPlayerId) return;
    try {
      await api.draw(roomId, myPlayerId, 'decline');
      toast('Draw declined');
    } catch (err) {
      toast.error('Failed to decline draw');
    }
  };

  // ── Derive piece list from FEN board ─────────────────────────────────────
  const board = chess.board();
  const isMyTurn = status === 'playing' && chess.turn() === (myColor === 'white' ? 'w' : 'b');

  let turnText = '';
  if (status === 'waiting') turnText = '⏳ Waiting for opponent...';
  else if (status === 'playing') {
    if (chess.isCheck()) turnText = isMyTurn ? '⚠️ You are in check!' : '⚠️ Opponent is in check!';
    else turnText = isMyTurn ? '✅ Your turn' : "⏳ Opponent's turn";
  }

  const turnClass = chess.isCheck() ? 'check' : isMyTurn ? 'your-turn' : 'opponent-turn';

  const copyInviteLink = () => {
    const link = `${window.location.origin}/room/${roomCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied!');
  };

  const history = chess.history({ verbose: true });
  const lastMoveSquares = history.length > 0
    ? { from: history[history.length - 1].from, to: history[history.length - 1].to }
    : null;

  return (
    <div className="game-page">
      {/* ── 3D Canvas area ───────────────────────────────────────────────────── */}
      <div className="canvas-area">
        {/* Turn indicator */}
        {status !== 'idle' && status !== 'finished' && (
          <div className={`turn-indicator glass ${turnClass}`}>
            {turnText}
          </div>
        )}

        {/* Waiting overlay */}
        {status === 'waiting' && (
          <div className="waiting-overlay">
            <div className="waiting-card glass">
              <div className="spinner" />
              <div className="waiting-title">Room Code: {roomCode}</div>
              <div className="waiting-subtitle">Share this code or invite link with your opponent</div>
              <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button className="btn-ghost" onClick={copyInviteLink}>📋 Copy Invite Link</button>
                <button className="btn-ghost" onClick={() => { navigator.clipboard.writeText(roomCode || ''); toast.success('Code copied!'); }}>
                  Copy Code: {roomCode}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3D Canvas */}
        <Canvas
          shadows
          camera={{ position: myColor === 'black' ? [4, 8, -4] : [4, 8, 12], fov: 42 }}
          style={{ background: 'linear-gradient(180deg, #0b0a12 0%, #160d1c 100%)' }}
          gl={{ antialias: true, shadowMapType: 2 }}
        >
          <ambientLight intensity={0.65} color="#FFFBF5" />
          {/* Main Key Studio Light */}
          <directionalLight
            position={[6, 12, 8]}
            intensity={1.4}
            color="#FFF8EF"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-near={0.5}
            shadow-camera-far={50}
            shadow-camera-left={-8}
            shadow-camera-right={12}
            shadow-camera-top={12}
            shadow-camera-bottom={-4}
          />
          {/* Soft Fill Light */}
          <directionalLight position={[-6, 10, -6]} intensity={0.6} color="#F5EFE6" />
          <pointLight position={[4, 7, 4]} intensity={0.8} color="#FFFFFF" />
          <pointLight position={[4, 9, 4]} intensity={0.5} color="#FFD700" />

          <OrbitControls
            target={[4, 0, 4]}
            minPolarAngle={0.25}
            maxPolarAngle={Math.PI / 2.2}
            minDistance={5}
            maxDistance={18}
            enablePan={false}
            dampingFactor={0.08}
            enableDamping
          />

          <Board
            selectedSquare={selectedSquare}
            lastMove={lastMoveSquares}
            onSquareClick={handleSquareClick}
          />

          {board.map((row, rowIdx) =>
            row.map((piece, colIdx) => {
              if (!piece) return null;
              const file = colIdx;
              const rank = 7 - rowIdx;
              const sq = String.fromCharCode(97 + file) + (rank + 1);
              const canSelect =
                isMyTurn &&
                piece.color === (myColor === 'white' ? 'w' : 'b') &&
                myColor !== 'spectator';

              return (
                <ChessPiece3D
                  key={sq}
                  square={sq}
                  pieceType={piece.type}
                  pieceColor={piece.color}
                  isSelected={selectedSquare === sq}
                  canSelect={canSelect}
                  onClick={handleSquareClick}
                />
              );
            })
          )}

          {selectedSquare && legalMoves.length > 0 && (
            <MoveHints
              legalMoves={legalMoves}
              board={board}
              onMove={handleSquareClick}
            />
          )}
        </Canvas>
      </div>

      {/* ── Sidebar ───────────────────────────────────────────────────────────── */}
      <Sidebar
        onResign={() => setShowResignModal(true)}
        onOfferDraw={handleOfferDraw}
        isMyTurn={isMyTurn}
        drawOfferedBy={drawOfferedBy}
        onAcceptDraw={handleAcceptDraw}
        onDeclineDraw={handleDeclineDraw}
        currentTurn={chess.turn() === 'w' ? 'white' : 'black'}
      />

      {/* ── Floating Chat ──────────────────────────────────────────────────────── */}
      <FloatingChat onSend={handleSendChat} />

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      {joinRoomData && (
        <JoinRoomModal
          roomCode={joinRoomData.room.room_code}
          creatorName={joinRoomData.room.white_player_name || joinRoomData.room.black_player_name || undefined}
          timeControl={joinRoomData.room.time_control}
          isFull={!!(joinRoomData.room.black_player_id && joinRoomData.room.white_player_id)}
          onJoin={handleDirectJoin}
          loading={joinRoomData.loading}
        />
      )}
      <GameOverModal />
      {showResignModal && (
        <ResignModal
          onConfirm={handleConfirmResign}
          onCancel={() => setShowResignModal(false)}
        />
      )}
      {pendingPromotion && (
        <PromotionModal
          color={myColor === 'white' ? 'w' : 'b'}
          onSelect={handlePromotionSelect}
          onCancel={() => setPendingPromotion(null)}
        />
      )}
    </div>
  );
}
