/**
 * Contracts API routes.
 * Contracts define shared interfaces between sibling agents.
 * They're critical for parallel development - agents agree on contracts first,
 * then implement independently without tight coupling.
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { broadcastGlobal } from '../utils/sse';

const router = Router();

/**
 * GET /api/contracts/:parentId
 * List all contracts for a given parent node.
 */
router.get('/:parentId', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const contracts = db.prepare(
      'SELECT * FROM contracts WHERE parent_node_id = ? ORDER BY updated_at DESC'
    ).all(req.params['parentId']);

    res.json({ contracts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/contracts
 * Create a new contract.
 * Body: { parent_node_id, name, content, created_by }
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { parent_node_id, name, content, created_by } = req.body as {
      parent_node_id: string;
      name: string;
      content?: string;
      created_by?: string;
    };

    if (!parent_node_id || !name?.trim()) {
      res.status(400).json({ error: 'parent_node_id and name are required' });
      return;
    }

    const contractId = uuidv4();
    db.prepare(`
      INSERT INTO contracts (id, parent_node_id, name, content, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(contractId, parent_node_id, name.trim(), content || null, created_by || null);

    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId);
    broadcastGlobal('contract:created', { contract });

    res.status(201).json({ contract });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/contracts/:id
 * Update a contract's content.
 * Used when agents negotiate or update shared interfaces.
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, content, created_by } = req.body as {
      name?: string;
      content?: string;
      created_by?: string;
    };

    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params['id']);
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }

    db.prepare(`
      UPDATE contracts
      SET name = COALESCE(?, name),
          content = COALESCE(?, content),
          created_by = COALESCE(?, created_by),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name || null, content !== undefined ? content : null, created_by || null, req.params['id']);

    const updated = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params['id']);
    broadcastGlobal('contract:updated', { contract: updated });

    res.json({ contract: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/contracts/:id
 * Delete a contract.
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params['id']);
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }

    db.prepare('DELETE FROM contracts WHERE id = ?').run(req.params['id']);
    broadcastGlobal('contract:deleted', { contractId: req.params['id'] });

    res.json({ message: 'Contract deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
