import type { ChatMessage, CreateRoomResponse, JoinRoomResponse, Room } from '../types';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  /** Create a new room with timeControl and preferredColor */
  createRoom(playerName: string, timeControl: number = 10, preferredColor: 'white' | 'black' | 'random' = 'white'): Promise<CreateRoomResponse> {
    return request('/rooms', {
      method: 'POST',
      body: JSON.stringify({ playerName, timeControl, preferredColor }),
    });
  },

  /** Get a room by its 6-char code */
  getRoom(code: string): Promise<Room> {
    return request(`/rooms/${code.toUpperCase()}`);
  },

  /** Join a room */
  joinRoom(roomId: string, playerName: string): Promise<JoinRoomResponse> {
    return request(`/rooms/${roomId}/join`, {
      method: 'PATCH',
      body: JSON.stringify({ playerName }),
    });
  },

  /** Push a move */
  pushMove(roomId: string, playerId: string, fen: string, san: string, status?: string, winner?: string | null): Promise<{ ok: boolean; pgn_moves: string[]; white_time_left: number; black_time_left: number }> {
    return request(`/rooms/${roomId}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ player_id: playerId, fen, san, status, winner }),
    });
  },

  /** Send a chat message via backend */
  sendChat(roomId: string, sender: string, color: string, text: string, type: 'chat' | 'event' = 'chat'): Promise<ChatMessage> {
    return request(`/rooms/${roomId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ sender, color, text, type }),
    });
  },

  /** Resign */
  resign(roomId: string, playerId: string): Promise<{ ok: boolean; winner: string }> {
    return request(`/rooms/${roomId}/resign`, {
      method: 'PATCH',
      body: JSON.stringify({ player_id: playerId }),
    });
  },

  /** Offer, accept, or decline a draw */
  draw(roomId: string, playerId: string, action: 'offer' | 'accept' | 'decline'): Promise<{ ok: boolean }> {
    return request(`/rooms/${roomId}/draw`, {
      method: 'PATCH',
      body: JSON.stringify({ player_id: playerId, action }),
    });
  },

  /** Offer, accept, or decline a rematch */
  rematchRequest(roomId: string, playerId: string, action: 'offer' | 'accept' | 'decline'): Promise<{ ok: boolean }> {
    return request(`/rooms/${roomId}/rematch-request`, {
      method: 'PATCH',
      body: JSON.stringify({ player_id: playerId, action }),
    });
  },

  /** Start a rematch directly */
  rematch(roomId: string, playerId: string): Promise<{ ok: boolean }> {
    return request(`/rooms/${roomId}/rematch`, {
      method: 'PATCH',
      body: JSON.stringify({ player_id: playerId }),
    });
  },
};
