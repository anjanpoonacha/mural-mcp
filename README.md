# mural-mcp

MCP server for the [Mural](https://mural.co) visual collaboration platform. Gives AI agents 51 tools to read and edit boards, create widgets, manage rooms, and facilitate sessions.

```bash
npx -y github:anjanpoonacha/mural-mcp
```

---

## Setup

### 1. Register a Mural App

Go to [app.mural.co](https://app.mural.co) → avatar → **"Create and manage apps"** → **"New app"**.  
Set the redirect URL to `http://localhost:3000/callback`. Note your **Client ID** and **Client Secret**.

### 2. Authenticate

```bash
MURAL_CLIENT_ID=your_id MURAL_CLIENT_SECRET=your_secret \
  npx -y github:anjanpoonacha/mural-mcp --auth
```

Opens a browser for OAuth consent. Tokens saved to `~/.mural-mcp/tokens.json` and auto-refreshed.

### 3. Add to your MCP client

**OpenCode** (`~/.config/opencode/opencode.jsonc`):
```json
"mural": {
  "type": "local",
  "command": ["npx", "-y", "github:anjanpoonacha/mural-mcp"],
  "environment": { "MURAL_CLIENT_ID": "...", "MURAL_CLIENT_SECRET": "..." }
}
```

**Claude Desktop / Cursor** (`claude_desktop_config.json` or `~/.cursor/mcp.json`):
```json
"mural": {
  "command": "bunx",
  "args": ["-y", "github:anjanpoonacha/mural-mcp"],
  "env": { "MURAL_CLIENT_ID": "...", "MURAL_CLIENT_SECRET": "..." }
}
```

---

## Tools (51)

### Workspaces & Rooms
| Tool | What it does |
|------|-------------|
| `list_workspaces` | List accessible workspaces |
| `list_rooms` | List rooms in a workspace |
| `create_room` / `get_room` / `update_room` | Manage rooms |
| `invite_users_to_room` | Invite collaborators to a room |

### Murals
| Tool | What it does |
|------|-------------|
| `list_murals` / `search_murals` | Find murals |
| `create_mural` / `get_mural` / `update_mural` / `delete_mural` | Mural CRUD |
| `duplicate_mural` | Copy a mural into a room |
| `create_mural_from_template` | Create from a template |
| `invite_users_to_mural` | Add collaborators |

### Templates
| Tool | What it does |
|------|-------------|
| `list_templates` / `get_default_templates` / `search_templates` | Browse templates |

### Board — Reading
| Tool | What it does |
|------|-------------|
| `get_widgets` | List widgets (filterable by type, paginated). Tables/cells: omit type filter, check `type === "table"` in results |
| `get_widget` | Get a single widget by ID |

### Board — Writing (22 tools)
| Tool | What it does |
|------|-------------|
| `create_sticky_notes` | Batch-create sticky notes (up to 1000) |
| `update_sticky_note` | Update text, position, color, font style |
| `create_text_boxes` | Batch-create text boxes |
| `update_text_box` | Update a text box |
| `create_shapes` | Batch-create shapes (60+ types). Default shape: `rectangle` |
| `update_shape` | Update shape — supports `fontColor`, `borderColor` |
| `create_area` | Create a grouping area |
| `update_area` | Update area layout, title, border |
| `create_image` | Add image from public URL — auto-detects dimensions, max 10MB |
| `update_image` | Update image position, size, caption |
| `create_title` | Batch-create title widgets |
| `update_title` | Update a title widget |
| `create_arrow` | Draw a freeform arrow |
| `update_arrow` | Update arrow type, style, tip |
| `connect_widgets` | Draw a connected arrow between two widgets (auto-computes geometry) |
| `connect_widgets_batch` | Connect up to 100 widget pairs at once |
| `create_comment` | Add a comment to the canvas |
| `update_comment` | Update or resolve a comment |
| `create_table` | Create a native table widget — auto-computes cell geometry from rows/columns |
| `delete_widget` | Delete any widget by ID |

> **Table notes:** Cell `x/y` are relative to the table origin (not the canvas). Only `rowId`, `columnId`, `textContent`, and `style.backgroundColor` are needed per cell — geometry is computed automatically. No update-cell API exists; to change a cell, delete and recreate the table.

### Tags
| Tool | What it does |
|------|-------------|
| `get_mural_tags` / `create_mural_tag` / `update_mural_tag` / `delete_mural_tag` | Manage mural tags |

### Facilitation
| Tool | What it does |
|------|-------------|
| `get_timer` / `start_timer` / `stop_timer` | Canvas countdown timer |
| `start_voting_session` / `end_voting_session` / `get_voting_results` | Dot voting sessions |

### User
| Tool | What it does |
|------|-------------|
| `get_current_user` | Get the authenticated user |

---

## Scripts

```bash
bun scripts/fetch-schemas.ts           # Refresh API schemas from developers.mural.co
bun scripts/fetch-schemas.ts --refresh-html   # Re-download the docs HTML first
bun scripts/audit.ts                   # Audit MCP coverage vs the live API schema
```

---

## Architecture

```
src/
├── index.ts                  # Entry point, stdio transport
├── auth/                     # OAuth2 + PKCE, token store, workspace allowlist
├── client/mural-api.ts       # HTTP client with auto-refresh on 401
├── tools/
│   ├── widgets-shared.ts     # Shared schemas, helpers, arrow geometry
│   ├── widgets-sticky-notes.ts
│   ├── widgets-text.ts       # Text boxes + titles
│   ├── widgets-shapes.ts
│   ├── widgets-areas.ts
│   ├── widgets-images.ts
│   ├── widgets-arrows.ts
│   ├── widgets-table.ts
│   ├── widgets-misc.ts       # Comments + delete
│   ├── widgets-read.ts
│   ├── mural-manage.ts
│   ├── mural-features.ts     # Tags, timer, voting
│   ├── navigation.ts
│   └── templates.ts
└── utils/                    # Response stripping, ID normalisation, error wrapper
```

- **Runtime:** Bun (TypeScript natively, no build step)
- **Transport:** stdio
- **Auth:** OAuth2 + PKCE — tokens at `~/.mural-mcp/tokens.json`, auto-refreshed
- **API:** Mural Public API v1 — `https://app.mural.co/api/public/v1`
- **Coverage:** 51/87 operations (59%) — all core editing and navigation covered

## License

MIT
