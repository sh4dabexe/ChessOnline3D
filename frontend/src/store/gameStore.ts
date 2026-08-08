import { create } from 'zustand';
import type { ChatMessage, GameStatus, PlayerColor, Winner } from '../types';

interface GameStore {
  // ── Room / session ─────────────────────────────────────────────────────────
  roomId: string | null;
  roomCode: string | null;
  myPlayerId: string | null;
  myColor: PlayerColor;
  myName: string;
  opponentName: string;

  // ── Game state & Clocks ───────────────────────────────────────────────────
  fen: string;
  status: GameStatus;
  winner: Winner;
  drawOfferedBy: PlayerColor | null;
  rematchRequestedBy: PlayerColor | null;
  pgnMoves: string[];
  timeControl: number;
  whiteTimeLeft: number;
  blackTimeLeft: number;
  timerLastUpdatedAt: number;

  // ── UI state ──────────────────────────────────────────────────────────────
  selectedSquare: string | null;
  legalMoves: string[];
  pendingPromotion: { from: string; to: string } | null;
  isAnimating: boolean;
  activeMobileTab: 'board' | 'chat' | 'moves';

  // ── Chat ──────────────────────────────────────────────────────────────────
  messages: ChatMessage[];

  // ── Actions ───────────────────────────────────────────────────────────────
  setSession: (data: {
    roomId: string;
    roomCode: string;
    myPlayerId: string;
    myColor: PlayerColor;
    myName: string;
    opponentName: string;
    fen: string;
    status: GameStatus;
    pgnMoves: string[];
    timeControl?: number;
    whiteTimeLeft?: number;
    blackTimeLeft?: number;
    timerLastUpdatedAt?: string;
    rematchRequestedBy?: PlayerColor | null;
  }) => void;

  setFen: (fen: string) => void;
  setStatus: (status: GameStatus) => void;
  setWinner: (winner: Winner) => void;
  setDrawOfferedBy: (color: PlayerColor | null) => void;
  setRematchRequestedBy: (color: PlayerColor | null) => void;
  setPgnMoves: (moves: string[]) => void;
  setOpponentName: (name: string) => void;
  setClocks: (whiteSec: number, blackSec: number, lastUpdatedIso?: string) => void;

  selectSquare: (sq: string | null, legalDests?: string[]) => void;
  setPendingPromotion: (promo: { from: string; to: string } | null) => void;
  setIsAnimating: (v: boolean) => void;
  setActiveMobileTab: (tab: 'board' | 'chat' | 'moves') => void;

  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  reset: () => void;
}

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const defaults = {
  roomId: null,
  roomCode: null,
  myPlayerId: null,
  myColor: 'spectator' as PlayerColor,
  myName: '',
  opponentName: '',
  fen: STARTING_FEN,
  status: 'idle' as GameStatus,
  winner: null as Winner,
  drawOfferedBy: null as PlayerColor | null,
  rematchRequestedBy: null as PlayerColor | null,
  pgnMoves: [] as string[],
  timeControl: 10,
  whiteTimeLeft: 600,
  blackTimeLeft: 600,
  timerLastUpdatedAt: Date.now(),
  selectedSquare: null as string | null,
  legalMoves: [] as string[],
  pendingPromotion: null as { from: string; to: string } | null,
  isAnimating: false,
  activeMobileTab: 'board' as 'board' | 'chat' | 'moves',
  messages: [] as ChatMessage[],
};

export const useGameStore = create<GameStore>((set) => ({
  ...defaults,

  setSession: (data) =>
    set({
      roomId: data.roomId,
      roomCode: data.roomCode,
      myPlayerId: data.myPlayerId,
      myColor: data.myColor,
      myName: data.myName,
      opponentName: data.opponentName,
      fen: data.fen,
      status: data.status,
      pgnMoves: data.pgnMoves,
      timeControl: data.timeControl ?? 10,
      whiteTimeLeft: data.whiteTimeLeft ?? (data.timeControl ? data.timeControl * 60 : 600),
      blackTimeLeft: data.blackTimeLeft ?? (data.timeControl ? data.timeControl * 60 : 600),
      timerLastUpdatedAt: data.timerLastUpdatedAt ? new Date(data.timerLastUpdatedAt).getTime() : Date.now(),
      rematchRequestedBy: data.rematchRequestedBy || null,
      messages: [],
      selectedSquare: null,
      legalMoves: [],
    }),

  setFen: (fen) => set({ fen, selectedSquare: null, legalMoves: [] }),
  setStatus: (status) => set({ status }),
  setWinner: (winner) => set({ winner }),
  setDrawOfferedBy: (color) => set({ drawOfferedBy: color }),
  setRematchRequestedBy: (color) => set({ rematchRequestedBy: color }),
  setPgnMoves: (moves) => set({ pgnMoves: moves }),
  setOpponentName: (name) => set({ opponentName: name }),

  setClocks: (whiteSec, blackSec, lastUpdatedIso) =>
    set({
      whiteTimeLeft: Math.max(0, whiteSec),
      blackTimeLeft: Math.max(0, blackSec),
      timerLastUpdatedAt: lastUpdatedIso ? new Date(lastUpdatedIso).getTime() : Date.now(),
    }),

  selectSquare: (sq, legalDests = []) =>
    set({ selectedSquare: sq, legalMoves: legalDests }),

  setPendingPromotion: (promo) => set({ pendingPromotion: promo }),
  setIsAnimating: (v) => set({ isAnimating: v }),
  setActiveMobileTab: (tab) => set({ activeMobileTab: tab }),

  addMessage: (msg) =>
    set((state) => {
      // Deduplicate by ID
      if (state.messages.some((m) => m.id === msg.id)) return state;
      // Deduplicate by text + sender within 3 seconds window
      if (msg.sender && state.messages.some((m) => m.sender === msg.sender && m.text === msg.text && Math.abs(m.ts - msg.ts) < 3000)) {
        return state;
      }
      return { messages: [...state.messages.slice(-199), msg] };
    }),

  setMessages: (msgs) => set({ messages: msgs }),

  reset: () => set(defaults),
}));
