/**
 * Projects API routes.
 * Projects are the top-level containers for agent trees.
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { broadcastGlobal } from '../utils/sse';
import { generateRootClaudeMd } from '../services/claude-md';
import { generateAllContexts } from '../services/context-generator';
import { generateProjectContracts, getContractRegistry } from '../services/contract-generator';

const router = Router();

/**
 * POST /api/projects
 * Create a new project with a root orchestrator node.
 * Body: { name, description, prompt, system_prompt }
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, description, prompt, system_prompt } = req.body as {
      name: string;
      description?: string;
      prompt?: string;
      system_prompt?: string;
    };

    if (!name?.trim()) {
      res.status(400).json({ error: 'Project name is required' });
      return;
    }

    const projectId = uuidv4();
    const rootNodeId = uuidv4();

    // Use a transaction to create project + root node atomically
    const createProject = db.transaction(() => {
      // Create the root orchestrator node
      db.prepare(`
        INSERT INTO nodes (id, parent_id, name, depth, status, node_type, prompt, system_prompt)
        VALUES (?, NULL, ?, 0, 'pending', 'orchestrator', ?, ?)
      `).run(rootNodeId, name, prompt || null, system_prompt || null);

      // Create the project
      db.prepare(`
        INSERT INTO projects (id, name, description, root_node_id)
        VALUES (?, ?, ?, ?)
      `).run(projectId, name.trim(), description || null, rootNodeId);
    });

    createProject();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    const rootNode = db.prepare('SELECT * FROM nodes WHERE id = ?').get(rootNodeId);

    broadcastGlobal('project:created', { project, rootNode });

    // Respond immediately. The client connects to GET /api/nodes/:id/init-stream
    // which streams the Haiku generation in real-time and updates the node.
    res.status(201).json({ project, rootNode });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating project:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/projects
 * List all projects.
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const projects = db.prepare(`
      SELECT p.*,
             n.status as root_status,
             (SELECT COUNT(*) FROM nodes WHERE nodes.id IN (
               WITH RECURSIVE tree(id) AS (
                 SELECT p2.root_node_id FROM projects p2 WHERE p2.id = p.id
                 UNION ALL
                 SELECT nodes.id FROM nodes JOIN tree ON nodes.parent_id = tree.id
               )
               SELECT id FROM tree
             )) as total_nodes
      FROM projects p
      LEFT JOIN nodes n ON p.root_node_id = n.id
      ORDER BY p.created_at DESC
    `).all();

    res.json({ projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/projects/:id
 * Get project details.
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params['id']);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ project });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/projects/:id/tree
 * Get the full tree structure for a project.
 * Returns nodes in a flat array; client reconstructs tree hierarchy.
 */
