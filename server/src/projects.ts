import fs from 'fs';
import path from 'path';
import { WORKSPACE_ROOT } from './config.js';
import type { Project, ProjectsIndex } from './types.js';

export function getProjectsIndexPath(): string {
  return path.join(WORKSPACE_ROOT, 'projects-index.json');
}

export function readProjectsIndex(): ProjectsIndex {
  const indexPath = getProjectsIndexPath();
  if (!fs.existsSync(indexPath)) return { projects: [] };
  try {
    return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch {
    return { projects: [] };
  }
}

export function readProjectJson(projectFolder: string): Project | null {
  const projectPath = path.join(WORKSPACE_ROOT, 'projects', projectFolder);
  const projectJsonPath = path.join(projectPath, 'project.json');
  if (!fs.existsSync(projectJsonPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
    return { ...raw, id: projectFolder, path: projectPath };
  } catch {
    return null;
  }
}

export function listProjects(): Project[] {
  const index = readProjectsIndex();
  const results: Project[] = [];
  for (const entry of index.projects) {
    const project = readProjectJson(entry.folder);
    if (project) results.push(project);
  }
  return results;
}

export function getMockupPath(projectFolder: string, file: string): string {
  return path.join(WORKSPACE_ROOT, 'projects', projectFolder, 'mockups', file);
}
