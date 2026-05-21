import { z } from "zod";
import { muralApi } from "../client/mural-api";
import type { Widget } from "../types";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { normalizeMuralId, MURAL_ID_DESC } from "../utils/normalize";
import { withTool } from "../utils/tool-wrapper";
import { colorSchema, text, textErr, cleanStyle } from "./widgets-shared";

export function registerTableTools(server: McpServer) {
  server.tool(
    "create_table",
    [
      "Create a native table widget on a mural.",
      "",
      "GEOMETRY RULES (read carefully):",
      "- rows[] and columns[] define the grid structure only (IDs + sizes).",
      "- Cell x/y/width/height are AUTO-COMPUTED from the grid — do NOT provide them.",
      "  cell.x = sum of widths of all columns BEFORE this cell's column (relative to table)",
      "  cell.y = sum of heights of all rows BEFORE this cell's row (relative to table)",
      "  cell.width = its column's width, cell.height = its row's height",
      "  IMPORTANT: cell coords are RELATIVE to the table top-left, NOT absolute canvas coords.",
      "",
      "CELL TEXT RULES:",
      "- textContent is optional. If provided, ALL of these fields are required by the API:",
      "  text, fontFamily, fontSize, textAlign, verticalAlign, orientation",
      "  Missing any one causes the API to silently drop the entire textContent.",
      "- text supports inline HTML: <b>, <i>, <u>, <s>, <ul>, <ol>, <li>",
      "- Safe defaults: fontFamily='proxima-nova', fontSize=14, textAlign='left',",
      "  verticalAlign='middle', orientation='horizontal'",
      "",
      "EXAMPLE — 2×2 table at x=100, y=200, col widths [200,300], row heights [50,60]:",
      "  rows: [{rowId:'r0',height:50},{rowId:'r1',height:60}]",
      "  columns: [{columnId:'c0',width:200},{columnId:'c1',width:300}]",
      "  cells: [",
      "    {rowId:'r0',columnId:'c0'}, // auto x=0,y=0,w=200,h=50",
      "    {rowId:'r0',columnId:'c1'}, // auto x=200,y=0,w=300,h=50",
      "    {rowId:'r1',columnId:'c0'}, // auto x=0,y=50,w=200,h=60",
      "    {rowId:'r1',columnId:'c1'}, // auto x=200,y=50,w=300,h=60",
      "  ]",
    ].join("\n"),
    {
      muralId: z.string().describe(MURAL_ID_DESC),
      x: z.number().describe("Horizontal position of the table's top-left corner in px from the left of the mural"),
      y: z.number().describe("Vertical position of the table's top-left corner in px from the top of the mural"),
      rows: z.array(z.object({
        rowId: z.string().describe("Unique row ID you choose, e.g. 'row-0'. Referenced by cells."),
        height: z.number().describe("Row height in px"),
        minHeight: z.number().optional().describe("Minimum row height in px"),
      })).min(1).describe("Ordered list of rows, top to bottom. Each row has an ID and height."),
      columns: z.array(z.object({
        columnId: z.string().describe("Unique column ID you choose, e.g. 'col-0'. Referenced by cells."),
        width: z.number().describe("Column width in px"),
      })).min(1).describe("Ordered list of columns, left to right. Each column has an ID and width."),
      cells: z.array(z.object({
        rowId: z.string().describe("ID of the row this cell belongs to (must match a rowId in rows[])"),
        columnId: z.string().describe("ID of the column this cell belongs to (must match a columnId in columns[])"),
        rowSpan: z.number().optional().describe("Number of rows this cell spans (default 1)"),
        colSpan: z.number().optional().describe("Number of columns this cell spans (default 1)"),
        style: z.object({
          backgroundColor: colorSchema,
        }).optional().describe("Cell background color"),
        textContent: z.object({
          text: z.string().describe("Cell text. Supports inline HTML: <b>, <i>, <u>, <s>, <ul>/<ol>/<li>"),
          fontFamily: z.enum(["adelle", "blambot-casual", "blambot-pro", "lint-mccree", "marker-felt", "museo-slab", "proxima-nova", "shark-water"]).default("proxima-nova").describe("Font family. Default: proxima-nova"),
          fontSize: z.number().default(14).describe("Font size in px. Default: 14"),
          textAlign: z.enum(["left", "center", "right"]).default("left").describe("Horizontal text alignment. Default: left"),
          verticalAlign: z.enum(["top", "middle", "bottom"]).default("middle").describe("Vertical text alignment. Default: middle"),
          orientation: z.enum(["horizontal", "vertical-left", "vertical-right"]).default("horizontal").describe("Text orientation. Default: horizontal"),
          padding: z.number().optional().describe("Cell padding in px (default 23)"),
        }).optional().describe("Cell text content. ALL sub-fields have defaults — just provide 'text' and optionally override others."),
      })).min(1).describe("One entry per cell. Do NOT provide x/y/width/height — they are computed automatically from the rows/columns grid."),
      width: z.number().optional().describe("Total table width in px. If omitted, computed as sum of all column widths."),
      height: z.number().optional().describe("Total table height in px. If omitted, computed as sum of all row heights."),
      autoResize: z.boolean().optional().describe("If true (default), table auto-resizes to fit cell content"),
      title: z.string().optional().describe("Table title shown in the outline"),
      hidden: z.boolean().optional(),
      instruction: z.string().optional(),
      parentId: z.string().optional(),
      presentationIndex: z.number().optional(),
      stackingOrder: z.number().optional(),
      style: z.object({
        borderColor: colorSchema.describe("Outer border color of the table"),
        borderWidth: z.number().optional().describe("Outer border width in px (default 3)"),
      }).optional(),
    },
    withTool("create_table", async ({ muralId: rawMuralId, x, y, rows, columns, cells, ...rest }) => {
      const { id: muralId, error: muralIdErr } = normalizeMuralId(rawMuralId);
      if (muralIdErr) return textErr(muralIdErr);

      // Cell x/y are RELATIVE to the table's top-left corner (not absolute canvas coords).
      const rowOffsets = new Map<string, { y: number; height: number }>();
      let rowY = 0;
      for (const row of rows) {
        rowOffsets.set(row.rowId, { y: rowY, height: row.height });
        rowY += row.height;
      }

      const colOffsets = new Map<string, { x: number; width: number }>();
      let colX = 0;
      for (const col of columns) {
        colOffsets.set(col.columnId, { x: colX, width: col.width });
        colX += col.width;
      }

      const resolvedCells = cells.map((cell) => {
        const row = rowOffsets.get(cell.rowId);
        const col = colOffsets.get(cell.columnId);
        if (!row) throw new Error(`Cell references unknown rowId "${cell.rowId}"`);
        if (!col) throw new Error(`Cell references unknown columnId "${cell.columnId}"`);

        const resolved: Record<string, unknown> = {
          rowId: cell.rowId,
          columnId: cell.columnId,
          x: col.x,
          y: row.y,
          width: col.width,
          height: row.height,
        };
        if (cell.rowSpan !== undefined) resolved.rowSpan = cell.rowSpan;
        if (cell.colSpan !== undefined) resolved.colSpan = cell.colSpan;
        if (cell.style) {
          const s = cleanStyle(cell.style as Record<string, unknown>);
          if (s) resolved.style = s;
        }
        if (cell.textContent) resolved.textContent = cell.textContent;
        return resolved;
      });

      const totalWidth = rest.width ?? columns.reduce((s, c) => s + c.width, 0);
      const totalHeight = rest.height ?? rows.reduce((s, r) => s + r.height, 0);

      const body: Record<string, unknown> = {
        x, y,
        width: totalWidth,
        height: totalHeight,
        rows,
        columns,
        cells: resolvedCells,
      };

      const scalarFields = ["autoResize", "title", "hidden", "instruction", "parentId", "presentationIndex", "stackingOrder"] as const;
      for (const f of scalarFields) {
        if ((rest as Record<string, unknown>)[f] !== undefined) body[f] = (rest as Record<string, unknown>)[f];
      }
      if (rest.style) {
        const s = cleanStyle(rest.style as Record<string, unknown>);
        if (s) body.style = s;
      }

      const data = await muralApi.post<{ value: Widget[] }>(
        `/murals/${muralId}/widgets/table`,
        body
      );

      const table = data.value.find((w: Widget) => (w as unknown as Record<string, unknown>).type === "table");
      const cells_out = data.value.filter((w: Widget) => (w as unknown as Record<string, unknown>).type === "table cell");
      return text(JSON.stringify({
        summary: `Created table with ${rows.length} rows × ${columns.length} cols (${cells_out.length} cells)`,
        tableId: table ? (table as unknown as Record<string, unknown>).id : null,
        cellCount: cells_out.length,
      }));
    })
  );
}
