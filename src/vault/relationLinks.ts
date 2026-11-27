import { getFrontMatterInfo, parseYaml, stringifyYaml } from 'obsidian';

export function addRelationLink(markdown: string, relationKey: string, targetTitle: string): string {
	const info = getFrontMatterInfo(markdown);
	const frontmatter: Record<string, unknown> = info.exists ? ((parseYaml(info.frontmatter) as Record<string, unknown>) ?? {}) : {};

	const wikilink = `[[${targetTitle}]]`;
	const existing = frontmatter[relationKey];
	const toText = (value: unknown): string => {
		if (typeof value === 'string') return value;
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
		return JSON.stringify(value);
	};
	const list = Array.isArray(existing) ? existing.map(toText) : existing != null ? [toText(existing)] : [];
	if (!list.includes(wikilink)) list.push(wikilink);
	frontmatter[relationKey] = list;

	const body = info.exists ? markdown.slice(info.contentStart) : markdown;
	return `---\n${stringifyYaml(frontmatter)}---\n${body}`;
}
