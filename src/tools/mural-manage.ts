import { z } from "zod";
import { muralApi } from "../client/mural-api";
import type { Mural, SingleResponse } from "../types";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stripMural } from "../utils/strip";
import { withTool } from "../utils/tool-wrapper";
import { normalizeMuralId, MURAL_ID_DESC } from "../utils/normalize";

const colorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6,8}$/)
  .optional()
  .describe("Color hex, e.g. #FF0000FF");

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}

export function registerMuralManageTools(server: McpServer) {
  server.tool(
    "create_mural",
    "Create a new mural in a room. Returns mural ID + title.",
    {
      roomId: z.number().describe("Room ID to create the mural in"),
      title: z.string().optional().describe("Mural title"),
      backgroundColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6,8}$/)
        .optional()
        .describe("Background color (hex, e.g. #FAFAFAFF)"),
      width: z
        .number()
        .min(3000)
        .max(60000)
        .optional()
        .describe("Width in px (3000–60000, default 9216)"),
      height: z
        .number()
        .min(3000)
        .max(60000)
        .optional()
        .describe("Height in px (3000–60000, default 6237)"),
      infinite: z
        .boolean()
        .optional()
        .describe("Borderless canvas that grows as you add widgets"),
    },
    withTool("create_mural", async ({ roomId, title, backgroundColor, width, height, infinite }) => {
      const body: Record<string, unknown> = { roomId };
      if (title !== undefined) body.title = title;
      if (backgroundColor !== undefined) body.backgroundColor = backgroundColor;
      if (width !== undefined) body.width = width;
      if (height !== undefined) body.height = height;
      if (infinite !== undefined) body.infinite = infinite;

      const data = await muralApi.post<SingleResponse<Mural>>("/murals", body);

      const slim = stripMural(data.value);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ summary: `Created mural "${data.value.title || "(untitled)"}"`, ...slim }),
          },
        ],
      };
    })
  );

  server.tool(
    "update_mural",
    "Update metadata (title, background color, dimensions) of an existing mural.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      title: z.string().optional().describe("New mural title"),
      backgroundColor: colorSchema,
      width: z.number().min(3000).max(60000).optional().describe("Width in px (3000–60000)"),
      height: z.number().min(3000).max(60000).optional().describe("Height in px (3000–60000)"),
      infinite: z.boolean().optional().describe("Borderless canvas that grows as you add widgets"),
      status: z.enum(["active", "archived"]).optional().describe("Archive or restore a mural"),
      favorite: z.boolean().optional().describe("Mark as favourite"),
      folderId: z.string().optional().describe("Move to folder by ID"),
      visitorsPermission: z.enum(["read", "write", "none"]).optional(),
      workspaceMembersPermission: z.enum(["read", "write", "none"]).optional(),
      timerSoundTheme: z.enum(["airplane", "cello", "cuckoo"]).optional(),
      visitorAvatarTheme: z.enum(["animals", "music", "travel"]).optional(),
    },
    withTool("update_mural", async ({ muralId: rawId, title, backgroundColor, width, height, infinite, status, favorite, folderId, visitorsPermission, workspaceMembersPermission, timerSoundTheme, visitorAvatarTheme }) => {
      const { id: muralId, error } = normalizeMuralId(rawId);
      if (error) return text(error);

      const body: Record<string, unknown> = {};
      if (title !== undefined) body.title = title;
      if (backgroundColor !== undefined) body.backgroundColor = backgroundColor;
      if (width !== undefined) body.width = width;
      if (height !== undefined) body.height = height;
      if (infinite !== undefined) body.infinite = infinite;
      if (status !== undefined) body.status = status;
      if (favorite !== undefined) body.favorite = favorite;
      if (folderId !== undefined) body.folderId = folderId;
      if (visitorsPermission !== undefined) body.visitorsPermission = visitorsPermission;
      if (workspaceMembersPermission !== undefined) body.workspaceMembersPermission = workspaceMembersPermission;
      if (timerSoundTheme !== undefined) body.timerSoundTheme = timerSoundTheme;
      if (visitorAvatarTheme !== undefined) body.visitorAvatarTheme = visitorAvatarTheme;

      const data = await muralApi.patch<SingleResponse<Mural>>(`/murals/${muralId}`, body);
      const slim = stripMural(data.value);
      return text(JSON.stringify({ summary: "Updated mural", ...slim }));
    })
  );

  server.tool(
    "delete_mural",
    "Permanently delete a mural by ID.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
    },
    withTool("delete_mural", async ({ muralId: rawId }) => {
      const { id: muralId, error } = normalizeMuralId(rawId);
      if (error) return text(error);

      await muralApi.delete(`/murals/${muralId}`);
      return text(JSON.stringify({ summary: "Deleted mural", id: muralId }));
    })
  );
}
