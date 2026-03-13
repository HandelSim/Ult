/**
 * Server-Sent Events (SSE) utilities.
 * SSE is preferred over WebSockets here because:
 * - Unidirectional (server -> client) is all we need for log streaming
 * - Automatic reconnection built into browsers
 * - Works through HTTP/1.1 proxies and load balancers
 */
import { Request, Response } from 'express';

export interface SSEClient {
  id: string;
  res: Response;
  nodeId?: string;
}

// In-memory registry of active SSE connections
const sseClients = new Map<string, SSEClient>();

/**
 * Initialize an SSE connection on a response object.
 * Sets appropriate headers and registers the client.
 */
export function initSSE(req: Request, res: Response, clientId: string, nodeId?: string): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
  res.flushHeaders();

  // Send initial connection confirmation
  sendSSEEvent(res, 'connected', { clientId, nodeId });

  // Register client
  sseClients.set(clientId, { id: clientId, res, nodeId });

  // Clean up on client disconnect
  req.on('close', () => {
    sseClients.delete(clientId);
  });

  // Keep-alive ping every 30 seconds to prevent proxy timeouts
  const keepAlive = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(keepAlive);
      return;
    }
    res.write(':ping\n\n');
  }, 30000);

  req.on('close', () => clearInterval(keepAlive));
}

/**
 * Send a typed SSE event to a specific response stream.
 */
export function sendSSEEvent(res: Response, event: string, data: unknown): void {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Broadcast a log line to all clients watching a specific node.
 */
export function broadcastToNode(nodeId: string, event: string, data: unknown): void {
  sseClients.forEach((client) => {
    if (client.nodeId === nodeId) {
      sendSSEEvent(client.res, event, data);
    }
  });
}

/**
 * Broadcast a status update to all connected clients (for tree graph updates).
 */
export function broadcastGlobal(event: string, data: unknown): void {
  sseClients.forEach((client) => {
    sendSSEEvent(client.res, event, data);
  });
}

export function getActiveClientCount(): number {
  return sseClients.size;
}
