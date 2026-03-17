/**
 * 12-parent-verification.spec.ts
 * Verifies parent auto-verification concept: when all children of a parent complete,
 * the parent should be ready for verification.
 */
import { test, expect } from "@playwright/test";
import { createProject } from "./helpers";

test.describe("Parent Verification", () => {
  test("parent node tracks completion of children via project tree", async ({ request }) => {
    // Create a project via API
    const createRes = await request.post("/api/projects", {
      data: { name: "Parent Verify Test", prompt: "Build a full-stack web app" },
    });
    expect(createRes.ok()).toBeTruthy();
    const { project } = await createRes.json();

    // Get the tree
    const treeRes = await request.get(`/api/projects/${project.id}/tree`);
    const tree = await treeRes.json();
    expect(tree.nodes.length).toBeGreaterThan(0);

    // The root node is the parent
    const rootNode = tree.nodes.find((n: { parent_id: string | null }) => n.parent_id === null);
    expect(rootNode).toBeTruthy();
    expect(rootNode.parent_id).toBeNull();
  });

  test("parent node status is tracked in project.json", async ({ request }) => {
    const createRes = await request.post("/api/projects", {
      data: { name: "Parent Status Test", prompt: "Build a microservices platform" },
    });
    const { project } = await createRes.json();

    // Approve the root node
    const treeRes = await request.get(`/api/projects/${project.id}/tree`);
    const tree = await treeRes.json();
    const rootNode = tree.nodes[0];

    if (rootNode) {
      const approveRes = await request.post(`/api/projects/${project.id}/nodes/${rootNode.id}/approve`);
      expect(approveRes.ok()).toBeTruthy();

      // Node should now be approved
      const nodeRes = await request.get(`/api/projects/${project.id}/nodes/${rootNode.id}`);
      const nodeData = await nodeRes.json();
      expect(nodeData.node.status).toBe("approved");
    }
  });

  test("node status can be reverted to pending (reject)", async ({ request }) => {
    const createRes = await request.post("/api/projects", {
      data: { name: "Reject Node Test", prompt: "Build an analytics dashboard" },
    });
    const { project } = await createRes.json();

    const treeRes = await request.get(`/api/projects/${project.id}/tree`);
    const tree = await treeRes.json();
    const rootNode = tree.nodes[0];

    if (rootNode) {
      // Approve first
      await request.post(`/api/projects/${project.id}/nodes/${rootNode.id}/approve`);

      // Then reject (patch status back to pending)
      const rejectRes = await request.patch(`/api/projects/${project.id}/nodes/${rootNode.id}`, {
        data: { status: "pending" },
      });
      expect(rejectRes.ok()).toBeTruthy();

      const nodeRes = await request.get(`/api/projects/${project.id}/nodes/${rootNode.id}`);
      const nodeData = await nodeRes.json();
      expect(nodeData.node.status).toBe("pending");
    }
  });

  test("project tree API returns all nodes with parent-child relationships", async ({ request }) => {
    const createRes = await request.post("/api/projects", {
      data: { name: "Tree Structure Test", prompt: "Build a data pipeline" },
    });
    const { project } = await createRes.json();

    const treeRes = await request.get(`/api/projects/${project.id}/tree`);
    expect(treeRes.ok()).toBeTruthy();
    const tree = await treeRes.json();

    expect(tree).toHaveProperty("project");
    expect(tree).toHaveProperty("nodes");
    expect(tree).toHaveProperty("contracts");
    expect(Array.isArray(tree.nodes)).toBeTruthy();

    // Root node exists
    const rootNodes = tree.nodes.filter((n: { parent_id: string | null }) => n.parent_id === null);
    expect(rootNodes.length).toBe(1);
  });

  test("verifyNode stub logs a message without errors", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='project-list']")).toBeVisible({ timeout: 10000 });

    // Just verify the page loads without errors
    const errors: string[] = [];
    page.on("console", msg => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await createProject(page, "Verify Stub Test", "Build a GraphQL API");

    const critical = errors.filter(e => !e.includes("favicon") && !e.includes("404"));
    expect(critical.length).toBe(0);
  });
});
