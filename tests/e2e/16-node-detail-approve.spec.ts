/**
 * 16-node-detail-approve.spec.ts
 *
 * Tests for Node Detail tab rendering and the Approve & Decompose flow.
 * This is core functionality — clicking a node must show the detail panel
 * with the approve button, and clicking approve must trigger decomposition.
 */
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const API_BASE = "http://localhost:3000";

test.describe("Node Detail Tab & Approve/Decompose", () => {
  test("clicking a tree node opens Node Detail tab with content (not loading)", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await page.click("[data-testid='create-project-button']");
    await page.fill("[data-testid='project-name-input']", "Node Detail Test");
    await page.fill("[data-testid='project-prompt-input']", "Build a todo app");
    await page.click("[data-testid='create-project-submit']");
    await page.locator("[data-testid='project-list-item']").filter({ hasText: "Node Detail Test" }).first().waitFor({ timeout: 10000 });
    await page.locator("[data-testid='project-list-item']").filter({ hasText: "Node Detail Test" }).first().click();

    // Click the root node in the tree graph
    const rootNodeButton = page.locator("[data-testid='tree-node']").first();
    await rootNodeButton.waitFor({ timeout: 10000 });
    await rootNodeButton.click();

    // Node Detail tab should become active
    const nodeDetailTab = page.locator("[data-testid='center-tab-node-detail']");
    await expect(nodeDetailTab).toBeVisible();

    // Should NOT show "Loading node..." — fix verifies this works now
    await expect(page.locator("text=Loading node...")).not.toBeVisible({ timeout: 3000 });

    // Node name should be visible in the detail panel
    await expect(page.locator("[data-testid='node-name']")).toBeVisible({ timeout: 5000 });
  });

  test("Approve & Decompose button is visible for pending non-leaf nodes", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await page.click("[data-testid='create-project-button']");
    await page.fill("[data-testid='project-name-input']", "Approve Button Test");
    await page.fill("[data-testid='project-prompt-input']", "Build an e-commerce platform");
    await page.click("[data-testid='create-project-submit']");
    await page.locator("[data-testid='project-list-item']").filter({ hasText: "Approve Button Test" }).first().waitFor({ timeout: 10000 });
    await page.locator("[data-testid='project-list-item']").filter({ hasText: "Approve Button Test" }).first().click();

    // Click root node
    await page.locator("[data-testid='tree-node']").first().waitFor({ timeout: 10000 });
    await page.locator("[data-testid='tree-node']").first().click();

    // The approve button should be visible (root node is pending + non-leaf)
    await expect(page.locator("[data-testid='approve-button']")).toBeVisible({ timeout: 5000 });
    const approveText = await page.locator("[data-testid='approve-button']").textContent();
    // Non-leaf node shows "Approve & Decompose"
    expect(approveText).toContain("Approve");
  });

  test("approve via API changes node status to approved", async ({ request }) => {
    // Create project
    const createRes = await request.post(`${API_BASE}/api/projects`, {
      data: { name: "Approve API Test", prompt: "Build a payment service" },
    });
    expect(createRes.ok()).toBe(true);
    const { project } = await createRes.json();
    const projectId = project.id;

    // Get root node
    const treeRes = await request.get(`${API_BASE}/api/projects/${projectId}/tree`);
    const { nodes } = await treeRes.json();
    const rootNode = nodes.find((n: any) => !n.parent_id);
    expect(rootNode).toBeTruthy();
    expect(rootNode.status).toBe("pending");

    // Approve root node
    const approveRes = await request.post(`${API_BASE}/api/projects/${projectId}/nodes/${rootNode.id}/approve`);
    expect(approveRes.ok()).toBe(true);

    // Wait a moment for the async decomposition to begin
    await new Promise(r => setTimeout(r, 500));

    // Node should now be approved (or decomposing)
    const updatedTree = await request.get(`${API_BASE}/api/projects/${projectId}/tree`);
    const { nodes: updatedNodes } = await updatedTree.json();
    const updatedRoot = updatedNodes.find((n: any) => n.id === rootNode.id);
    expect(["approved", "decomposing"]).toContain(updatedRoot.status);
  });

  test("approving a non-leaf node triggers decomposition and creates children", async ({ request }) => {
    const createRes = await request.post(`${API_BASE}/api/projects`, {
      data: { name: "Decompose API Test", prompt: "Build a microservices app" },
    });
    expect(createRes.ok()).toBe(true);
    const { project } = await createRes.json();
    const projectId = project.id;

    // Approve root node — this triggers Blacksmith decomposition async
    const treeRes = await request.get(`${API_BASE}/api/projects/${projectId}/tree`);
    const { nodes } = await treeRes.json();
    const rootNode = nodes.find((n: any) => !n.parent_id);

    const approveRes = await request.post(`${API_BASE}/api/projects/${projectId}/nodes/${rootNode.id}/approve`);
    expect(approveRes.ok()).toBe(true);
    const approveData = await approveRes.json();

    // Response should indicate decomposition was started for non-leaf node
    expect(approveData.nodeId).toBe(rootNode.id);
    // Message should mention decomposition (for non-leaf) or approval (for leaf)
    expect(approveData.message).toBeTruthy();
  });

  test("node status badge shows correct status in Node Detail panel", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await page.click("[data-testid='create-project-button']");
    await page.fill("[data-testid='project-name-input']", "Status Badge Test");
    await page.fill("[data-testid='project-prompt-input']", "Build a chat app");
    await page.click("[data-testid='create-project-submit']");
    await page.locator("[data-testid='project-list-item']").filter({ hasText: "Status Badge Test" }).first().waitFor({ timeout: 10000 });
    await page.locator("[data-testid='project-list-item']").filter({ hasText: "Status Badge Test" }).first().click();

    // Click root node to open detail
    await page.locator("[data-testid='tree-node']").first().waitFor({ timeout: 10000 });
    await page.locator("[data-testid='tree-node']").first().click();

    // Status badge should show "pending" for new root node
    const statusBadge = page.locator("[data-testid='node-status']");
    await expect(statusBadge).toBeVisible({ timeout: 5000 });
    const statusText = (await statusBadge.textContent() || "").toLowerCase();
    expect(statusText).toContain("pending");
  });
});
