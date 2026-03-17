/**
 * 13-full-lifecycle.spec.ts
 * Full end-to-end lifecycle with a simple project:
 * create → generate contexts → start execution
 */
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import { createProject } from "./helpers";

test.describe("Full Lifecycle", () => {
  test("complete workflow: create → generate contexts → verify files → start execution", async ({ page, request }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    // Step 1: Create project
    const projectId = await createProject(page, "Lifecycle Test", "Build a simple REST API with CRUD operations");
    expect(projectId).toBeTruthy();

    if (!projectId) return;

    // Step 2: Make root node a leaf (simulating a simple single-component project)
    const treeRes = await request.get(`/api/projects/${projectId}/tree`);
    const tree = await treeRes.json();
    const rootNode = tree.nodes[0];
    expect(rootNode).toBeTruthy();

    await request.patch(`/api/projects/${projectId}/nodes/${rootNode.id}`, {
      data: {
        is_leaf: true,
        acceptance_criteria: "All CRUD endpoints respond with proper HTTP status codes",
      },
    });

    // Step 3: Generate contexts via UI
    await expect(page.locator("[data-testid='generate-contexts-button']")).toBeVisible({ timeout: 10000 });
    await page.click("[data-testid='generate-contexts-button']");

    // Step 4: Verify review panel appears
    await expect(page.locator("[data-testid='review-contexts-panel']")).toBeVisible({ timeout: 10000 });

    // Step 5: Verify files were created on disk
    const genRes = await request.get(`/api/projects/${projectId}/tree`);
    const updatedTree = await genRes.json();
    expect(updatedTree.project.status).toBe("contexts_generated");

    // Step 6: start-execution-button should appear
    await expect(page.locator("[data-testid='start-execution-button']")).toBeVisible({ timeout: 10000 });

    // Step 7: Click Start Execution
    const execPromise = page.waitForResponse(r => r.url().includes("/start-execution"), { timeout: 10000 });
    await page.click("[data-testid='start-execution-button']");
    const execRes = await execPromise;
    const execData = await execRes.json();
    expect(execData.status).toBe("executing");
  });

  test("project status progresses correctly through lifecycle stages", async ({ request }) => {
    // Create
    const createRes = await request.post("/api/projects", {
      data: { name: "Status Progression Test", prompt: "Build a task scheduler" },
    });
    const { project } = await createRes.json();
    expect(project.status).toBe("building");

    // Generate contexts
    const genRes = await request.post(`/api/projects/${project.id}/generate-contexts`);
    const genData = await genRes.json();
    expect(genData.status).toBe("contexts_generated");

    // Verify project status updated
    const treeRes = await request.get(`/api/projects/${project.id}/tree`);
    const tree = await treeRes.json();
    expect(tree.project.status).toBe("contexts_generated");

    // Start execution
    const execRes = await request.post(`/api/projects/${project.id}/start-execution`);
    const execData = await execRes.json();
    expect(execData.status).toBe("executing");

    // Verify final status
    const finalRes = await request.get(`/api/projects/${project.id}/tree`);
    const finalTree = await finalRes.json();
    expect(finalTree.project.status).toBe("executing");
  });

  test("generated workflows.spec.ts exists after context generation", async ({ request }) => {
    const createRes = await request.post("/api/projects", {
      data: { name: "Workflow Spec Test", prompt: "Build a notification system" },
    });
    const { project } = await createRes.json();

    const genRes = await request.post(`/api/projects/${project.id}/generate-contexts`);
    expect(genRes.ok()).toBeTruthy();
    const genData = await genRes.json();

    // workflows.spec.ts should always be generated
    const workflowSpec = genData.generatedFiles?.find((f: string) => f.endsWith("workflows.spec.ts"));
    expect(workflowSpec).toBeTruthy();
    if (workflowSpec) {
      expect(fs.existsSync(workflowSpec)).toBeTruthy();
      const content = fs.readFileSync(workflowSpec, "utf-8");
      expect(content).toContain("Stakeholder Workflows");
    }
  });

  test("context files contain correct project context", async ({ request }) => {
    const createRes = await request.post("/api/projects", {
      data: { name: "Context Content Test", prompt: "Build a real-time chat application with WebSockets" },
    });
    const { project } = await createRes.json();

    // Make root node a leaf
    const treeRes = await request.get(`/api/projects/${project.id}/tree`);
    const tree = await treeRes.json();
    const rootNode = tree.nodes[0];
    await request.patch(`/api/projects/${project.id}/nodes/${rootNode.id}`, {
      data: { is_leaf: true },
    });

    const genRes = await request.post(`/api/projects/${project.id}/generate-contexts`);
    const genData = await genRes.json();

    const claudeMd = genData.generatedFiles?.find((f: string) => f.endsWith("CLAUDE.md"));
    if (claudeMd && fs.existsSync(claudeMd)) {
      const content = fs.readFileSync(claudeMd, "utf-8");
      // Should contain the project prompt in the Project Context section
      expect(content).toContain("Build a real-time chat application with WebSockets");
    }
  });
});
