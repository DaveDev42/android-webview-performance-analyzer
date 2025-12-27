# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies
pnpm install

# Development (runs Vite frontend + Tauri backend with hot reload)
pnpm dev

# Run Tauri desktop app in development
pnpm tauri dev

# Build production app
pnpm build

# Linting & Type checking
pnpm lint
pnpm typecheck

# Testing
pnpm test                          # Run all tests
pnpm --filter @awpa/app test:watch  # Watch mode for app package
pnpm --filter @awpa/app test:coverage
```

## Architecture Overview

**AWPA (Android WebView Performance Analyzer)** is a Tauri desktop application for real-time performance monitoring of Android WebViews via Chrome DevTools Protocol (CDP).

### Monorepo Structure (pnpm workspaces + Turborepo)

```
packages/
├── app/           # Main Tauri application
│   ├── src/       # React frontend (TypeScript, Tailwind, Recharts)
│   └── src-tauri/ # Rust backend
└── metrics-io/    # Shared library for SQLite export/import (TypeScript, sql.js)
```

### Frontend → Backend Communication

The React frontend uses `@tauri-apps/api/core` to invoke Rust commands:
- `invoke("command_name", { params })` - Commands defined in `commands.rs`
- `listen("event_name", callback)` - Events emitted from Rust (metrics, network)

### Rust Backend Modules (`packages/app/src-tauri/src/`)

| Module | Purpose |
|--------|---------|
| `lib.rs` | Tauri app setup, command registration, plugin initialization |
| `commands.rs` | All Tauri commands (ADB, CDP, session, metrics) |
| `state.rs` | `AppState` struct managing CdpClient, MetricsCollector, Database |
| `adb.rs` | ADB shell commands via `tauri-plugin-shell` |
| `cdp/` | Chrome DevTools Protocol client using `chromiumoxide` |
| `storage/` | SQLite persistence via `rusqlite` (sessions, metrics, network) |

### Data Flow

1. **Device Discovery**: ADB → list devices → list WebView sockets
2. **Connection**: Port forward socket → fetch CDP targets → connect via WebSocket
3. **Metrics Collection**: `MetricsCollector` polls CDP Performance domain → stores to SQLite → emits Tauri events
4. **Network Monitoring**: CDP Network domain events → stored to SQLite → emitted to frontend
5. **Export/Import**: `@awpa/metrics-io` handles SQLite database file export/import in browser

### Key Technologies

- **Tauri 2**: Desktop app framework (Rust backend + webview frontend)
- **chromiumoxide**: CDP client library for Rust
- **rusqlite**: SQLite database (bundled)
- **Vite + React 18**: Frontend with Tailwind CSS
- **Recharts**: Metrics visualization charts

## Tauri Plugin: MCP

The app integrates `tauri-plugin-mcp` for Model Context Protocol support, enabling AI tool integration.

## External Binary

ADB binary is bundled via Tauri's `externalBin` feature (`binaries/adb`).
