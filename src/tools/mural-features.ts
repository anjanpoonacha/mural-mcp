import { z } from "zod";
import { muralApi } from "../client/mural-api";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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

function textErr(t: string) {
  return { content: [{ type: "text" as const, text: t }], isError: true };
}

export function registerMuralFeatureTools(server: McpServer) {
  // ============================
  // DUPLICATE
  // ============================

  server.tool(
    "duplicate_mural",
    "Duplicate a mural, optionally into a different room.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      roomId: z.number().optional(),
      title: z.string().optional(),
      folderId: z.string().optional(),
      infinite: z.boolean().optional(),
    },
    withTool("duplicate_mural", async ({ muralId: rawMuralId, roomId, title, folderId, infinite }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      const body: Record<string, unknown> = {};
      if (roomId !== undefined) body.roomId = roomId;
      if (title !== undefined) body.title = title;
      if (folderId !== undefined) body.folderId = folderId;
      if (infinite !== undefined) body.infinite = infinite;

      const data = await muralApi.post<{ value: { id: string; title?: string; roomId?: number } }>(
        `/murals/${muralId}/duplicate`,
        body
      );

      return text(JSON.stringify({ id: data.value.id, title: data.value.title, roomId: data.value.roomId }));
    })
  );

  // ============================
  // TAGS
  // ============================

  server.tool(
    "get_mural_tags",
    "Get all tags on a mural.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
    },
    withTool("get_mural_tags", async ({ muralId: rawMuralId }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      const data = await muralApi.get<{ value: Array<{ id: string; text: string; backgroundColor?: string }> }>(
        `/murals/${muralId}/tags`
      );

      return text(JSON.stringify(data.value.map((t) => ({ id: t.id, text: t.text, backgroundColor: t.backgroundColor }))));
    })
  );

  server.tool(
    "create_mural_tag",
    "Create a tag on a mural.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      text: z.string(),
      backgroundColor: colorSchema,
      borderColor: colorSchema,
      color: z.string().optional(),
    },
    withTool("create_mural_tag", async ({ muralId: rawMuralId, text: tagText, backgroundColor, borderColor, color }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      const body: Record<string, unknown> = { text: tagText };
      if (backgroundColor !== undefined) body.backgroundColor = backgroundColor;
      if (borderColor !== undefined) body.borderColor = borderColor;
      if (color !== undefined) body.color = color;

      const data = await muralApi.post<{ value: { id: string; text: string; backgroundColor?: string } }>(
        `/murals/${muralId}/tags`,
        body
      );

      return text(JSON.stringify({ id: data.value.id, text: data.value.text, backgroundColor: data.value.backgroundColor }));
    })
  );

  server.tool(
    "update_mural_tag",
    "Update a tag on a mural.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      tagId: z.string(),
      text: z.string().optional(),
      backgroundColor: colorSchema,
      borderColor: colorSchema,
      color: z.string().optional(),
    },
    withTool("update_mural_tag", async ({ muralId: rawMuralId, tagId, text: tagText, backgroundColor, borderColor, color }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      const body: Record<string, unknown> = {};
      if (tagText !== undefined) body.text = tagText;
      if (backgroundColor !== undefined) body.backgroundColor = backgroundColor;
      if (borderColor !== undefined) body.borderColor = borderColor;
      if (color !== undefined) body.color = color;

      const data = await muralApi.patch<{ value: { id: string; text: string } }>(
        `/murals/${muralId}/tags/${tagId}`,
        body
      );

      return text(JSON.stringify({ id: data.value.id, text: data.value.text }));
    })
  );

  server.tool(
    "delete_mural_tag",
    "Delete a tag from a mural.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      tagId: z.string(),
    },
    withTool("delete_mural_tag", async ({ muralId: rawMuralId, tagId }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      await muralApi.delete(`/murals/${muralId}/tags/${tagId}`);
      return text(`Deleted tag ${tagId}`);
    })
  );

  // ============================
  // TIMER
  // ============================

  server.tool(
    "get_timer",
    "Get the current timer state on a mural.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
    },
    withTool("get_timer", async ({ muralId: rawMuralId }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      const data = await muralApi.get<{ value: { duration?: number; remainingSeconds?: number; soundEnabled?: boolean } }>(
        `/murals/${muralId}/timer`
      );

      return text(JSON.stringify({ duration: data.value.duration, remainingSeconds: data.value.remainingSeconds, soundEnabled: data.value.soundEnabled }));
    })
  );

  server.tool(
    "start_timer",
    "Start the timer on a mural.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      duration: z.number().describe("Duration in seconds"),
      soundEnabled: z.boolean(),
    },
    withTool("start_timer", async ({ muralId: rawMuralId, duration, soundEnabled }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      const data = await muralApi.post<{ value: { duration?: number; remainingSeconds?: number } }>(
        `/murals/${muralId}/timer/start`,
        { duration, soundEnabled }
      );

      return text(JSON.stringify({ duration: data.value.duration, remainingSeconds: data.value.remainingSeconds }));
    })
  );

  server.tool(
    "stop_timer",
    "Stop the timer on a mural.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
    },
    withTool("stop_timer", async ({ muralId: rawMuralId }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      await muralApi.post(`/murals/${muralId}/timer/end`, {});
      return text("Timer stopped");
    })
  );

  // ============================
  // VOTING SESSIONS
  // ============================

  server.tool(
    "start_voting_session",
    "Start a voting session on a mural.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      title: z.string(),
      numberOfVotes: z.number(),
      anyoneCanEnd: z.boolean().optional(),
    },
    withTool("start_voting_session", async ({ muralId: rawMuralId, title, numberOfVotes, anyoneCanEnd }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      const body: Record<string, unknown> = { title, numberOfVotes };
      if (anyoneCanEnd !== undefined) body.anyoneCanEnd = anyoneCanEnd;

      const data = await muralApi.post<{ value: { id: string; title?: string } }>(
        `/murals/${muralId}/voting-sessions/start`,
        body
      );

      return text(JSON.stringify({ id: data.value.id, title: data.value.title }));
    })
  );

  server.tool(
    "end_voting_session",
    "End the active voting session on a mural.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
    },
    withTool("end_voting_session", async ({ muralId: rawMuralId }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      await muralApi.post(`/murals/${muralId}/voting-sessions/end`, {});
      return text("Voting session ended");
    })
  );

  server.tool(
    "get_voting_results",
    "Get results for a voting session on a mural.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      votingSessionId: z.string(),
    },
    withTool("get_voting_results", async ({ muralId: rawMuralId, votingSessionId }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId); if (muralIdErr) return textErr(muralIdErr);
      const data = await muralApi.get<{ value: Array<{ widgetId: string; totalVotes: number; uniqueVoters: number }> }>(
        `/murals/${muralId}/voting-sessions/${votingSessionId}/results`
      );

      return text(JSON.stringify(data.value.map((r) => ({ widgetId: r.widgetId, totalVotes: r.totalVotes, uniqueVoters: r.uniqueVoters }))));
    })
  );
}
