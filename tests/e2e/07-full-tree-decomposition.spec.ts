/**
 * 07-full-tree-decomposition.spec.ts
 *
 * Tests a complete auto-mode tree decomposition from root node to all leaf nodes.
 * Uses a long, detailed app idea prompt to ensure meaningful tree depth and breadth.
 *
 * Workflow:
 *  1. Create a project with a complex prompt (via UI modal)
 *  2. Wait for Haiku streaming to finish configuring the root node
 *  3. Set project mode to 'auto' so all children are auto-approved/decomposed
 *  4. Approve the root node to kick off recursive decomposition
 *  5. Poll GET /api/projects/:id/tree until NO nodes remain in
 *     'pending' or 'decomposing' status — i.e. the entire tree has resolved
 *  6. Assert: all bottom-level nodes are leaves, no failures occurred
 *
 * Timeout: 15 minutes — complex prompts can produce 20-40 nodes across 3-4
 * levels, each decomposition calling Claude Haiku (~30-90s each), with up to
 * 3 running concurrently.
 */
import { test, expect } from "@playwright/test";

// ── Constants ─────────────────────────────────────────────────────────────────

const PROJECT_NAME = "Full Tree Decomp — Collab PM Platform";

/**
 * Long, detailed app description that drives a multi-level decomposition tree.
 * Sourced from the task brief.
 */
const LONG_PROMPT =
  "Build a comprehensive real-time collaborative project management platform " +
  "for distributed software engineering teams. The platform should include: " +
  "a Kanban board with drag-and-drop task management, a Gantt chart for " +
  "timeline visualization, real-time presence indicators showing who is " +
  "viewing or editing what, GitHub and GitLab integration for automatic " +
  "ticket-to-PR linking, a built-in video conferencing module with screen " +
  "sharing and session recording, an AI-powered workload balancing system " +
  "that analyzes team velocity and suggests task reassignments, a time " +
  "tracking system with invoicing capabilities for client-facing teams, a " +
  "custom reporting dashboard with exportable charts (CSV, PDF, PNG), " +
  "role-based access control with fine-grained permissions per project and " +
  "per board, Slack and Microsoft Teams notification webhooks, a " +
  "mobile-responsive PWA with offline support, multi-language i18n support " +
  "starting with English, Spanish, French, and Japanese, and a full REST " +
  "and GraphQL API for third-party integrations.";

/**
 * API base — use the frontend proxy at port 3000 so requests work even if
 * the API server temporarily restarts. The frontend proxy handles reconnection.
 */
const API_BASE = "http://localhost:3000/api";

/** How often to poll the tree endpoint while waiting for decomposition. */
const POLL_INTERVAL_MS = 8000;

/** Maximum time to wait for the full tree to resolve (15 minutes). */
const TREE_COMPLETE_TIMEOUT_MS = 900_000;

// ── Test ──────────────────────────────────────────────────────────────────────

