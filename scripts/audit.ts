#!/usr/bin/env bun
/**
 * audit.ts
 *
 * Compares the Mural public API schema against the MCP tool implementations.
 * Produces a report of:
 *   - Implemented APIs (mapped to MCP tool names)
 *   - Missing APIs (in schema but not in MCP)
 *   - Schema correctness issues (wrong fields, wrong enums, missing required fields)
 *
 * Usage:
 *   bun scripts/audit.ts
 *   bun scripts/audit.ts --json   # output raw JSON
 */

import { readFile } from "fs/promises";
import { existsSync } from "fs";

const SCHEMAS_FILE = "api-schemas/all-schemas.json";

// ── MCP Tool Registry ────────────────────────────────────────────────────────
// Maps each MCP tool name → the API operationId(s) it implements
const MCP_TOOLS: Record<string, string[]> = {
  // Murals
  create_mural:              ["createMural"],
  get_mural:                 ["getMuralById"],
  update_mural:              ["updateMuralById"],
  delete_mural:              ["deleteMuralById"],
  duplicate_mural:           ["duplicateMural"],
  list_murals:               ["getWorkspaceMurals"],
  search_murals:             ["searchMurals"],

  // Rooms
  create_room:               ["createRoom"],
  get_room:                  ["getRoomInfoById"],
  update_room:               ["updateRoomById"],
  list_rooms:                ["getWorkspaceRooms"],
  search_rooms:              ["searchRooms"],
  invite_users_to_room:      ["inviteUsersToRoom"],

  // Templates
  list_templates:            ["getTemplatesByWorkspace", "getDefaultTemplates"],
  get_default_templates:     ["getDefaultTemplates"],
  create_mural_from_template:["createMuralFromTemplate"],
  search_templates:          ["searchTemplates"],

  // Workspaces
  list_workspaces:           ["getWorkspaces"],

  // Users
  get_current_user:          ["getCurrentMember"],
  invite_users_to_mural:     ["inviteUsersToMural"],

  // Tags
  create_mural_tag:          ["createMuralTag"],
  get_mural_tags:            ["getMuralTags"],
  update_mural_tag:          ["updateTagById"],
  delete_mural_tag:          ["deleteTagById"],

  // Widgets - read
  get_widgets:               ["getMuralWidgets"],
  get_widget:                ["getMuralWidget"],

  // Widgets - write
  create_sticky_notes:       ["createStickyNote"],
  update_sticky_note:        ["updateStickyNote"],
  create_text_boxes:         ["createTextbox"],
  update_text_box:           ["updateTextbox"],
  create_shapes:             ["createShapeWidget"],
  update_shape:              ["updateShapeWidget"],
  create_area:               ["createArea"],
  update_area:               ["updateArea"],
  create_arrow:              ["createArrow"],
  update_arrow:              ["updateArrow"],
  connect_widgets:           ["createArrow"],
  connect_widgets_batch:     ["createArrow"],
  create_image:              ["createImage", "createAsset"],
  update_image:              ["updateImage"],
  create_title:              ["createTitle"],
  update_title:              ["updateTitle"],
  create_comment:            ["createComment"],
  update_comment:            ["updateComment"],
  create_table:              ["createTable"],
  delete_widget:             ["deleteWidgetById"],

  // Features
  start_voting_session:      ["startMuralVotingSession"],
  end_voting_session:        ["endMuralVotingSession"],
  get_voting_results:        ["getMuralVotingSessionResults"],
  start_timer:               ["startMuralTimer"],
  stop_timer:                ["stopMuralTimer"],
  get_timer:                 ["getMuralTimer"],
};

// All API operationIds covered by MCP
const coveredOps = new Set(Object.values(MCP_TOOLS).flat());

// ── Schema helpers ────────────────────────────────────────────────────────────

type Schema = Record<string, unknown>;

