import { ItemView, MarkdownRenderer, WorkspaceLeaf, setIcon } from 'obsidian';
import VaultToVoice from '../main';
import { VoiceRecorder } from '../audio/recorder';
import { transcribeAudio } from '../audio/transcriber';
import { applyVoiceEdit } from '../llm/editInterpreter';

export const VIEW_TYPE_DRAFT = 'voice-draft-view';

export class DraftView extends ItemView {
	private dictateRecorder = new VoiceRecorder();
	private editRecorder = new VoiceRecorder();
	private markdown = '';

	private dictateButtonEl!: HTMLButtonElement;
	private editButtonEl!: HTMLButtonElement;
	private statusEl!: HTMLElement;
	private editorPaneEl!: HTMLElement;
	private editorEl!: HTMLTextAreaElement;
	private previewEl!: HTMLElement;
	private toggleEditorButtonEl!: HTMLButtonElement;
	private markdownPaneVisible = true;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: VaultToVoice,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_DRAFT;
	}

	getDisplayText(): string {
		return 'Voice to Vault';
	}

	getIcon(): string {
		return 'mic';
	}

	async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();
		container.addClass('voice-draft-view');

		const toolbarEl = container.createDiv({ cls: 'voice-draft-toolbar' });
		this.dictateButtonEl = toolbarEl.createEl('button', {
			cls: 'voice-draft-record-button',
			text: '🎙️ grabar',
		});
		this.dictateButtonEl.addEventListener('click', () => void this.toggleDictation());

		this.editButtonEl = toolbarEl.createEl('button', {
			cls: 'voice-draft-record-button',
			text: '🗣️ editar por voz',
		});
		this.editButtonEl.addEventListener('click', () => void this.toggleVoiceEdit());

		this.statusEl = toolbarEl.createSpan({ cls: 'voice-draft-status' });

		const panesEl = container.createDiv({ cls: 'voice-draft-panes' });

		this.editorPaneEl = panesEl.createDiv({ cls: 'voice-draft-pane' });
		this.editorPaneEl.createEl('h4', { text: 'Texto (Markdown)' });
		this.editorEl = this.editorPaneEl.createEl('textarea', {
			cls: 'voice-draft-editor',
			attr: { placeholder: 'El texto transcrito aparecerá aquí. También puedes escribirlo o editarlo a mano...' },
		});
		this.editorEl.value = this.markdown;
		this.editorEl.addEventListener('input', () => {
			this.markdown = this.editorEl.value;
			void this.renderPreview();
		});

		this.toggleEditorButtonEl = panesEl.createEl('button', {
			cls: 'voice-draft-toggle-editor',
			attr: { 'aria-label': 'Mostrar/ocultar el editor de Markdown' },
		});
		this.toggleEditorButtonEl.addEventListener('click', () => this.toggleMarkdownPane());
		setIcon(this.toggleEditorButtonEl, 'chevron-right');

		const previewPane = panesEl.createDiv({ cls: 'voice-draft-pane' });
		previewPane.createEl('h4', { text: 'Previsualización' });
		this.previewEl = previewPane.createDiv({ cls: 'voice-draft-preview' });

		await this.renderPreview();
	}

	async onClose(): Promise<void> {
		if (this.dictateRecorder.isRecording) await this.dictateRecorder.stop();
		if (this.editRecorder.isRecording) await this.editRecorder.stop();
	}

	private setControlsDisabled(disabled: boolean): void {
		this.dictateButtonEl.disabled = disabled;
		this.editButtonEl.disabled = disabled;
	}

	private async toggleDictation(): Promise<void> {
		if (this.dictateRecorder.isRecording) {
			const audioBlob = await this.dictateRecorder.stop();
			this.dictateButtonEl.setText('🎙️ grabar');
			this.setControlsDisabled(true);
			this.statusEl.setText('Transcribiendo...');

			try {
				const result = await transcribeAudio(audioBlob, this.plugin.settings);
				this.markdown += (this.markdown ? '\n\n' : '') + result.text;
				this.editorEl.value = this.markdown;
				await this.renderPreview();
				this.statusEl.setText(
					`Transcripción lista vía ${result.provider} (${result.durationSeconds.toFixed(1)}s, RMS=${result.rms.toFixed(3)}).`,
				);
			} catch (error) {
				this.statusEl.setText(`Error al transcribir: ${error instanceof Error ? error.message : String(error)}`);
			} finally {
				this.setControlsDisabled(false);
			}
			return;
		}

		try {
			await this.dictateRecorder.start();
			this.dictateButtonEl.setText('⏹️ detener');
			this.statusEl.setText('Grabando dictado...');
		} catch {
			this.statusEl.setText('No se pudo acceder al micrófono.');
		}
	}

	private async toggleVoiceEdit(): Promise<void> {
		if (this.editRecorder.isRecording) {
			const audioBlob = await this.editRecorder.stop();
			this.editButtonEl.setText('🗣️ editar por voz');
			this.setControlsDisabled(true);
			this.statusEl.setText('Transcribiendo instrucción...');

			try {
				const transcription = await transcribeAudio(audioBlob, this.plugin.settings);
				this.statusEl.setText(`Aplicando instrucción (vía ${transcription.provider}): "${transcription.text}"...`);
				const updatedMarkdown = await applyVoiceEdit(this.markdown, transcription.text, this.plugin.settings);
				this.markdown = updatedMarkdown;
				this.editorEl.value = this.markdown;
				await this.renderPreview();
				this.statusEl.setText('Edición aplicada.');
			} catch (error) {
				this.statusEl.setText(`Error al editar: ${error instanceof Error ? error.message : String(error)}`);
			} finally {
				this.setControlsDisabled(false);
			}
			return;
		}

		try {
			await this.editRecorder.start();
			this.editButtonEl.setText('⏹️ detener');
			this.statusEl.setText('Grabando instrucción de edición...');
		} catch {
			this.statusEl.setText('No se pudo acceder al micrófono.');
		}
	}

	private toggleMarkdownPane(): void {
		this.markdownPaneVisible = !this.markdownPaneVisible;
		this.editorPaneEl.toggleClass('voice-draft-pane-hidden', !this.markdownPaneVisible);
		setIcon(this.toggleEditorButtonEl, this.markdownPaneVisible ? 'chevron-right' : 'chevron-left');
	}

	private async renderPreview(): Promise<void> {
		this.previewEl.empty();
		await MarkdownRenderer.render(this.app, this.markdown, this.previewEl, '', this);
	}
}
