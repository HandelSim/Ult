import type { Project } from './types';

const BASE = '';

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${BASE}/api/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  return res.json();
}

export async function fetchProject(id: string): Promise<Project> {
  const res = await fetch(`${BASE}/api/projects/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch project: ${res.status}`);
  return res.json();
}

export async function startSmithSession(projectId: string): Promise<void> {
  await fetch(`${BASE}/api/smith/start/${projectId}`, { method: 'POST' });
}

export async function sendSmithMessage(projectId: string, message: string): Promise<void> {
  await fetch(`${BASE}/api/smith/message/${projectId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
}

export function createSmithEventSource(projectId: string): EventSource {
  return new EventSource(`${BASE}/api/smith/stream/${projectId}`);
}
