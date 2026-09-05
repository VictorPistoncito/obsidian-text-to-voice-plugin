import { App, PluginSettingTab, Setting } from 'obsidian';
import VaultToVoice from './main';

export interface VaultToVoiceSettings {
	groqApiKey: string;
	groqModel: string;
	geminiApiKey: string;
	geminiModel: string;
	openrouterApiKey: string;
	openrouterModel: string;
	huggingfaceApiKey: string;
}

export const DEFAULT_SETTINGS: VaultToVoiceSettings = {
	groqApiKey: '',
	groqModel: 'openai/gpt-oss-20b',
	geminiApiKey: '',
	geminiModel: 'gemini-3.8-flash',
	openrouterApiKey: '',
	openrouterModel: '',
	huggingfaceApiKey: '',
};

export class VaultToVoiceSettingTab extends PluginSettingTab {
	plugin: VaultToVoice;

	constructor(app: App, plugin: VaultToVoice) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('p', {
			text: 'La transcripción por voz y la edición por voz usan una cadena de proveedores gratuitos: se prueban en orden, y si uno agota su cuota se pasa al siguiente. Groq y Gemini se reutilizan para ambas tareas.',
		});

		new Setting(containerEl)
			.setName('Groq API key')
			.setDesc('console.groq.com — transcripción (whisper-large-v3-turbo) y edición (Llama).')
			.addText((text) => {
				text.inputEl.type = 'password';
				text
					.setPlaceholder('gsk_...')
					.setValue(this.plugin.settings.groqApiKey)
					.onChange(async (value) => {
						this.plugin.settings.groqApiKey = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Modelo de Groq (edición)')
			.addText((text) =>
				text.setValue(this.plugin.settings.groqModel).onChange(async (value) => {
					this.plugin.settings.groqModel = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Hugging Face API key')
			.setDesc('huggingface.co/settings/tokens — segundo proveedor de transcripción (whisper-large-v3).')
			.addText((text) => {
				text.inputEl.type = 'password';
				text
					.setPlaceholder('hf_...')
					.setValue(this.plugin.settings.huggingfaceApiKey)
					.onChange(async (value) => {
						this.plugin.settings.huggingfaceApiKey = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Google Gemini API key')
			.setDesc('aistudio.google.com/apikey — respaldo de transcripción (audio nativo) y de edición.')
			.addText((text) => {
				text.inputEl.type = 'password';
				text
					.setPlaceholder('AIza...')
					.setValue(this.plugin.settings.geminiApiKey)
					.onChange(async (value) => {
						this.plugin.settings.geminiApiKey = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Modelo de Gemini')
			.addText((text) =>
				text.setValue(this.plugin.settings.geminiModel).onChange(async (value) => {
					this.plugin.settings.geminiModel = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('OpenRouter API key')
			.setDesc('openrouter.ai/keys — último respaldo de edición.')
			.addText((text) => {
				text.inputEl.type = 'password';
				text
					.setPlaceholder('sk-or-...')
					.setValue(this.plugin.settings.openrouterApiKey)
					.onChange(async (value) => {
						this.plugin.settings.openrouterApiKey = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Modelo de OpenRouter')
			.setDesc('Comprueba el listado de modelos gratuitos (sufijo ":free") en openrouter.ai/models.')
			.addText((text) =>
				text
					.setPlaceholder('proveedor/modelo:free')
					.setValue(this.plugin.settings.openrouterModel)
					.onChange(async (value) => {
						this.plugin.settings.openrouterModel = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
