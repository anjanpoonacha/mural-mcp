#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ensureAuthenticated } from "./auth/oauth";
import { initWorkspaceGuard } from "./auth/workspace-guard";
import { registerNavigationTools } from "./tools/navigation";
import { registerWidgetReadTools } from "./tools/widgets-read";
import { registerStickyNoteTools } from "./tools/widgets-sticky-notes";
import { registerTextTools } from "./tools/widgets-text";
import { registerShapeTools } from "./tools/widgets-shapes";
import { registerAreaTools } from "./tools/widgets-areas";
import { registerImageTools } from "./tools/widgets-images";
import { registerArrowTools } from "./tools/widgets-arrows";
import { registerTableTools } from "./tools/widgets-table";
import { registerMiscWidgetTools } from "./tools/widgets-misc";
import { registerMuralManageTools } from "./tools/mural-manage";
import { registerMuralFeatureTools } from "./tools/mural-features";
import { registerTemplateTools } from "./tools/templates";

// Initialize workspace allowlist guard (reads MURAL_ALLOWED_WORKSPACES env var)
initWorkspaceGuard();

const server = new McpServer({
  name: "mural-mcp",
  version: "1.0.0",
  description:
    "Mural MCP Server — read and edit boards, sticky notes, shapes, text boxes, areas, images, and connectors on the Mural visual collaboration platform.",
});

// Register all tool groups
registerNavigationTools(server);
registerWidgetReadTools(server);
registerStickyNoteTools(server);
registerTextTools(server);
registerShapeTools(server);
registerAreaTools(server);
registerImageTools(server);
registerArrowTools(server);
registerTableTools(server);
registerMiscWidgetTools(server);
registerMuralManageTools(server);
registerMuralFeatureTools(server);
registerTemplateTools(server);

// Start the server over stdio
async function main() {
  await ensureAuthenticated();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error starting Mural MCP server:", error);
  process.exit(1);
});
