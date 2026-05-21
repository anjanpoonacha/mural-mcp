import { z } from "zod";
import { muralApi } from "../client/mural-api";
import type { Widget, ListResponse, SingleResponse } from "../types";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stripWidget, stripWidgets } from "../utils/strip";
import { normalizeMuralId, MURAL_ID_DESC } from "../utils/normalize";
import { withTool } from "../utils/tool-wrapper";

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}
function textErr(t: string) {
  return { content: [{ type: "text" as const, text: t }], isError: true };
}

export function registerWidgetReadTools(server: McpServer) {
  // --- get_widgets (paginated, stripped) ---
  server.tool(
    "get_widgets",
    [
      "List widgets on a mural. Default limit 50. Use 'next' cursor to paginate.",
      "",
      "IMPORTANT — type filter limitations (from the API spec):",
      "The 'type' filter only accepts these exact values:",
      "  sticky notes, texts, shapes, areas, images, arrows, icons, files, comments",
      "",
      "Tables and table cells CANNOT be filtered by type.",
      "To find tables: omit the type filter and check for type === 'table' or type === 'table cell' in the results.",
      "Table cells have a parentId pointing to their parent table widget.",
    ].join("\n"),
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      type: z
        .enum([
          "sticky notes",
          "texts",
          "shapes",
          "areas",
          "images",
          "arrows",
          "icons",
          "files",
          "comments",
        ])
        .optional()
        .describe(
          "Filter by widget type. Valid values: sticky notes, texts, shapes, areas, images, arrows, icons, files, comments. NOTE: 'tables' is NOT a valid filter — omit type to get all widgets including tables."
        ),
      filterByParentId: z
        .string()
        .optional()
        .describe("Filter widgets by parent area or table widget ID"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Max widgets per page (1–100, default 50)"),
      next: z
        .string()
        .optional()
        .describe("Pagination cursor from a previous response"),
    },
    withTool("get_widgets", async ({ muralId: rawMuralId, type, filterByParentId, limit, next }) => {
      const { id: muralId, error } = normalizeMuralId(rawMuralId);
      if (error) return textErr(error);
      const effectiveLimit = limit ?? 50;
      const params: Record<string, string> = { limit: String(effectiveLimit) };
      if (type) params["type"] = type;
      if (filterByParentId) params["parentId"] = filterByParentId;
      if (next) params.next = next;

      const data = await muralApi.get<ListResponse<Widget>>(
        `/murals/${muralId}/widgets`,
        params
      );

      const stripped = stripWidgets(data.value);
      const result: Record<string, unknown> = {
        count: stripped.length,
        widgets: stripped,
      };
      if (data.next) result.next = data.next;

      return text(JSON.stringify(result));
    })
  );

  // --- get_widget (single by ID, stripped) ---
  server.tool(
    "get_widget",
    "Get a single widget by ID.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      widgetId: z.string().describe("Widget ID"),
    },
    withTool("get_widget", async ({ muralId: rawMuralId, widgetId }) => {
      const { id: muralId, error } = normalizeMuralId(rawMuralId);
      if (error) return textErr(error);
      const data = await muralApi.get<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/${widgetId}`
      );

      return text(JSON.stringify(stripWidget(data.value)));
    })
  );
}
