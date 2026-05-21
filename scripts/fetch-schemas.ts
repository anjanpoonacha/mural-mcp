#!/usr/bin/env bun
/**
 * fetch-schemas.ts
 *
 * Discovers all Mural API endpoint slugs, then fetches the full OpenAPI JSON
 * schema for each one via the .md suffix trick on developers.mural.co.
 *
 * Slug discovery strategy (in order of preference):
 *   1. --refresh-html flag  → re-downloads the docs HTML via playwright (if installed)
 *      or falls back to a headless fetch with cookies
 *   2. Default             → parses the local mural-api.html snapshot (already contains
 *      all sidebar links since it was captured from a real browser session)
 *
 * Usage:
 *   bun scripts/fetch-schemas.ts                  # use saved HTML snapshot
 *   bun scripts/fetch-schemas.ts --refresh-html   # re-download HTML first
 *   bun scripts/fetch-schemas.ts --out custom.json
 */

import { mkdir, writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

const BASE_DOCS = "https://developers.mural.co";
const OUTPUT_DIR = "api-schemas";
const DEFAULT_OUT = join(OUTPUT_DIR, "all-schemas.json");
// Local HTML snapshot — captured from a real browser session, contains all sidebar links
const HTML_SNAPSHOT = "mural-api.html";

// Docs index pages whose sidebar links cover all endpoints
const DOCS_INDEX_PAGES = [
  "/public/reference/mural-contents",
  "/public/reference/users",
  "/public/reference/rooms",
  "/public/reference/templates",
  "/public/reference/workspaces",
  "/public/reference/search",
];

// Section index slugs that are nav pages, not endpoints with schemas
const NAV_SLUGS = new Set([
  "murals", "mural-contents", "users", "rooms", "templates",
  "workspaces", "search", "muralaccessinfo",
]);

const CONCURRENCY = 8;
const DELAY_MS = 60;

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// ── HTML download ────────────────────────────────────────────────────────────

/**
 * Download a docs page using playwright-chromium for full JS rendering.
 * Falls back to curl with a browser User-Agent if playwright isn't available.
 */
async function downloadHtml(pages: string[]): Promise<string> {
  // Try playwright first (full JS rendering)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pw = await import("playwright" as any);
    console.log("  Using playwright for full JS rendering...");
    const browser = await pw.chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const parts: string[] = [];
    for (const path of pages) {
      const page = await ctx.newPage();
      await page.goto(`${BASE_DOCS}${path}`, { waitUntil: "networkidle" });
      parts.push(await page.content());
      await page.close();
      console.log(`  ✓ ${path.split("/").pop()}`);
    }
    await browser.close();
    return parts.join("\n");
  } catch {
    // playwright not available — use curl with browser UA
    console.log("  playwright not found, using curl...");
  }

  const parts: string[] = [];
  for (const path of pages) {
    const result = spawnSync("curl", [
      "-sL",
      "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "--max-time", "20",
      `${BASE_DOCS}${path}`,
    ], { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });

    if (result.error || result.status !== 0) {
      console.warn(`  ✗ ${path}: curl failed`);
    } else {
      parts.push(result.stdout);
      console.log(`  ✓ ${path.split("/").pop()}`);
    }
  }
  return parts.join("\n");
}

// ── Slug extraction ──────────────────────────────────────────────────────────

function extractSlugs(html: string): string[] {
  const pattern = /href="(\/public\/reference\/[a-z0-9_-]+)"/gi;
  const slugs = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    slugs.add(m[1].split("/").pop()!);
  }
  return [...slugs].filter((s) => !NAV_SLUGS.has(s)).sort();
}

// ── Schema fetch ─────────────────────────────────────────────────────────────

async function fetchSchema(slug: string): Promise<{ slug: string; schema: unknown } | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${BASE_DOCS}/public/reference/${slug}.md`, {
        headers: { "User-Agent": "mural-mcp-schema-fetcher/1.0" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) return null;
      const text = await res.text();
      const match = text.match(/```json\n(\{[\s\S]*?\})\n```/);
      if (!match) return null;
      return { slug, schema: JSON.parse(match[1]) };
    } catch {
      if (attempt === 0) await sleep(300);
    }
  }
  return null;
}

// ── Concurrency pool ─────────────────────────────────────────────────────────

async function pool<T>(items: string[], fn: (s: string) => Promise<T>, concurrency: number, delay: number): Promise<T[]> {
  const results: T[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
      if (delay) await sleep(delay);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const outFile = args[args.indexOf("--out") + 1] || DEFAULT_OUT;
  const refreshHtml = args.includes("--refresh-html");

  if (!existsSync(OUTPUT_DIR)) await mkdir(OUTPUT_DIR, { recursive: true });

  console.log("=== Mural API Schema Fetcher ===\n");

  // ── Step 1: Get HTML containing all sidebar links ──────────────────────────
  let html: string;

  if (refreshHtml) {
    console.log("Step 1: Downloading fresh docs HTML...");
    html = await downloadHtml(DOCS_INDEX_PAGES);
    // Save it as the new snapshot
    await writeFile(HTML_SNAPSHOT, html);
    console.log(`  Saved → ${HTML_SNAPSHOT}\n`);
  } else {
    if (!existsSync(HTML_SNAPSHOT)) {
      console.error(`No local HTML snapshot found at '${HTML_SNAPSHOT}'.`);
      console.error("Run with --refresh-html to download it, or place the docs page HTML at that path.");
      process.exit(1);
    }
    html = await readFile(HTML_SNAPSHOT, "utf-8");
    console.log(`Step 1: Using local HTML snapshot (${HTML_SNAPSHOT})\n`);
  }

  // ── Step 2: Extract slugs ──────────────────────────────────────────────────
  const slugs = extractSlugs(html);
  console.log(`  Found ${slugs.length} endpoint slugs\n`);

  if (slugs.length === 0) {
    console.error("No slugs found. Try --refresh-html to re-download the docs.");
    process.exit(1);
  }

  // ── Step 3: Fetch all OpenAPI schemas in parallel ──────────────────────────
  console.log("Step 2: Fetching OpenAPI schemas...");
  const results = await pool(slugs, async (slug) => {
    const r = await fetchSchema(slug);
    process.stdout.write(r ? `  ✓ ${slug}\n` : `  ✗ ${slug}\n`);
    return r;
  }, CONCURRENCY, DELAY_MS);

  // ── Step 4: Save ───────────────────────────────────────────────────────────
  const schemas: Record<string, unknown> = {};
  let ok = 0, fail = 0;
  for (const r of results) {
    if (r?.schema) { schemas[r.slug] = r.schema; ok++; } else fail++;
  }

  await writeFile(outFile, JSON.stringify(schemas, null, 2));

  console.log(`\n=== Done ===`);
  console.log(`  Fetched : ${ok}`);
  console.log(`  Failed  : ${fail}`);
  console.log(`  Output  : ${outFile}`);
  console.log(`  Size    : ${(JSON.stringify(schemas).length / 1024).toFixed(0)} KB`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
