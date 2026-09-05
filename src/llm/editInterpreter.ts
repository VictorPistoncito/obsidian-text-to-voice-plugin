import { requestUrl } from 'obsidian';
import type { VaultToVoiceSettings } from '../settings';

interface ChatProvider {
	name: string;
	apiKey: string;
	baseUrl: string;
	model: string;
}

interface ChatCompletionResponse {
	choices?: { message?: { content?: string } }[];
}

const SYSTEM_PROMPT =
	'Eres un asistente que edita un borrador de texto en formato Markdown según una instrucción hablada por el usuario. ' +
	'Aplica solo el cambio pedido (añadir, borrar, sustituir texto, o aplicar formato Markdown como títulos/negrita/listas). ' +
	'Devuelve ÚNICAMENTE el texto Markdown resultante completo, sin explicaciones ni comillas envolventes.';

function buildProviders(settings: VaultToVoiceSettings): ChatProvider[] {
	return [
		{ name: 'Groq', apiKey: settings.groqApiKey, baseUrl: 'https://api.groq.com/openai/v1', model: settings.groqModel },
		{
			name: 'Gemini',
			apiKey: settings.geminiApiKey,
			baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
			model: settings.geminiModel,
		},
		{
			name: 'OpenRouter',
			apiKey: settings.openrouterApiKey,
			baseUrl: 'https://openrouter.ai/api/v1',
			model: settings.openrouterModel,
		},
	].filter((provider) => provider.apiKey && provider.model);
}

async function callProvider(provider: ChatProvider, currentMarkdown: string, instruction: string): Promise<string> {
	const response = await requestUrl({
		url: `${provider.baseUrl}/chat/completions`,
		method: 'POST',
		contentType: 'application/json',
		throw: false,
		headers: {
			Authorization: `Bearer ${provider.apiKey}`,
		},
		body: JSON.stringify({
			model: provider.model,
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{
					role: 'user',
					content: `Texto actual:\n"""\n${currentMarkdown}\n"""\n\nInstrucción hablada: "${instruction}"`,
				},
			],
		}),
	});

	if (response.status >= 400) {
		throw new Error(`${provider.name} respondió ${response.status}`);
	}

	const data = response.json as ChatCompletionResponse;
	const content = data.choices?.[0]?.message?.content;
	if (!content) {
		throw new Error(`${provider.name} devolvió una respuesta vacía`);
	}
	return content.trim();
}

export async function applyVoiceEdit(
	currentMarkdown: string,
	instruction: string,
	settings: VaultToVoiceSettings,
): Promise<string> {
	const providers = buildProviders(settings);
	if (providers.length === 0) {
		throw new Error('No hay ninguna clave de API configurada en los ajustes del plugin.');
	}

	const errors: string[] = [];
	for (const provider of providers) {
		try {
			return await callProvider(provider, currentMarkdown, instruction);
		} catch (error) {
			errors.push(`${provider.name}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	throw new Error(`Todos los proveedores fallaron — ${errors.join(' | ')}`);
}
