/**
 * global-setup.ts — runs once before all tests
 * Clears accumulated workspace projects to prevent test pollution.
 */
import * as fs from "fs";
import * as path from "path";

async function globalSetup() {
  const workspaceDir = path.join(process.cwd(), "workspace");
  if (fs.existsSync(workspaceDir)) {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
    console.log("[global-setup] Cleared workspace/");
  }
  fs.mkdirSync(workspaceDir, { recursive: true });
}

export default globalSetup;
