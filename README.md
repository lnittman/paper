# Paper

Design-to-code agent CLI. A purpose-built fork of [pi](https://github.com/badlogic/pi-mono) for [Paper Desktop](https://paper.design).

Paper connects directly to Paper Desktop's local MCP server, giving your AI agent full read/write access to your design files — alongside standard coding tools (read, bash, edit, write).

## Install

```bash
git clone https://github.com/lnittman/paper-mono.git
cd paper-mono
npm run setup
```

This installs dependencies, builds all packages, and links the `paper` binary globally. After setup, run `paper` from any directory.

> **Requires:** Node.js ≥ 20

## Usage

```bash
# Interactive mode — opens TUI
paper

# With an initial prompt
paper "Build this component using React and Tailwind"

# Non-interactive (process and exit)
paper -p "List all .ts files in src/"

# Use a specific model
paper --model anthropic/claude-sonnet-4-20250514

# Cycle models with Ctrl+P
paper --models claude-sonnet,gpt-4o,gemini-2.5-pro
```

Run `paper --help` for all options.

## Requirements

- **Paper Desktop** — download from [paper.design](https://paper.design) and open a file (starts the MCP server automatically at `http://127.0.0.1:29979/mcp`)
- **API key** — set at least one: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, or any [provider supported by pi](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md)

Paper will show a connection status indicator in the footer bar — it works without Paper Desktop running (as a regular coding agent) and picks up the connection when you open a file.

## Paper tools

When Paper Desktop is running, 20 design tools are available to the agent:

### Read — inspect your designs
| Tool | Description |
|------|-------------|
| `paper_get_basic_info` | File overview, artboard list |
| `paper_get_selection` | What's currently selected |
| `paper_get_screenshot` | Visual capture of any node |
| `paper_get_jsx` | JSX output (Tailwind or inline styles) |
| `paper_get_computed_styles` | Exact CSS values |
| `paper_get_tree_summary` | Node hierarchy |
| `paper_get_node_info` | Node details by ID |
| `paper_get_children` | Direct children of a node |
| `paper_get_fill_image` | Extract images from fills |
| `paper_get_font_family_info` | Font availability |
| `paper_get_guide` | Guided workflows |
| `paper_find_placement` | Find space for new artboards |

### Write — modify your designs
| Tool | Description |
|------|-------------|
| `paper_create_artboard` | New artboards |
| `paper_write_html` | Inject HTML into designs |
| `paper_set_text_content` | Update text nodes |
| `paper_update_styles` | Change CSS styles |
| `paper_rename_nodes` | Rename layers |
| `paper_duplicate_nodes` | Clone nodes |
| `paper_delete_nodes` | Remove nodes |
| `paper_finish_working_on_nodes` | Clear working indicators |

## Workflows

### Design → Code
1. Open your design in Paper Desktop
2. Select the frame you want to build
3. Run `paper` in your project directory
4. Ask: *"Build this using React and Tailwind"*

### Code → Design
1. Run `paper` in your project directory
2. Ask: *"Create artboards in Paper showing the current state of my app's pages"*

### Site recreation
Use the built-in `/site` command:
```
/site https://example.com
```
The agent will screenshot the site, analyze the layout, and recreate it as Paper artboards.

## Config

Paper uses `~/.paper/agent/` for config, sessions, and extensions. Same structure as pi but independent — your pi and paper configs don't interfere.

## Development

```bash
npm install          # install all workspace deps
npm run build        # build all packages
npm run dev          # watch mode (all packages)
npm run check        # lint + typecheck
npm test             # run tests
```

### Project structure

```
paper-mono/
├── packages/
│   ├── coding-agent/    ← the paper CLI (this is the main package)
│   ├── agent/           ← agent core (upstream pi-agent-core)
│   ├── ai/              ← AI providers (upstream pi-ai)
│   ├── tui/             ← terminal UI (upstream pi-tui)
│   ├── mom/             ← multi-agent orchestrator
│   ├── web-ui/          ← web UI components
│   └── pods/            ← pod runner
└── package.json         ← workspace root
```

### What changed from pi-mono

1. **Paper MCP tools** — 20 tools in [`packages/coding-agent/src/core/tools/paper-mcp.ts`](packages/coding-agent/src/core/tools/paper-mcp.ts)
2. **System prompt** — rewritten for design-to-code workflows
3. **Branding** — `paper` binary, `~/.paper/` config, Paper theme
4. **Status bar** — live Paper Desktop connection indicator
5. **`/site` command** — structured website-to-design workflow
6. **Version check** — disabled (no upstream phone-home)

## Based on

[pi-mono](https://github.com/badlogic/pi-mono) by Mario Zechner — MIT licensed.

## License

MIT
