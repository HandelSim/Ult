/**
 * Contract Change Proposals API routes.
 * Improvement 4: Human-review flow for breaking contract changes.
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { broadcastGlobal } from '../utils/sse';

const router = Router();

/**
 * GET /api/proposals
 * List all pending proposals (optionally filter by status).
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const status = req.query['status'] as string | undefined;
    let proposals;
    if (status) {
      proposals = db.prepare(
        'SELECT * FROM contract_change_proposals WHERE status = ? ORDER BY created_at DESC'
      ).all(status);
    } else {
      proposals = db.prepare(
        'SELECT * FROM contract_change_proposals ORDER BY created_at DESC'
      ).all();
    }
    res.json({ proposals });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/proposals
 * Create a new contract change proposal.
 * Body: { contract_id, proposed_by, old_content, new_content, change_type, analysis }
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { contract_id, proposed_by, old_content, new_content, change_type, analysis } = req.body as {
      contract_id: string;
      proposed_by?: string;
      old_content?: string;
      new_content: string;
      change_type?: string;
      analysis?: string;
    };

    if (!contract_id || !new_content) {
      res.status(400).json({ error: 'contract_id and new_content are required' });
      return;
    }

    const id = uuidv4();
    const effectiveChangeType = change_type || 'unknown';
    // Auto-approve backward-compatible changes
    const autoStatus = effectiveChangeType === 'backward_compatible' ? 'approved' : 'pending';

    db.prepare(`
      INSERT INTO contract_change_proposals
        (id, contract_id, proposed_by, old_content, new_content, change_type, status, analysis)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, contract_id, proposed_by || null, old_content || null, new_content,
           effectiveChangeType, autoStatus, analysis || null);

    // If auto-approved, apply the change immediately
    if (autoStatus === 'approved') {
      db.prepare(`
        UPDATE contracts SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(new_content, contract_id);
      const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contract_id);
      broadcastGlobal('contract:updated', { contract });
    }

    const proposal = db.prepare('SELECT * FROM contract_change_proposals WHERE id = ?').get(id);
    broadcastGlobal('proposal:created', { proposal });

    res.status(201).json({ proposal });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/proposals/:id/approve
 * Approve a pending proposal and apply the contract change.
 */
router.post('/:id/approve', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const proposal = db.prepare('SELECT * FROM contract_change_proposals WHERE id = ?').get(req.params['id']) as {
      id: string; contract_id: string; new_content: string; status: string;
    } | undefined;

    if (!proposal) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    if (proposal.status !== 'pending') {
      res.status(400).json({ error: `Proposal is already ${proposal.status}` });
      return;
    }

    const reviewer = (req.body as { reviewer?: string }).reviewer || 'human';

    db.prepare(`
      UPDATE contract_change_proposals
      SET status = 'approved', reviewed_by = ?, resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reviewer, req.params['id']);

    // Apply the contract change
    db.prepare(`
      UPDATE contracts SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(proposal.new_content, proposal.contract_id);

    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(proposal.contract_id);
    const updated = db.prepare('SELECT * FROM contract_change_proposals WHERE id = ?').get(req.params['id']);

    broadcastGlobal('contract:updated', { contract });
    broadcastGlobal('proposal:resolved', { proposal: updated });

    res.json({ message: 'Proposal approved and contract updated', proposal: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/proposals/:id/reject
 * Reject a pending proposal.
 */
router.post('/:id/reject', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const proposal = db.prepare('SELECT * FROM contract_change_proposals WHERE id = ?').get(req.params['id']) as {
      status: string;
    } | undefined;

    if (!proposal) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    if (proposal.status !== 'pending') {
      res.status(400).json({ error: `Proposal is already ${proposal.status}` });
      return;
    }

    const reviewer = (req.body as { reviewer?: string }).reviewer || 'human';

    db.prepare(`
      UPDATE contract_change_proposals
      SET status = 'rejected', reviewed_by = ?, resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reviewer, req.params['id']);

    const updated = db.prepare('SELECT * FROM contract_change_proposals WHERE id = ?').get(req.params['id']);
    broadcastGlobal('proposal:resolved', { proposal: updated });

    res.json({ message: 'Proposal rejected', proposal: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
