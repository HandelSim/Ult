/**
 * 14-auto-mode-scaffold.spec.ts
 * Verifies the auto-mode toggle exists, can be toggled, and persists via API.
 */
import { test, expect } from "@playwright/test";
import { createProject } from "./helpers";

test.describe("Auto Mode Scaffold", () => {
  test("auto-mode-toggle is visible when a project is selected", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    await createProject(page, "Auto Mode Test", "Build a data processing pipeline");

    // Toggle should be visible in the header bar
    await expect(page.locator("[data-testid='auto-mode-toggle']")).toBeVisible({ timeout: 10000 });
  });

  test("auto-mode-toggle is a checkbox", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    await createProject(page, "Auto Mode Checkbox Test", "Build a recommendation engine");

    const toggle = page.locator("[data-testid='auto-mode-toggle']");
    await expect(toggle).toBeVisible({ timeout: 10000 });

    // Should be an input[type=checkbox]
    await expect(toggle).toHaveAttribute("type", "checkbox");
  });

  test("auto-mode-toggle defaults to unchecked", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    await createProject(page, "Auto Mode Default Test", "Build an image processing service");

    const toggle = page.locator("[data-testid='auto-mode-toggle']");
    await expect(toggle).toBeVisible({ timeout: 10000 });

    // Default should be unchecked (auto_mode: false)
    await expect(toggle).not.toBeChecked();
  });

  test("auto-mode-toggle can be checked and unchecked", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    await createProject(page, "Auto Mode Toggle Test", "Build an event streaming service");

    const toggle = page.locator("[data-testid='auto-mode-toggle']");
    await expect(toggle).toBeVisible({ timeout: 10000 });

    // Check it
    await toggle.click();
    await expect(toggle).toBeChecked();

    // Uncheck it
    await toggle.click();
    await expect(toggle).not.toBeChecked();
  });

  test("auto-mode API endpoint persists the value", async ({ request }) => {
    const createRes = await request.post("/api/projects", {
      data: { name: "Auto Mode API Test", prompt: "Build a batch processing system" },
    });
    expect(createRes.ok()).toBeTruthy();
    const { project } = await createRes.json();

    // Set auto_mode to true
    const setRes = await request.post(`/api/projects/${project.id}/auto-mode`, {
      data: { auto_mode: true },
    });
    expect(setRes.ok()).toBeTruthy();
    const setData = await setRes.json();
    expect(setData.auto_mode).toBe(true);

    // Get project and verify
    const treeRes = await request.get(`/api/projects/${project.id}/tree`);
    const tree = await treeRes.json();
    expect(tree.project.auto_mode).toBe(true);

    // Set back to false
    const unsetRes = await request.post(`/api/projects/${project.id}/auto-mode`, {
      data: { auto_mode: false },
    });
    expect(unsetRes.ok()).toBeTruthy();
    const unsetData = await unsetRes.json();
    expect(unsetData.auto_mode).toBe(false);
  });

  test("auto-mode-toggle is absent when no project is selected", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    // No project selected
    await expect(page.locator("[data-testid='auto-mode-toggle']")).not.toBeVisible();
  });

  test("new project has auto_mode false by default in project.json", async ({ request }) => {
    const createRes = await request.post("/api/projects", {
      data: { name: "Default Auto Mode Test", prompt: "Build a health check service" },
    });
    expect(createRes.ok()).toBeTruthy();
    const { project } = await createRes.json();

    // Check project tree for auto_mode
    const treeRes = await request.get(`/api/projects/${project.id}/tree`);
    const tree = await treeRes.json();

    // auto_mode should default to false
    expect(tree.project.auto_mode).toBe(false);
  });
});
