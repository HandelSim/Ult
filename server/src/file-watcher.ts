import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import { WORKSPACE_ROOT } from './config.js';
import { EventEmitter } from 'events';

export const fileWatcherEmitter = new EventEmitter();

let watcher: chokidar.FSWatcher | null = null;

export function startWatcher(): void {
  const watchPath = path.join(WORKSPACE_ROOT, 'projects');

  // Ensure the directory exists
  if (!fs.existsSync(watchPath)) {
    fs.mkdirSync(watchPath, { recursive: true });
  }

  watcher = chokidar.watch(path.join(watchPath, '**/project.json'), {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
  });

  watcher.on('change', (filePath: string) => {
    // Extract project folder from path
    const relative = path.relative(path.join(WORKSPACE_ROOT, 'projects'), filePath);
    const projectFolder = relative.split(path.sep)[0];
    fileWatcherEmitter.emit('project_changed', projectFolder, filePath);
  });

  watcher.on('add', (filePath: string) => {
    const relative = path.relative(path.join(WORKSPACE_ROOT, 'projects'), filePath);
    const projectFolder = relative.split(path.sep)[0];
    fileWatcherEmitter.emit('project_changed', projectFolder, filePath);
  });

  // Also watch the index file
  const indexPath = path.join(WORKSPACE_ROOT, 'projects-index.json');
  const indexWatcher = chokidar.watch(indexPath, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
  });
  indexWatcher.on('change', () => {
    fileWatcherEmitter.emit('index_changed');
  });
}

export function stopWatcher(): void {
  watcher?.close();
}
