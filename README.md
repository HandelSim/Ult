# SCHEMA — Thin GUI Over SMITH

SCHEMA is a lightweight web interface that visualizes what SMITH does. It reads `project.json` files managed by SMITH, renders the folder hierarchy as an interactive tree, and provides a chat interface to talk to SMITH directly.

```
SMITH (architect) → writes project.json, conversation.jsonl, mockups/
SCHEMA (GUI)      → reads project.json live, renders tree, proxies chat
HAMMER (builder)  → reads CLAUDE.md per folder, builds, updates status
```

## Architecture

```
schema/
  server/          Express + WebSocket + SSE + chokidar
    src/
      index.ts         entry point (port 3000)
      config.ts        SMITH_WORKSPACE, PORT env vars
      projects.ts      read project.json / projects-index.json
      file-watcher.ts  chokidar watches projects/**/project.json
      ws.ts            WebSocket — broadcasts project updates to clients
      smith-proxy.ts   spawns/manages SMITH claude sessions
      routes/
        projects.ts    GET /api/projects, GET /api/projects/:id
        smith.ts       POST /api/smith/start|message|resume, GET /api/smith/stream (SSE)
  client/          React 18 + Vite + Tailwind + React Flow
    src/
      App.tsx          main shell: sidebar + tree + detail + chat/mockup panels
      components/
        Sidebar.tsx       project list with status indicators
        TreeView.tsx      React Flow folder hierarchy
        FolderDetail.tsx  folder metadata, contracts, files, stakeholder notes
        SmithChat.tsx     SSE chat with SMITH (supports adversary mode)
        MockupPreview.tsx iframe mockup renderer
        StatusBar.tsx     connection status + project count
        NewProjectDialog.tsx  modal to kick off new SMITH session
      hooks/
        useWebSocket.ts   auto-reconnecting WebSocket hook
  tests/             Playwright test suite
```

## Setup

```bash
# Install dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# Build
cd server && npm run build && cd ..
cd client && npm run build && cd ..
```

## Running

```bash
# Production (serves built client on same port)
SMITH_WORKSPACE=~/smith-projects PORT=3000 npm start

# Development (hot reload)
SMITH_WORKSPACE=~/smith-projects npm run dev
# → server on :3000, client on :5173 (proxied)
```

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `SMITH_WORKSPACE` | `~/smith-projects` | Path to smith-projects workspace |
| `PORT` | `3000` | Server listen port |
| `SMITH_MODEL` | `opus` | Model for SMITH sessions |
| `SMITH_DIR` | `~/smith` | Path to SMITH installation |

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:id` | Get project.json for a project |
| GET | `/api/projects/:id/mockup/:file` | Serve mockup HTML |
| POST | `/api/smith/start/:id` | Start SMITH session for project |
| POST | `/api/smith/message/:id` | Send message to SMITH |
| POST | `/api/smith/resume/:id` | Resume by session ID |
| GET | `/api/smith/stream/:id` | SSE stream of SMITH output |
| WS | `/ws` | Live project.json updates |

## Testing

```bash
# API tests (no browser deps required)
SMITH_WORKSPACE=~/smith-projects npx playwright test

# Browser tests require system X11 libraries:
# apt-get install libxfixes3 libxcomposite1 libxrandr2 libxdamage1
```

## Design

- Dark theme: `#0a0e17` background, `#6366f1` accent
- Fonts: Outfit (UI), JetBrains Mono (code)
- Status colors: green=complete, blue=executing, yellow=in-progress, red=failed
