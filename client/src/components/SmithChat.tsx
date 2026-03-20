import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sendSmithMessage, startSmithSession, createSmithEventSource } from '../api';

interface Message {
  role: 'user' | 'smith' | 'adversary' | 'system';
  content: string;
  timestamp: number;
}

interface Props {
  projectId: string;
}

export function SmithChat({ projectId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  const appendMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  useEffect(() => {
    // Start the SMITH session and connect SSE
    startSmithSession(projectId).catch(console.error);

    const es = createSmithEventSource(projectId);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'text' && data.payload) {
          const text = String(data.payload);
          const isAdversary = text.startsWith('[ADVERSARY]');
          appendMessage({
            role: isAdversary ? 'adversary' : 'smith',
            content: isAdversary ? text.replace('[ADVERSARY]', '').trim() : text,
            timestamp: Date.now()
          });
        } else if (data.type === 'data' && data.payload?.type === 'assistant') {
          const content = data.payload?.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'text' && block.text) {
                appendMessage({
                  role: 'smith',
                  content: block.text,
                  timestamp: Date.now()
                });
              }
            }
          }
        } else if (data.type === 'close') {
          setConnected(false);
        } else if (data.type === 'error') {
          appendMessage({
            role: 'system',
            content: `Error: ${data.payload}`,
            timestamp: Date.now()
          });
        }
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
    };
  }, [projectId, appendMessage]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput('');
    setSending(true);

    appendMessage({ role: 'user', content: msg, timestamp: Date.now() });

    try {
      await sendSmithMessage(projectId, msg);
    } catch (err) {
      appendMessage({ role: 'system', content: `Failed to send: ${err}`, timestamp: Date.now() });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const roleColors: Record<string, string> = {
    user: 'text-accent',
    smith: 'text-success',
    adversary: 'text-warning',
    system: 'text-text-muted'
  };

  const roleLabels: Record<string, string> = {
    user: 'You',
    smith: 'Blacksmith',
    adversary: 'Adversary',
    system: 'System'
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">SMITH Chat</span>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-success' : 'bg-error'}`} />
          <span className="text-xs text-text-muted">{connected ? 'connected' : 'offline'}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-text-muted text-xs py-8">
            <p>SMITH session started. Send a message to begin.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`text-xs ${roleColors[msg.role]}`}>
            <span className="font-semibold">{roleLabels[msg.role]}: </span>
            <span className="text-text-primary whitespace-pre-wrap">{msg.content}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-2">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message SMITH..."
            rows={2}
            className="flex-1 bg-bg-tertiary text-text-primary text-xs rounded px-3 py-2 resize-none border border-border focus:outline-none focus:border-accent placeholder-text-muted font-sans"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-3 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs rounded font-medium transition-colors"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
        <p className="text-xs text-text-muted mt-1 px-1">Enter to send, Shift+Enter for newline</p>
      </div>
    </div>
  );
}
