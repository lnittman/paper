# Contributing to Paper

Thanks for wanting to contribute! Paper is a purpose-built fork of [pi-mono](https://github.com/badlogic/pi-mono) for [Paper Desktop](https://paper.design).

## The One Rule

**You must understand your code.** If you can't explain what your changes do and how they interact with the rest of the system, your PR will be closed.

## Before Submitting a PR

```bash
npm run build  # must succeed
npm run check  # must pass with no errors
```

## Paper-specific areas

The main Paper-specific code lives in `packages/coding-agent`:

- `src/core/tools/paper-mcp.ts` — Paper MCP tool definitions
- `src/core/system-prompt.ts` — Paper-focused system prompt
- `src/core/agent-session.ts` — Paper tool registration
- `src/modes/interactive/interactive-mode.ts` — Paper branding + status bar
- `src/modes/interactive/theme/` — Paper color themes

## Questions?

Open an issue.
