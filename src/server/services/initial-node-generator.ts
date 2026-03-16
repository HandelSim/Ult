/**
 * Initial Node Generator
 * Uses Claude CLI (claude -p) to auto-generate root node configuration from
 * project name + description. Streams the raw text to the caller token-by-token,
 * then parses the completed JSON and saves it to the DB.
 *
 * Auth: Uses the existing Claude Code session (CLAUDE_CODE_OAUTH_TOKEN) via the
 * `claude` CLI binary — no separate ANTHROPIC_API_KEY required.
 */
import { spawn } from 'child_process';
import { getDb } from '../db';
import { broadcastGlobal } from '../utils/sse';

const INIT_PROMPT = (projectName: string, projectDescription: string) =>
  `You are planning a software project. Given the project name and description, generate a detailed root node configuration as JSON.

Project Name: ${projectName}
Project Description: ${projectDescription}

Respond with ONLY valid JSON, no markdown fences, no explanation:
{
  "name": "...",
  "prompt": "...",
  "role": "...",
  "is_leaf": false,
  "model": "haiku",
  "acceptance_criteria": "...",
  "allowed_tools": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
  "max_iterations": 10,
  "escalation_policy": "ask_human"
}`;

interface RootNodeConfig {
  name: string;
  prompt: string;
  role: string;
  is_leaf: boolean;
  model: 'sonnet' | 'haiku' | 'opus';
  acceptance_criteria: string;
  allowed_tools: string[];
  max_iterations: number;
  escalation_policy: 'ask_human' | 'auto_retry' | 'fail';
}

/** Parse and normalise raw JSON text returned by the model. */
function parseAndNormalise(raw: string): RootNodeConfig {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const config = JSON.parse(cleaned) as RootNodeConfig;
  config.is_leaf = false;
  config.model = (['sonnet', 'haiku', 'opus'] as const).includes(config.model) ? config.model : 'haiku';
  config.escalation_policy = (['ask_human', 'auto_retry', 'fail'] as const).includes(config.escalation_policy)
    ? config.escalation_policy : 'ask_human';
  config.max_iterations = typeof config.max_iterations === 'number' ? config.max_iterations : 10;
  config.allowed_tools = Array.isArray(config.allowed_tools)
    ? config.allowed_tools : ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'];
  return config;
}

/** Persist the generated config to the DB. */
function saveConfig(rootNodeId: string, config: RootNodeConfig, projectName: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE nodes SET
      name = ?,
      prompt = ?,
      role = ?,
      node_type = 'orchestrator',
      model = ?,
      acceptance_criteria = ?,
      allowed_tools = ?,
      max_iterations = ?,
      escalation_policy = ?
    WHERE id = ?
  `).run(
    config.name || projectName,
    config.prompt || projectName,
    config.role || 'Senior Software Engineer',
    config.model,
    config.acceptance_criteria || null,
    JSON.stringify(config.allowed_tools),
    config.max_iterations,
    config.escalation_policy,
    rootNodeId
  );
}

/**
 * Streaming version: calls Claude CLI with streaming and fires onChunk for each text token.
 * Saves the final config to the DB when complete.
 */
export async function generateInitialNodeStream(
  rootNodeId: string,
  projectName: string,
  projectDescription: string,
  onChunk: (text: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const prompt = INIT_PROMPT(projectName, projectDescription);
    let fullText = '';
    let stderrBuf = '';

    const proc = spawn('claude', [
      '-p',
      '--output-format', 'stream-json',
      '--include-partial-messages',
      '--verbose',
      '--model', 'claude-haiku-4-5-20251001',
      '--strict-mcp-config',
    ], {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Write prompt via stdin then close it
    proc.stdin.write(prompt);
    proc.stdin.end();

    // Parse NDJSON lines from stdout
    let lineBuf = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      lineBuf += chunk.toString();
      const parts = lineBuf.split('\n');
      lineBuf = parts.pop() ?? '';
      for (const line of parts) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as {
            type: string;
            event?: {
              type: string;
              delta?: { type: string; text?: string };
            };
          };
          if (
            msg.type === 'stream_event' &&
            msg.event?.type === 'content_block_delta' &&
            msg.event.delta?.type === 'text_delta' &&
            msg.event.delta.text
          ) {
            const text = msg.event.delta.text;
            fullText += text;
            onChunk(text);
          }
        } catch { /* ignore parse errors on individual lines */ }
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`claude CLI exited with code ${code}: ${stderrBuf.slice(0, 500)}`));
        return;
      }
      if (!fullText.trim()) {
        reject(new Error('claude CLI produced no output'));
        return;
      }
      try {
        const config = parseAndNormalise(fullText);
        saveConfig(rootNodeId, config, projectName);
        resolve();
      } catch (err) {
        reject(new Error(`Failed to parse model output: ${err}. Raw: ${fullText.slice(0, 200)}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn claude CLI: ${err.message}`));
    });
  });
}

/**
 * Non-streaming fallback: generates root node config and saves it.
 * @deprecated Prefer generateInitialNodeStream for the streaming UI.
 */
export async function generateInitialNode(
  rootNodeId: string,
  projectName: string,
  projectDescription: string
): Promise<void> {
  try {
    console.log(`[InitialNodeGen] Generating config for root node ${rootNodeId}...`);
    await generateInitialNodeStream(rootNodeId, projectName, projectDescription, () => {});
    const db = getDb();
    const updatedNode = db.prepare('SELECT * FROM nodes WHERE id = ?').get(rootNodeId);
    broadcastGlobal('node:updated', { node: updatedNode });
    console.log(`[InitialNodeGen] Root node ${rootNodeId} updated.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[InitialNodeGen] Failed: ${message}`);
  }
}
