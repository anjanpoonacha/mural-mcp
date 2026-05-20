import type {
  Widget, ArrowWidget, StickyNoteWidget, TextWidget, ShapeWidget,
  AreaWidget, ImageWidget, FileWidget, IconWidget, CommentWidget,
  Workspace, Room, Mural
} from "../types";

/**
 * Return all meaningful fields from a Mural widget, typed per widget type.
 * Drops only internal audit fields (createdBy, updatedBy, createdOn, updatedOn,
 * hideEditor, hideOwner, locked, lockedByFacilitator, invisible).
 *
 * IMPORTANT — coordinate systems:
 *   - x/y on all widgets: relative to parentId area, or absolute mural coords if no parent
 *   - points[] on ArrowWidget: ALWAYS absolute mural canvas coordinates, never parent-relative
 */
export function stripWidget(w: Widget): Record<string, unknown> {
  const out: Record<string, unknown> = { id: w.id };

  // Identity & type
  if (w.type !== undefined) out.type = w.type;

  // Position & size (parent-relative or absolute if no parentId)
  if (w.x !== undefined) out.x = w.x;
  if (w.y !== undefined) out.y = w.y;
  if (w.width !== undefined) out.w = w.width;
  if (w.height !== undefined) out.h = w.height;
  if (w.rotation !== undefined && w.rotation !== 0) out.rotation = w.rotation;

  // Layout
  if (w.parentId) out.parentId = w.parentId;
  if (w.stackingOrder !== undefined) out.stackingOrder = w.stackingOrder;
  if (w.presentationIndex !== undefined) out.presentationIndex = w.presentationIndex;
  if (w.hidden !== undefined) out.hidden = w.hidden;
  if (w.instruction) out.instruction = w.instruction;

  switch (w.type) {
    case "arrow": {
      const a = w as ArrowWidget;
      out.arrowType = a.arrowType;
      out.tip = a.tip;
      out.stackable = a.stackable;
      // points are ABSOLUTE canvas coords regardless of parentId
      if (a.points) out.points = a.points;
      if (a.startRefId) out.startRefId = a.startRefId;
      if (a.endRefId) out.endRefId = a.endRefId;
      if (a.title !== undefined) out.title = a.title;
      if (a.style) out.style = a.style;
      if (a.label) out.label = a.label;
      break;
    }

    case "sticky note": {
      const s = w as StickyNoteWidget;
      out.shape = s.shape;
      out.title = s.title;
      if (s.text !== undefined) out.text = s.text;
      if (s.htmlText) out.htmlText = s.htmlText;
      if (s.hyperlink) out.hyperlink = s.hyperlink;
      if (s.hyperlinkTitle) out.hyperlinkTitle = s.hyperlinkTitle;
      if (s.tags?.length) out.tags = s.tags;
      if (s.style) out.style = s.style;
      break;
    }

    case "text": {
      const t = w as TextWidget;
      out.title = t.title;
      out.fixedWidth = t.fixedWidth;
      if (t.text !== undefined) out.text = t.text;
      if (t.hyperlink) out.hyperlink = t.hyperlink;
      if (t.hyperlinkTitle) out.hyperlinkTitle = t.hyperlinkTitle;
      if (t.style) out.style = t.style;
      break;
    }

    case "shape": {
      const s = w as ShapeWidget;
      out.shape = s.shape;
      out.title = s.title;
      if (s.text !== undefined) out.text = s.text;
      if (s.htmlText) out.htmlText = s.htmlText;
      if (s.style) out.style = s.style;
      break;
    }

    case "area": {
      const a = w as AreaWidget;
      out.layout = a.layout;
      out.showTitle = a.showTitle;
      out.title = a.title;
      if (a.style) out.style = a.style;
      break;
    }

    case "image": {
      const i = w as ImageWidget;
      out.border = i.border;
      out.caption = i.caption;
      out.showCaption = i.showCaption;
      out.naturalWidth = i.naturalWidth;
      out.naturalHeight = i.naturalHeight;
      if (i.url) out.url = i.url;
      if (i.thumbnailUrl) out.thumbnailUrl = i.thumbnailUrl;
      if (i.aspectRatio !== undefined) out.aspectRatio = i.aspectRatio;
      if (i.mask) out.mask = i.mask;
      if (i.link) out.link = i.link;
      if (i.description) out.description = i.description;
      break;
    }

    case "file": {
      const f = w as FileWidget;
      out.title = f.title;
      out.scanning = f.scanning;
      if (f.url) out.url = f.url;
      if (f.previewUrl) out.previewUrl = f.previewUrl;
      if (f.link) out.link = f.link;
      break;
    }

    case "icon": {
      const i = w as IconWidget;
      out.name = i.name;
      out.title = i.title;
      if (i.style) out.style = i.style;
      break;
    }

    case "comment": {
      const c = w as CommentWidget;
      out.message = c.message;
      out.title = c.title;
      out.replies = c.replies;
      if (c.referenceWidgetId) out.referenceWidgetId = c.referenceWidgetId;
      if (c.resolvedOn !== undefined) out.resolvedOn = c.resolvedOn;
      break;
    }

    default: {
      // Unknown widget type — pass through any known base fields
      const any = w as Record<string, unknown>;
      if (any["text"] !== undefined) out.text = any["text"];
      if (any["title"] !== undefined) out.title = any["title"];
      if (any["shape"]) out.shape = any["shape"];
      if (any["style"]) out.style = any["style"];
      if (any["points"]) out.points = any["points"];
      if (any["startRefId"]) out.startRefId = any["startRefId"];
      if (any["endRefId"]) out.endRefId = any["endRefId"];
    }
  }

  return out;
}

export function stripWidgets(widgets: Widget[]): Record<string, unknown>[] {
  return widgets.map(stripWidget);
}

/**
 * Batch-create response — returns all widgets when count ≤ 20, otherwise previews first 3.
 */
export function batchResponse(action: string, widgets: Widget[], previewCount = 3): string {
  const ids = widgets.map((w) => w.id);
  const preview = stripWidgets(widgets.length <= 20 ? widgets : widgets.slice(0, previewCount));
  return JSON.stringify({ summary: action, count: widgets.length, ids, preview });
}

/**
 * Single-widget write response.
 */
export function singleResponse(action: string, widget: Widget): string {
  return JSON.stringify({ summary: action, ...stripWidget(widget) });
}

// --- Navigation strippers ---

export function stripWorkspace(w: Workspace): { id: string; name: string } {
  return { id: w.id, name: w.name };
}

export function stripRoom(r: Room): { id: number; name: string; type?: string } {
  return { id: r.id, name: r.name, ...(r.type ? { type: r.type } : {}) };
}

export function stripMural(m: Mural): { id: string; title?: string; roomId?: number } {
  return {
    id: m.id,
    ...(m.title ? { title: m.title } : {}),
    ...(m.roomId !== undefined ? { roomId: m.roomId } : {}),
  };
}