test.describe("Full Tree Decomposition", () => {
  // Override the default 3-minute timeout — this test intentionally runs long.
  test.setTimeout(TREE_COMPLETE_TIMEOUT_MS + 60_000);

  test(
    "auto-mode decomposes entire tree until all bottom-level nodes are leaves",
    async ({ page }) => {
      // ── Step 1: Load the app ───────────────────────────────────────────────
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      // ── Step 2: Open the create project dialog ─────────────────────────────
      const newBtn = page.locator('[data-testid="new-project-button"]');
      await expect(newBtn).toBeVisible({ timeout: 10000 });
      await newBtn.click();

      await expect(
        page.locator('[data-testid="project-name"]')
      ).toBeVisible({ timeout: 5000 });

      // ── Step 3: Fill the form with the long prompt ─────────────────────────
      await page.fill('[data-testid="project-name"]', PROJECT_NAME);
      await page.fill('[data-testid="project-prompt"]', LONG_PROMPT);

      // Intercept the POST /api/projects response to capture IDs before the
      // UI has a chance to navigate or the terminal appears.
      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/projects") &&
          resp.request().method() === "POST",
        { timeout: 30000 }
      );

      await page.locator('[data-testid="create-project"]').click();

      const createResponse = await responsePromise;
      expect(createResponse.ok()).toBeTruthy();

      const createData = await createResponse.json();
      const projectId: string = createData.project?.id;
      const rootNodeId: string = createData.rootNode?.id;

      expect(projectId).toBeTruthy();
      expect(rootNodeId).toBeTruthy();
      console.log(`[setup] Project created: ${projectId}, root node: ${rootNodeId}`);

      // ── Step 4: Wait for Haiku init-stream to finish configuring root ──────
      // The streaming terminal renders while Haiku populates prompt/role/etc.
      const terminal = page.locator('[data-testid="streaming-terminal"]');
      await expect(terminal).toBeVisible({ timeout: 20000 });

      const completeBtn = page.locator('[data-testid="streaming-complete-btn"]');
      await expect(completeBtn).toBeVisible({ timeout: 120000 });
      console.log(`[setup] Root node configuration streaming complete.`);

      // ── Step 5: Switch project to AUTO mode before approving ───────────────
      // This ensures that once the root is approved, all descendant orchestrator
      // nodes are also automatically approved and decomposed without human input.
      const modeResp = await page.request.patch(
        `${API_BASE}/projects/${projectId}/mode`,
        { data: { mode: "auto" } }
      );
      expect(modeResp.ok()).toBeTruthy();
      console.log(`[setup] Project mode set to auto.`);

      // ── Step 6: Dismiss the streaming terminal ─────────────────────────────
      await completeBtn.click();
      const detailPanel = page.locator('[data-testid="node-detail-panel"]');
      await expect(detailPanel).toBeVisible({ timeout: 15000 });

      // ── Step 7: Approve the root node via the API ──────────────────────────
      // Using the API directly is more reliable than clicking the UI button
      // while a long decomposition is about to begin.
      const approveResp = await page.request.post(
        `${API_BASE}/nodes/${rootNodeId}/approve`,
        { data: { decompose: true } }
      );
      expect(approveResp.ok()).toBeTruthy();
      console.log(`[decomp] Root node approved. Auto-mode recursive decomposition started.`);

      // ── Step 8: Poll until the full tree has resolved ──────────────────────
      // Terminal condition:
      //   • no node has status 'pending' or 'decomposing'
      //   • no node has status 'failed'
      //   • the tree has grown beyond the single root node
      const deadline = Date.now() + TREE_COMPLETE_TIMEOUT_MS;

      while (true) {
        if (Date.now() > deadline) {
          throw new Error(
            `Full-tree decomposition did not complete within ${TREE_COMPLETE_TIMEOUT_MS / 1000}s`
          );
        }

        // Wait between polls to avoid hammering the server during heavy AI work.
        await page.waitForTimeout(POLL_INTERVAL_MS);

        let treeResp: Awaited<ReturnType<typeof page.request.get>> | null = null;
        try {
          treeResp = await page.request.get(
            `${API_BASE}/projects/${projectId}/tree`
          );
        } catch (connErr) {
          console.warn(`[poll] Connection error (server may be restarting): ${connErr}`);
          await page.waitForTimeout(5000);
          continue;
        }
        if (!treeResp.ok()) {
          console.warn(`[poll] Tree endpoint returned ${treeResp.status()}, retrying…`);
          continue;
        }

        const treeData = await treeResp.json() as {
          nodes: Array<{ id: string; name: string; node_type: string; status: string }>;
        };
        const nodes = treeData.nodes ?? [];

        if (nodes.length <= 1) {
          // Decomposition hasn't produced children yet — keep waiting.
          continue;
        }

        const pending     = nodes.filter(n => n.status === "pending");
        const decomposing = nodes.filter(n => n.status === "decomposing");
        const failed      = nodes.filter(n => n.status === "failed");
        const leaves      = nodes.filter(n => n.node_type === "leaf");
        const active      = pending.length + decomposing.length;

        console.log(
          `[poll] nodes=${nodes.length}  leaves=${leaves.length}  ` +
          `decomposing=${decomposing.length}  pending=${pending.length}  ` +
          `failed=${failed.length}`
        );

        // Fail fast if any node errored out during decomposition.
        if (failed.length > 0) {
          const names = failed.map(n => `"${n.name}"`).join(", ");
          throw new Error(
            `${failed.length} node(s) failed during auto-decomposition: ${names}`
          );
        }

        // All nodes have settled — decomposition is complete.
        if (active === 0) {
          console.log(
            `[poll] Tree fully resolved! ` +
            `${nodes.length} total nodes, ${leaves.length} leaf nodes.`
          );
          break;
        }
      }

      // ── Step 9: Final assertions ───────────────────────────────────────────
      const finalResp = await page.request.get(
        `${API_BASE}/projects/${projectId}/tree`
      );
      expect(finalResp.ok()).toBeTruthy();

      const { nodes: finalNodes } = await finalResp.json() as {
        nodes: Array<{ name: string; node_type: string; status: string }>;
      };

      // Must have expanded beyond just the root.
      expect(finalNodes.length).toBeGreaterThanOrEqual(3);

      // Zero unresolved nodes — no pending, no decomposing.
      const unresolved = finalNodes.filter(n =>
        ["pending", "decomposing"].includes(n.status)
      );
      expect(
        unresolved,
        `Expected 0 unresolved nodes but found: ${unresolved.map(n => n.name).join(", ")}`
      ).toHaveLength(0);

      // Zero failed nodes.
      const failedFinal = finalNodes.filter(n => n.status === "failed");
      expect(
        failedFinal,
        `Expected 0 failed nodes but found: ${failedFinal.map(n => n.name).join(", ")}`
      ).toHaveLength(0);

      // Leaf nodes exist at the bottom of the tree.
      const leafNodes = finalNodes.filter(n => n.node_type === "leaf");
      expect(leafNodes.length).toBeGreaterThan(0);

      // All leaf nodes are approved (ready for execution).
      const unapprovedLeaves = leafNodes.filter(n => n.status !== "approved");
      expect(
        unapprovedLeaves,
        `All leaf nodes should be approved. Unapproved: ${unapprovedLeaves.map(n => n.name).join(", ")}`
      ).toHaveLength(0);

      console.log(
        `✓ PASS — Full tree decomposition complete.\n` +
        `  Total nodes : ${finalNodes.length}\n` +
        `  Leaf nodes  : ${leafNodes.length}\n` +
        `  Orchestrators: ${finalNodes.filter(n => n.node_type === "orchestrator").length}`
      );
    }
  );
});
