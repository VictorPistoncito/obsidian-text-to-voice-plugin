import { App, TFile } from 'obsidian';

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|#^[\]]/g;

function deriveTitle(markdown: string): string {
	const body = markdown.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
	const headingMatch = /^#{1,6}\s+(.+)$/m.exec(body);
	const source = headingMatch ? headingMatch[1]! : body;
	const words = source.trim().split(/\s+/).slice(0, 8).join(' ');
	const title = words.replace(INVALID_FILENAME_CHARS, '').trim();
	return title || 'Nota sin título';
}

export async function saveNoteToVault(app: App, markdown: string): Promise<TFile> {
	const title = deriveTitle(markdown);

	let path = `${title}.md`;
	let counter = 2;
	while (app.vault.getAbstractFileByPath(path)) {
		path = `${title} ${counter}.md`;
		counter++;
	}

	return app.vault.create(path, markdown);
}
