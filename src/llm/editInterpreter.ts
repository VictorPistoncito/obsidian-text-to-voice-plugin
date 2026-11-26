import type { VaultToVoiceSettings } from '../settings';
import { LANGUAGE_LABELS } from '../language';
import { callChatChain } from './chatClient';

function buildSystemPrompt(languageLabel: string): string {
	return (
		'Eres un asistente que edita un borrador de texto en formato Markdown según una instrucción hablada por el usuario. ' +
		`El usuario habla y escribe en ${languageLabel}; la instrucción hablada y el texto actual están en ese idioma. ` +
		'Aplica solo el cambio pedido (añadir, borrar, sustituir texto, o aplicar formato Markdown como títulos/negrita/listas). ' +
		'Devuelve ÚNICAMENTE el texto Markdown resultante completo, sin explicaciones ni comillas envolventes.'
	);
}

export async function applyVoiceEdit(
	currentMarkdown: string,
	instruction: string,
	settings: VaultToVoiceSettings,
): Promise<string> {
	const userPrompt = `Texto actual:\n"""\n${currentMarkdown}\n"""\n\nInstrucción hablada: "${instruction}"`;
	return callChatChain(settings, buildSystemPrompt(LANGUAGE_LABELS[settings.language]), userPrompt);
}
