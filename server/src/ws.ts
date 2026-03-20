import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { readProjectJson, listProjects } from './projects.js';
import { fileWatcherEmitter } from './file-watcher.js';
import type { WsMessage } from './types.js';

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Broadcast to all connected clients
  function broadcast(msg: WsMessage): void {
    const data = JSON.stringify(msg);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  // When project.json changes, broadcast update
  fileWatcherEmitter.on('project_changed', (projectFolder: string) => {
    const project = readProjectJson(projectFolder);
    if (project) {
      broadcast({ type: 'project_update', payload: project });
    }
  });

  // When projects-index changes, broadcast full list
  fileWatcherEmitter.on('index_changed', () => {
    const projects = listProjects();
    broadcast({ type: 'project_list', payload: projects });
  });

  wss.on('connection', (ws: WebSocket) => {
    // Send initial project list on connect
    try {
      const projects = listProjects();
      ws.send(JSON.stringify({ type: 'project_list', payload: projects }));
    } catch {
      // workspace may not exist yet
    }

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'subscribe_project' && msg.projectId) {
          const project = readProjectJson(msg.projectId);
          if (project) {
            ws.send(JSON.stringify({ type: 'project_update', payload: project }));
          }
        }
      } catch {
        // ignore invalid messages
      }
    });
  });
}
