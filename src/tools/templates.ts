import { z } from "zod";
import { muralApi } from "../client/mural-api";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withTool } from "../utils/tool-wrapper";

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}

export function registerTemplateTools(server: McpServer) {
  // --- list_templates ---
  server.tool(
    "list_templates",
    "List templates in a workspace (stripped to id+name+type+thumbUrl+workspaceId). Default limit 20.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      limit: z.number().optional().describe("Max templates (default 20)"),
      next: z.string().optional().describe("Pagination cursor from previous response"),
      withoutDefault: z.boolean().optional().describe("Exclude default templates"),
    },
    withTool("list_templates", async ({ workspaceId, limit, next, withoutDefault }) => {
      const params: Record<string, string> = { limit: String(limit ?? 20) };
      if (next) params.next = next;
      if (withoutDefault !== undefined) params.withoutDefault = String(withoutDefault);
      const data = await muralApi.get<{ value: unknown[]; next?: string }>(
        `/workspaces/${workspaceId}/templates`,
        params
      );
      const templates = (data.value as Array<Record<string, unknown>>).map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        thumbUrl: t.thumbUrl,
        workspaceId: t.workspaceId,
      }));
      const result: Record<string, unknown> = { count: templates.length, templates };
      if (data.next) result.next = data.next;
      return text(JSON.stringify(result));
    })
  );

  // --- get_default_templates ---
  server.tool(
    "get_default_templates",
    "Get the default Mural templates",
    {
      limit: z.number().optional().describe("Max templates (default 20)"),
      next: z.string().optional().describe("Pagination cursor from previous response"),
    },
    withTool("get_default_templates", async ({ limit, next }) => {
      const params: Record<string, string> = { limit: String(limit ?? 20) };
      if (next) params.next = next;
      const data = await muralApi.get<{ value: unknown[]; next?: string }>("/templates", params);
      const templates = (data.value as Array<Record<string, unknown>>).map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        thumbUrl: t.thumbUrl,
      }));
      const result: Record<string, unknown> = { count: templates.length, templates };
      if (data.next) result.next = data.next;
      return text(JSON.stringify(result));
    })
  );

  // --- create_mural_from_template ---
  server.tool(
    "create_mural_from_template",
    "Create a new mural from a template",
    {
      templateId: z.string().describe("Template ID"),
      title: z.string().describe("Title for the new mural"),
      roomId: z.number().describe("Room ID to create the mural in"),
      folderId: z.string().optional().describe("Optional folder ID"),
    },
    withTool("create_mural_from_template", async ({ templateId, title, roomId, folderId }) => {
      const body: Record<string, unknown> = { title, roomId };
      if (folderId !== undefined) body.folderId = folderId;
      const data = await muralApi.post<{ value: Record<string, unknown> }>(
        `/templates/${templateId}/murals`,
        body
      );
      const m = data.value;
      return text(JSON.stringify({ id: m.id, title: m.title, roomId: m.roomId, workspaceId: m.workspaceId }));
    })
  );
}
