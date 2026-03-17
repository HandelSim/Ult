/**
 * 07-project-switching.spec.ts
 */
import { test, expect } from "@playwright/test";

test.describe("Project Switching", () => {
  test("switching between projects changes Blacksmith context", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Create project 1
    await page.click("[data-testid='create-project-button']");
    await page.fill("[data-testid='project-name-input']", "Switch Project One");
    await page.fill("[data-testid='project-prompt-input']", "First project description");
    await page.click("[data-testid='create-project-submit']");
    await page.locator("[data-testid='project-list-item']").filter({ hasText: "Switch Project One"  }).first().waitFor({ timeout: 10000 });

    // Create project 2
    await page.click("[data-testid='create-project-button']");
    await page.fill("[data-testid='project-name-input']", "Switch Project Two");
    await page.fill("[data-testid='project-prompt-input']", "Second project description");
    await page.click("[data-testid='create-project-submit']");
    await page.locator("[data-testid='project-list-item']").filter({ hasText: "Switch Project Two"  }).first().waitFor({ timeout: 10000 });

    // Both projects should be in list
    await expect(page.locator("[data-testid='project-list-item']").filter({ hasText: "Switch Project One" }).first()).toBeVisible();
    await expect(page.locator("[data-testid='project-list-item']").filter({ hasText: "Switch Project Two" }).first()).toBeVisible();

    // Switch to project 1
    await page.locator("[data-testid='project-list-item']").filter({ hasText: "Switch Project One"  }).first().click();
    await page.waitForTimeout(1000);
    const proj1Id = await page.locator("[data-testid='project-list-item']").filter({ hasText: "Switch Project One"  }).first().getAttribute("data-project-id");

    // Switch to project 2
    await page.locator("[data-testid='project-list-item']").filter({ hasText: "Switch Project Two"  }).first().click();
    await page.waitForTimeout(1000);
    const proj2Id = await page.locator("[data-testid='project-list-item']").filter({ hasText: "Switch Project Two"  }).first().getAttribute("data-project-id");

    expect(proj1Id).toBeTruthy();
    expect(proj2Id).toBeTruthy();
    expect(proj1Id).not.toBe(proj2Id);

    // Switch back to project 1
    await page.locator("[data-testid='project-list-item']").filter({ hasText: "Switch Project One"  }).first().click();
    await page.waitForTimeout(500);

    // Tree and Blacksmith should still be visible
    await expect(page.locator("[data-testid='blacksmith-terminal']")).toBeVisible();
  });

  test("project list shows both projects with correct data-project-id", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Create two projects
    for (const name of ["DataId Project A", "DataId Project B"]) {
      await page.click("[data-testid='create-project-button']");
      await page.fill("[data-testid='project-name-input']", name);
      await page.fill("[data-testid='project-prompt-input']", "Test project");
      await page.click("[data-testid='create-project-submit']");
      await page.locator("[data-testid='project-list-item']").filter({ hasText: name  }).first().waitFor({ timeout: 10000 });
    }

    // Each item should have a non-empty data-project-id
    const items = page.locator("[data-testid='project-list-item']");
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < count; i++) {
      const id = await items.nth(i).getAttribute("data-project-id");
      expect(id).toBeTruthy();
    }
  });
});
