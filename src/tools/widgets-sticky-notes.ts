import { z } from "zod";
import { muralApi } from "../client/mural-api";
import type { Widget, SingleResponse, ListResponse } from "../types";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { batchResponse, singleResponse } from "../utils/strip";
import { normalizeMuralId, MURAL_ID_DESC } from "../utils/normalize";
import { withTool } from "../utils/tool-wrapper";
import { colorSchema, fontSchema, positionSchema, text, textErr, withTextStyleDefaults } from "./widgets-shared";

export function registerStickyNoteTools(server: McpServer) {
  server.tool(
    "create_sticky_notes",
    "Create sticky notes on a mural (batch, up to 1000). Returns IDs.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      stickies: z
        .array(
          z.object({
            ...positionSchema,
            text: z.string().describe("Sticky note text"),
            width: z.number().optional(),
            height: z.number().optional(),
            shape: z.enum(["rectangle", "circle"]).optional(),
            htmlText: z.string().optional(),
            hidden: z.boolean().optional(),
            hyperlink: z.string().url().optional(),
            hyperlinkTitle: z.string().optional(),
            instruction: z.string().optional(),
            parentId: z.string().optional(),
            presentationIndex: z.number().optional(),
            rotation: z.number().min(0).optional(),
            stackingOrder: z.number().optional(),
            tags: z.array(z.string()).optional(),
            title: z.string().optional(),
            style: z
              .object({
                fontSize: z.number().optional(),
                textAlign: z.enum(["left", "center", "right"]).optional(),
                backgroundColor: colorSchema,
                bold: z.boolean().optional(),
                italic: z.boolean().optional(),
                underline: z.boolean().optional(),
                strike: z.boolean().optional(),
                font: fontSchema,
                border: z.boolean().optional(),
              })
              .optional(),
          })
        )
        .min(1)
        .max(1000),
    },
    withTool("create_sticky_notes", async ({ muralId: rawMuralId, stickies }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId);
      if (muralIdErr) return textErr(muralIdErr);
      const body = stickies.map((s) => {
        const { style, ...rest } = s;
        return {
          ...rest,
          shape: s.shape ?? "rectangle",
          style: withTextStyleDefaults(style as Record<string, unknown> | undefined),
        };
      });
      const data = await muralApi.post<ListResponse<Widget>>(
        `/murals/${muralId}/widgets/sticky-note`,
        body
      );
      return text(batchResponse(`Created ${data.value.length} sticky note(s)`, data.value));
    })
  );

  server.tool(
    "update_sticky_note",
    "Update a sticky note (text, position, color, size)",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      widgetId: z.string().describe("Widget ID"),
      text: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      htmlText: z.string().optional(),
      hidden: z.boolean().optional(),
      hyperlink: z.string().url().optional(),
      hyperlinkTitle: z.string().optional(),
      instruction: z.string().optional(),
      parentId: z.string().optional(),
      presentationIndex: z.number().optional(),
      rotation: z.number().optional(),
      tags: z.array(z.string()).optional(),
      title: z.string().optional(),
      style: z
        .object({
          backgroundColor: colorSchema,
          fontSize: z.number().optional(),
          textAlign: z.enum(["left", "center", "right"]).optional(),
          bold: z.boolean().optional(),
          italic: z.boolean().optional(),
          underline: z.boolean().optional(),
          strike: z.boolean().optional(),
          font: fontSchema,
          border: z.boolean().optional(),
        })
        .optional(),
    },
    withTool("update_sticky_note", async ({ muralId: rawMuralId, widgetId, style, ...changes }) => {
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
        `/murals/${muralId}/widgets/sticky-note/${widgetId}`,
        body
      );
      return text(singleResponse(`Updated sticky ${widgetId}`, data.value));
    })
  );
}
