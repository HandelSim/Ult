import { Router } from 'express';
import { getOrCreateSession, sendMessage, resumeSession } from '../smith-proxy.js';

const router = Router();

// POST /api/smith/start/:projectId — start or attach to SMITH session
router.post('/start/:projectId', (req, res) => {
  try {
    getOrCreateSession(req.params.projectId);
    res.json({ status: 'started' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/smith/message/:projectId — send message to SMITH
router.post('/message/:projectId', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const sent = sendMessage(req.params.projectId, message);
  if (!sent) return res.status(404).json({ error: 'No active session' });
  res.json({ status: 'sent' });
});

// POST /api/smith/resume/:projectId — resume by session ID
router.post('/resume/:projectId', (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  resumeSession(req.params.projectId, sessionId);
  res.json({ status: 'resumed' });
});

// GET /api/smith/stream/:projectId — SSE stream
router.get('/stream/:projectId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const emitter = getOrCreateSession(req.params.projectId);

  const onData = (event: unknown) => {
    res.write(`data: ${JSON.stringify({ type: 'data', payload: event })}\n\n`);
  };

  const onText = (text: string) => {
    res.write(`data: ${JSON.stringify({ type: 'text', payload: text })}\n\n`);
  };

  const onClose = (code: number | null) => {
    res.write(`data: ${JSON.stringify({ type: 'close', payload: code })}\n\n`);
    res.end();
  };

  const onError = (err: Error) => {
    res.write(`data: ${JSON.stringify({ type: 'error', payload: err.message })}\n\n`);
    res.end();
  };

  emitter.on('data', onData);
  emitter.on('text', onText);
  emitter.on('close', onClose);
  emitter.on('error', onError);

  req.on('close', () => {
    emitter.off('data', onData);
    emitter.off('text', onText);
    emitter.off('close', onClose);
    emitter.off('error', onError);
  });
});

export default router;
