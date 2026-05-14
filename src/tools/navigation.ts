import { z } from "zod";
import { muralApi } from "../client/mural-api";
import { filterAllowedWorkspaces, isWorkspaceAllowed, getWorkspaceGuardError } from "../auth/workspace-guard";
import type { Workspace, Room, Mural, ListResponse, SingleResponse } from "../types";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stripWorkspace, stripRoom, stripMural } from "../utils/strip";
import { normalizeMuralId, MURAL_ID_DESC } from "../utils/normalize";
import { withTool } from "../utils/tool-wrapper";

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}
function textErr(t: string) {
  return { content: [{ type: "text" as const, text: t }], isError: true };
}

export function registerNavigationTools(server: McpServer) {
  // --- list_workspaces ---
  server.tool(
    "list_workspaces",
    "List Mural workspaces (stripped to id+name)",
    {},
    withTool("list_workspaces", async () => {
      const data = await muralApi.get<ListResponse<Workspace>>("/workspaces");
      const filtered = filterAllowedWorkspaces(data.value).map(stripWorkspace);
      return text(JSON.stringify(filtered));
    })
  );

  // --- list_rooms ---
  server.tool(
    "list_rooms",
    "List rooms in a workspace (stripped to id+name+type). Default limit 50.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      limit: z.number().min(1).max(200).optional().describe("Max rooms (default 50)"),
      next: z.string().optional().describe("Pagination cursor from previous response"),
    },
    withTool("list_rooms", async ({ workspaceId, limit, next }) => {
      if (!isWorkspaceAllowed(workspaceId)) {
        return textErr(getWorkspaceGuardError(workspaceId));
      }
      const params: Record<string, string> = { limit: String(limit ?? 50) };
      if (next) params.next = next;
      const data = await muralApi.get<ListResponse<Room>>(
        `/workspaces/${workspaceId}/rooms`,
        params
      );
      const rooms = data.value.map(stripRoom);
      const result: Record<string, unknown> = { count: rooms.length, rooms };
      if (data.next) result.next = data.next;
      return text(JSON.stringify(result));
    })
  );

  // --- list_murals ---
  server.tool(
    "list_murals",
    "List murals in a room or workspace (stripped to id+title+roomId). Default limit 50.",
    {
      roomId: z.number().optional().describe("Room ID (preferred — more specific)"),
      workspaceId: z.string().optional().describe("Workspace ID (lists all murals in workspace)"),
      limit: z.number().min(1).max(200).optional().describe("Max murals (default 50)"),
      next: z.string().optional().describe("Pagination cursor from previous response"),
    },
    withTool("list_murals", async ({ roomId, workspaceId, limit, next }) => {
      let path: string;
      if (roomId !== undefined) {
        path = `/rooms/${roomId}/murals`;
      } else if (workspaceId) {
        if (!isWorkspaceAllowed(workspaceId)) {
          return textErr(getWorkspaceGuardError(workspaceId));
        }
        path = `/workspaces/${workspaceId}/murals`;
      } else {
        return textErr("Error: Provide either roomId or workspaceId");
      }
      const params: Record<string, string> = { limit: String(limit ?? 50) };
      if (next) params.next = next;
      const data = await muralApi.get<ListResponse<Mural>>(path, params);
      const murals = data.value.map(stripMural);
      const result: Record<string, unknown> = { count: murals.length, murals };
      if (data.next) result.next = data.next;
      return text(JSON.stringify(result));
    })
  );

  // --- get_current_user ---
  server.tool(
    "get_current_user",
    "Get the currently authenticated Mural user",
    {},
    withTool("get_current_user", async () => {
      const data = await muralApi.get<{ value: Record<string, unknown> }>("/users/me");
      const u = data.value;
      const slim: Record<string, unknown> = {};
      for (const key of ["id", "companyId", "companyName", "type", "lastActiveWorkspace", "createdOn"]) {
        if (u[key] !== undefined) slim[key] = u[key];
      }
      return text(JSON.stringify(slim));
    })
  );

  // --- search_murals ---
  server.tool(
    "search_murals",
    "Search for murals in a workspace",
    {
      workspaceId: z.string().describe("Workspace ID"),
      query: z.string().describe("Search query"),
      roomId: z.number().optional().describe("Filter by room ID"),
      limit: z.number().optional().describe("Max results (default 20)"),
      next: z.string().optional().describe("Pagination cursor"),
    },
    withTool("search_murals", async ({ workspaceId, query, roomId, limit, next }) => {
      const params: Record<string, string> = { q: query, limit: String(limit ?? 20) };
      if (roomId !== undefined) params.roomId = String(roomId);
      if (next) params.next = next;
      const data = await muralApi.get<{ value: unknown[]; next?: string }>(
        `/search/${workspaceId}/murals`,
        params
      );
      const murals = (data.value as Array<Record<string, unknown>>).map((m) => ({
        id: m.id,
        title: m.title,
        roomId: m.roomId,
        workspaceId: m.workspaceId,
        thumbnailUrl: m.thumbnailUrl,
      }));
      const result: Record<string, unknown> = { count: murals.length, murals };
      if (data.next) result.next = data.next;
      return text(JSON.stringify(result));
    })
  );

  // --- search_rooms ---
  server.tool(
    "search_rooms",
    "Search for rooms in a workspace",
    {
      workspaceId: z.string().describe("Workspace ID"),
      query: z.string().describe("Search query"),
      limit: z.number().optional().describe("Max results"),
      next: z.string().optional().describe("Pagination cursor"),
    },
    withTool("search_rooms", async ({ workspaceId, query, limit, next }) => {
      const params: Record<string, string> = { q: query };
      if (limit !== undefined) params.limit = String(limit);
      if (next) params.next = next;
      const data = await muralApi.get<{ value: unknown[]; next?: string }>(
        `/search/${workspaceId}/rooms`,
        params
      );
      const rooms = (data.value as Array<Record<string, unknown>>).map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
      }));
      const result: Record<string, unknown> = { count: rooms.length, rooms };
      if (data.next) result.next = data.next;
      return text(JSON.stringify(result));
    })
  );

  // --- search_templates ---
  server.tool(
    "search_templates",
    "Search for templates in a workspace",
    {
      workspaceId: z.string().describe("Workspace ID"),
      query: z.string().describe("Search query"),
      limit: z.number().optional().describe("Max results"),
      next: z.string().optional().describe("Pagination cursor"),
    },
    withTool("search_templates", async ({ workspaceId, query, limit, next }) => {
      const params: Record<string, string> = { q: query };
      if (limit !== undefined) params.limit = String(limit);
      if (next) params.next = next;
      const data = await muralApi.get<{ value: unknown[]; next?: string }>(
        `/search/${workspaceId}/templates`,
        params
      );
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

  // --- create_room ---
  server.tool(
    "create_room",
    "Create a new room in a workspace",
    {
      workspaceId: z.string().describe("Workspace ID"),
      name: z.string().describe("Room name"),
      type: z.string().describe("Room type: open or private"),
      description: z.string().optional().describe("Room description"),
      confidential: z.boolean().optional().describe("Whether the room is confidential"),
    },
    withTool("create_room", async ({ workspaceId, name, type, description, confidential }) => {
      const body: Record<string, unknown> = { workspaceId, name, type };
      if (description !== undefined) body.description = description;
      if (confidential !== undefined) body.confidential = confidential;
      const data = await muralApi.post<{ value: Record<string, unknown> }>("/rooms", body);
      const r = data.value;
      return text(JSON.stringify({ id: r.id, name: r.name, type: r.type, workspaceId: r.workspaceId }));
    })
  );

  // --- get_room ---
  server.tool(
    "get_room",
    "Get details for a specific room",
    {
      roomId: z.number().describe("Room ID"),
    },
    withTool("get_room", async ({ roomId }) => {
      const data = await muralApi.get<{ value: Record<string, unknown> }>(`/rooms/${roomId}`);
      const r = data.value;
      const slim: Record<string, unknown> = {};
      for (const key of ["id", "name", "description", "type", "workspaceId", "confidential", "isMember"]) {
        if (r[key] !== undefined) slim[key] = r[key];
      }
      return text(JSON.stringify(slim));
    })
  );

  // --- update_room ---
  server.tool(
    "update_room",
    "Update a room's properties",
    {
      roomId: z.number().describe("Room ID"),
      name: z.string().optional().describe("New room name"),
      description: z.string().optional().describe("New description"),
      type: z.string().optional().describe("New type"),
      favorite: z.boolean().optional().describe("Mark as favorite"),
    },
    withTool("update_room", async ({ roomId, name, description, type, favorite }) => {
      const body: Record<string, unknown> = {};
      if (name !== undefined) body.name = name;
      if (description !== undefined) body.description = description;
      if (type !== undefined) body.type = type;
      if (favorite !== undefined) body.favorite = favorite;
      const data = await muralApi.patch<{ value: Record<string, unknown> }>(`/rooms/${roomId}`, body);
      const r = data.value;
      return text(JSON.stringify({ id: r.id, name: r.name, type: r.type }));
    })
  );

  // --- invite_users_to_mural ---
  server.tool(
    "invite_users_to_mural",
    "Invite users to a mural",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      invitations: z.array(z.object({
        email: z.string().optional(),
        username: z.string().optional(),
        editPermission: z.string().optional(),
      })).min(1).describe("Array of users to invite. Provide email or username."),
      message: z.string().optional().describe("Optional invitation message"),
      sendEmail: z.boolean().optional().describe("Whether to send invitation email (default true)"),
    },
    withTool("invite_users_to_mural", async ({ muralId: rawMuralId, invitations, message, sendEmail }) => {
      const { id: muralId, error } = normalizeMuralId(rawMuralId);
      if (error) return textErr(error);
      const body: Record<string, unknown> = { invitations };
      if (message !== undefined) body.message = message;
      if (sendEmail !== undefined) body.sendEmail = sendEmail;
      const data = await muralApi.post<{ value?: unknown[] }>(`/murals/${muralId}/users/invite`, body);
      return text(JSON.stringify({ invited: data.value?.length ?? 0, results: data.value }));
    })
  );

  // --- invite_users_to_room ---
  server.tool(
    "invite_users_to_room",
    "Invite users to a room",
    {
      roomId: z.number().describe("Room ID"),
      invitations: z.array(z.object({
        email: z.string().optional(),
        username: z.string().optional(),
      })).min(1).describe("Array of users to invite. Provide email or username."),
      message: z.string().optional().describe("Optional invitation message"),
      sendEmail: z.boolean().optional().describe("Whether to send invitation email (default true)"),
    },
    withTool("invite_users_to_room", async ({ roomId, invitations, message, sendEmail }) => {
      const body: Record<string, unknown> = { invitations };
      if (message !== undefined) body.message = message;
      if (sendEmail !== undefined) body.sendEmail = sendEmail;
      const data = await muralApi.post<{ value?: unknown[] }>(`/rooms/${roomId}/users/invite`, body);
      return text(JSON.stringify({ invited: data.value?.length ?? 0, results: data.value }));
    })
  );

  // --- get_mural ---
  server.tool(
    "get_mural",
    "Get metadata for a specific mural (stripped to key fields)",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
    },
    withTool("get_mural", async ({ muralId: rawMuralId }) => {
      const { id: muralId, error } = normalizeMuralId(rawMuralId);
      if (error) return textErr(error);
      const data = await muralApi.get<SingleResponse<Mural>>(
        `/murals/${muralId}`
      );
      const m = data.value;
      const slim: Record<string, unknown> = { id: m.id };
      if (m.title) slim.title = m.title;
      if (m.width) slim.width = m.width;
      if (m.height) slim.height = m.height;
      if (m.backgroundColor) slim.bg = m.backgroundColor;
      if (m.roomId) slim.roomId = m.roomId;
      if (m.infinite !== undefined) slim.infinite = m.infinite;
      return text(JSON.stringify(slim));
    })
  );
}
