/**
 * 02-blacksmith-conversation.spec.ts
 */
import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import { sendBlacksmithMessage, getBlacksmithMessages } from "./helpers";

test.describe("Blacksmith Conversation", () => {
  test("Blacksmith asks clarifying questions after project creation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    // Create project
    await page.click("[data-testid='create-project-button']");
    await page.fill("[data-testid='project-name-input']", "Todo App Project");
    await page.fill("[data-testid='project-prompt-input']", "Build a simple todo list app with React and Express");
    await page.click("[data-testid='create-project-submit']");
    await page.locator("[data-testid='project-list-item']").filter({ hasText: "Todo App Project"  }).first().waitFor({ timeout: 10000 });

    // Select the project to switch Blacksmith
    await page.locator("[data-testid='project-list-item']").filter({ hasText: "Todo App Project"  }).first().click();

    // Wait for Blacksmith to become idle (first message may stream in)
    await page.waitForSelector("[data-testid='blacksmith-status'][data-status='idle']", { timeout: 120000 });

    // Send an initial greeting to get clarifying questions
    await sendBlacksmithMessage(page, "Hello! I need help designing a todo list app with React and Express.");

    // Check messages appeared
    const messages = await getBlacksmithMessages(page);
    expect(messages.length).toBeGreaterThanOrEqual(2); // user + assistant

    // At least one assistant message should exist with meaningful content
    const assistantMessages = await page.locator("[data-testid='blacksmith-message-assistant']").allTextContents();
    expect(assistantMessages.length).toBeGreaterThanOrEqual(1);
    expect(assistantMessages[0].length).toBeGreaterThan(20);
  });

  test("send answer and get follow-up", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    await page.click("[data-testid='create-project-button']");
    await page.fill("[data-testid='project-name-input']", "Conversation Flow Test");
    await page.fill("[data-testid='project-prompt-input']", "Build a team collaboration tool");
    await page.click("[data-testid='create-project-submit']");
    await page.locator("[data-testid='project-list-item']").filter({ hasText: "Conversation Flow Test"  }).first().waitFor({ timeout: 10000 });
    await page.locator("[data-testid='project-list-item']").filter({ hasText: "Conversation Flow Test"  }).first().click();
    await page.waitForSelector("[data-testid='blacksmith-status'][data-status='idle']", { timeout: 120000 });

    // First message
    await sendBlacksmithMessage(page, "I want to build a task management tool for remote teams.");

    // Check we got a response
    const msgs1 = await page.locator("[data-testid='blacksmith-message']").count();
    expect(msgs1).toBeGreaterThanOrEqual(2);

    // Send second message — verify it's accepted (input enabled + message appears)
    const input = page.locator('[data-testid="blacksmith-input"]');
    await expect(input).toBeEnabled({ timeout: 5000 });
    await input.fill("The target users are software development teams, 5-50 people. React frontend, Node.js backend.");
    await input.press("Enter");

    // User message should appear in the chat immediately
    await expect(page.locator("[data-testid='blacksmith-message']")).toHaveCount(msgs1 + 1, { timeout: 5000 });

    // Wait for Blacksmith response (with generous timeout)
    await page.waitForSelector("[data-testid='blacksmith-status'][data-status='idle']", { timeout: 240000 });

    // Should have more messages now (at least user + assistant)
    const msgs2 = await page.locator("[data-testid='blacksmith-message']").count();
    expect(msgs2).toBeGreaterThan(msgs1);
  });
});
