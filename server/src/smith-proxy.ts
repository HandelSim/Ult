import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { EventEmitter } from 'events';
import { WORKSPACE_ROOT } from './config.js';

interface SmithSession {
  process: ChildProcess;
  emitter: EventEmitter;
  sessionId?: string;
}

const sessions = new Map<string, SmithSession>();

export function getOrCreateSession(projectFolder: string): EventEmitter {
  const existing = sessions.get(projectFolder);
  if (existing) return existing.emitter;

  const emitter = new EventEmitter();
  const smithDir = process.env.SMITH_DIR || path.join(process.env.HOME || '/root', 'smith');
  const model = process.env.SMITH_MODEL || 'opus';
  const projectPath = path.join(WORKSPACE_ROOT, 'projects', projectFolder);

  const proc = spawn('claude', [
    '--dangerously-skip-permissions',
    '--model', model,
    '--system-prompt-file', path.join(smithDir, 'system-prompt.md'),
    '--output-format', 'stream-json',
    '--input-format', 'stream-json',
    '--verbose'
  ], {
    cwd: WORKSPACE_ROOT,
    env: { ...process.env, SCHEMA_ATTACHED: 'true' },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  proc.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        emitter.emit('data', event);
      } catch {
        emitter.emit('text', line);
      }
    }
  });

  proc.stderr?.on('data', (data: Buffer) => {
    emitter.emit('stderr', data.toString());
  });

  proc.on('close', (code: number | null) => {
    emitter.emit('close', code);
    sessions.delete(projectFolder);
  });

  proc.on('error', (err: Error) => {
    emitter.emit('error', err);
    sessions.delete(projectFolder);
  });

  sessions.set(projectFolder, { process: proc, emitter });
  return emitter;
}

export function sendMessage(projectFolder: string, message: string): boolean {
  const session = sessions.get(projectFolder);
  if (!session || !session.process.stdin) return false;

  const input = JSON.stringify({ type: 'user', message }) + '\n';
  session.process.stdin.write(input);
  return true;
}

export function resumeSession(projectFolder: string, sessionId: string): EventEmitter {
  // Kill existing session if any
  const existing = sessions.get(projectFolder);
  if (existing) {
    existing.process.kill();
    sessions.delete(projectFolder);
  }

  const emitter = new EventEmitter();
  const smithDir = process.env.SMITH_DIR || path.join(process.env.HOME || '/root', 'smith');
  const model = process.env.SMITH_MODEL || 'opus';

  const proc = spawn('claude', [
    '--resume', sessionId,
    '--dangerously-skip-permissions',
    '--model', model,
    '--system-prompt-file', path.join(smithDir, 'system-prompt.md'),
    '--output-format', 'stream-json',
    '--input-format', 'stream-json',
    '--verbose'
  ], {
    cwd: WORKSPACE_ROOT,
    env: { ...process.env, SCHEMA_ATTACHED: 'true' },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  proc.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        emitter.emit('data', event);
      } catch {
        emitter.emit('text', line);
      }
    }
  });

  proc.stderr?.on('data', (data: Buffer) => {
    emitter.emit('stderr', data.toString());
  });

  proc.on('close', (code: number | null) => {
    emitter.emit('close', code);
    sessions.delete(projectFolder);
  });

  proc.on('error', (err: Error) => {
    emitter.emit('error', err);
    sessions.delete(projectFolder);
  });

  sessions.set(projectFolder, { process: proc, emitter, sessionId });
  return emitter;
}

export function getSession(projectFolder: string): SmithSession | undefined {
  return sessions.get(projectFolder);
}
