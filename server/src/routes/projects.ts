import { Router } from 'express';
import fs from 'fs';
import { listProjects, readProjectJson, getMockupPath } from '../projects.js';

const router = Router();

router.get('/', (_req, res) => {
  try {
    const projects = listProjects();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id', (req, res) => {
  try {
    const project = readProjectJson(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id/mockup/:file', (req, res) => {
  try {
    const mockupPath = getMockupPath(req.params.id, req.params.file);
    if (!fs.existsSync(mockupPath)) return res.status(404).json({ error: 'Mockup not found' });
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(mockupPath);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
