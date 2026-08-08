import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import type { ChatMessage } from '../types';

// ── Notification bubble type ──────────────────────────────────────────────────
interface FloatingNotif {
  id: string;
  sender: string;
  text: string;
  color: string;
}

interface FloatingChatProps {
  onSend: (text: string) => void;
}

export default function FloatingChat({ onSend }: FloatingChatProps) {
  const messages = useGameStore((s) => s.messages);
  const myColor = useGameStore((s) => s.myColor);
  const myName = useGameStore((s) => s.myName);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [notifs, setNotifs] = useState<FloatingNotif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMsgCountRef = useRef(messages.length);
  const openRef = useRef(open);
  openRef.current = open;

  // Scroll to bottom whenever panel is opened or messages update while open
  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  }, [open, messages.length]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  // Watch for new incoming messages
  useEffect(() => {
    const newCount = messages.length;
    if (newCount <= prevMsgCountRef.current) {
      prevMsgCountRef.current = newCount;
      return;
    }

    // Find truly new messages since last render
    const newMsgs = messages.slice(prevMsgCountRef.current);
    prevMsgCountRef.current = newCount;

    newMsgs.forEach((msg) => {
      // Only show notification for opponent chat messages, not own messages or events
      if (msg.type !== 'chat') return;
      const isOwn = msg.sender === myName;
      if (isOwn) return;

      if (!openRef.current) {
        // Panel is closed — show floating notification
        setUnreadCount((c) => c + 1);
        const notif: FloatingNotif = {
          id: msg.id,
          sender: msg.sender,
          text: msg.text.length > 50 ? msg.text.slice(0, 47) + '…' : msg.text,
          color: msg.color || 'white',
        };
        setNotifs((prev) => {
          // Keep at most 1 notification at a time to avoid clutter
          return [notif];
        });
        // Auto-dismiss after 4 seconds
        setTimeout(() => {
          setNotifs((prev) => prev.filter((n) => n.id !== notif.id));
        }, 4000);
      }
    });
  }, [messages, myName]);

  const handleSend = useCallback(() => {
    const t = text.trim().slice(0, 200);
    if (!t) return;
    onSend(t);
    setText('');
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [text, onSend]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const chatMsgs = messages.filter((m) => m.type === 'chat' || m.type === 'event');

  return (
    <>
      {/* ── Floating Notification Bubbles ──────────────────────────────────── */}
      <div className="chat-notif-stack">
        {notifs.map((n) => (
          <div key={n.id} className="chat-notif-bubble">
            <span className={`chat-notif-sender ${n.color}`}>{n.sender}</span>
            <span className="chat-notif-text">{n.text}</span>
          </div>
        ))}
      </div>

      {/* ── Floating Chat Button ────────────────────────────────────────────── */}
      <button
        className="chat-fab"
        onClick={() => setOpen(true)}
        title="Open Chat"
        aria-label="Open chat"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {unreadCount > 0 && (
          <span className="chat-fab-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {/* ── Backdrop blur overlay ───────────────────────────────────────────── */}
      <div
        className={`chat-backdrop ${open ? 'chat-backdrop--open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* ── Slide-up Chat Drawer ────────────────────────────────────────────── */}
      <div className={`chat-drawer ${open ? 'chat-drawer--open' : ''}`} role="dialog" aria-label="Chat">

        {/* Drag handle / dismiss area */}
        <div className="chat-drawer-handle-area" onClick={() => setOpen(false)}>
          <div className="chat-drawer-handle" />
        </div>

        {/* Header */}
        <div className="chat-drawer-header">
          <span className="chat-drawer-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, opacity: 0.7 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Chat
          </span>
          <button className="chat-drawer-close" onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
        </div>

        {/* Messages */}
        <div className="chat-drawer-messages">
          {chatMsgs.length === 0 && (
            <div className="chat-drawer-empty">
              <span>💬</span>
              <p>No messages yet. Say hello!</p>
            </div>
          )}
          {messages.map((msg: ChatMessage) => {
            if (msg.type === 'event') {
              return (
                <div key={msg.id} className="chat-bubble-event">
                  {msg.text}
                </div>
              );
            }
            const isOwn = msg.sender === myName;
            return (
              <div key={msg.id} className={`chat-bubble-row ${isOwn ? 'own' : 'opponent'}`}>
                {!isOwn && (
                  <div className={`chat-bubble-avatar ${msg.color}`}>
                    {msg.sender.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="chat-bubble-col">
                  {!isOwn && (
                    <span className={`chat-bubble-name ${msg.color}`}>{msg.sender}</span>
                  )}
                  <div className={`chat-bubble ${isOwn ? 'chat-bubble--own' : 'chat-bubble--opp'}`}>
                    {msg.text}
                    <span className="chat-bubble-time">{formatTime(msg.ts)}</span>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input row */}
        <div className="chat-drawer-input-row">
          <input
            ref={inputRef}
            id="chat-input"
            type="text"
            placeholder={myColor === 'spectator' ? 'Spectators cannot chat' : 'Type a message…'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            maxLength={200}
            disabled={myColor === 'spectator'}
            className="chat-drawer-input"
          />
          <button
            className="chat-drawer-send"
            onClick={handleSend}
            disabled={!text.trim() || myColor === 'spectator'}
            aria-label="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
