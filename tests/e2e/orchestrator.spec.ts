/**
 * Orchestrator workflow E2E tests.
 * Tests the full project creation → node generation → approval → decomposition flow.
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

test.describe('Agent Tree Orchestrator — Full Workflow', () => {
  test('(a) App loads and shows create project button', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.*/);

    // App should show the main UI
    await expect(page.locator('text=Agent Tree Orchestrator').or(page.locator('text=Project Orchestrator'))).toBeVisible({ timeout: 10000 });

    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-1-app-loaded.png') });
  });

  test('(b) Create a new project — modal opens and accepts input', async ({ page }) => {
    await page.goto('/');

    // Click "+ New" button in sidebar
    const newBtn = page.locator('button', { hasText: '+ New' }).first();
    await expect(newBtn).toBeVisible({ timeout: 10000 });
    await newBtn.click();

    // Modal should appear
    await expect(page.locator('text=Create New Project')).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-2-create-dialog.png') });

    // System Prompt field should NOT be present
    await expect(page.locator('text=System Prompt')).not.toBeVisible();

    // Fill in project name
    await page.fill('input[placeholder*="e.g. E-commerce"]', 'Test Orchestrator Project');

    // Fill in description (required)
    await page.fill(
      'textarea[placeholder*="descriptive"]',
      'Build a REST API using Node.js and TypeScript with Express, SQLite database, authentication middleware, and comprehensive test coverage. Target: production-ready API server.'
    );

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-3-form-filled.png') });

    // Submit button should be enabled
    const submitBtn = page.locator('button', { hasText: 'Create Project' });
    await expect(submitBtn).toBeEnabled();
  });

  test('(c) Create project and verify root node shows Awaiting Approval', async ({ page }) => {
    await page.goto('/');

    // Open create modal
    await page.locator('button', { hasText: '+ New' }).first().click();
    await expect(page.locator('text=Create New Project')).toBeVisible({ timeout: 5000 });

    // Fill form
    const projectName = `E2E Project ${Date.now()}`;
    await page.fill('input[placeholder*="e.g. E-commerce"]', projectName);
    await page.fill(
      'textarea[placeholder*="descriptive"]',
      'Build a task management API with Node.js, TypeScript, Express, and SQLite. Include CRUD endpoints for tasks, user auth via JWT, and unit tests.'
    );

    // Submit
    await page.locator('button', { hasText: 'Create Project' }).click();

    // Modal should close and project should be selected
    await expect(page.locator('text=Create New Project')).not.toBeVisible({ timeout: 10000 });

    // Wait for root node detail view to appear
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-4-after-create.png') });

    // The root node should show "Awaiting Approval" status badge
    // Give the initial node generator a moment to run (it's async)
    await page.waitForTimeout(2000);

    const awaitingBadge = page.locator('text=Awaiting Approval').first();
    await expect(awaitingBadge).toBeVisible({ timeout: 15000 });

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-5-awaiting-approval.png') });
  });

  test('(d) Manual mode — approve root node triggers decomposition', async ({ page }) => {
    await page.goto('/');

    // Create a project
    await page.locator('button', { hasText: '+ New' }).first().click();
    await expect(page.locator('text=Create New Project')).toBeVisible({ timeout: 5000 });

    const projectName = `Approve Test ${Date.now()}`;
    await page.fill('input[placeholder*="e.g. E-commerce"]', projectName);
    await page.fill(
      'textarea[placeholder*="descriptive"]',
      'Build a simple Express REST API with TypeScript. Single endpoint for health check. Minimal scope for testing.'
    );
    await page.locator('button', { hasText: 'Create Project' }).click();
    await expect(page.locator('text=Create New Project')).not.toBeVisible({ timeout: 10000 });

    // Wait for root node to appear and initial gen to run
    await page.waitForTimeout(3000);

    // Verify we're in detail view and the node shows Awaiting Approval
    await expect(page.locator('text=Awaiting Approval').first()).toBeVisible({ timeout: 15000 });

    // Verify mode toggle shows Manual (default)
    await expect(page.locator('button', { hasText: 'Manual' }).first()).toBeVisible();

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-6-manual-mode.png') });

    // Click "Approve & Decompose"
    const approveBtn = page.locator('button', { hasText: /Approve/ }).first();
    await expect(approveBtn).toBeVisible({ timeout: 5000 });
    await approveBtn.click();

    // Decomposition should start — status should change
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-7-decomposing.png') });

    // Eventually the status changes from Awaiting Approval
    await expect(
      page.locator('text=Decomposing').or(page.locator('text=Approved')).first()
    ).toBeVisible({ timeout: 30000 });

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-8-after-approve.png') });
  });

  test('(e) Verify is_leaf checkbox exists in Config tab', async ({ page }) => {
    await page.goto('/');

    // Create project and get to node detail
    await page.locator('button', { hasText: '+ New' }).first().click();
    await expect(page.locator('text=Create New Project')).toBeVisible({ timeout: 5000 });

    await page.fill('input[placeholder*="e.g. E-commerce"]', `Leaf Test ${Date.now()}`);
    await page.fill('textarea[placeholder*="descriptive"]', 'Test project for checking is_leaf checkbox functionality in node configuration.');
    await page.locator('button', { hasText: 'Create Project' }).click();
    await expect(page.locator('text=Create New Project')).not.toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2000);

    // Switch to detail view if not already there
    const detailBtn = page.locator('button', { hasText: 'Detail' });
    if (await detailBtn.isVisible()) {
      await detailBtn.click();
    }

    // Enter edit mode
    const editBtn = page.locator('button', { hasText: 'Edit' }).first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }

    // Config tab should be active by default — look for the is_leaf checkbox
    await expect(page.locator('text=Leaf node').first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-9-leaf-checkbox.png') });
  });
});
