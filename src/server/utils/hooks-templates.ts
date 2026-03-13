/**
 * Reusable hook templates for Claude Code agents.
 * Hooks are shell commands that run before/after tool use to enforce
 * code quality, security, and boundary constraints automatically.
 */

export interface HookCommand {
  type: 'command';
  command: string;
}

export interface HookMatcher {
  matcher: string;
  hooks: HookCommand[];
}

export interface HookConfig {
  PreToolUse?: HookMatcher[];
  PostToolUse?: HookMatcher[];
}

export const HOOK_TEMPLATES: Record<string, HookConfig> = {
  // Auto-format code after every write/edit
  codeQuality: {
    PostToolUse: [{
      matcher: 'Write|Edit',
      hooks: [
        { type: 'command', command: 'npx prettier --write "$CLAUDE_FILE_PATH" 2>/dev/null || true' },
        { type: 'command', command: 'npx eslint --fix "$CLAUDE_FILE_PATH" 2>/dev/null || true' }
      ]
    }]
  },

  // Enforce file path boundaries - prevent agents from writing outside their scope
  pathBoundary: {
    PreToolUse: [{
      matcher: 'Write|Edit',
      hooks: [{
        type: 'command',
        command: 'python3 $CLAUDE_PROJECT_DIR/scripts/enforce_boundaries.py'
      }]
    }]
  },

  // Run TypeScript type checking after code changes
  typeCheck: {
    PostToolUse: [{
      matcher: 'Write|Edit',
      hooks: [{
        type: 'command',
        command: 'npx tsc --noEmit 2>&1 | head -20 || true'
      }]
    }]
  },

  // Run tests after code changes - bail on first failure for fast feedback
  testRunner: {
    PostToolUse: [{
      matcher: 'Write|Edit',
      hooks: [{
        type: 'command',
        command: 'npx jest --passWithNoTests --bail 2>&1 | tail -10 || true'
      }]
    }]
  },

  // Detect secrets before committing files
  secretDetection: {
    PreToolUse: [{
      matcher: 'Write|Edit',
      hooks: [{
        type: 'command',
        command: 'python3 $CLAUDE_PROJECT_DIR/scripts/detect_secrets.py'
      }]
    }]
  },

  // Prevent direct edits to main/master branch
  branchProtection: {
    PreToolUse: [{
      matcher: 'Write|Edit',
      hooks: [{
        type: 'command',
        command: '[ "$(git branch --show-current)" != "main" ] || { echo \'{"block": true, "message": "Cannot edit on main branch"}\' >&2; exit 2; }'
      }]
    }]
  },

  // Verify contracts after changes - ensures interface compliance
  contractVerification: {
    PostToolUse: [{
      matcher: 'Write|Edit',
      hooks: [{
        type: 'command',
        command: 'python3 $CLAUDE_PROJECT_DIR/scripts/verify_contracts.py 2>&1 | tail -5 || true'
      }]
    }]
  }
};

/**
 * Merge multiple hook templates into a single config.
 * This allows composing hooks from multiple templates per agent.
 */
export function mergeHooks(...templates: HookConfig[]): HookConfig {
  const merged: HookConfig = { PreToolUse: [], PostToolUse: [] };

  for (const template of templates) {
    if (template.PreToolUse) {
      merged.PreToolUse = [...(merged.PreToolUse || []), ...template.PreToolUse];
    }
    if (template.PostToolUse) {
      merged.PostToolUse = [...(merged.PostToolUse || []), ...template.PostToolUse];
    }
  }

  // Remove empty arrays
  if (merged.PreToolUse?.length === 0) delete merged.PreToolUse;
  if (merged.PostToolUse?.length === 0) delete merged.PostToolUse;

  return merged;
}

/**
 * Get default hooks for a given node type.
 * Test nodes get test runner hooks; leaf nodes get quality hooks.
 */
export function getDefaultHooks(nodeType: 'orchestrator' | 'leaf' | 'test'): HookConfig {
  if (nodeType === 'test') {
    return mergeHooks(
      HOOK_TEMPLATES.pathBoundary,
      HOOK_TEMPLATES.testRunner,
      HOOK_TEMPLATES.secretDetection
    );
  }
  if (nodeType === 'leaf') {
    return mergeHooks(
      HOOK_TEMPLATES.pathBoundary,
      HOOK_TEMPLATES.codeQuality,
      HOOK_TEMPLATES.secretDetection,
      HOOK_TEMPLATES.contractVerification
    );
  }
  // Orchestrators don't write files directly, so minimal hooks
  return {};
}
