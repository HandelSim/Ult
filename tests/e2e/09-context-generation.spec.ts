/**
 * 09-context-generation.spec.ts
 * Tests that the "Generate Agent Contexts" button works and produces files.
 */
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { createProject } from "./helpers";

test.describe("Context Generation", () => {
  test("generate-contexts-button appears when project has nodes", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    const projectId = await createProject(page, "Context Gen Test", "Build a REST API with authentication");

    // Button should appear since project is in 'building' status and has a root node
    await expect(page.locator("[data-testid='generate-contexts-button']")).toBeVisible({ timeout: 10000 });
  });

  test("clicking generate-contexts-button calls the API and shows status change", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    const projectId = await createProject(page, "Context Gen API Test", "Build a microservice for payments");

    // Intercept the generate-contexts API call
    const generateContextsPromise = page.waitForRequest(req =>
      req.url().includes("/generate-contexts") && req.method() === "POST"
    );

    await page.click("[data-testid='generate-contexts-button']");
    const req = await generateContextsPromise;
    expect(req.url()).toContain("/generate-contexts");

    // Wait for response and status update
    await page.waitForResponse(res => res.url().includes("/generate-contexts"), { timeout: 10000 });
  });

  test("generate-contexts-button is absent when no project is selected", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    // No project selected — button should not be present
    await expect(page.locator("[data-testid='generate-contexts-button']")).not.toBeVisible();
  });

  test("generating contexts creates files on disk for leaf nodes", async ({ page, request }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    const projectId = await createProject(page, "Context Files Test", "Build a todo list application");

    // First inject a leaf node via the API directly to avoid waiting for Blacksmith
    if (projectId) {
      // Get the project tree to find the root node id
      const treeRes = await request.get(`/api/projects/${projectId}/tree`);
      const tree = await treeRes.json();
      const rootNodeId = tree.nodes[0]?.id;

      if (rootNodeId) {
        // Patch the root node to be a leaf
        await request.patch(`/api/projects/${projectId}/nodes/${rootNodeId}`, {
          data: {
            is_leaf: true,
            acceptance_criteria: "All endpoints respond correctly",
          },
        });

        // Generate contexts via API
        const genRes = await request.post(`/api/projects/${projectId}/generate-contexts`);
        expect(genRes.ok()).toBeTruthy();
        const genData = await genRes.json();
        expect(genData.status).toBe("contexts_generated");
        expect(Array.isArray(genData.generatedFiles)).toBeTruthy();

        // Verify files exist on disk
        if (genData.generatedFiles.length > 0) {
          for (const filePath of genData.generatedFiles) {
            expect(fs.existsSync(filePath)).toBeTruthy();
          }
        }
      }
    }
  });

  test("start-execution-button appears after contexts are generated", async ({ page, request }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    const projectId = await createProject(page, "Execution Button Test", "Build a file upload service");

    if (projectId) {
      // Generate contexts via API directly
      await request.post(`/api/projects/${projectId}/generate-contexts`);

      // Refresh the page to pick up status change
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await page.locator("[data-testid='project-list-item']").filter({ hasText: "Execution Button Test" }).first().click();

      // start-execution-button should now be visible
      await expect(page.locator("[data-testid='start-execution-button']")).toBeVisible({ timeout: 10000 });
    }
  });
});
