/**
 * StreamingTerminal - Modal overlay shown immediately after project creation.
 * Connects to /api/nodes/:id/init-stream and displays Haiku's configuration
 * output token-by-token in a terminal-style view.
 */
import React, { useState, useEffect, useRef } from 'react';

interface StreamingTerminalProps {
  /** Root node ID to stream configuration for */
  nodeId: string;
  /** Project name shown in terminal header */
  projectName: string;
  /** Called when the user dismisses after stream completes (or on error) */
  onComplete: () => void;
}

type TerminalStatus = 'connecting' | 'streaming' | 'done' | 'error';

export const StreamingTerminal: React.FC<StreamingTerminalProps> = ({
  nodeId,
  projectName,
  onComplete,
}) => {
  const [lines, setLines] = useState<string[]>([]);
  const [buffer, setBuffer] = useState('');
  const [status, setStatus] = useState<TerminalStatus>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as new content arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, buffer]);

  useEffect(() => {
    const es = new EventSource(`/api/nodes/${nodeId}/init-stream`);

    es.addEventListener('start', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { message: string };
      setLines(prev => [...prev, `$ ${data.message}`]);
      setStatus('streaming');
    });

    es.addEventListener('chunk', (e: MessageEvent) => {
      const { text } = JSON.parse(e.data) as { text: string };
      setBuffer(prev => {
        const updated = prev + text;
        // Flush completed lines immediately so terminal scrolls naturally
        const parts = updated.split('\n');
        if (parts.length > 1) {
          setLines(existing => [...existing, ...parts.slice(0, -1)]);
          return parts[parts.length - 1] ?? '';
        }
        return updated;
      });
    });

    es.addEventListener('done', () => {
      // Flush any remaining buffer content
      setBuffer(remaining => {
        if (remaining.trim()) {
          setLines(existing => [...existing, remaining]);
        }
        return '';
      });
      setLines(existing => [...existing, '', '✓ Configuration complete']);
      setStatus('done');
      es.close();
    });

    es.addEventListener('error', (e: MessageEvent) => {
      let msg = 'Stream error';
      try {
        const data = JSON.parse(e.data) as { message?: string };
        msg = data.message || msg;
      } catch { /* raw error event */ }
      setErrorMsg(msg);
      setStatus('error');
      es.close();
    });

    // Handle network-level EventSource errors (not our custom error events)
    es.onerror = () => {
      if (status === 'connecting') {
        setErrorMsg('Could not connect to init stream');
        setStatus('error');
      }
      es.close();
    };

    return () => { es.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      data-testid="streaming-terminal"
    >
      <div className="bg-gray-900 rounded-xl w-full max-w-2xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">

        {/* Terminal title bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span className="ml-2 text-xs font-mono text-gray-400 truncate">
            haiku — configuring <span className="text-green-400">{projectName}</span>
          </span>
          <div className="ml-auto flex-shrink-0">
            {status === 'connecting' && (
              <span className="text-xs text-gray-500 animate-pulse">● connecting…</span>
            )}
            {status === 'streaming' && (
              <span className="text-xs text-yellow-400 animate-pulse">● streaming</span>
            )}
            {status === 'done' && (
              <span className="text-xs text-green-400">✓ complete</span>
            )}
            {status === 'error' && (
              <span className="text-xs text-red-400">✕ error</span>
            )}
          </div>
        </div>

        {/* Terminal output */}
        <div
          className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed bg-gray-950 min-h-48"
          data-testid="streaming-output"
        >
          {status === 'connecting' && (
            <div className="text-gray-500 animate-pulse">Connecting to Haiku…</div>
          )}

          {lines.map((line, i) => (
            <div
              key={i}
              className={`whitespace-pre-wrap break-all ${
                line.startsWith('$') ? 'text-cyan-400' :
                line.startsWith('✓') ? 'text-green-400' :
                'text-green-300'
              }`}
            >
              {line || '\u00a0'}
            </div>
          ))}

          {/* In-progress buffer with blinking cursor */}
          {buffer && (
            <span className="text-green-300 whitespace-pre-wrap break-all">
              {buffer}<span className="animate-pulse">▊</span>
            </span>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Footer — shown when stream ends */}
        {status === 'done' && (
          <div className="px-4 py-3 bg-gray-800 border-t border-gray-700 flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-green-400 font-medium">
              Root node configuration ready for review
            </span>
            <button
              onClick={onComplete}
              data-testid="streaming-complete-btn"
              className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              View Configuration →
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="px-4 py-3 bg-red-950 border-t border-red-800 flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-red-300">
              {errorMsg || 'Configuration failed — you can still edit the node manually'}
            </span>
            <button
              onClick={onComplete}
              data-testid="streaming-complete-btn"
              className="text-sm px-3 py-1.5 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700"
            >
              Continue anyway →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
