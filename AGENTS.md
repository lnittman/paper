# Paper — Development Rules

Purpose-built fork of pi-mono for Paper Desktop MCP integration.

## What changed from pi-mono

1. **piConfig**: `{ name: "paper", configDir: ".paper" }` — drives binary name, config dir, env vars
2. **System prompt**: Rewritten for design-to-code workflows with Paper MCP tool descriptions
3. **Paper MCP tools**: 20 tools in `src/core/tools/paper-mcp.ts`, registered as base tools in agent-session.ts
4. **Version check**: Disabled (no upstream phone-home)
5. **Branding**: `paper` binary, `~/.paper/agent/` config, `PAPER_CODING_AGENT_DIR` env var

## Key files

| File | Purpose |
|------|---------|
| `packages/coding-agent/src/core/tools/paper-mcp.ts` | All 20 Paper MCP tool definitions |
| `packages/coding-agent/src/core/system-prompt.ts` | Paper-focused system prompt |
| `packages/coding-agent/src/core/agent-session.ts` | Paper tools registered in `_buildRuntime` |
| `packages/coding-agent/package.json` | `piConfig` drives all branding |

## Commands

```bash
npm run build          # Build all packages
npm run check          # Lint + typecheck
cd packages/coding-agent && npm link   # Install globally as `paper`
```

## Paper MCP server

Paper Desktop auto-starts an MCP server at `http://127.0.0.1:29979/mcp` when a file is open.
The tools use JSON-RPC `tools/call` to communicate.

## Rules

- All pi-mono AGENTS.md rules apply (no `any`, no inline imports, etc.)
- Paper-specific code goes in existing files (not a separate directory)
- Keep upstream files as close to upstream as possible for easier rebasing
- Never run `npm run dev` or `npm run build` from repo root during testing