function getRequestBodySchema(schema: Schema): Schema | null {
  const paths = schema["paths"] as Record<string, Record<string, Schema>>;
  if (!paths) return null;
  for (const methods of Object.values(paths)) {
    for (const op of Object.values(methods)) {
      const rb = (op["requestBody"] as Schema)?.["content"] as Schema;
      if (!rb) continue;
      const jsonContent = rb["application/json"] as Schema;
      if (!jsonContent) continue;
      const schemaRef = jsonContent["schema"] as Schema;
      if (!schemaRef) continue;
      // Resolve $ref
      if (schemaRef["$ref"]) {
        const refName = (schemaRef["$ref"] as string).split("/").pop()!;
        const components = schema["components"] as Schema;
        const resolved = (components?.["schemas"] as Schema)?.[refName] as Schema;
        return resolved ?? null;
      }
      return schemaRef;
    }
  }
  return null;
}

function getOperationId(schema: Schema): string | null {
  const paths = schema["paths"] as Record<string, Record<string, Schema>>;
  if (!paths) return null;
  for (const methods of Object.values(paths)) {
    for (const op of Object.values(methods)) {
      if (op["operationId"]) return op["operationId"] as string;
    }
  }
  return null;
}

function getPath(schema: Schema): { path: string; method: string } | null {
  const paths = schema["paths"] as Record<string, Record<string, Schema>>;
  if (!paths) return null;
  for (const [path, methods] of Object.entries(paths)) {
    for (const method of Object.keys(methods)) {
      return { path, method: method.toUpperCase() };
    }
  }
  return null;
}

function getRequiredFields(bodySchema: Schema): string[] {
  if (bodySchema["type"] === "array") {
    const items = bodySchema["items"] as Schema;
    return (items?.["required"] as string[]) ?? [];
  }
  return (bodySchema["required"] as string[]) ?? [];
}

function getProperties(bodySchema: Schema): Record<string, Schema> {
  if (bodySchema["type"] === "array") {
    const items = bodySchema["items"] as Schema;
    return (items?.["properties"] as Record<string, Schema>) ?? {};
  }
  return (bodySchema["properties"] as Record<string, Schema>) ?? {};
}

// ── MCP source analysis ────────────────────────────────────────────────────────
// Read tool source files and extract zod schema field names per tool