router.get('/:id/tree', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params['id']) as {
      id: string;
      name: string;
      root_node_id: string | null;
    } | undefined;

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (!project.root_node_id) {
      res.json({ project, nodes: [], contracts: [] });
      return;
    }

    // Use recursive CTE to get all nodes in the tree
    const nodes = db.prepare(`
      WITH RECURSIVE tree(id) AS (
        SELECT ?
        UNION ALL
        SELECT nodes.id FROM nodes JOIN tree ON nodes.parent_id = tree.id
      )
      SELECT * FROM nodes WHERE id IN (SELECT id FROM tree)
      ORDER BY depth, created_at
    `).all(project.root_node_id);

    // Get all contracts for nodes in this tree
    const nodeIds = (nodes as Array<{ id: string }>).map(n => `'${n.id}'`).join(',');
    const contracts = nodeIds.length > 0
      ? db.prepare(`SELECT * FROM contracts WHERE parent_node_id IN (${nodeIds})`).all()
      : [];

    res.json({ project, nodes, contracts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error getting tree:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/projects/:id/claude-md
 * Generate and return the CLAUDE.md content for a project.
 * Returns the auto-generated project context document (read-only).
 */
router.get('/:id/claude-md', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params['id']);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const content = generateRootClaudeMd(req.params['id']);
    res.json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/projects/:id/mode
 * Update project mode (manual/auto).
 */
router.patch('/:id/mode', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { mode } = req.body as { mode: 'manual' | 'auto' };
    if (!['manual', 'auto'].includes(mode)) {
      res.status(400).json({ error: 'mode must be "manual" or "auto"' });
      return;
    }
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params['id']);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    db.prepare('UPDATE projects SET mode = ? WHERE id = ?').run(mode, req.params['id']);
    res.json({ message: 'Mode updated', mode });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/projects/:id/generate-contexts
 * Improvement 2 + 5: Generate CLAUDE.md hierarchy and settings for all nodes.
 * Transitions project status: tree_approved → contexts_generating → contexts_generated
 */
router.post('/:id/generate-contexts', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params['id']) as {
      id: string; name: string; status: string;
    } | undefined;

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Transition to contexts_generating
    db.prepare("UPDATE projects SET status = 'contexts_generating' WHERE id = ?").run(req.params['id']);
    broadcastGlobal('project:status', { projectId: req.params['id'], status: 'contexts_generating' });

    // Run async — respond immediately then generate in background
    res.json({ message: 'Context generation started', status: 'contexts_generating' });

    generateAllContexts(req.params['id'])
      .then((contextDir) => {
        db.prepare("UPDATE projects SET status = 'contexts_generated' WHERE id = ?").run(req.params['id']);
        broadcastGlobal('project:status', { projectId: req.params['id'], status: 'contexts_generated', contextDir });
        console.log(`[contexts] Generated for project ${req.params['id']} at ${contextDir}`);
      })
      .catch((err) => {
        console.error('[contexts] Generation failed:', err);
        db.prepare("UPDATE projects SET status = 'tree_approved' WHERE id = ?").run(req.params['id']);
        broadcastGlobal('project:status', { projectId: req.params['id'], status: 'tree_approved', error: String(err) });
      });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/projects/:id/start-execution
 * Improvement 2: Transition project to executing phase.
 * Queues all approved leaf nodes for execution.
 */
router.post('/:id/start-execution', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params['id']) as {
      id: string; root_node_id: string | null; status: string;
    } | undefined;

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (!project.root_node_id) {
      res.status(400).json({ error: 'Project has no root node' });
      return;
    }

    // Transition to executing
    db.prepare("UPDATE projects SET status = 'executing' WHERE id = ?").run(req.params['id']);
    broadcastGlobal('project:status', { projectId: req.params['id'], status: 'executing' });

    // Find all approved leaf nodes to queue
    const leafNodes = db.prepare(`
      WITH RECURSIVE tree(id) AS (
        SELECT ?
        UNION ALL
        SELECT nodes.id FROM nodes JOIN tree ON nodes.parent_id = tree.id
      )
      SELECT id, name FROM nodes
      WHERE id IN (SELECT id FROM tree)
        AND node_type = 'leaf'
        AND status = 'approved'
    `).all(project.root_node_id) as { id: string; name: string }[];

    res.json({
      message: 'Execution started',
      status: 'executing',
      queuedNodes: leafNodes.map(n => ({ id: n.id, name: n.name })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/projects/:id/approve-tree
 * Improvement 2: Mark tree as approved (building → tree_approved).
 */
router.post('/:id/approve-tree', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params['id']);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    db.prepare("UPDATE projects SET status = 'tree_approved' WHERE id = ?").run(req.params['id']);
    broadcastGlobal('project:status', { projectId: req.params['id'], status: 'tree_approved' });
    res.json({ message: 'Tree approved', status: 'tree_approved' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/projects/:id/contract-registry
 * Improvement 3: Get all contracts for a project in registry format.
 */
router.get('/:id/contract-registry', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params['id']);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const registry = getContractRegistry(req.params['id']);
    res.json({ registry });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/projects/:id/generate-contracts
 * Improvement 3: Generate contract files for all nodes in a project.
 */
router.post('/:id/generate-contracts', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params['id']);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const results = await generateProjectContracts(req.params['id']);
    res.json({ message: 'Contracts generated', results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project and all its nodes (cascade).
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params['id']);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params['id']);
    broadcastGlobal('project:deleted', { projectId: req.params['id'] });

    res.json({ message: 'Project deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
