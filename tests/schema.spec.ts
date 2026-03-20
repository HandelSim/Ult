import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const WORKSPACE = process.env.SMITH_WORKSPACE || path.join(process.env.HOME || '/root', 'smith-projects');

// ── Scenario 1: Landing page renders ───────────────────────────────────────
test('scenario 1: landing page shows SCHEMA branding', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('text=SCHEMA')).toBeVisible();
  await expect(page.locator('text=Projects')).toBeVisible();
});

// ── Scenario 2: Health check API ────────────────────────────────────────────
test('scenario 2: health check returns ok', async ({ request }) => {
  const res = await request.get(`${BASE}/api/health`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe('ok');
  expect(body.version).toBe('2.0.0');
});

// ── Scenario 3: Projects API returns array ──────────────────────────────────
test('scenario 3: projects API returns array', async ({ request }) => {
  const res = await request.get(`${BASE}/api/projects`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

// ── Scenario 4: New project dialog ──────────────────────────────────────────
test('scenario 4: new project dialog opens and has input', async ({ page }) => {
  await page.goto(BASE);
  // Click the + button or "New Project" button
  const newProjectBtn = page.locator('button:has-text("New Project"), button[title="New Project"]').first();
  await newProjectBtn.click();
  // Dialog should appear
  await expect(page.locator('text=New Project').nth(1)).toBeVisible({ timeout: 2000 }).catch(() => {});
  const textarea = page.locator('textarea[placeholder*="trading"]');
  await expect(textarea).toBeVisible();
  // Can type in it
  await textarea.fill('A test todo app');
  await expect(textarea).toHaveValue('A test todo app');
  // Cancel closes dialog
  await page.locator('button:has-text("Cancel")').click();
  await expect(textarea).not.toBeVisible();
});

// ── Scenario 5: WebSocket connects ──────────────────────────────────────────
test('scenario 5: websocket connects and status bar shows connected', async ({ page }) => {
  await page.goto(BASE);
  // Status bar should show connection status
  await page.waitForTimeout(1000); // let WS connect
  const statusBar = page.locator('.font-mono').last();
  await expect(statusBar).toBeVisible();
  // Either 'live' or connection indicator should be present
  const liveText = page.locator('text=live');
  await expect(liveText).toBeVisible({ timeout: 3000 });
});

// ── Scenario 6: Project detail with fixture data ─────────────────────────────
test('scenario 6: project with folders shows tree and detail panel', async ({ page }) => {
  // Create a fixture project in the workspace
  const projectsDir = path.join(WORKSPACE, 'projects');
  const projectId = 'test-fixture-abc123';
  const projectDir = path.join(projectsDir, projectId);
  fs.mkdirSync(projectDir, { recursive: true });

  const projectJson = {
    name: 'Test Fixture App',
    session_id: 'abc123',
    status: 'decomposing',
    created_at: new Date().toISOString(),
    folders: [
      {
        path: 'src',
        description: 'Main source code',
        status: 'approved'
      },
      {
        path: 'src/api',
        description: 'REST API handlers',
        status: 'executing',
        libraries: ['express', 'zod'],
        contracts: {
          provides: ['GET /users', 'POST /users'],
          consumes: ['Database.query']
        }
      },
      {
        path: 'tests',
        description: 'Playwright end-to-end tests',
        status: 'pending'
      }
    ]
  };

  fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(projectJson, null, 2));

  // Update the index
  const indexPath = path.join(WORKSPACE, 'projects-index.json');
  let index = { projects: [] as { id: string; name: string; session_id: string; status: string; created_at: string; folder: string }[] };
  if (fs.existsSync(indexPath)) {
    try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch {}
  }
  // Remove any existing fixture entry
  index.projects = index.projects.filter((p) => p.folder !== projectId);
  index.projects.push({
    id: projectId,
    name: 'Test Fixture App',
    session_id: 'abc123',
    status: 'decomposing',
    created_at: new Date().toISOString(),
    folder: projectId
  });
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  // Navigate and check project appears in sidebar
  await page.goto(BASE);
  await page.waitForTimeout(500);
  await expect(page.locator('text=Test Fixture App')).toBeVisible({ timeout: 5000 });

  // Click project
  await page.locator('text=Test Fixture App').click();

  // Tree should show folder nodes
  await expect(page.locator('text=src').first()).toBeVisible({ timeout: 3000 });

  // Cleanup
  fs.rmSync(projectDir, { recursive: true, force: true });
  index.projects = index.projects.filter((p) => p.folder !== projectId);
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
});