async function getMcpToolFields(): Promise<Record<string, string[]>> {
  const toolFiles = [
    "src/tools/widgets-sticky-notes.ts",
    "src/tools/widgets-text.ts",
    "src/tools/widgets-shapes.ts",
    "src/tools/widgets-areas.ts",
    "src/tools/widgets-images.ts",
    "src/tools/widgets-arrows.ts",
    "src/tools/widgets-table.ts",
    "src/tools/widgets-misc.ts",
    "src/tools/widgets-read.ts",
    "src/tools/mural-manage.ts",
    "src/tools/mural-features.ts",
    "src/tools/navigation.ts",
    "src/tools/templates.ts",
  ];

  const fields: Record<string, string[]> = {};
  // Simple regex extraction — finds tool name and the z.object field names within it
  const toolNameRe = /server\.tool\(\s*"([^"]+)"/g;
  const fieldRe = /^\s{6}(\w+):\s*z\./gm;

  for (const file of toolFiles) {
    if (!existsSync(file)) continue;
    const src = await readFile(file, "utf-8");
    // Split file into tool blocks
    const toolPositions: Array<{ name: string; start: number }> = [];
    let m: RegExpExecArray | null;
    const re = new RegExp(toolNameRe.source, "g");
    while ((m = re.exec(src)) !== null) {
      toolPositions.push({ name: m[1], start: m.index });
    }
    for (let i = 0; i < toolPositions.length; i++) {
      const { name, start } = toolPositions[i];
      const end = i + 1 < toolPositions.length ? toolPositions[i + 1].start : src.length;
      const block = src.slice(start, end);
      const fieldMatches = [...block.matchAll(fieldRe)].map((x) => x[1]);
      fields[name] = fieldMatches.filter((f) => f !== "muralId" && f !== "widgetId");
    }
  }
  return fields;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const asJson = process.argv.includes("--json");

  if (!existsSync(SCHEMAS_FILE)) {
    console.error(`Schema file not found: ${SCHEMAS_FILE}`);
    console.error("Run: bun scripts/fetch-schemas.ts");
    process.exit(1);
  }

  const schemasRaw = JSON.parse(await readFile(SCHEMAS_FILE, "utf-8")) as Record<string, Schema>;
  const mcpFields = await getMcpToolFields();

  // Build operationId → slug + schema index
  const opIndex: Record<string, { slug: string; schema: Schema }> = {};
  for (const [slug, schema] of Object.entries(schemasRaw)) {
    const opId = getOperationId(schema);
    if (opId) opIndex[opId] = { slug, schema };
  }

  // ── 1. Categorise all API operations ─────────────────────────────────────
  type ApiOp = {
    operationId: string;
    slug: string;
    method: string;
    path: string;
    implemented: boolean;
    mcpTool?: string;
  };

  const allOps: ApiOp[] = [];
  for (const [opId, { slug, schema }] of Object.entries(opIndex)) {
    const ep = getPath(schema);
    const mcpTool = Object.entries(MCP_TOOLS).find(([, ops]) => ops.includes(opId))?.[0];
    allOps.push({
      operationId: opId,
      slug,
      method: ep?.method ?? "?",
      path: ep?.path ?? "?",
      implemented: coveredOps.has(opId),
      mcpTool,
    });
  }

  allOps.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  const implemented = allOps.filter((o) => o.implemented);
  const missing = allOps.filter((o) => !o.implemented);

  // ── 2. Schema correctness checks ─────────────────────────────────────────
  type Issue = {
    tool: string;
    operationId: string;
    kind: "missing_required_field" | "extra_field" | "wrong_enum";
    field: string;
    detail: string;
  };

  const issues: Issue[] = [];

  for (const [toolName, opIds] of Object.entries(MCP_TOOLS)) {
    const toolFieldNames = mcpFields[toolName] ?? [];

    for (const opId of opIds) {
      const entry = opIndex[opId];
      if (!entry) continue;
      const bodySchema = getRequestBodySchema(entry.schema);
      if (!bodySchema) continue;

      const required = getRequiredFields(bodySchema);
      const props = getProperties(bodySchema);

      // Fields that are handled internally by the tool (not exposed in zod schema
      // but always sent to the API — e.g. computed values or multi-step flows)
      const internallyHandled: Record<string, string[]> = {
        connect_widgets:       ["width", "height", "points"],  // computed from source/target geometry
        connect_widgets_batch: ["width", "height", "points"],  // computed from source/target geometry
        create_arrow:          ["points"],                      // exposed as top-level param
        create_image:          ["name", "fileExtension"],       // handled in multi-step upload flow
        create_shapes:         ["shape"],                       // has .default("rectangle")
        create_sticky_notes:   ["shape"],                       // has .default("rectangle")
      };

      // Check: required fields in API but missing from MCP tool
      for (const req of required) {
        if (req === "x" || req === "y") continue; // positional — always present
        if (internallyHandled[toolName]?.includes(req)) continue;
        if (!toolFieldNames.includes(req)) {
          issues.push({
            tool: toolName,
            operationId: opId,
            kind: "missing_required_field",
            field: req,
            detail: `API requires '${req}' but MCP tool doesn't expose it`,
          });
        }
      }

      // Fields exposed by MCP that are path params or abstraction params (not in body schema)
      const pathOrAbstractionParams: Record<string, string[]> = {
        connect_widgets:        ["sourceWidgetId", "targetWidgetId", "sourceX", "sourceY",
                                 "sourceWidth", "sourceHeight", "targetX", "targetY",
                                 "targetWidth", "targetHeight"],
        connect_widgets_batch:  ["connections", "style"],
        create_image:           ["url"],               // input URL, converted to asset upload
        create_mural_from_template: ["templateId"],    // path param
        invite_users_to_room:   ["roomId"],            // path param
        update_mural_tag:       ["tagId"],             // path param
        update_room:            ["roomId"],            // path param
      };

      // Check: fields in MCP that don't exist in API schema
      for (const field of toolFieldNames) {
        if (!props[field] && !required.includes(field)) {
          if (pathOrAbstractionParams[toolName]?.includes(field)) continue;
          // Skip common base fields that are valid on all widgets
          const baseFields = ["x", "y", "width", "height", "hidden", "rotation",
            "stackingOrder", "presentationIndex", "parentId", "instruction", "title"];
          if (!baseFields.includes(field)) {
            issues.push({
              tool: toolName,
              operationId: opId,
              kind: "extra_field",
              field,
              detail: `MCP exposes '${field}' but it's not in the API request body schema`,
            });
          }
        }
      }
    }
  }

  // ── 3. Output ──────────────────────────────────────────────────────────────

  if (asJson) {
    console.log(JSON.stringify({ implemented, missing, issues }, null, 2));
    return;
  }

  const w = (s: string, n: number) => s.padEnd(n).slice(0, n);

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║           MURAL MCP — API COVERAGE AUDIT                    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // ── Implemented ──
  console.log(`✅ IMPLEMENTED (${implemented.length}/${allOps.length} operations)\n`);

  // Group by category
  const categories: Record<string, typeof implemented> = {};
  for (const op of implemented) {
    const parts = op.path.split("/").filter(Boolean);
    const cat = parts[1] ?? parts[0] ?? "other"; // e.g. "murals", "rooms", "workspaces"
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(op);
  }

  for (const [cat, ops] of Object.entries(categories).sort()) {
    console.log(`  ${cat.toUpperCase()}`);
    for (const op of ops) {
      console.log(`    ${w(op.method, 6)} ${w(op.path, 52)} → ${op.mcpTool}`);
    }
    console.log();
  }

  // ── Missing ──
  console.log(`\n❌ NOT IMPLEMENTED (${missing.length} operations)\n`);

  // Group by category
  const missingCats: Record<string, typeof missing> = {};
  for (const op of missing) {
    const parts = op.path.split("/").filter(Boolean);
    const cat = parts[1] ?? parts[0] ?? "other";
    if (!missingCats[cat]) missingCats[cat] = [];
    missingCats[cat].push(op);
  }

  // Prioritise by usefulness
  const priority: Record<string, number> = {
    murals: 1, rooms: 2, workspaces: 3, templates: 4, users: 5,
  };

  for (const [cat, ops] of Object.entries(missingCats).sort((a, b) =>
    (priority[a[0]] ?? 99) - (priority[b[0]] ?? 99)
  )) {
    console.log(`  ${cat.toUpperCase()}`);
    for (const op of ops) {
      console.log(`    ${w(op.method, 6)} ${w(op.path, 52)} (${op.operationId})`);
    }
    console.log();
  }

  // ── Schema Issues ──
  if (issues.length > 0) {
    console.log(`\n⚠️  SCHEMA ISSUES (${issues.length})\n`);
    const byTool: Record<string, Issue[]> = {};
    for (const issue of issues) {
      if (!byTool[issue.tool]) byTool[issue.tool] = [];
      byTool[issue.tool].push(issue);
    }
    for (const [tool, toolIssues] of Object.entries(byTool).sort()) {
      console.log(`  ${tool}`);
      for (const issue of toolIssues) {
        const icon = issue.kind === "missing_required_field" ? "  🔴" : "  🟡";
        console.log(`${icon} [${issue.kind}] field='${issue.field}' — ${issue.detail}`);
      }
      console.log();
    }
  } else {
    console.log("\n✅ No schema issues found");
  }

  // ── Summary ──
  const pct = Math.round((implemented.length / allOps.length) * 100);
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`SUMMARY`);
  console.log(`  Total API operations : ${allOps.length}`);
  console.log(`  Implemented          : ${implemented.length} (${pct}%)`);
  console.log(`  Missing              : ${missing.length}`);
  console.log(`  Schema issues        : ${issues.length}`);
  console.log("══════════════════════════════════════════════════════════════");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
