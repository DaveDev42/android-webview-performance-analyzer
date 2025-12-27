import React from "react";
import ReactDOM from "react-dom/client";
import { initMcpBridge } from "tauri-plugin-mcp";
import App from "./App";
import "./index.css";

initMcpBridge().catch((err) =>
  console.warn("[MCP] Bridge init failed:", err)
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
