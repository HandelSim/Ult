/**
 * 15-mcp-integration.spec.ts
 *
 * MCP integration tests — verify that context generation produces valid
 * MCP server configurations for each leaf node, and that the generated
 * .claude/settings.json files are structurally correct.
 *
 * These tests focus on the MCP layer of SCHEMA's context generation,
 * ensuring agents will have properly configured tool access.
 */
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const API_BASE = "http://localhost:3000";

test.describe("MCP Configuration Integration", () => {
  test("generated settings.json has valid MCP server structure", async ({ request }) => {
    // Create a project via API
    const createRes = await request.post(`${API_BASE}/api/projects`, {
      data: { name: "MCP Config Test", prompt: "Build a REST API with authentication" },
    });
    expect(createRes.ok()).toBe(true);
    const { project } = await createRes.json();
    const projectId = project.id;

    // Approve the root node so the project has leaf nodes
    const treeRes = await request.get(`${API_BASE}/api/projects/${projectId}/tree`);
    const { nodes } = await treeRes.json();
    const rootNode = nodes.find((n: any) => !n.parent_id);
    expect(rootNode).toBeTruthy();

    await request.post(`${API_BASE}/api/projects/${projectId}/nodes/${rootNode.id}/approve`);

    // Generate contexts
    const genRes = await request.post(`${API_BASE}/api/projects/${projectId}/generate-contexts`);
    expect(genRes.ok()).toBe(true);
    const { generatedFiles, leafNodes } = await genRes.json();

    // Verify files were generated
    expect(Array.isArray(generatedFiles)).toBe(true);
    expect(Array.isArray(leafNodes)).toBe(true);

    // Check each leaf node's settings.json
    for (const nodeId of leafNodes) {
      const nodeDir = path.join(process.cwd(), "workspace", projectId, "nodes", nodeId);
      const settingsPath = path.join(nodeDir, ".claude", "settings.json");

      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));

        // settings.json must have mcpServers key
        expect(settings).toHaveProperty("mcpServers");
        expect(typeof settings.mcpServers).toBe("object");

        // All MCP server entries must have command and args
        for (const [serverName, serverConfig] of Object.entries(settings.mcpServers as any)) {
          expect(typeof serverName).toBe("string");
          expect(serverConfig).toHaveProperty("command");
          expect((serverConfig as any).command).toBeTruthy();
        }
      }
    }
  });

  test("generated .hammer-config.json has required execution fields", async ({ request }) => {
    const createRes = await request.post(`${API_BASE}/api/projects`, {
      data: { name: "Hammer Config Test", prompt: "Build a web scraper with rate limiting" },
    });
    expect(createRes.ok()).toBe(true);
    const { project } = await createRes.json();
    const projectId = project.id;

    const treeRes = await request.get(`${API_BASE}/api/projects/${projectId}/tree`);
    const { nodes } = await treeRes.json();
    const rootNode = nodes.find((n: any) => !n.parent_id);

    await request.post(`${API_BASE}/api/projects/${projectId}/nodes/${rootNode.id}/approve`);

    const genRes = await request.post(`${API_BASE}/api/projects/${projectId}/generate-contexts`);
    expect(genRes.ok()).toBe(true);
    const { leafNodes } = await genRes.json();

    for (const nodeId of leafNodes) {
      const nodeDir = path.join(process.cwd(), "workspace", projectId, "nodes", nodeId);
      const hammerConfigPath = path.join(nodeDir, ".hammer-config.json");

      if (fs.existsSync(hammerConfigPath)) {
        const config = JSON.parse(fs.readFileSync(hammerConfigPath, "utf-8"));

        // Must have nodeId and projectId for tracking
        expect(config).toHaveProperty("nodeId");
        expect(config).toHaveProperty("projectId");
        expect(config.projectId).toBe(projectId);

        // Must have model field
        expect(config).toHaveProperty("model");
      }
    }
  });

  test("generate-contexts API returns correct response shape", async ({ request }) => {
    const createRes = await request.post(`${API_BASE}/api/projects`, {
      data: { name: "API Shape Test", prompt: "Build a GraphQL API" },
    });
    expect(createRes.ok()).toBe(true);
    const { project } = await createRes.json();
    const projectId = project.id;

    const treeRes = await request.get(`${API_BASE}/api/projects/${projectId}/tree`);
    const { nodes } = await treeRes.json();
    const rootNode = nodes.find((n: any) => !n.parent_id);
    await request.post(`${API_BASE}/api/projects/${projectId}/nodes/${rootNode.id}/approve`);

    const genRes = await request.post(`${API_BASE}/api/projects/${projectId}/generate-contexts`);
    expect(genRes.ok()).toBe(true);

    const data = await genRes.json();
    expect(data).toHaveProperty("generatedFiles");
    expect(data).toHaveProperty("leafNodes");
    expect(Array.isArray(data.generatedFiles)).toBe(true);
    expect(Array.isArray(data.leafNodes)).toBe(true);

    // After generation, project status should be contexts_generated
    const updatedTree = await request.get(`${API_BASE}/api/projects/${projectId}/tree`);
    const { project: updatedProject } = await updatedTree.json();
    expect(updatedProject.status).toBe("contexts_generated");
  });

  test("start-execution API transitions status to executing", async ({ request }) => {
    const createRes = await request.post(`${API_BASE}/api/projects`, {
      data: { name: "Execution Status Test", prompt: "Build a message queue service" },
    });
    expect(createRes.ok()).toBe(true);
    const { project } = await createRes.json();
    const projectId = project.id;

    const treeRes = await request.get(`${API_BASE}/api/projects/${projectId}/tree`);
    const { nodes } = await treeRes.json();
    const rootNode = nodes.find((n: any) => !n.parent_id);
    await request.post(`${API_BASE}/api/projects/${projectId}/nodes/${rootNode.id}/approve`);
    await request.post(`${API_BASE}/api/projects/${projectId}/generate-contexts`);

    // Start execution
    const execRes = await request.post(`${API_BASE}/api/projects/${projectId}/start-execution`);
    expect(execRes.ok()).toBe(true);

    const execData = await execRes.json();
    expect(execData).toHaveProperty("status");
    // Status should indicate execution was started
    expect(["executing", "queued", "started"]).toContain(execData.status);
  });

  test("CLAUDE.md contains agent identity and task context", async ({ request }) => {
    const projectPrompt = "Build a real-time notification system with webhooks";
    const createRes = await request.post(`${API_BASE}/api/projects`, {
      data: { name: "CLAUDE.md Content Test", prompt: projectPrompt },
    });
    expect(createRes.ok()).toBe(true);
    const { project } = await createRes.json();
    const projectId = project.id;

    const treeRes = await request.get(`${API_BASE}/api/projects/${projectId}/tree`);
    const { nodes } = await treeRes.json();
    const rootNode = nodes.find((n: any) => !n.parent_id);
    await request.post(`${API_BASE}/api/projects/${projectId}/nodes/${rootNode.id}/approve`);

    const genRes = await request.post(`${API_BASE}/api/projects/${projectId}/generate-contexts`);
    expect(genRes.ok()).toBe(true);
    const { leafNodes } = await genRes.json();

    for (const nodeId of leafNodes) {
      const nodeDir = path.join(process.cwd(), "workspace", projectId, "nodes", nodeId);
      const claudeMdPath = path.join(nodeDir, "CLAUDE.md");

      if (fs.existsSync(claudeMdPath)) {
        const content = fs.readFileSync(claudeMdPath, "utf-8");

        // Must contain the project prompt for context (project name is not in template)
        expect(content).toContain(projectPrompt);

        // Must have the required sections
        expect(content).toContain("## Project Context");
        expect(content).toContain("## Your Task");

        // Must have non-trivial content
        expect(content.length).toBeGreaterThan(100);
      }
    }
  });
});
