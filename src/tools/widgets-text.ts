import { z } from "zod";
import { muralApi } from "../client/mural-api";
import type { Widget, SingleResponse, ListResponse } from "../types";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { batchResponse, singleResponse } from "../utils/strip";
import { normalizeMuralId, MURAL_ID_DESC } from "../utils/normalize";
import { withTool } from "../utils/tool-wrapper";
import { colorSchema, fontSchema, positionSchema, text, textErr, withTextStyleDefaults } from "./widgets-shared";

export function registerTextTools(server: McpServer) {
  server.tool(
    "create_text_boxes",
    "Create text boxes on a mural (batch, up to 1000). Returns IDs.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      textBoxes: z
        .array(
          z.object({
            ...positionSchema,
            text: z.string().describe("Text content"),
            width: z.number().optional(),
            height: z.number().optional(),
            hidden: z.boolean().optional(),
            hyperlink: z.string().url().optional(),
            hyperlinkTitle: z.string().optional(),
            instruction: z.string().optional(),
            parentId: z.string().optional(),
            presentationIndex: z.number().optional(),
            rotation: z.number().optional(),
            stackingOrder: z.number().optional(),
            title: z.string().optional(),
            style: z
              .object({
                fontSize: z.number().optional(),
                textAlign: z.enum(["left", "center", "right"]).optional(),
                backgroundColor: colorSchema,
                font: fontSchema,
              })
              .optional(),
          })
        )
        .min(1)
        .max(1000),
    },
    withTool("create_text_boxes", async ({ muralId: rawMuralId, textBoxes }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId);
      if (muralIdErr) return textErr(muralIdErr);
      const body = textBoxes.map((t) => {
        const { style, ...rest } = t as Record<string, unknown>;
        return { ...rest, style: withTextStyleDefaults(style as Record<string, unknown> | undefined) };
      });
      const data = await muralApi.post<ListResponse<Widget>>(
        `/murals/${muralId}/widgets/textbox`,
        body
      );
      return text(batchResponse(`Created ${data.value.length} text box(es)`, data.value));
    })
  );

  server.tool(
    "update_text_box",
    "Update a text box on a mural",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      widgetId: z.string().describe("Widget ID"),
      text: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      hidden: z.boolean().optional(),
      hyperlink: z.string().url().optional(),
      hyperlinkTitle: z.string().optional(),
      instruction: z.string().optional(),
      parentId: z.string().optional(),
      presentationIndex: z.number().optional(),
      rotation: z.number().optional(),
      title: z.string().optional(),
      style: z
        .object({
          fontSize: z.number().optional(),
          textAlign: z.enum(["left", "center", "right"]).optional(),
          backgroundColor: colorSchema,
          font: fontSchema,
        })
        .optional(),
    },
    withTool("update_text_box", async ({ muralId: rawMuralId, widgetId, style, ...changes }) => {
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
        `/murals/${muralId}/widgets/textbox/${widgetId}`,
        body
      );
      return text(singleResponse(`Updated text box ${widgetId}`, data.value));
    })
  );

  server.tool(
    "create_title",
    "Create title widgets on a mural (batch, up to 1000). Returns IDs.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      titles: z
        .array(
          z.object({
            ...positionSchema,
            text: z.string().optional(),
            width: z.number().optional(),
            height: z.number().optional(),
            hidden: z.boolean().optional(),
            hyperlink: z.string().url().optional(),
            hyperlinkTitle: z.string().optional(),
            rotation: z.number().optional(),
            stackingOrder: z.number().optional(),
            title: z.string().optional(),
            instruction: z.string().optional(),
            parentId: z.string().optional(),
            presentationIndex: z.number().optional(),
            style: z
              .object({
                backgroundColor: colorSchema,
                font: fontSchema,
                fontSize: z.number().optional(),
                textAlign: z.enum(["left", "center", "right"]).optional(),
              })
              .optional(),
          })
        )
        .min(1)
        .max(1000),
    },
    withTool("create_title", async ({ muralId: rawMuralId, titles }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId);
      if (muralIdErr) return textErr(muralIdErr);
      const body = titles.map((t) => {
        const { style, ...rest } = t as Record<string, unknown>;
        return { ...rest, style: withTextStyleDefaults(style as Record<string, unknown> | undefined) };
      });
      const data = await muralApi.post<ListResponse<Widget>>(
        `/murals/${muralId}/widgets/title`,
        body
      );
      return text(batchResponse(`Created ${data.value.length} title(s)`, data.value));
    })
  );

  server.tool(
    "update_title",
    "Update an existing title widget.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      widgetId: z.string().describe("Widget ID"),
      text: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      hidden: z.boolean().optional(),
      hyperlink: z.string().url().optional(),
      hyperlinkTitle: z.string().optional(),
      rotation: z.number().optional(),
      title: z.string().optional(),
      instruction: z.string().optional(),
      parentId: z.string().optional(),
      presentationIndex: z.number().optional(),
      style: z
        .object({
          backgroundColor: colorSchema,
          font: fontSchema,
          fontSize: z.number().optional(),
          textAlign: z.enum(["left", "center", "right"]).optional(),
        })
        .optional(),
    },
    withTool("update_title", async ({ muralId: rawMuralId, widgetId, style, ...changes }) => {
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
        `/murals/${muralId}/widgets/title/${widgetId}`,
        body
      );
      return text(singleResponse("Updated title", data.value));
    })
  );
}
