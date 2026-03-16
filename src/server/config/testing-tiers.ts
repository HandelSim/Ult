/**
 * Testing Tier Configuration
 * Defines the three-tier testing strategy for agent nodes.
 *
 * Tier 1 (default): Lightweight, zero-token checks (lint, type check, unit tests via CLI).
 * Tier 2: Playwright CLI screenshot captures (headless, zero interactive tokens).
 * Tier 3: Full Playwright MCP integration with live browser — used only when siblings complete.
 */

export enum TestingTier {
  TIER1 = 'tier1',
  TIER2 = 'tier2',
  TIER3 = 'tier3',
}

export interface TierConfig {
  tier: TestingTier;
  label: string;
  description: string;
  /** Commands to run as part of the testing phase */
  commands: string[];
  /** Whether Playwright MCP should be wired in for this tier */
  playwrightMcp: boolean;
  /** Whether sibling completion is required before running */
  requireSiblingCompletion: boolean;
  /** Approximate token cost multiplier relative to tier 1 */
  tokenCostMultiplier: number;
}

export const TIER_CONFIGS: Record<TestingTier, TierConfig> = {
  [TestingTier.TIER1]: {
    tier: TestingTier.TIER1,
    label: 'Tier 1 — CLI Tests',
    description: 'Lint, TypeScript check, unit tests. Zero agent tokens consumed.',
    commands: [
      'npx tsc --noEmit 2>&1 | head -20',
      'npx eslint --max-warnings=0 . 2>&1 | tail -10',
      'npx jest --passWithNoTests --silent 2>&1 | tail -20',
    ],
    playwrightMcp: false,
    requireSiblingCompletion: false,
    tokenCostMultiplier: 1,
  },
  [TestingTier.TIER2]: {
    tier: TestingTier.TIER2,
    label: 'Tier 2 — Screenshots',
    description: 'Playwright CLI screenshot capture. Headless, no interactive tokens.',
    commands: [
      'bash /workspace/scripts/playwright-cli-check.sh',
      'bash /workspace/scripts/capture-screenshots.sh',
    ],
    playwrightMcp: false,
    requireSiblingCompletion: false,
    tokenCostMultiplier: 2,
  },
  [TestingTier.TIER3]: {
    tier: TestingTier.TIER3,
    label: 'Tier 3 — Integration',
    description: 'Full Playwright MCP integration verification. Requires sibling completion.',
    commands: [],
    playwrightMcp: true,
    requireSiblingCompletion: true,
    tokenCostMultiplier: 5,
  },
};

export function getTierConfig(tier: string | null | undefined): TierConfig {
  return TIER_CONFIGS[(tier as TestingTier) || TestingTier.TIER1] || TIER_CONFIGS[TestingTier.TIER1];
}
