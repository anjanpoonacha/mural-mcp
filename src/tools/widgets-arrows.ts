import { z } from "zod";
import { muralApi } from "../client/mural-api";
import type { Widget, SingleResponse } from "../types";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { batchResponse, singleResponse } from "../utils/strip";
import { normalizeMuralId, MURAL_ID_DESC } from "../utils/normalize";
import { withTool } from "../utils/tool-wrapper";
import { colorSchema, positionSchema, text, textErr, computeArrowGeometry } from "./widgets-shared";

const arrowStyleSchema = z
  .object({
    strokeColor: colorSchema,
    strokeWidth: z.number().optional(),
    strokeStyle: z.enum(["solid", "dashed", "dotted-spaced", "dotted"]).optional(),
  })
  .optional();

const arrowTypeSchema = z.enum(["straight", "curved", "orthogonal"]).optional();

export function registerArrowTools(server: McpServer) {
  server.tool(
    "connect_widgets",
    "Draw a connected arrow between two widgets. Provide source/target IDs and positions.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      sourceWidgetId: z.string().describe("Widget ID arrow starts FROM (tail)"),
      targetWidgetId: z.string().describe("Widget ID arrow points TO (head)"),
      sourceX: z.number(), sourceY: z.number(),
      sourceWidth: z.number(), sourceHeight: z.number(),
      targetX: z.number(), targetY: z.number(),
      targetWidth: z.number().optional(), targetHeight: z.number().optional(),
      arrowType: arrowTypeSchema,
      style: arrowStyleSchema,
    },
    withTool("connect_widgets", async ({ muralId: rawMuralId, sourceWidgetId, targetWidgetId, sourceX, sourceY, sourceWidth, sourceHeight, targetX, targetY, targetWidth, targetHeight, arrowType, style }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId);
      if (muralIdErr) return textErr(muralIdErr);
      const geom = computeArrowGeometry(
        { x: sourceX, y: sourceY, w: sourceWidth, h: sourceHeight },
        { x: targetX, y: targetY, w: targetWidth ?? sourceWidth, h: targetHeight ?? sourceHeight }
      );
      const body: Record<string, unknown> = {
        ...geom,
        arrowType: arrowType || "straight",
        startRefId: sourceWidgetId,
        endRefId: targetWidgetId,
      };
      if (style) body.style = style;
      const data = await muralApi.post<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/arrow`,
        body
      );
      return text(singleResponse(`Connected ${sourceWidgetId} → ${targetWidgetId}`, data.value));
    })
  );

  server.tool(
    "connect_widgets_batch",
    "Connect multiple widget pairs with arrows in one call. Returns all arrow IDs.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      connections: z
        .array(
          z.object({
            sourceWidgetId: z.string(),
            targetWidgetId: z.string(),
            sourceX: z.number(), sourceY: z.number(),
            sourceWidth: z.number(), sourceHeight: z.number(),
            targetX: z.number(), targetY: z.number(),
            targetWidth: z.number().optional(), targetHeight: z.number().optional(),
            arrowType: arrowTypeSchema,
          })
        )
        .min(1)
        .max(100),
      style: arrowStyleSchema.describe("Style applied to all arrows"),
    },
    withTool("connect_widgets_batch", async ({ muralId: rawMuralId, connections, style }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId);
      if (muralIdErr) return textErr(muralIdErr);
      const results: Widget[] = [];
      const errors: string[] = [];
      for (const c of connections) {
        try {
          const geom = computeArrowGeometry(
            { x: c.sourceX, y: c.sourceY, w: c.sourceWidth, h: c.sourceHeight },
            { x: c.targetX, y: c.targetY, w: c.targetWidth ?? c.sourceWidth, h: c.targetHeight ?? c.sourceHeight }
          );
          const body: Record<string, unknown> = {
            ...geom,
            arrowType: c.arrowType || "straight",
            startRefId: c.sourceWidgetId,
            endRefId: c.targetWidgetId,
          };
          if (style) body.style = style;
          const data = await muralApi.post<SingleResponse<Widget>>(
            `/murals/${muralId}/widgets/arrow`,
            body
          );
          results.push(data.value);
        } catch (e: unknown) {
          errors.push(`${c.sourceWidgetId}→${c.targetWidgetId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      const summary = `Connected ${results.length}/${connections.length} pairs` +
        (errors.length > 0 ? `\nErrors:\n${errors.join("\n")}` : "");
      return text(batchResponse(summary, results));
    })
  );

  server.tool(
    "create_arrow",
    "Draw a freeform arrow (not snapped to widgets). For connected arrows, use connect_widgets.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      ...positionSchema,
      width: z.number().describe("Bounding box width"),
      height: z.number().describe("Bounding box height"),
      points: z
        .array(z.object({ x: z.number(), y: z.number() }))
        .min(2)
        .describe("Arrow path points as coordinates RELATIVE to the widget bounding box (x,y). {x:0,y:0} = top-left of bbox. points[0] = arrowhead, points[1] = tail."),
      arrowType: arrowTypeSchema,
      style: arrowStyleSchema,
    },
    withTool("create_arrow", async ({ muralId: rawMuralId, x, y, width, height, points, arrowType, style }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId);
      if (muralIdErr) return textErr(muralIdErr);
      const body: Record<string, unknown> = { x, y, width, height, points };
      if (arrowType) body.arrowType = arrowType;
      if (style) body.style = style;
      const data = await muralApi.post<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/arrow`,
        body
      );
      return text(singleResponse("Created arrow", data.value));
    })
  );

  server.tool(
    "update_arrow",
    "Update an existing arrow widget (position, style, type, endpoints).",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      widgetId: z.string().describe("Widget ID"),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      arrowType: arrowTypeSchema,
      tip: z.enum(["no tip", "single", "double"]).optional(),
      rotation: z.number().optional(),
      title: z.string().optional(),
      instruction: z.string().optional(),
      parentId: z.string().optional(),
      style: arrowStyleSchema,
    },
    withTool("update_arrow", async ({ muralId: rawMuralId, widgetId, style, ...changes }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId);
      if (muralIdErr) return textErr(muralIdErr);
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(changes)) {
        if (value !== undefined) body[key] = value;
      }
      if (style) {
        const styleBody: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(style)) {
          if (v !== undefined) styleBody[k] = v;
        }
        if (Object.keys(styleBody).length > 0) body.style = styleBody;
      }
      const data = await muralApi.patch<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/arrow/${widgetId}`,
        body
      );
      return text(singleResponse("Updated arrow", data.value));
    })
  );
}
