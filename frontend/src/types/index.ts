export type PlayerColor = 'white' | 'black' | 'spectator';
export type GameStatus = 'idle' | 'waiting' | 'playing' | 'finished';
export type Winner = 'white' | 'black' | 'draw' | null;
export type DrawAction = 'offer' | 'accept' | 'decline';

export interface ChatMessage {
  id: string;
  type: 'chat' | 'event';
  sender?: string;
  color?: PlayerColor;
  text: string;
  ts: number;
}

export interface Room {
  id: string;
  room_code: string;
  white_player_id: string | null;
  white_player_name: string | null;
  black_player_id: string | null;
  black_player_name: string | null;
  fen: string;
  pgn_moves: string[];
  status: 'waiting' | 'playing' | 'finished';
  winner: Winner;
  draw_offered_by: PlayerColor | null;
  rematch_requested_by: PlayerColor | null;
  time_control: number; // in minutes (0 = unlimited)
  white_time_left: number; // in seconds
  black_time_left: number; // in seconds
  timer_last_updated_at: string;
  chat_messages?: ChatMessage[];
  last_move_at: string;
  created_at: string;
}

export interface PieceInfo {
  square: string;
  type: string; // 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
  color: 'w' | 'b';
}

export interface CreateRoomResponse {
  id: string;
  room_code: string;
  player_id: string;
  color: PlayerColor;
  fen: string;
  time_control: number;
  white_time_left: number;
  black_time_left: number;
}

export interface JoinRoomResponse {
  player_id: string;
  color: PlayerColor;
}
