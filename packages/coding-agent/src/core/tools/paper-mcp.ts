/**
 * Paper MCP client — talks to Paper Desktop's local MCP server.
 *
 * Paper Desktop runs a Streamable HTTP MCP server at http://127.0.0.1:29979/mcp.
 * This module wraps all 20 Paper tools as first-class agent tools.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type, type TSchema } from "@sinclair/typebox";

const PAPER_MCP_URL = "http://127.0.0.1:29979/mcp";
const TIMEOUT_MS = 30_000;

// ── JSON-RPC helper ─────────────────────────────────────────────────────────

interface JsonRpcResponse {
	jsonrpc: "2.0";
	id: number;
	result?: unknown;
	error?: { code: number; message: string };
}

let requestId = 1;

async function callPaperMcp(
	toolName: string,
	args: Record<string, unknown>,
	signal?: AbortSignal,
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
	const id = requestId++;
	const body = JSON.stringify({
		jsonrpc: "2.0",
		method: "tools/call",
		params: { name: toolName, arguments: args },
		id,
	});

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

		// Chain external signal
		if (signal) {
			signal.addEventListener("abort", () => controller.abort(), { once: true });
		}

		const resp = await fetch(PAPER_MCP_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
			body,
			signal: controller.signal,
		});

		clearTimeout(timeout);

		if (!resp.ok) {
			return { ok: false, error: `Paper MCP returned ${resp.status} ${resp.statusText}` };
		}

		// The server may return SSE format (event: message\ndata: {...}) or raw JSON
		const text = await resp.text();
		let json: JsonRpcResponse;
		const dataMatch = text.match(/^data: (.+)$/m);
		if (dataMatch) {
			json = JSON.parse(dataMatch[1]) as JsonRpcResponse;
		} else {
			json = JSON.parse(text) as JsonRpcResponse;
		}
		if (json.error) {
			return { ok: false, error: `Paper MCP error: ${json.error.message}` };
		}

		return { ok: true, result: json.result };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
			return {
				ok: false,
				error: "Paper Desktop is not running. Open a file in Paper Desktop to start the MCP server (http://127.0.0.1:29979/mcp).",
			};
		}
		return { ok: false, error: `Paper MCP connection error: ${message}` };
	}
}

// ── Result formatting ───────────────────────────────────────────────────────

function formatMcpResult(result: unknown): Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> {
	if (!result || typeof result !== "object") {
		return [{ type: "text", text: JSON.stringify(result, null, 2) }];
	}

	const r = result as Record<string, unknown>;
	const content = r.content;
	if (!Array.isArray(content)) {
		return [{ type: "text", text: JSON.stringify(result, null, 2) }];
	}

	const parts: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [];

	for (const item of content) {
		if (typeof item !== "object" || item === null) continue;
		const entry = item as Record<string, unknown>;

		if (entry.type === "text" && typeof entry.text === "string") {
			parts.push({ type: "text", text: entry.text });
		} else if (entry.type === "image" && typeof entry.data === "string") {
			parts.push({
				type: "image",
				data: entry.data,
				mimeType: (typeof entry.mimeType === "string" ? entry.mimeType : "image/png"),
			});
		}
	}

	if (parts.length === 0) {
		return [{ type: "text", text: JSON.stringify(result, null, 2) }];
	}

	return parts;
}

// ── Tool factory ────────────────────────────────────────────────────────────

interface PaperToolDef {
	/** Tool name exposed to the LLM (paper_*) */
	name: string;
	/** Human-readable label */
	label: string;
	/** Description for the LLM */
	description: string;
	/** MCP tool name (what Paper Desktop expects) */
	mcpName: string;
	/** TypeBox parameter schema */
	parameters: TSchema;
	/** Optional: remap LLM-facing param names to MCP server param names */
	mapArgs?: (args: Record<string, unknown>) => Record<string, unknown>;
}

