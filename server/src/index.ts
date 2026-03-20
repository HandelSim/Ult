import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { PORT, CLIENT_DIST, WORKSPACE_ROOT } from './config.js';
import { startWatcher } from './file-watcher.js';
import { setupWebSocket } from './ws.js';
import projectsRouter from './routes/projects.js';
import smithRouter from './routes/smith.js';

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/projects', projectsRouter);
app.use('/api/smith', smithRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.0.0' });
});

// Serve client in production
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

// WebSocket
setupWebSocket(server);

// File watcher
startWatcher();

server.listen(PORT, () => {
  console.log(`SCHEMA server listening on port ${PORT}`);
  console.log(`Workspace: ${WORKSPACE_ROOT}`);
});
