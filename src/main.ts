import { Plugin, WorkspaceLeaf } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	VaultToVoiceSettings,
	VaultToVoiceSettingTab,
} from './settings';
import { DraftView, VIEW_TYPE_DRAFT } from './ui/DraftView';

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
	}

	onunload() {}

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