function createPaperTool(def: PaperToolDef): AgentTool {
	return {
		name: def.name,
		label: def.label,
		description: def.description,
		parameters: def.parameters,
		async execute(
			toolCallId: string,
			params: unknown,
			signal?: AbortSignal,
		): Promise<AgentToolResult<Record<string, unknown>>> {
			let args = (params && typeof params === "object" ? params : {}) as Record<string, unknown>;
			if (def.mapArgs) {
				args = def.mapArgs(args);
			}
			const result = await callPaperMcp(def.mcpName, args, signal);
			if (!result.ok) {
				return {
					content: [{ type: "text" as const, text: result.error }],
					details: { error: result.error },
				};
			}
			return {
				content: formatMcpResult(result.result),
				details: { mcpTool: def.mcpName },
			};
		},
	};
}

// ── Tool definitions ────────────────────────────────────────────────────────

export const paperTools: AgentTool[] = [
	// ── Read tools ──────────────────────────────────────────────────────────

	createPaperTool({
		name: "paper_get_basic_info",
		label: "Paper: Get Basic Info",
		description: "Get file name, page name, node count, and list of artboards with dimensions from the currently open Paper file.",
		mcpName: "get_basic_info",
		parameters: Type.Object({}),
	}),

	createPaperTool({
		name: "paper_get_selection",
		label: "Paper: Get Selection",
		description: "Get details about the currently selected nodes in Paper Desktop (IDs, names, types, size, artboard). Use this to see what the user is pointing at.",
		mcpName: "get_selection",
		parameters: Type.Object({}),
	}),

	createPaperTool({
		name: "paper_get_node_info",
		label: "Paper: Get Node Info",
		description: "Get details for a specific node by ID: size, visibility, lock state, parent, children, text content.",
		mcpName: "get_node_info",
		parameters: Type.Object({
			id: Type.String({ description: "Node ID to inspect" }),
		}),
		mapArgs: (a) => ({ nodeId: a.id }),
	}),

	createPaperTool({
		name: "paper_get_children",
		label: "Paper: Get Children",
		description: "Get direct children of a node: IDs, names, types, and child counts.",
		mcpName: "get_children",
		parameters: Type.Object({
			id: Type.String({ description: "Parent node ID" }),
		}),
		mapArgs: (a) => ({ nodeId: a.id }),
	}),

	createPaperTool({
		name: "paper_get_tree_summary",
		label: "Paper: Get Tree Summary",
		description: "Get a compact text summary of a node's subtree hierarchy. Use optional depth to limit how deep to go.",
		mcpName: "get_tree_summary",
		parameters: Type.Object({
			id: Type.String({ description: "Root node ID" }),
			depth: Type.Optional(Type.Number({ description: "Max depth to traverse" })),
		}),
		mapArgs: (a) => ({ nodeId: a.id, ...(a.depth !== undefined ? { depth: a.depth } : {}) }),
	}),

	createPaperTool({
		name: "paper_get_screenshot",
		label: "Paper: Get Screenshot",
		description: "Get a screenshot of a node by ID as a base64 image. Use scale 1 or 2 for resolution. Essential for visually verifying designs.",
		mcpName: "get_screenshot",
		parameters: Type.Object({
			id: Type.String({ description: "Node ID to screenshot" }),
			scale: Type.Optional(Type.Number({ description: "Scale: 1 (default) or 2 for 2x resolution" })),
		}),
		mapArgs: (a) => ({ nodeId: a.id, ...(a.scale !== undefined ? { scale: a.scale } : {}) }),
	}),

	createPaperTool({
		name: "paper_get_jsx",
		label: "Paper: Get JSX",
		description: "Get JSX representation of a node and its descendants. Choose 'tailwind' or 'inline' styles format. This is the primary tool for translating designs to code.",
		mcpName: "get_jsx",
		parameters: Type.Object({
			id: Type.String({ description: "Node ID" }),
			styleFormat: Type.Optional(Type.String({ description: "'tailwind' or 'inline' (default: tailwind)" })),
		}),
		mapArgs: (a) => ({ nodeId: a.id, ...(a.styleFormat !== undefined ? { format: a.styleFormat } : {}) }),
	}),

	createPaperTool({
		name: "paper_get_computed_styles",
		label: "Paper: Get Computed Styles",
		description: "Get computed CSS styles for one or more nodes. Returns exact values for spacing, colors, typography, etc.",
		mcpName: "get_computed_styles",
		parameters: Type.Object({
			ids: Type.Array(Type.String(), { description: "Array of node IDs" }),
		}),
		mapArgs: (a) => ({ nodeIds: a.ids }),
	}),

	createPaperTool({
		name: "paper_get_fill_image",
		label: "Paper: Get Fill Image",
		description: "Get image data from a node that has an image fill (returns base64 JPEG).",
		mcpName: "get_fill_image",
		parameters: Type.Object({
			id: Type.String({ description: "Node ID with image fill" }),
		}),
		mapArgs: (a) => ({ nodeId: a.id }),
	}),

	createPaperTool({
		name: "paper_get_font_family_info",
		label: "Paper: Get Font Info",
		description: "Look up whether a font family is available on the user's machine or Google Fonts. Inspect weights and styles.",
		mcpName: "get_font_family_info",
		parameters: Type.Object({
			family: Type.String({ description: "Font family name to look up" }),
		}),
		mapArgs: (a) => ({ familyNames: [a.family] }),
	}),

	createPaperTool({
		name: "paper_get_guide",
		label: "Paper: Get Guide",
		description: "Retrieve guided workflow documentation for a topic (e.g., 'figma-import' for Figma import steps).",
		mcpName: "get_guide",
		parameters: Type.Object({
			topic: Type.String({ description: "Guide topic name" }),
		}),
	}),

	createPaperTool({
		name: "paper_find_placement",
		label: "Paper: Find Placement",
		description: "Get suggested x/y coordinates on the canvas to place a new artboard without overlapping existing ones.",
		mcpName: "find_placement",
		parameters: Type.Object({
			width: Type.Optional(Type.Number({ description: "Artboard width" })),
			height: Type.Optional(Type.Number({ description: "Artboard height" })),
		}),
	}),

	// ── Write tools ─────────────────────────────────────────────────────────

	createPaperTool({
		name: "paper_create_artboard",
		label: "Paper: Create Artboard",
		description: "Create a new artboard in the Paper file. Optionally specify name, width, height, and other styles.",
		mcpName: "create_artboard",
		parameters: Type.Object({
			name: Type.Optional(Type.String({ description: "Artboard name" })),
			styles: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "CSS styles (width, height, etc.)" })),
		}),
	}),

	createPaperTool({
		name: "paper_write_html",
		label: "Paper: Write HTML",
		description: "Parse HTML and add or replace nodes in the Paper file. Use mode 'insert-children' to add inside a node, or 'replace' to replace a node's content.",
		mcpName: "write_html",
		parameters: Type.Object({
			id: Type.String({ description: "Target node ID" }),
			html: Type.String({ description: "HTML string to write" }),
			mode: Type.Optional(Type.String({ description: "'insert-children' or 'replace'" })),
		}),
		mapArgs: (a) => ({ targetNodeId: a.id, html: a.html, ...(a.mode !== undefined ? { mode: a.mode } : {}) }),
	}),

	createPaperTool({
		name: "paper_set_text_content",
		label: "Paper: Set Text",
		description: "Set the text content of one or more Text nodes (batch operation).",
		mcpName: "set_text_content",
		parameters: Type.Object({
			updates: Type.Array(Type.Object({
				id: Type.String({ description: "Text node ID" }),
				text: Type.String({ description: "New text content" }),
			}), { description: "Array of { id, text } updates" }),
		}),
		mapArgs: (a) => ({
			updates: (a.updates as Array<{ id: string; text: string }>).map((u) => ({
				nodeId: u.id,
				textContent: u.text,
			})),
		}),
	}),

	createPaperTool({
		name: "paper_rename_nodes",
		label: "Paper: Rename Nodes",
		description: "Rename one or more layers in the Paper file (batch operation).",
		mcpName: "rename_nodes",
		parameters: Type.Object({
			updates: Type.Array(Type.Object({
				id: Type.String({ description: "Node ID" }),
				name: Type.String({ description: "New layer name" }),
			}), { description: "Array of { id, name } updates" }),
		}),
		mapArgs: (a) => ({
			updates: (a.updates as Array<{ id: string; name: string }>).map((u) => ({
				nodeId: u.id,
				name: u.name,
			})),
		}),
	}),

	createPaperTool({
		name: "paper_duplicate_nodes",
		label: "Paper: Duplicate Nodes",
		description: "Deep-clone one or more nodes. Returns new IDs and a descendant ID mapping.",
		mcpName: "duplicate_nodes",
		parameters: Type.Object({
			ids: Type.Array(Type.String(), { description: "Array of node IDs to duplicate" }),
		}),
		mapArgs: (a) => ({
			nodes: (a.ids as string[]).map((id) => ({ id })),
		}),
	}),

	createPaperTool({
		name: "paper_update_styles",
		label: "Paper: Update Styles",
		description: "Update CSS styles on one or more nodes in the Paper file.",
		mcpName: "update_styles",
		parameters: Type.Object({
			updates: Type.Array(Type.Object({
				id: Type.String({ description: "Node ID" }),
				styles: Type.Record(Type.String(), Type.Unknown(), { description: "CSS styles to apply" }),
			}), { description: "Array of { id, styles } updates" }),
		}),
		mapArgs: (a) => ({
			updates: (a.updates as Array<{ id: string; styles: Record<string, unknown> }>).map((u) => ({
				nodeIds: [u.id],
				styles: u.styles,
			})),
		}),
	}),

	createPaperTool({
		name: "paper_delete_nodes",
		label: "Paper: Delete Nodes",
		description: "Delete one or more nodes and all their descendants from the Paper file.",
		mcpName: "delete_nodes",
		parameters: Type.Object({
			ids: Type.Array(Type.String(), { description: "Array of node IDs to delete" }),
		}),
		mapArgs: (a) => ({ nodeIds: a.ids }),
	}),

	createPaperTool({
		name: "paper_start_working_on_nodes",
		label: "Paper: Start Working",
		description: "Mark artboards as being worked on (shows a visual indicator in Paper Desktop). Call this before modifying artboards.",
		mcpName: "start_working_on_nodes",
		parameters: Type.Object({
			ids: Type.Array(Type.String(), { description: "Array of artboard IDs to mark" }),
		}),
		mapArgs: (a) => ({ nodeIds: a.ids }),
	}),

	createPaperTool({
		name: "paper_finish_working_on_nodes",
		label: "Paper: Finish Working",
		description: "Clear the working indicator from artboards. Call this after you're done modifying artboards.",
		mcpName: "finish_working_on_nodes",
		parameters: Type.Object({
			ids: Type.Array(Type.String(), { description: "Array of artboard IDs to unmark" }),
		}),
		mapArgs: (a) => (a.ids ? { nodeIds: a.ids } : {}),
	}),
];

/** Map of paper tool names for quick lookup */
export const paperToolNames = new Set(paperTools.map((t) => t.name));

/** Check if Paper Desktop MCP server is reachable */
export async function isPaperRunning(): Promise<boolean> {
	try {
		const resp = await fetch(PAPER_MCP_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 0 }),
			signal: AbortSignal.timeout(3000),
		});
		return resp.ok;
	} catch {
		return false;
	}
}
