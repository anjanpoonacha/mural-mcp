import { z } from "zod";

// --- Constants ---

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

// Server-side shape validation — keeps schema small, avoids runtime enum mismatches
export const VALID_SHAPES = new Set([
  "circle", "diamond", "hexagon", "pentagon", "square", "triangle",
  "document_shape", "event_shape", "loop_limit", "off_page_reference",
  "off_page_reference_incoming", "arrow_down", "arrow_left_right",
  "arrow_left", "arrow_right", "arrow_top", "badge", "brace_left",
  "brace_right", "chonk_unicorn", "cloud", "connector", "cross", "data",
  "database", "decision", "delay", "direct_data", "display", "document",
  "ellipse", "end", "hexagon_smart", "internal_storage", "manual_input",
  "manual_loop", "merge", "multiple_documents", "note_left", "note_right",
  "octagon", "off_page_connector", "or", "papertape", "pentagon_smart",
  "porongo", "predefined_process", "preparation", "process", "rectangle",
  "rhombus_smart", "ribbon", "right_triangle", "rounded_square",
  "simple_ribbon", "speech_bubble_center", "speech_bubble_left",
  "speech_bubble_right", "star", "start", "step", "stored_data",
  "summing_junction", "teardrop_bubble", "terminator",
  "thinking_bubble_left", "thinking_bubble_right", "trapezoid",
  "triangle_smart",
]);

// --- Shared schemas ---

export const positionSchema = {
  x: z.number().describe("Horizontal position in px from left of mural"),
  y: z.number().describe("Vertical position in px from top of mural"),
};

export const colorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6,8}$/)
  .optional()
  .describe("Color hex, e.g. #FF0000FF");

export const fontSchema = z
  .enum(["adelle", "blambot-casual", "blambot-pro", "lint-mccree", "marker-felt", "museo-slab", "proxima-nova", "shark-water"])
  .optional();

// --- Response helpers ---

export function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}

export function textErr(t: string) {
  return { content: [{ type: "text" as const, text: t }], isError: true };
}

// --- Geometry helpers ---

export type Rect = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };

/**
 * Compute arrow geometry between two widgets.
 *
 * CRITICAL: Mural's points[] are RELATIVE to the widget bounding box (x,y).
 * - The bounding box x/y = absolute canvas position of the arrow's top-left corner
 * - points[0] = arrowhead, points[1] = tail (confirmed from manual arrow inspection)
 * - point coords are offsets from (x, y): so {x:0,y:0} = top-left of bbox
 */
export function computeArrowGeometry(src: Rect, tgt: Rect): {
  x: number; y: number; width: number; height: number;
  points: Pt[];
} {
  const srcCenterX = src.x + src.w / 2;
  const srcCenterY = src.y + src.h / 2;
  const tgtCenterX = tgt.x + tgt.w / 2;
  const tgtCenterY = tgt.y + tgt.h / 2;

  const dy = tgtCenterY - srcCenterY;
  const dx = tgtCenterX - srcCenterX;

  let tailAbs: Pt;
  let headAbs: Pt;

  if (Math.abs(dy) >= Math.abs(dx)) {
    if (dy > 0) {
      tailAbs = { x: srcCenterX, y: src.y + src.h };
      headAbs = { x: tgtCenterX, y: tgt.y };
    } else {
      tailAbs = { x: srcCenterX, y: src.y };
      headAbs = { x: tgtCenterX, y: tgt.y + tgt.h };
    }
  } else {
    if (dx > 0) {
      tailAbs = { x: src.x + src.w, y: srcCenterY };
      headAbs = { x: tgt.x, y: tgtCenterY };
    } else {
      tailAbs = { x: src.x, y: srcCenterY };
      headAbs = { x: tgt.x + tgt.w, y: tgtCenterY };
    }
  }

  const bboxX = Math.min(tailAbs.x, headAbs.x);
  const bboxY = Math.min(tailAbs.y, headAbs.y);
  const bboxW = Math.max(1, Math.abs(headAbs.x - tailAbs.x));
  const bboxH = Math.max(1, Math.abs(headAbs.y - tailAbs.y));

  const headRel: Pt = { x: headAbs.x - bboxX, y: headAbs.y - bboxY };
  const tailRel: Pt = { x: tailAbs.x - bboxX, y: tailAbs.y - bboxY };

  return { x: bboxX, y: bboxY, width: bboxW, height: bboxH, points: [headRel, tailRel] };
}

/**
 * Merge caller style with textAlign default for widgets that accept textAlign
 * in their request body (textbox, sticky note, title). Do NOT use for shapes or areas.
 */
export function withTextStyleDefaults(style?: Record<string, unknown>): Record<string, unknown> {
  return { textAlign: "left", ...style };
}

/** Strip undefined values from a style object, no defaults injected. */
export function cleanStyle(style?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!style) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(style)) {
    if (v !== undefined) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
