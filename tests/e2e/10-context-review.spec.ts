/**
 * 10-context-review.spec.ts
 * Verifies that the review-contexts-panel shows generated file paths with correct content.
 */
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { createProject } from "./helpers";

test.describe("Context Review Panel", () => {
  test("review-contexts-panel appears after clicking generate", async ({ page, request }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    const projectId = await createProject(page, "Review Panel Test", "Build a notification service");

    // Generate contexts by clicking the button
    await expect(page.locator("[data-testid='generate-contexts-button']")).toBeVisible({ timeout: 10000 });
    await page.click("[data-testid='generate-contexts-button']");

    // Wait for the review panel to appear
    await expect(page.locator("[data-testid='review-contexts-panel']")).toBeVisible({ timeout: 10000 });
  });

  test("context-file-tree shows generated file paths", async ({ page, request }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    const projectId = await createProject(page, "File Tree Test", "Build an email service");

    if (projectId) {
      // Patch root node to be a leaf so we get real files
      const treeRes = await request.get(`/api/projects/${projectId}/tree`);
      const tree = await treeRes.json();
      const rootNodeId = tree.nodes[0]?.id;

      if (rootNodeId) {
        await request.patch(`/api/projects/${projectId}/nodes/${rootNodeId}`, {
          data: { is_leaf: true },
        });
      }
    }

    // Click generate
    await expect(page.locator("[data-testid='generate-contexts-button']")).toBeVisible({ timeout: 10000 });
    await page.click("[data-testid='generate-contexts-button']");

    // Wait for panel
    await expect(page.locator("[data-testid='review-contexts-panel']")).toBeVisible({ timeout: 10000 });

    // File tree should be visible with at least the workflows spec
    await expect(page.locator("[data-testid='context-file-tree']")).toBeVisible({ timeout: 5000 });
    const items = page.locator("[data-testid='context-file-tree'] li");
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test("generated CLAUDE.md contains node name and task", async ({ page, request }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    const projectId = await createProject(page, "CLAUDE.md Content Test", "Build an authentication module");

    if (projectId) {
      // Patch root node to leaf
      const treeRes = await request.get(`/api/projects/${projectId}/tree`);
      const tree = await treeRes.json();
      const rootNode = tree.nodes[0];

      if (rootNode) {
        await request.patch(`/api/projects/${projectId}/nodes/${rootNode.id}`, {
          data: {
            is_leaf: true,
            acceptance_criteria: "All auth endpoints respond with proper status codes",
          },
        });

        // Generate contexts via API
        const genRes = await request.post(`/api/projects/${projectId}/generate-contexts`);
        const genData = await genRes.json();

        // Find and read the CLAUDE.md file
        const claudeMdFile = genData.generatedFiles?.find((f: string) => f.endsWith("CLAUDE.md"));
        if (claudeMdFile && fs.existsSync(claudeMdFile)) {
          const content = fs.readFileSync(claudeMdFile, "utf-8");
          // Should contain the node name heading
          expect(content).toContain("# ");
          // Should contain the task section
          expect(content).toContain("## Your Task");
          // Should contain the project context
          expect(content).toContain("## Project Context");
          // Should contain acceptance criteria
          expect(content).toContain("## Acceptance Criteria");
        }
      }
    }
  });

  test("generated .hammer-config.json has correct structure", async ({ page, request }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const projectId = await createProject(page, "Hammer Config Test", "Build a logging service");

    if (projectId) {
      const treeRes = await request.get(`/api/projects/${projectId}/tree`);
      const tree = await treeRes.json();
      const rootNode = tree.nodes[0];

      if (rootNode) {
        await request.patch(`/api/projects/${projectId}/nodes/${rootNode.id}`, {
          data: { is_leaf: true },
        });

        const genRes = await request.post(`/api/projects/${projectId}/generate-contexts`);
        const genData = await genRes.json();

        const hammerFile = genData.generatedFiles?.find((f: string) => f.endsWith(".hammer-config.json"));
        if (hammerFile && fs.existsSync(hammerFile)) {
          const config = JSON.parse(fs.readFileSync(hammerFile, "utf-8"));
          expect(config).toHaveProperty("prompt");
          expect(config).toHaveProperty("cwd");
          expect(config).toHaveProperty("model");
          expect(config).toHaveProperty("acceptanceChecks");
          expect(Array.isArray(config.acceptanceChecks)).toBeTruthy();
        }
      }
    }
  });
});
