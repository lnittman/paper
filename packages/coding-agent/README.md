# Paper

Design-to-code agent CLI powered by [Paper Desktop](https://paper.design) MCP.

Paper is a purpose-built fork of [pi](https://github.com/badlogic/pi-mono) that bridges the gap between design and code. It connects directly to Paper Desktop's local MCP server, giving your AI agent full read/write access to your design files.

## Install

```bash
# From source (this repo)
cd packages/coding-agent && npm link

# Then run from any project directory
paper
```

## Requirements

- **Paper Desktop** — download from [paper.design](https://paper.design) and open a file (starts the MCP server automatically)
- **API key** — set `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, or any provider supported by pi

## How it works

Paper Desktop runs a local MCP server at `http://127.0.0.1:29979/mcp` when you have a file open. The `paper` CLI connects to it and exposes 20 Paper tools alongside standard coding tools (read, bash, edit, write).

### Paper tools

**Read** — inspect your designs:
- `paper_get_basic_info` — file overview, artboard list
- `paper_get_selection` — what's currently selected
- `paper_get_screenshot` — visual capture of any node
- `paper_get_jsx` — JSX output (Tailwind or inline styles)
- `paper_get_computed_styles` — exact CSS values
- `paper_get_tree_summary` — node hierarchy
- `paper_get_node_info`, `paper_get_children` — node details
- `paper_get_fill_image` — extract images
- `paper_get_font_family_info` — font availability
- `paper_get_guide` — guided workflows
- `paper_find_placement` — find space for new artboards

**Write** — modify your designs:
- `paper_create_artboard` — new artboards
- `paper_write_html` — inject HTML into designs
- `paper_set_text_content` — update text nodes
- `paper_update_styles` — change CSS styles
- `paper_rename_nodes` — rename layers
- `paper_duplicate_nodes` — clone nodes
- `paper_delete_nodes` — remove nodes
- `paper_start_working_on_nodes` / `paper_finish_working_on_nodes` — progress indicators

## Workflows

### Design → Code
1. Open your design in Paper Desktop
2. Select the frame you want to build
3. Run `paper` in your project directory
4. Ask: *"Build this using React and Tailwind"*

### Code → Design
1. Run `paper` in your project directory
2. Ask: *"Create artboards in Paper showing the current state of my app's pages"*

### Design system sync
1. Open both Figma MCP and Paper MCP
2. Ask: *"Sync my Figma design tokens into Paper"*

## Config

Paper uses `~/.paper/agent/` for config, sessions, and extensions. Same structure as pi but independent.

## Based on

[pi-mono](https://github.com/badlogic/pi-mono) by Mario Zechner — MIT licensed.
