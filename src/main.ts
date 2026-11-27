import { App, Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	VaultToVoiceSettings,
	VaultToVoiceSettingTab,
} from './settings';
import { DraftView, VIEW_TYPE_DRAFT } from './ui/DraftView';

interface AppWithPlugins extends App {
	plugins: {
		plugins: Record<string, unknown>;
	};
}

const COMPANION_PLUGINS = [
	{ id: 'dataview', name: 'Dataview' },
	{ id: 'wikilink-types', name: 'Wikilink Types' },
	{ id: 'graph-link-types', name: 'Graph Link Types' },
];

export default class VaultToVoice extends Plugin {
	settings!: VaultToVoiceSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_DRAFT, (leaf) => new DraftView(leaf, this));

		this.addRibbonIcon('mic', 'Abrir borrador de dictado', () => {
			void this.activateDraftView();
		});

		this.addCommand({
			id: 'open-draft-view',
			name: 'Abrir borrador de dictado',
			callback: () => {
				void this.activateDraftView();
			},
		});

		this.addSettingTab(new VaultToVoiceSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => this.checkCompanionPlugins());
	}

	onunload() {}

	private checkCompanionPlugins() {
		const installedPlugins = (this.app as AppWithPlugins).plugins?.plugins ?? {};
		const missing = COMPANION_PLUGINS.filter((plugin) => !installedPlugins[plugin.id]).map((plugin) => plugin.name);

		if (missing.length > 0) {
			new Notice(
				`VaultByVoice: para ver los tipos de relación en el grafo, instala y activa estos plugins de la comunidad: ${missing.join(', ')}.`,
				10000,
			);
		}
	}

	async activateDraftView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_DRAFT)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: VIEW_TYPE_DRAFT, active: true });
		}

		if (leaf) await workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<VaultToVoiceSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
