import { App, Component, MarkdownRenderer, Modal, TFile, setIcon } from 'obsidian';
import type { VaultToVoiceSettings } from '../settings';
import { VoiceRecorder } from '../audio/recorder';
import { transcribeAudio } from '../audio/transcriber';
import { RELATIONSHIP_TYPES, interpretRelationType } from '../llm/relationInterpreter';
import { addRelationLink } from '../vault/relationLinks';

interface DisplayNote {
	title: string;
	content: string;
}

const CURRENT_NOTE_TITLE = 'Nota actual (borrador)';

export class RelationsModal extends Modal {
	private renderComponent = new Component();
	private recorder = new VoiceRecorder();
	private bodyEl!: HTMLElement;
	private statusEl!: HTMLElement;
	private selectedNote: DisplayNote | null = null;
	private showingPicker = false;

	constructor(
		app: App,
		private settings: VaultToVoiceSettings,
		private getMarkdown: () => string,
		private setMarkdown: (markdown: string) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.renderComponent.load();
		this.modalEl.addClass('relations-modal');
		this.titleEl.setText('Establecer relación');

		this.renderTypesHelp();

		this.bodyEl = this.contentEl.createDiv({ cls: 'relations-body' });
		this.render();
	}

	private renderTypesHelp(): void {
		const helpButtonEl = this.contentEl.createEl('button', {
			cls: 'relations-help-button',
			attr: { 'aria-label': 'Tipos de relación disponibles' },
		});
		setIcon(helpButtonEl, 'lightbulb');

		const panelEl = this.contentEl.createDiv({ cls: 'relations-types-panel relations-types-panel-hidden' });
		panelEl.createEl('h4', { text: 'Tipos de relación disponibles' });
		const listEl = panelEl.createEl('ul');
		for (const type of RELATIONSHIP_TYPES) {
			const itemEl = listEl.createEl('li');
			itemEl.createEl('strong', { text: type.key });
			itemEl.createSpan({ text: ` — ${type.description}` });
		}

		helpButtonEl.addEventListener('click', () => {
			panelEl.toggleClass('relations-types-panel-hidden', !panelEl.hasClass('relations-types-panel-hidden'));
		});
	}

	onClose(): void {
		if (this.recorder.isRecording) void this.recorder.stop();
		this.renderComponent.unload();
		this.contentEl.empty();
	}

	private render(): void {
		this.bodyEl.empty();
		if (this.showingPicker) {
			this.renderPicker();
		} else {
			this.renderMain();
		}
	}

	private renderMain(): void {
		const toolbarEl = this.bodyEl.createDiv({ cls: 'relations-toolbar' });
		const pickButtonEl = toolbarEl.createEl('button', { cls: 'relations-pick-button', text: 'Notas del vault' });
		pickButtonEl.addEventListener('click', () => {
			this.showingPicker = true;
			this.render();
		});

		const stackEl = this.bodyEl.createDiv({ cls: 'relations-note-stack' });
		void this.renderNoteCard(
			stackEl,
			{ title: CURRENT_NOTE_TITLE, content: this.getMarkdown() || '*(el borrador está vacío)*' },
			true,
		);

		if (this.selectedNote) {
			this.renderVoiceRelationControls(stackEl, this.selectedNote);
			void this.renderNoteCard(stackEl, this.selectedNote, false);
		}
	}

	private renderVoiceRelationControls(container: HTMLElement, targetNote: DisplayNote): void {
		const controlsEl = container.createDiv({ cls: 'relations-voice-controls' });
		const recordButtonEl = controlsEl.createEl('button', {
			cls: 'voice-draft-record-button',
			text: '🎤 Definir relación por voz',
		});
		this.statusEl = controlsEl.createSpan({ cls: 'voice-draft-status' });

		recordButtonEl.addEventListener('click', () => void this.toggleRelationRecording(recordButtonEl, targetNote));
	}

	private async toggleRelationRecording(buttonEl: HTMLButtonElement, targetNote: DisplayNote): Promise<void> {
		if (this.recorder.isRecording) {
			const audioBlob = await this.recorder.stop();
			buttonEl.setText('🎤 Definir relación por voz');
			buttonEl.disabled = true;
			this.statusEl.setText('Transcribiendo...');

			try {
				const transcription = await transcribeAudio(audioBlob, this.settings);
				this.statusEl.setText(`Clasificando relación: "${transcription.text}"...`);

				const relationKey = await interpretRelationType(
					transcription.text,
					CURRENT_NOTE_TITLE,
					targetNote.title,
					this.settings,
				);

				const updated = addRelationLink(this.getMarkdown(), relationKey, targetNote.title);
				this.setMarkdown(updated);
				this.render();
				this.statusEl.setText(`Relación establecida: ${relationKey} → [[${targetNote.title}]]`);
			} catch (error) {
				this.statusEl.setText(`Error: ${error instanceof Error ? error.message : String(error)}`);
			} finally {
				buttonEl.disabled = false;
			}
			return;
		}

		try {
			await this.recorder.start();
			buttonEl.setText('⏹️ detener');
			this.statusEl.setText('Grabando descripción de la relación...');
		} catch {
			this.statusEl.setText('No se pudo acceder al micrófono.');
		}
	}

	private renderPicker(): void {
		const pickerEl = this.bodyEl.createDiv({ cls: 'relations-picker' });

		const headerEl = pickerEl.createDiv({ cls: 'relations-picker-header' });
		const backButtonEl = headerEl.createEl('button', { cls: 'relations-back-button' });
		setIcon(backButtonEl, 'arrow-left');
		backButtonEl.addEventListener('click', () => {
			this.showingPicker = false;
			this.render();
		});
		headerEl.createEl('h4', { text: 'Notas del vault' });

		const listEl = pickerEl.createDiv({ cls: 'relations-picker-list' });
		const files = this.app.vault.getMarkdownFiles().sort((a, b) => a.basename.localeCompare(b.basename));
		for (const file of files) {
			const itemEl = listEl.createDiv({ cls: 'relations-note-item', text: file.basename });
			itemEl.addEventListener('click', () => void this.selectFile(file));
		}
	}

	private async selectFile(file: TFile): Promise<void> {
		const content = await this.app.vault.cachedRead(file);
		this.selectedNote = { title: file.basename, content };
		this.showingPicker = false;
		this.render();
	}

	private async renderNoteCard(container: HTMLElement, note: DisplayNote, isCurrent: boolean): Promise<void> {
		const cardEl = container.createDiv({ cls: 'relations-note-card' });
		if (isCurrent) cardEl.addClass('relations-note-card-current');
		cardEl.createEl('h4', { text: note.title });

		const rowEl = cardEl.createDiv({ cls: 'relations-card-row' });

		const rawEl = rowEl.createEl('pre', { cls: 'relations-card-raw relations-card-raw-hidden' });
		rawEl.createEl('code', { text: note.content });

		const toggleButtonEl = rowEl.createEl('button', {
			cls: 'relations-card-toggle',
			attr: { 'aria-label': 'Mostrar/ocultar el Markdown de la nota' },
		});
		setIcon(toggleButtonEl, 'chevron-right');
		let rawVisible = false;
		toggleButtonEl.addEventListener('click', () => {
			rawVisible = !rawVisible;
			rawEl.toggleClass('relations-card-raw-hidden', !rawVisible);
			setIcon(toggleButtonEl, rawVisible ? 'chevron-left' : 'chevron-right');
		});

		const renderedEl = rowEl.createDiv({ cls: 'relations-note-card-body' });
		await MarkdownRenderer.render(this.app, note.content, renderedEl, '', this.renderComponent);
	}
}
