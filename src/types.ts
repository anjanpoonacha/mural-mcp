// ============================================================
// Mural API — Complete TypeScript types derived from OpenAPI spec
// Source: GET /murals/{muralId}/widgets/{widgetId} ?reduce=false
// ============================================================

// --- Supporting types ---

export interface WidgetMemberInfo {
  id: string;
  firstName: string;
  lastName: string;
}

export interface WidgetVisitorInfo {
  id: string;
  alias: string;
}

export type WidgetActor = WidgetMemberInfo | WidgetVisitorInfo;

export interface WidgetPoint {
  x: number;
  y: number;
}

export interface ArrowLabelEntry {
  x: number;       // Horizontal position of label on connector in px
  y: number;       // Vertical position of label on connector in px
  height: number;
  width: number;
  text: string;
}

export interface ArrowLabel {
  format: {
    color: string;
    fontFamily: string;
    bold: boolean;
    italic: boolean;
    textAlign: "left" | "center" | "right";
    fontSize: number;
  };
  labels: ArrowLabelEntry[];
}

export interface ImageMask {
  top: number;     // Vertical offset of crop mask from upper-left of image
  left: number;    // Horizontal offset of crop mask from upper-left of image
  height: number;  // Height of crop mask
  width: number;   // Width of crop mask
}

// --- Base widget ---

export interface BaseWidget {
  // Required
  id: string;
  width: number;
  x: number;               // Distance from left of parent area, or left of mural if no parent
  y: number;               // Distance from top of parent area, or top of mural if no parent
  rotation: number;
  stackingOrder: number;
  hidden: boolean;
  hideEditor: boolean;
  hideOwner: boolean;
  locked: boolean;
  lockedByFacilitator: boolean;
  createdOn: number;
  createdBy: WidgetActor;

  // Optional
  height?: number;
  invisible?: boolean;
  parentId?: string;
  presentationIndex?: number;
  instruction?: string;
  updatedOn?: number;
  updatedBy?: WidgetActor;
  contentEditedOn?: number;
  contentEditedBy?: WidgetActor;

  [key: string]: unknown;
}

// --- Arrow ---

export interface ArrowStyle {
  strokeColor: string;
  strokeStyle: "solid" | "dashed" | "dotted-spaced" | "dotted";
  strokeWidth: number;
}

export interface ArrowWidget extends BaseWidget {
  type: "arrow";
  arrowType: "straight" | "curved" | "orthogonal";
  tip: "no tip" | "single" | "double";
  stackable: boolean;
  points: WidgetPoint[];   // Absolute mural canvas coordinates (NOT parent-relative)
  title: string;
  startRefId?: string;
  endRefId?: string;
  style?: ArrowStyle;
  label?: ArrowLabel;
}

// --- Sticky Note ---

export interface StickyNoteStyle {
  backgroundColor: string;
  bold: boolean;
  border: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  font: string;
  fontSize: number;
  textAlign: "left" | "center" | "right";
}

export interface StickyNoteWidget extends BaseWidget {
  type: "sticky note";
  shape: "circle" | "rectangle";
  title: string;
  text?: string;
  htmlText?: string;
  minLines?: number;
  hyperlink?: string;
  hyperlinkTitle?: string;
  tags?: string[];
  style?: StickyNoteStyle;
}

// --- Text (textbox / title) ---

export interface TextStyle {
  backgroundColor?: string;
  font?: string;
  fontSize?: number;
  textAlign?: "left" | "center" | "right";
}

export interface TextWidget extends BaseWidget {
  type: "text";
  title: string;
  fixedWidth: boolean;   // true = textbox (wraps), false = title (grows)
  text?: string;
  hyperlink?: string;
  hyperlinkTitle?: string;
  style?: TextStyle;
}

// --- Shape ---

export type ShapeType =
  | "circle" | "diamond" | "hexagon" | "pentagon" | "square" | "triangle"
  | "document_shape" | "event_shape" | "loop_limit" | "off_page_reference"
  | "off_page_reference_incoming" | "arrow_down" | "arrow_left_right"
  | "arrow_left" | "arrow_right" | "arrow_top" | "badge" | "brace_left"
  | "brace_right" | "chonk_unicorn" | "cloud" | "connector" | "cross"
  | "data" | "database" | "decision" | "delay" | "direct_data" | "display"
  | "document" | "ellipse" | "end" | "hexagon_smart" | "internal_storage"
  | "manual_input" | "manual_loop" | "merge" | "multiple_documents"
  | "note_left" | "note_right" | "octagon" | "off_page_connector" | "or"
  | "papertape" | "pentagon_smart" | "porongo" | "predefined_process"
  | "preparation" | "process" | "rectangle" | "rhombus_smart" | "ribbon"
  | "right_triangle" | "rounded_square" | "simple_ribbon"
  | "speech_bubble_center" | "speech_bubble_left" | "speech_bubble_right"
  | "star" | "start" | "step" | "stored_data" | "summing_junction"
  | "teardrop_bubble" | "terminator" | "thinking_bubble_left"
  | "thinking_bubble_right" | "trapezoid" | "triangle_smart";

