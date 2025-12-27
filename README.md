# AWPA - Android WebView Performance Analyzer

A desktop application for real-time performance monitoring and analysis of Android WebViews using Chrome DevTools Protocol (CDP).

## Features

- **Device Management**: Automatically detect connected Android devices via ADB
- **WebView Discovery**: List all debuggable WebViews on a device
- **Real-time Metrics**: Monitor JS heap, DOM nodes, layout count, script duration
- **Network Monitoring**: Track network requests with timing and size data
- **Session Recording**: Record and save performance sessions for later analysis
- **Data Export/Import**: Export sessions to SQLite files, import for comparison
- **Charts & Visualization**: Interactive charts using Recharts

## Requirements

- **Node.js** 20+
- **pnpm** 9.15+
- **Rust** (for Tauri backend)
- **ADB** (Android Debug Bridge) - bundled with the app
- Android device with USB debugging enabled

## Installation

```bash
# Clone the repository
git clone https://github.com/DaveDev42/android-webview-performance-analyzer.git
cd android-webview-performance-analyzer

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Usage

1. **Connect Device**: Connect an Android device with USB debugging enabled
2. **Select Device**: Click on a device in the Devices panel
3. **Find WebViews**: Debuggable WebViews will appear in the WebViews panel
4. **Port Forward**: Click "Forward" to create a port forward for the WebView
5. **Load Targets**: Click "Load Targets" to discover CDP targets
6. **Connect**: Select a target and click "Connect"
7. **Record**: Click "Start Recording" to begin capturing metrics
8. **Analyze**: View real-time metrics and network requests
9. **Export**: Save sessions for later analysis or sharing

## Development

```bash
# Run development server
pnpm dev

# Run linting
pnpm lint

# Run type checking
pnpm typecheck

# Run tests
pnpm test
```

## Project Structure

```
packages/
├── app/               # Tauri desktop application
│   ├── src/           # React frontend
│   │   ├── components/  # UI components
│   │   ├── types/       # TypeScript types
│   │   └── App.tsx      # Main application
│   └── src-tauri/     # Rust backend
│       └── src/
│           ├── adb.rs      # ADB integration
│           ├── cdp/        # CDP client
│           ├── commands.rs # Tauri commands
│           ├── state.rs    # App state
│           └── storage/    # SQLite storage
└── metrics-io/        # Shared export/import library
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Recharts
- **Backend**: Rust, Tauri 2
- **CDP Client**: chromiumoxide
- **Database**: SQLite (rusqlite)
- **Build Tools**: Vite, Turborepo, pnpm

## License

MIT

