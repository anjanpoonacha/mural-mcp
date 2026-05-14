# @anjanpoonacha/mural-mcp

MCP server for the [Mural](https://mural.co) visual collaboration platform. Run it instantly with `bunx`:

```bash
npx -y github:anjanpoonacha/mural-mcp
```

## Features

**51 tools** across 7 modules:

### Navigation & Discovery
| Tool | Description |
|------|-------------|
| `list_workspaces` | List accessible workspaces |
| `list_rooms` | List rooms in a workspace (paginated) |
| `list_murals` | List murals in a room or workspace (paginated) |
| `get_mural` | Get mural metadata |
| `get_current_user` | Get the authenticated user |
| `search_murals` | Search murals by query string |
| `search_rooms` | Search rooms by query string |
| `search_templates` | Search templates by query string |

### Mural Management
| Tool | Description |
|------|-------------|
| `create_mural` | Create a new mural |
| `update_mural` | Update title, background, dimensions, status, favorite |
| `delete_mural` | Delete a mural |
| `duplicate_mural` | Duplicate a mural into a room |
| `create_mural_from_template` | Create a mural from a template |

### Rooms
| Tool | Description |
|------|-------------|
| `create_room` | Create a room |
| `get_room` | Get room details |
| `update_room` | Update room name/description/type |

### Templates
| Tool | Description |
|------|-------------|
| `list_templates` | List workspace templates |
| `get_default_templates` | List Mural's built-in templates |

### Board Editing — Write (22 tools)
| Tool | Description |
|------|-------------|
| `create_sticky_notes` | Batch-create sticky notes (1–1000) |
| `update_sticky_note` | Update text, position, color, style (bold, italic, fontSize, textAlign…) |
| `create_text_boxes` | Batch-create text boxes |
| `update_text_box` | Update a text box |
| `create_shapes` | Batch-create shapes (60+ types, with fontColor support) |
| `update_shape` | Update a shape (including fontColor, borderColor) |
| `create_area` | Create a grouping area |
| `update_area` | Update an area |
| `create_image` | Add image from public URL (auto-detects dimensions) |
| `update_image` | Update image position, size, caption |
| `create_arrow` | Draw a freeform arrow |
| `update_arrow` | Update an arrow (type, style, tip) |
| `connect_widgets` | Draw a connected arrow between two widgets |
| `connect_widgets_batch` | Connect multiple widget pairs (up to 100) |
| `create_title` | Batch-create title widgets |
| `update_title` | Update a title widget |
| `create_comment` | Create a comment on the canvas |
| `update_comment` | Update/resolve a comment |
| `delete_widget` | Delete any widget by ID |

### Board Reading
| Tool | Description |
|------|-------------|
| `get_widgets` | List widgets (paginated, filterable by type/parentId) |
| `get_widget` | Get a single widget |

### Tags
| Tool | Description |
|------|-------------|
| `get_mural_tags` | List all tags in a mural |
| `create_mural_tag` | Create a tag |
| `update_mural_tag` | Update a tag |
| `delete_mural_tag` | Delete a tag |

### Facilitation
| Tool | Description |
|------|-------------|
| `get_timer` | Get the mural timer state |
| `start_timer` | Start a countdown timer |
| `stop_timer` | Stop the timer |
| `start_voting_session` | Start a voting session |
| `end_voting_session` | End the active voting session |
| `get_voting_results` | Get voting results for a session |

### Members
| Tool | Description |
|------|-------------|
| `invite_users_to_mural` | Invite users to a mural |
| `invite_users_to_room` | Invite users to a room |

---

## Setup

### 1. Register a Mural App

1. Go to [app.mural.co](https://app.mural.co) → your avatar → **"Create and manage apps"**
2. Click **"New app"** and set the redirect URL to `http://localhost:3000/callback`
3. Note your **Client ID** and **Client Secret**

### 2. Authenticate

```bash
MURAL_CLIENT_ID=your_client_id \
MURAL_CLIENT_SECRET=your_client_secret \
npx -y github:anjanpoonacha/mural-mcp --auth
```

This opens your browser for OAuth consent. Tokens are saved to `~/.mural-mcp/tokens.json` and auto-refresh at runtime.

### 3. Configure your MCP client

#### OpenCode (`~/.config/opencode/opencode.jsonc`)
```json
{
  "mcp": {
    "mural": {
      "type": "local",
      "command": ["npx", "-y", "github:anjanpoonacha/mural-mcp"],
      "enabled": true,
      "environment": {
        "MURAL_CLIENT_ID": "your_client_id",
        "MURAL_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

#### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "mural": {
      "command": "bunx",
      "args": ["-y", "github:anjanpoonacha/mural-mcp"],
      "env": {
        "MURAL_CLIENT_ID": "your_client_id",
        "MURAL_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

#### Cursor (`~/.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "mural": {
      "command": "bunx",
      "args": ["-y", "github:anjanpoonacha/mural-mcp"],
      "env": {
        "MURAL_CLIENT_ID": "your_client_id",
        "MURAL_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

---

## Architecture

```
src/
├── index.ts                    # Entry point, stdio transport
├── auth/
│   ├── oauth.ts                # OAuth2 + PKCE flow, auto token refresh
│   ├── token-store.ts          # Token persistence (~/.mural-mcp/tokens.json)
│   └── workspace-guard.ts      # Workspace allowlist (MURAL_ALLOWED_WORKSPACES)
├── client/
│   └── mural-api.ts            # HTTP client, auto-retry on 401
├── tools/
│   ├── navigation.ts           # Workspace, room, search, user tools
│   ├── widgets-read.ts         # get_widgets, get_widget
│   ├── widgets-write.ts        # All widget create/update/delete tools
│   ├── mural-manage.ts         # Mural CRUD, duplicate
│   ├── mural-features.ts       # Tags, timer, voting
│   └── templates.ts            # Template tools
└── utils/
    ├── strip.ts                # Token-efficient response stripping
    ├── normalize.ts            # Mural ID normalization (URL or dotted format)
    └── tool-wrapper.ts         # withTool error wrapper
```

- **Transport:** stdio
- **Runtime:** Bun (TypeScript natively, no build step)
- **Auth:** OAuth2 + PKCE, tokens stored at `~/.mural-mcp/tokens.json`, auto-refresh on expiry and 401
- **API:** Mural Public API v1 (`https://app.mural.co/api/public/v1`)

## License

MIT
