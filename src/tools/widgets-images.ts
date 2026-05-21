import { z } from "zod";
import { muralApi } from "../client/mural-api";
import type { Widget, SingleResponse } from "../types";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { singleResponse } from "../utils/strip";
import { normalizeMuralId, MURAL_ID_DESC } from "../utils/normalize";
import { withTool } from "../utils/tool-wrapper";
import { imageSize } from "image-size";
import { positionSchema, text, textErr, MAX_IMAGE_BYTES } from "./widgets-shared";

export function registerImageTools(server: McpServer) {
  server.tool(
    "create_image",
    "Add an image to a mural from a public URL. Auto-detects dimensions. Max 10MB.",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      ...positionSchema,
      url: z.string().url().describe("Public URL of the image"),
      width: z.number().optional().describe("Override width (default: original)"),
      height: z.number().optional().describe("Override height (default: original)"),
    },
    withTool("create_image", async ({ muralId: rawMuralId, x, y, url, width, height }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId);
      if (muralIdErr) return textErr(muralIdErr);

      // Step 1: Download
      const response = await fetch(url);
      if (!response.ok) return textErr(`Failed to download image: ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());

      if (buffer.length > MAX_IMAGE_BYTES) {
        return textErr(`Image too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB exceeds 10MB limit`);
      }

      // Detect dimensions
      const dimensions = imageSize(buffer);
      const imgWidth = width ?? dimensions.width ?? 400;
      const imgHeight = height ?? dimensions.height ?? 300;

      // Detect extension
      const contentType = response.headers.get("content-type") || "";
      let ext = "png";
      if (contentType.includes("jpeg") || contentType.includes("jpg") || url.match(/\.jpe?g$/i)) ext = "jpg";
      else if (contentType.includes("gif") || url.match(/\.gif$/i)) ext = "gif";
      else if (contentType.includes("webp") || url.match(/\.webp$/i)) ext = "webp";
      else if (contentType.includes("svg") || url.match(/\.svg$/i)) ext = "svg";

      // Step 2: Create asset URL
      const assetResponse = await muralApi.post<{ value: { url: string; name: string; headers: Record<string, string> } }>(
        `/murals/${muralId}/assets`,
        { fileExtension: ext }
      );
      const asset = assetResponse.value;

      // Step 3: Upload to blob storage
      const uploadResponse = await fetch(asset.url, {
        method: "PUT",
        headers: {
          "x-ms-blob-type": asset.headers["x-ms-blob-type"],
          "Content-Type": contentType || `image/${ext}`,
        },
        body: buffer,
      });
      if (!uploadResponse.ok) return textErr(`Failed to upload to Mural storage: ${uploadResponse.status}`);

      // Step 4: Create image widget
      const data = await muralApi.post<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/image`,
        { name: asset.name, x, y, width: imgWidth, height: imgHeight }
      );
      return text(singleResponse(`Added image (${imgWidth}×${imgHeight})`, data.value));
    })
  );

  server.tool(
    "update_image",
    "Update an existing image widget (position, size, caption, hyperlink, etc.).",
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      widgetId: z.string().describe("Widget ID"),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      rotation: z.number().optional(),
      hidden: z.boolean().optional(),
      border: z.boolean().optional(),
      caption: z.string().optional(),
      description: z.string().optional(),
      hyperlink: z.string().url().optional(),
      showCaption: z.boolean().optional(),
      title: z.string().optional(),
      instruction: z.string().optional(),
      parentId: z.string().optional(),
    },
    withTool("update_image", async ({ muralId: rawMuralId, widgetId, ...changes }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId);
      if (muralIdErr) return textErr(muralIdErr);
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(changes)) {
        if (value !== undefined) body[key] = value;
      }
      const data = await muralApi.patch<SingleResponse<Widget>>(
        `/murals/${muralId}/widgets/image/${widgetId}`,
        body
      );
      return text(singleResponse("Updated image", data.value));
    })
  );
}
