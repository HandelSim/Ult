/**
 * 06-streaming-workflow.spec.ts
 *
 * Tests the full desired workflow:
 *  1. Click New Project
 *  2. Fill title + description
 *  3. Submit dialog
 *  4. StreamingTerminal appears and shows Haiku output in real time
 *  5. Click "View Configuration" when done
 *  6. Node detail panel shows the AI-generated config
 *  7. Click Approve (Approve & Decompose)
 *  8. Graph view switches to show decomposition in progress
 *  9. Child nodes appear in the tree
 * 10. Click a child node → detail panel updates
 */
import { test, expect } from "@playwright/test";
import { TEST_PROMPT } from "./helpers";

const PROJECT_NAME = "Streaming Workflow Test";

test.describe("Streaming Workflow", () => {

  test("full workflow: create → stream → configure → approve → decompose → inspect child", async ({ page }) => {
    // ── Step 1: Load app ────────────────────────────────────────────────────
    await page.goto("/");
    // SSE connection keeps network active — wait for UI to be ready instead
    await page.waitForLoadState("domcontentloaded");

    // ── Step 2: Open create dialog ──────────────────────────────────────────
    const newBtn = page.locator('[data-testid="new-project-button"]');
    await expect(newBtn).toBeVisible({ timeout: 10000 });
    await newBtn.click();

    await expect(page.locator('[data-testid="project-name"]')).toBeVisible({ timeout: 5000 });

    // ── Step 3: Fill and submit form ─────────────────────────────────────────
    await page.fill('[data-testid="project-name"]', PROJECT_NAME);
    await page.fill('[data-testid="project-prompt"]', TEST_PROMPT);

    const submitBtn = page.locator('[data-testid="create-project"]');
    await expect(submitBtn).toBeEnabled({ timeout: 2000 });
    await submitBtn.click();

    // ── Step 4: Streaming terminal appears ───────────────────────────────────
    const terminal = page.locator('[data-testid="streaming-terminal"]');
    await expect(terminal).toBeVisible({ timeout: 15000 });

    // Terminal shows output (non-empty)
    const output = page.locator('[data-testid="streaming-output"]');
    await expect(output).toBeVisible();

    // ── Step 5: Wait for streaming to finish (Haiku can take up to 60s) ─────
    const completeBtn = page.locator('[data-testid="streaming-complete-btn"]');
    await expect(completeBtn).toBeVisible({ timeout: 90000 });

    // Verify the terminal output has content (Haiku wrote something)
    const outputText = await output.textContent();
    expect(outputText?.trim().length).toBeGreaterThan(20);

    // ── Step 6: Click "View Configuration" ──────────────────────────────────
    await completeBtn.click();

    // Terminal should disappear
    await expect(terminal).not.toBeVisible({ timeout: 5000 });

    // Node detail panel should be visible
    const detailPanel = page.locator('[data-testid="node-detail-panel"]');
    await expect(detailPanel).toBeVisible({ timeout: 15000 });

    // ── Step 7: Verify node was configured by Haiku ──────────────────────────
    // Name should be filled (not empty)
    const nodeName = page.locator('[data-testid="node-name"]');
    await expect(nodeName).toBeVisible();
    const nameText = await nodeName.textContent();
    expect(nameText?.trim().length).toBeGreaterThan(0);

    // Prompt should have content
    const promptEl = page.locator('[data-testid="node-prompt"]');
    const promptText = await promptEl.textContent();
    expect(promptText?.trim().length).toBeGreaterThan(20);

    // Role should be filled
    const roleEl = page.locator('[data-testid="node-role"]');
    const roleValue = await roleEl.inputValue();
    expect(roleValue.trim().length).toBeGreaterThan(2);

    // Status should still be pending (awaiting human approval)
    const statusEl = page.locator('[data-testid="node-status"]');
    const status = await statusEl.getAttribute("data-status");
    expect(status).toBe("pending");

    // ── Step 8: Approve & Decompose ──────────────────────────────────────────
    const approveBtn = page.locator('[data-testid="approve-button"]');
    await expect(approveBtn).toBeVisible();
    await expect(approveBtn).toBeEnabled();
    await approveBtn.click();

    // ── Step 9: Graph view appears ───────────────────────────────────────────
    const treeCanvas = page.locator('[data-testid="tree-canvas"]');
    await expect(treeCanvas).toBeVisible({ timeout: 10000 });

    // Wait for at least 3 nodes (root + 2 children from decomposition)
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="tree-node"]').length >= 3,
      {},
      { timeout: 120000 }
    );

    const nodeCount = await page.locator('[data-testid="tree-node"]').count();
    expect(nodeCount).toBeGreaterThanOrEqual(3);

    // ── Step 10: Click a child node ──────────────────────────────────────────
    // Use node list (right sidebar navigator) — more reliable than canvas clicks
    const listItems = page.locator('[data-testid="node-list-item"]');
    const listCount = await listItems.count();
    expect(listCount).toBeGreaterThanOrEqual(2);

    // Click the second item (first child)
    await listItems.nth(1).click();

    // Detail panel updates to show the child node
    await expect(detailPanel).toBeVisible({ timeout: 10000 });

    const childName = page.locator('[data-testid="node-name"]');
    const childNameText = await childName.textContent();
    expect(childNameText?.trim().length).toBeGreaterThan(0);

    // Child should be a different node than the root
    expect(childNameText?.trim()).not.toEqual(nameText?.trim());

    // Child should be pending (awaiting approval)
    const childStatus = await page.locator('[data-testid="node-status"]').getAttribute("data-status");
    expect(childStatus).toBe("pending");

    // Child should have a prompt
    const childPromptText = await page.locator('[data-testid="node-prompt"]').textContent();
    expect(childPromptText?.trim().length).toBeGreaterThan(10);
  });

  test("streaming terminal shows real-time text output", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-testid="new-project-button"]').click();
    await page.fill('[data-testid="project-name"]', PROJECT_NAME + " Stream");
    await page.fill('[data-testid="project-prompt"]', TEST_PROMPT);
    await page.locator('[data-testid="create-project"]').click();

    // Terminal must appear quickly (< 15s)
    const terminal = page.locator('[data-testid="streaming-terminal"]');
    await expect(terminal).toBeVisible({ timeout: 15000 });

    // The output area should start receiving text within 30 seconds
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="streaming-output"]');
        return el && el.textContent && el.textContent.trim().length > 10;
      },
      {},
      { timeout: 30000 }
    );

    const outputText = await page.locator('[data-testid="streaming-output"]').textContent();
    expect(outputText?.trim().length).toBeGreaterThan(10);
  });

  test("node config is filled after streaming completes", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-testid="new-project-button"]').click();
    await page.fill('[data-testid="project-name"]', PROJECT_NAME + " Config");
    await page.fill('[data-testid="project-prompt"]', TEST_PROMPT);
    await page.locator('[data-testid="create-project"]').click();

    // Wait for terminal to complete
    const completeBtn = page.locator('[data-testid="streaming-complete-btn"]');
    await expect(completeBtn).toBeVisible({ timeout: 90000 });
    await completeBtn.click();

    // Node detail panel shows with filled config
    const detailPanel = page.locator('[data-testid="node-detail-panel"]');
    await expect(detailPanel).toBeVisible({ timeout: 15000 });

    // Prompt field should have substantial content (Haiku generated it)
    const promptEl = page.locator('[data-testid="node-prompt"]');
    const promptText = await promptEl.textContent();
    expect(promptText?.trim().length).toBeGreaterThan(50);

    // Approval button should be present (node is pending)
    const approveBtn = page.locator('[data-testid="approve-button"]');
    await expect(approveBtn).toBeVisible();
    await expect(approveBtn).toBeEnabled();
  });
});
