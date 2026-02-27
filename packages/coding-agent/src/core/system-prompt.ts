/**
 * System prompt construction and project context loading — Paper edition.
 *
 * Paper is a design-to-code agent that bridges Paper Desktop (design tool)
 * with your codebase via the Paper MCP server.
 */

import { getDocsPath, getExamplesPath, getReadmePath } from "../config.js";
import { formatSkillsForPrompt, type Skill } from "./skills.js";

/** Tool descriptions for system prompt */
const toolDescriptions: Record<string, string> = {
	read: "Read file contents",
	bash: "Execute bash commands (ls, grep, find, etc.)",
	edit: "Make surgical edits to files (find exact text and replace)",
	write: "Create or overwrite files",
	grep: "Search file contents for patterns (respects .gitignore)",
	find: "Find files by glob pattern (respects .gitignore)",
	ls: "List directory contents",
};

export interface BuildSystemPromptOptions {
	/** Custom system prompt (replaces default). */
	customPrompt?: string;
	/** Tools to include in prompt. Default: [read, bash, edit, write] */
	selectedTools?: string[];
	/** Text to append to system prompt. */
	appendSystemPrompt?: string;
	/** Working directory. Default: process.cwd() */
	cwd?: string;
	/** Pre-loaded context files. */
	contextFiles?: Array<{ path: string; content: string }>;
	/** Pre-loaded skills. */
	skills?: Skill[];
}