export interface ShapeStyle {
  backgroundColor: string;
  bold: boolean;
  borderColor: string;
  borderWidth: number;     // 1–7
  borderStyle: "solid" | "dotted";
  font: string;
  fontColor: string;
  fontSize: number;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  textAlign: "left" | "center" | "right";
}

export interface ShapeWidget extends BaseWidget {
  type: "shape";
  shape: ShapeType;
  text: string;
  title: string;
  htmlText?: string;
  style?: ShapeStyle;
}

// --- Area ---

export interface AreaStyle {
  backgroundColor: string;
  borderColor: string;
  borderStyle: "solid" | "dashed" | "dotted-spaced" | "dotted";
  borderWidth: number;
  titleFontSize: number;
}

export interface AreaWidget extends BaseWidget {
  type: "area";
  layout: "free" | "column" | "row";
  showTitle: boolean;
  title: string;
  style?: AreaStyle;
}

// --- Image ---

export interface ImageWidget extends BaseWidget {
  type: "image";
  border: boolean;
  caption: string;
  description: string;
  expiresInMinutes: number | null;
  naturalHeight: number;   // Uncropped image height
  naturalWidth: number;    // Uncropped image width
  showCaption: boolean;
  thumbnailUrl: string;
  url: string | null;      // null when download restriction is enabled
  aspectRatio?: number;
  link?: string | null;
  mask?: ImageMask;
}

// --- File ---

export interface FileWidget extends BaseWidget {
  type: "file";
  scanning: boolean;
  title: string;
  url: string | null;
  expiresInMinutes?: number | null;
  link?: string;
  previewUrl?: string;
}

// --- Icon ---

export interface IconWidget extends BaseWidget {
  type: "icon";
  name: string;
  title: string;
  style?: {
    color: string;
  };
}

// --- Comment ---

export interface CommentReply {
  created: number;
  message: string;
  user: WidgetActor;
}

export interface CommentWidget extends BaseWidget {
  type: "comment";
  message: string;
  replies: CommentReply[];
  title: string;
  timestamp?: number;
  referenceWidgetId?: string;
  resolvedBy?: WidgetActor;
  resolvedOn?: number;
}

// --- Table (not in Widget oneOf but exists in schema) ---

export interface TableWidget extends BaseWidget {
  type: "table";
  autoResize: boolean;
  columns: Array<{ columnId: string; width: number }>;
  rows: Array<{ rowId: string; height: number; minHeight?: number }>;
  style: {
    borderColor: string;
    borderWidth: number;
  };
  title?: string;
}

export interface TableCellTextContent {
  fontFamily: string;
  fontSize: number;
  text: string;
  textAlign: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
}

export interface TableCellWidget extends BaseWidget {
  type: "table cell";
  columnId: string;
  rowId: string;
  colSpan?: number;
  rowSpan?: number;
  style?: {
    backgroundColor?: string;
  };
  textContent?: TableCellTextContent | null;
}

// --- Union type ---

export type Widget =
  | AreaWidget
  | ArrowWidget
  | CommentWidget
  | FileWidget
  | IconWidget
  | ImageWidget
  | ShapeWidget
  | StickyNoteWidget
  | TextWidget
  | TableWidget
  | TableCellWidget
  | BaseWidget; // fallback for unknown types

// --- Workspace / Room / Mural ---

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  locked?: boolean;
  suspended?: boolean;
  companyId?: string;
  createdOn?: number;
}

export interface Room {
  id: number;
  name: string;
  description?: string;
  type: "open" | "private";
  workspaceId: string;
  createdOn?: number;
  updatedOn?: number;
}

export interface Mural {
  id: string;
  title?: string;
  backgroundColor?: string;
  height?: number;
  width?: number;
  roomId?: number;
  workspaceId?: string;
  createdOn?: number;
  updatedOn?: number;
  infinite?: boolean;
}

// --- API response wrappers ---

export interface PaginatedResponse<T> {
  value: T[];
  next?: string;
}

export interface ListResponse<T> {
  value: T[];
  next?: string;
}

export interface SingleResponse<T> {
  value: T;
}
