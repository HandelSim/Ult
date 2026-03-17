/**
 * 11-execution-start.spec.ts
 * Verifies clicking "Start Execution" changes project status to 'executing'.
 */
import { test, expect } from "@playwright/test";
import { createProject } from "./helpers";

test.describe("Execution Start", () => {
  test("start-execution-button is hidden when status is building", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    await createProject(page, "Exec Hidden Test", "Build a caching layer");

    // start-execution-button should NOT be visible until contexts are generated
    await expect(page.locator("[data-testid='start-execution-button']")).not.toBeVisible();
  });

  test("start-execution-button appears after generate-contexts API call", async ({ page, request }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    const projectId = await createProject(page, "Exec Appear Test", "Build a search service");

    if (projectId) {
      // Set status to contexts_generated via API
      await request.post(`/api/projects/${projectId}/generate-contexts`);

      // Refresh to pick up status
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await page.locator("[data-testid='project-list-item']").filter({ hasText: "Exec Appear Test" }).first().click();

      await expect(page.locator("[data-testid='start-execution-button']")).toBeVisible({ timeout: 10000 });
    }
  });

  test("clicking start-execution-button calls the API and changes status", async ({ page, request }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    const projectId = await createProject(page, "Start Execution Test", "Build a rate limiter");

    if (projectId) {
      // Set status to contexts_generated first
      await request.post(`/api/projects/${projectId}/generate-contexts`);

      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await page.locator("[data-testid='project-list-item']").filter({ hasText: "Start Execution Test" }).first().click();

      // Intercept the start-execution call
      const execPromise = page.waitForRequest(req =>
        req.url().includes("/start-execution") && req.method() === "POST"
      );

      await page.click("[data-testid='start-execution-button']");
      const req = await execPromise;
      expect(req.url()).toContain("/start-execution");

      // Wait for response
      const res = await page.waitForResponse(r => r.url().includes("/start-execution"), { timeout: 10000 });
      const body = await res.json();
      expect(body.status).toBe("executing");
    }
  });

  test("start-execution API response includes queued nodes", async ({ request }) => {
    // Create project via API
    const createRes = await request.post("/api/projects", {
      data: { name: "Queue Test Project", prompt: "Build a message queue service" },
    });
    expect(createRes.ok()).toBeTruthy();
    const { project } = await createRes.json();

    // Set status to contexts_generated
    await request.post(`/api/projects/${project.id}/generate-contexts`);

    // Start execution
    const execRes = await request.post(`/api/projects/${project.id}/start-execution`);
    expect(execRes.ok()).toBeTruthy();
    const execData = await execRes.json();
    expect(execData.status).toBe("executing");
    expect(Array.isArray(execData.queuedNodes)).toBeTruthy();
  });

  test("after start-execution, generate-contexts-button is hidden and start-execution-button is hidden", async ({ page, request }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    const projectId = await createProject(page, "Post-Exec Button Test", "Build a webhook service");

    if (projectId) {
      await request.post(`/api/projects/${projectId}/generate-contexts`);
      await request.post(`/api/projects/${projectId}/start-execution`);

      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await page.locator("[data-testid='project-list-item']").filter({ hasText: "Post-Exec Button Test" }).first().click();

      // Both buttons should be hidden when status is 'executing'
      await expect(page.locator("[data-testid='generate-contexts-button']")).not.toBeVisible();
      await expect(page.locator("[data-testid='start-execution-button']")).not.toBeVisible();
    }
  });
});