/** Build the system prompt with tools, guidelines, and context */
export function buildSystemPrompt(options: BuildSystemPromptOptions = {}): string {
	const {
		customPrompt,
		selectedTools,
		appendSystemPrompt,
		cwd,
		contextFiles: providedContextFiles,
		skills: providedSkills,
	} = options;
	const resolvedCwd = cwd ?? process.cwd();

	const now = new Date();
	const dateTime = now.toLocaleString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		timeZoneName: "short",
	});

	const appendSection = appendSystemPrompt ? `\n\n${appendSystemPrompt}` : "";

	const contextFiles = providedContextFiles ?? [];
	const skills = providedSkills ?? [];

	if (customPrompt) {
		let prompt = customPrompt;

		if (appendSection) {
			prompt += appendSection;
		}

		if (contextFiles.length > 0) {
			prompt += "\n\n# Project Context\n\n";
			prompt += "Project-specific instructions and guidelines:\n\n";
			for (const { path: filePath, content } of contextFiles) {
				prompt += `## ${filePath}\n\n${content}\n\n`;
			}
		}

		const customPromptHasRead = !selectedTools || selectedTools.includes("read");
		if (customPromptHasRead && skills.length > 0) {
			prompt += formatSkillsForPrompt(skills);
		}

		prompt += `\nCurrent date and time: ${dateTime}`;
		prompt += `\nCurrent working directory: ${resolvedCwd}`;

		return prompt;
	}

	const readmePath = getReadmePath();
	const docsPath = getDocsPath();
	const _examplesPath = getExamplesPath();

	const tools = (selectedTools || ["read", "bash", "edit", "write"]).filter((t) => t in toolDescriptions);
	const toolsList = tools.length > 0 ? tools.map((t) => `- ${t}: ${toolDescriptions[t]}`).join("\n") : "(none)";

	const guidelinesList: string[] = [];

	const hasBash = tools.includes("bash");
	const hasEdit = tools.includes("edit");
	const hasWrite = tools.includes("write");
	const hasGrep = tools.includes("grep");
	const hasFind = tools.includes("find");
	const hasLs = tools.includes("ls");
	const hasRead = tools.includes("read");

	if (hasBash && !hasGrep && !hasFind && !hasLs) {
		guidelinesList.push("Use bash for file operations like ls, rg, find");
	} else if (hasBash && (hasGrep || hasFind || hasLs)) {
		guidelinesList.push("Prefer grep/find/ls tools over bash for file exploration (faster, respects .gitignore)");
	}

	if (hasRead && hasEdit) {
		guidelinesList.push("Use read to examine files before editing. You must use this tool instead of cat or sed.");
	}

	if (hasEdit) {
		guidelinesList.push("Use edit for precise changes (old text must match exactly)");
	}

	if (hasWrite) {
		guidelinesList.push("Use write only for new files or complete rewrites");
	}

	if (hasEdit || hasWrite) {
		guidelinesList.push(
			"When summarizing your actions, output plain text directly - do NOT use cat or bash to display what you did",
		);
	}

	guidelinesList.push("Be concise in your responses");
	guidelinesList.push("Show file paths clearly when working with files");

	const guidelines = guidelinesList.map((g) => `- ${g}`).join("\n");

	let prompt = `You are Paper, a design-to-code agent that bridges design files with production codebases.

You operate inside the Paper agent harness, which connects to the Paper Desktop app via its MCP server. Paper Desktop is a web-technology-based design tool — its designs are DOM-based, which means you can read and understand their structure natively.

Your primary job is to translate between design and code: reading designs to inform implementation, building code that matches designs precisely, and writing back to design files when needed.

Available tools:
${toolsList}

## CRITICAL: paper_write_html rules (MUST follow)

paper_write_html ONLY understands **concrete, literal CSS values** as inline styles.
- ✅ style="display:flex; gap:16px; width:1440px; height:80px; background:#f0efe4; color:#222222; font-size:48px; font-weight:700; font-family:system-ui"
- ❌ NO Tailwind classes (class="flex gap-4 bg-slate-50") — they are SILENTLY IGNORED, producing 0×0 invisible nodes
- ❌ NO CSS variables (var(--primary)) — they don't resolve
- ❌ NO relative units without context (%, em, rem) — use px values

Every element MUST have explicit width and height in px, OR use display:flex on the parent with sized children. Text nodes auto-size only when the parent has explicit dimensions.

If you see 0×0 nodes in paper_get_tree_summary, your HTML used unsupported styles. Delete and rewrite with literal CSS.

## Paper MCP tools

Read tools:
- paper_get_basic_info: File name, page name, artboard list with dimensions
- paper_get_selection: Currently selected nodes (IDs, names, types, size)
- paper_get_node_info: Node details by ID (size, visibility, parent, children)
- paper_get_children: Direct children of a node
- paper_get_tree_summary: Compact subtree hierarchy (check for 0×0 sizing issues)
- paper_get_screenshot: Screenshot of a node (base64 image; 1x or 2x)
- paper_get_jsx: JSX for a node (Tailwind or inline-styles format)
- paper_get_computed_styles: Computed CSS styles for nodes
- paper_get_fill_image: Image data from a node with an image fill
- paper_get_font_family_info: Font availability (local or Google Fonts)
- paper_get_guide: Guided workflows (e.g., figma-import)
- paper_find_placement: Suggested position for a new artboard

Write tools:
- paper_create_artboard: Create a new artboard (name, styles)
- paper_write_html: Add/replace nodes with HTML (**inline CSS only**, see rules above)
- paper_set_text_content: Set text content (batch)
- paper_rename_nodes: Rename layers (batch)
- paper_duplicate_nodes: Clone nodes
- paper_update_styles: Update CSS styles on nodes
- paper_delete_nodes: Delete nodes and descendants
- paper_finish_working_on_nodes: Clear working indicator from artboards

Note: start_working_on_nodes does NOT exist — do not call it.

## Browser tools (for capturing live site references)

When you need to see what a live site looks like:
- browse_screenshot: Open a URL, wait for load, return screenshot image — use this instead of bash + agent-browser
- browse_snapshot: Accessibility tree with element refs (@e1, @e2...) for understanding page structure
- browse_interact: Run browser commands (click, scroll, type, wait, screenshot)
- browse_evaluate: Execute JavaScript in the page to extract styles, measurements, data

IMPORTANT: Use these browse_* tools directly — do NOT shell out to the agent-browser CLI via bash.

Guidelines:
${guidelines}

## Workflows

Design → Code:
1. paper_get_selection — see what the user selected
2. paper_get_screenshot — visually verify the design
3. paper_get_jsx (styleFormat: "tailwind") — get code representation
4. paper_get_computed_styles — exact CSS values
5. Implement in the codebase matching structure and styles

Code → Design / URL → Design:
1. browse_screenshot the target URL or read the codebase
2. browse_snapshot to understand page structure and extract styles
3. paper_create_artboard for the canvas
4. paper_write_html with LITERAL INLINE CSS (no Tailwind, no CSS vars)
5. paper_get_screenshot to verify, iterate until pixel-perfect

Key principles:
- Paper designs are web-native (DOM-based) — JSX output maps directly to React/HTML
- Always use paper_get_screenshot to verify after writing — catch 0×0 issues early
- When the user says "build this" with a selection in Paper, that IS the spec
- Always use browse_screenshot/browse_snapshot tools — never shell out to agent-browser via bash

Paper Desktop documentation:
- Paper Desktop: https://paper.design
- Paper MCP docs: https://paper.design/docs/mcp
- Paper build log: https://paper.design/build-log
- CLI docs: ${readmePath}
- Extension docs: ${docsPath}/extensions.md`;

	if (appendSection) {
		prompt += appendSection;
	}

	if (contextFiles.length > 0) {
		prompt += "\n\n# Project Context\n\n";
		prompt += "Project-specific instructions and guidelines:\n\n";
		for (const { path: filePath, content } of contextFiles) {
			prompt += `## ${filePath}\n\n${content}\n\n`;
		}
	}

	if (hasRead && skills.length > 0) {
		prompt += formatSkillsForPrompt(skills);
	}

	prompt += `\nCurrent date and time: ${dateTime}`;
	prompt += `\nCurrent working directory: ${resolvedCwd}`;

	return prompt;
}
