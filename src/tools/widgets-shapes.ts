import { z } from "zod";
import { muralApi } from "../client/mural-api";
import type { Widget, SingleResponse, ListResponse } from "../types";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { batchResponse, singleResponse } from "../utils/strip";
import { normalizeMuralId, MURAL_ID_DESC } from "../utils/normalize";
import { withTool } from "../utils/tool-wrapper";
import { colorSchema, positionSchema, text, textErr, cleanStyle, VALID_SHAPES } from "./widgets-shared";

export function registerShapeTools(server: McpServer) {
  server.tool(
    "create_shapes",
    "Create shapes on a mural (batch, up to 1000). Common shapes: rectangle, circle, diamond, triangle, star, hexagon. Full list validated server-side.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      shapes: z
        .array(
          z.object({
            ...positionSchema,
            width: z.number().describe("Width in px"),
            height: z.number().describe("Height in px"),
            text: z.string().optional(),
            htmlText: z.string().optional(),
            shape: z.string().default("rectangle").describe("Shape type. Default: rectangle. Others: circle, diamond, triangle, star, hexagon, ellipse, rounded_square, etc. Full list validated server-side."),
            hidden: z.boolean().optional(),
            instruction: z.string().optional(),
            parentId: z.string().optional(),
            presentationIndex: z.number().optional(),
            rotation: z.number().optional(),
            stackingOrder: z.number().optional(),
            title: z.string().optional(),
            style: z
              .object({
                // Only these 5 fields are accepted by the API for shape create/update
                backgroundColor: colorSchema,
                borderColor: colorSchema,
                borderStyle: z.enum(["solid", "dotted"]).optional(),
                borderWidth: z.number().min(1).max(7).optional(),
                fontColor: colorSchema,
              })
              .optional(),
          })
        )
        .min(1)
        .max(1000),
    },
    withTool("create_shapes", async ({ muralId: rawMuralId, shapes }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId);
      if (muralIdErr) return textErr(muralIdErr);
      for (const s of shapes) {
        if (s.shape && !VALID_SHAPES.has(s.shape)) {
          return textErr(`Invalid shape "${s.shape}". Valid: rectangle, circle, diamond, triangle, star, hexagon, ellipse, rhombus_smart, rounded_square, ...`);
        }
      }
      const body = shapes.map((s) => {
        const { style, ...rest } = s as Record<string, unknown>;
        const cleanedStyle = cleanStyle(style as Record<string, unknown> | undefined);
        return cleanedStyle ? { ...rest, style: cleanedStyle } : rest;
      });
      const data = await muralApi.post<ListResponse<Widget>>(
        `/murals/${muralId}/widgets/shape`,
        body
      );
      return text(batchResponse(`Created ${data.value.length} shape(s)`, data.value));
    })
  );

  server.tool(
    "update_shape",
    "Update a shape on a mural",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      widgetId: z.string().describe("Widget ID"),
      text: z.string().optional(),
      htmlText: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      hidden: z.boolean().optional(),
      instruction: z.string().optional(),
      parentId: z.string().optional(),
      presentationIndex: z.number().optional(),
      rotation: z.number().optional(),
      title: z.string().optional(),
      style: z
        .object({
          backgroundColor: colorSchema,
          borderColor: colorSchema,
          borderStyle: z.enum(["solid", "dotted"]).optional(),
          borderWidth: z.number().min(1).max(7).optional(),
          fontColor: colorSchema,
        })
        .optional(),
    },
    withTool("update_shape", async ({ muralId: rawMuralId, widgetId, style, ...changes }) => {
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
        `/murals/${muralId}/widgets/shape/${widgetId}`,
        body
      );
      return text(singleResponse(`Updated shape ${widgetId}`, data.value));
    })
  );
}
