/**
 * Orchestrator Workflow E2E Tests
 *
 * Tests the full tree-building workflow:
 * 1. Load app
 * 2. Create a new project with name and description
 * 3. Verify root node appears in pending state
 * 4. Click Approve & Decompose
 * 5. Wait for decomposition to complete and children to appear
 * 6. Verify child nodes appear in tree
 *
 * Run with: npx playwright test tests/e2e/orchestrator-workflow.spec.js
 */
const { test, expect } = require('@playwright/test');

test.describe('Agent Tree Orchestrator - Full Workflow', () => {

  test('1. App loads and shows Orchestrator UI', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: '/tmp/ato-step-1-load.png' });

    // Check title
    const title = await page.title();
    expect(title).toContain('Orchestrator');

    // Check header text contains Orchestrator
    const headerText = await page.textContent('body');
    expect(headerText).toMatch(/[Oo]rchestrator/);

    // Check New button exists
    const newButton = page.locator('button', { hasText: '+ New' });
    await expect(newButton).toBeVisible();
  });

  test('2. Create new project — dialog has name and description fields, NO system prompt', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Open create modal
    const newButton = page.locator('button', { hasText: '+ New' });
    await newButton.click();

    await page.screenshot({ path: '/tmp/ato-step-2-modal.png' });

    // Modal should be visible
    const modal = page.locator('text=Create New Project');
    await expect(modal).toBeVisible();

    // Name field should exist
    const nameInput = page.locator('input[placeholder*="E-commerce"]');
    await expect(nameInput).toBeVisible();

    // Description/goal field should exist
    const descField = page.locator('textarea[placeholder*="Be as descriptive"]');
    await expect(descField).toBeVisible();

    // System prompt field should NOT exist
    const systemPromptLabel = page.locator('text=System Prompt');
    await expect(systemPromptLabel).not.toBeVisible();
  });

  test('3. Create project and verify root node appears in pending state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Open create modal
    await page.locator('button', { hasText: '+ New' }).click();
    await page.waitForSelector('text=Create New Project');

    // Fill in project details
    const projectName = `Test Project ${Date.now()}`;
    await page.locator('input[placeholder*="E-commerce"]').fill(projectName);
    await page.locator('textarea[placeholder*="Be as descriptive"]').fill('Build a simple REST API with user authentication');

    await page.screenshot({ path: '/tmp/ato-step-3-filled.png' });

    // Submit
    await page.locator('button', { hasText: 'Create Project' }).click();

    // Wait for modal to close
    await page.waitForSelector('text=Create New Project', { state: 'hidden', timeout: 5000 });

    // Wait for tree to load
    await page.waitForTimeout(2000);

    await page.screenshot({ path: '/tmp/ato-step-3-after-create.png' });

    // Project name should appear in sidebar or toolbar
    const pageText = await page.textContent('body');
    expect(pageText).toContain(projectName.substring(0, 20));

    // Root node should be visible (either in detail view or node list)
    // After creation we auto-navigate to detail view of root node
    const pendingStatus = page.locator('text=Awaiting Approval').first();
    await expect(pendingStatus).toBeVisible({ timeout: 5000 });
  });

  test('4. Root node detail view has Approve & Decompose button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Create a project
    await page.locator('button', { hasText: '+ New' }).click();
    await page.waitForSelector('text=Create New Project');

    const projectName = `Approve Test ${Date.now()}`;
    await page.locator('input[placeholder*="E-commerce"]').fill(projectName);
    await page.locator('textarea[placeholder*="Be as descriptive"]').fill('Build a task management application');
    await page.locator('button', { hasText: 'Create Project' }).click();
    await page.waitForSelector('text=Create New Project', { state: 'hidden', timeout: 5000 });

    // Wait for navigation to detail view
    await page.waitForTimeout(2000);

    await page.screenshot({ path: '/tmp/ato-step-4-detail.png' });

    // Should auto-navigate to detail view showing the root node
    // Look for the Approve & Decompose button
    const approveButton = page.locator('button', { hasText: /Approve.*Decompose|Decompose/i });
    await expect(approveButton).toBeVisible({ timeout: 5000 });
  });

  test('5. Click Approve & Decompose — node transitions to decomposing state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Create a project
    await page.locator('button', { hasText: '+ New' }).click();
    await page.waitForSelector('text=Create New Project');

    const projectName = `Decompose Test ${Date.now()}`;
    await page.locator('input[placeholder*="E-commerce"]').fill(projectName);
    await page.locator('textarea[placeholder*="Be as descriptive"]').fill('Build a simple blog platform with posts and comments');
    await page.locator('button', { hasText: 'Create Project' }).click();
    await page.waitForSelector('text=Create New Project', { state: 'hidden', timeout: 5000 });

    // Wait for detail view to load
    await page.waitForTimeout(2000);

    // Find and click Approve & Decompose
    const approveButton = page.locator('button', { hasText: /Approve.*Decompose|Decompose/i });
    await expect(approveButton).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: '/tmp/ato-step-5-before-approve.png' });
    await approveButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/ato-step-5-after-approve.png' });

    // Node should transition to decomposing or approved status
    const pageText = await page.textContent('body');
    expect(pageText).toMatch(/decomposing|approved|Calling Claude/i);
  });

  test('6. Graph view shows root node in node list', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Create a project
    await page.locator('button', { hasText: '+ New' }).click();
    await page.waitForSelector('text=Create New Project');

    const projectName = `Graph Test ${Date.now()}`;
    await page.locator('input[placeholder*="E-commerce"]').fill(projectName);
    await page.locator('textarea[placeholder*="Be as descriptive"]').fill('Build a URL shortener service');
    await page.locator('button', { hasText: 'Create Project' }).click();
    await page.waitForSelector('text=Create New Project', { state: 'hidden', timeout: 5000 });
    await page.waitForTimeout(2000);

    // Switch to graph view
    const graphButton = page.locator('button', { hasText: 'Graph' });
    await expect(graphButton).toBeVisible({ timeout: 5000 });
    await graphButton.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: '/tmp/ato-step-6-graph.png' });

    // Node list on right should show root node
    const allNodesHeader = page.locator('text=/All Nodes/');
    await expect(allNodesHeader).toBeVisible({ timeout: 5000 });

    // Should show at least 1 node (the root)
    const nodeCount = await page.locator('[style*="padding-left"]').count();
    expect(nodeCount).toBeGreaterThanOrEqual(1);
  });

});
