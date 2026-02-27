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
	const examplesPath = getExamplesPath();

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

You also have access to Paper MCP tools (when Paper Desktop is running on http://127.0.0.1:29979/mcp):

Paper MCP — Read tools:
- paper_get_basic_info: File name, page name, node count, artboard list with dimensions
- paper_get_selection: Details about currently selected nodes (IDs, names, types, size, artboard)
- paper_get_node_info: Node details by ID (size, visibility, lock, parent, children, text)
- paper_get_children: Direct children of a node (IDs, names, types, child counts)
- paper_get_tree_summary: Compact text summary of a node's subtree (optional depth limit)
- paper_get_screenshot: Screenshot of a node by ID (base64 image; 1x or 2x scale)
- paper_get_jsx: JSX for a node and descendants (Tailwind or inline-styles format)
- paper_get_computed_styles: Computed CSS styles for one or more nodes (batch)
- paper_get_fill_image: Image data from a node with an image fill (base64 JPEG)
- paper_get_font_family_info: Font family availability (local or Google Fonts); weights and styles
- paper_get_guide: Guided workflows for topics (e.g., figma-import)
- paper_find_placement: Suggested x/y for a new artboard without overlap

Paper MCP — Write tools:
- paper_create_artboard: Create a new artboard with optional name and styles
- paper_write_html: Parse HTML and add/replace nodes (insert-children or replace mode)
- paper_set_text_content: Set text content of Text nodes (batch)
- paper_rename_nodes: Rename layers (batch)
- paper_duplicate_nodes: Deep-clone nodes; returns new IDs and descendant ID map
- paper_update_styles: Update CSS styles on nodes
- paper_delete_nodes: Delete nodes and all descendants
- paper_start_working_on_nodes: Mark artboards as being worked on (show indicator)
- paper_finish_working_on_nodes: Clear the working indicator

Guidelines:
${guidelines}

Design-to-code workflow:
1. Use paper_get_selection to see what the user has selected in Paper Desktop
2. Use paper_get_jsx to get the JSX/Tailwind representation of the design
3. Use paper_get_screenshot to visually verify what you're looking at
4. Use paper_get_computed_styles for precise CSS values (spacing, colors, typography)
5. Use paper_get_tree_summary to understand the node hierarchy before diving in
6. Implement the design in code, matching structure and styles precisely
7. Use paper_start_working_on_nodes / paper_finish_working_on_nodes to show progress

Code-to-design workflow:
1. Read the codebase to understand the current implementation
2. Use paper_create_artboard to set up a canvas
3. Use paper_write_html to create design representations from code
4. Use paper_update_styles to refine the visual output

Key principles:
- Paper designs are web-native (DOM-based) — JSX output maps directly to React/HTML
- Always prefer paper_get_jsx with Tailwind format when working with Tailwind projects
- Use paper_get_screenshot to ground your understanding visually before implementing
- When the user says "build this" with a selection in Paper, that IS the spec
- Structure matters: flex layouts and containers in Paper translate directly to code

Paper documentation (read only when asked about Paper itself):
- Main documentation: ${readmePath}
- Additional docs: ${docsPath}
- Examples: ${examplesPath} (extensions, custom tools, SDK)`;

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
