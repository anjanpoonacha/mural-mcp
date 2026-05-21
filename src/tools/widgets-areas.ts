import { z } from "zod";
import { muralApi } from "../client/mural-api";
import type { Widget, SingleResponse } from "../types";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { singleResponse } from "../utils/strip";
import { normalizeMuralId, MURAL_ID_DESC } from "../utils/normalize";
import { withTool } from "../utils/tool-wrapper";
import { colorSchema, positionSchema, text, textErr } from "./widgets-shared";

export function registerAreaTools(server: McpServer) {
  server.tool(
    "create_area",
    "Create an area (grouping section) on a mural.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      ...positionSchema,
      width: z.number().describe("Width in px"),
      height: z.number().describe("Height in px"),
      title: z.string().optional(),
      backgroundColor: colorSchema,
      hidden: z.boolean().optional(),
      instruction: z.string().optional(),
      presentationIndex: z.number().optional(),
      rotation: z.number().optional(),
      stackingOrder: z.number().optional(),
      layout: z.enum(["free", "column", "row"]).optional(),
      showTitle: z.boolean().optional(),
      style: z
        .object({
          borderColor: colorSchema,
          borderStyle: z.enum(["solid", "dotted"]).optional(),
          borderWidth: z.number().min(1).max(7).optional(),
          titleFontSize: z.number().optional(),
        })
        .optional(),
    },
    withTool("create_area", async ({ muralId: rawMuralId, style, backgroundColor, ...params }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId);
      if (muralIdErr) return textErr(muralIdErr);
      const body: Record<string, unknown> = {
        x: params.x,
        y: params.y,
        width: params.width,
        height: params.height,
      };
      const scalarFields = ["title", "hidden", "instruction", "presentationIndex", "rotation", "stackingOrder", "layout", "showTitle"] as const;
      for (const f of scalarFields) {
        if (params[f] !== undefined) body[f] = params[f];
      }
      const styleBody: Record<string, unknown> = {};
      if (backgroundColor) styleBody.backgroundColor = backgroundColor;
      if (style) {
        for (const [k, v] of Object.entries(style)) {
          if (v !== undefined) styleBody[k] = v;
        }
      }
      if (Object.keys(styleBody).length > 0) body.style = styleBody;
      const data = await muralApi.post<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/area`,
        body
      );
      return text(singleResponse("Created area", data.value));
    })
  );

  server.tool(
    "update_area",
    "Update an area on a mural",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      widgetId: z.string().describe("Widget ID"),
      title: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      backgroundColor: colorSchema,
      hidden: z.boolean().optional(),
      instruction: z.string().optional(),
      presentationIndex: z.number().optional(),
      rotation: z.number().optional(),
      layout: z.enum(["free", "column", "row"]).optional(),
      showTitle: z.boolean().optional(),
      style: z
        .object({
          borderColor: colorSchema,
          borderStyle: z.enum(["solid", "dotted"]).optional(),
          borderWidth: z.number().min(1).max(7).optional(),
          titleFontSize: z.number().optional(),
        })
        .optional(),
    },
    withTool("update_area", async ({ muralId: rawMuralId, widgetId, style, backgroundColor, ...changes }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId);
      if (muralIdErr) return textErr(muralIdErr);
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(changes)) {
        if (value !== undefined) body[key] = value;
      }
      const styleBody: Record<string, unknown> = {};
      if (backgroundColor) styleBody.backgroundColor = backgroundColor;
      if (style) {
        for (const [k, v] of Object.entries(style)) {
          if (v !== undefined) styleBody[k] = v;
        }
      }
      if (Object.keys(styleBody).length > 0) body.style = styleBody;
      const data = await muralApi.patch<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/area/${widgetId}`,
        body
      );
      return text(singleResponse(`Updated area ${widgetId}`, data.value));
    })
  );
}
