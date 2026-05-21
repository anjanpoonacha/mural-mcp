import { z } from "zod";
import { muralApi } from "../client/mural-api";
import type { Widget, SingleResponse } from "../types";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { singleResponse } from "../utils/strip";
import { normalizeMuralId, MURAL_ID_DESC } from "../utils/normalize";
import { withTool } from "../utils/tool-wrapper";
import { text, textErr } from "./widgets-shared";

export function registerMiscWidgetTools(server: McpServer) {
  server.tool(
    "create_comment",
    "Create a comment widget on a mural.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      x: z.number().describe("Horizontal position in px from left of mural"),
      y: z.number().describe("Vertical position in px from top of mural"),
      message: z.string().describe("Comment message text"),
      resolved: z.boolean().optional(),
      referenceWidgetId: z.string().optional(),
      stackingOrder: z.number().optional(),
    },
    withTool("create_comment", async ({ muralId: rawMuralId, x, y, message, resolved, referenceWidgetId, stackingOrder }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId);
      if (muralIdErr) return textErr(muralIdErr);
      const body: Record<string, unknown> = { x, y, message };
      if (resolved !== undefined) body.resolved = resolved;
      if (referenceWidgetId !== undefined) body.referenceWidgetId = referenceWidgetId;
      if (stackingOrder !== undefined) body.stackingOrder = stackingOrder;
      const data = await muralApi.post<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/comment`,
        body
      );
      return text(singleResponse("Created comment", data.value));
    })
  );

  server.tool(
    "update_comment",
    "Update an existing comment widget.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      widgetId: z.string().describe("Widget ID"),
      message: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      resolved: z.boolean().optional(),
      referenceWidgetId: z.string().optional(),
    },
    withTool("update_comment", async ({ muralId: rawMuralId, widgetId, ...changes }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId);
      if (muralIdErr) return textErr(muralIdErr);
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(changes)) {
        if (value !== undefined) body[key] = value;
      }
      const data = await muralApi.patch<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/comment/${widgetId}`,
        body
      );
      return text(singleResponse("Updated comment", data.value));
    })
  );

  server.tool(
    "delete_widget",
    "Delete any widget from a mural by ID",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      widgetId: z.string().describe("Widget ID to delete"),
    },
    withTool("delete_widget", async ({ muralId: rawMuralId, widgetId }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId);
      if (muralIdErr) return textErr(muralIdErr);
      await muralApi.delete(`/murals/${muralId}/widgets/${widgetId}`);
      return text(`Deleted widget ${widgetId}`);
    })
  );
}
