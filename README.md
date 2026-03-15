# SCHEMA — Self-Constructing Hierarchy for Entire Managed Applications

SCHEMA is a recursive AI agent orchestration platform. It decomposes high-level goals into executable sub-tasks arranged as a tree, then dispatches autonomous Claude agents to execute each leaf node.

## Overview

- **Recursive decomposition**: Break any project into a hierarchical tree of tasks
- **Agent orchestration**: Each leaf node becomes a Claude sub-agent with its own workspace, prompt, and execution context
- **Real-time monitoring**: SSE-based live updates stream execution logs to the UI tree graph
- **Contract-driven**: Nodes negotiate contracts (inputs/outputs) before execution begins
- **Mode control**: Auto-approve or manual-review each node's children before they execute
- **HAMMER integration**: Uses HAMMER for SDK wrapping, retry logic, acceptance checking, and session management

## Architecture

```
SCHEMA
├── src/client/       React + Vite frontend (tree visualization, node control)
├── src/server/       Express API + SQLite persistence
│   ├── routes/       REST endpoints for projects, nodes, contracts
│   ├── services/     Decomposition, execution (via HAMMER), verification, workspace
│   └── db/           SQLite schema and connection
├── scripts/          Boundary enforcement, secret detection, contract guards
├── tests/            Playwright e2e tests
└── workspace/        Per-node working directories (gitignored)
```

## Quick Start

```bash
npm install
npm run dev        # starts server (3001) + client (3000) concurrently
```

## Environment

Copy `.env.example` to `.env` and set:
- `ANTHROPIC_API_KEY` — required for agent execution
- `PORT_API` — server port (default: 3001)

## Usage

1. Create a project and describe your goal
2. SCHEMA auto-decomposes it into a task tree
3. Review/approve nodes (or enable auto-approve)
4. Watch agents execute leaf nodes in real-time
5. Review logs, contracts, and outputs per node

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/enforce_boundaries.py` | Prevent agents from reading outside workspace |
| `scripts/detect_secrets.py` | Block secret leakage in agent outputs |
| `scripts/verify_contracts.py` | Check node contracts are fulfilled |
| `scripts/check_acceptance.py` | Run acceptance criteria checks |

## Part of the Kingdom

SCHEMA is the **Forge** guild's primary software delivery platform. Tasks arrive via NATS (`raven.forge.assigned`) and are executed as SCHEMA projects.

## License

Private — HandelSim Kingdom
