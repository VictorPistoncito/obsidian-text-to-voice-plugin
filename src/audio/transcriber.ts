import { requestUrl } from 'obsidian';
import type { VaultToVoiceSettings } from '../settings';

const SAMPLING_RATE = 16000;
const SILENCE_RMS_THRESHOLD = 0.001;

async function decodeAudioForDiagnostics(audioBlob: Blob): Promise<Float32Array> {
	const arrayBuffer = await audioBlob.arrayBuffer();
	const audioContext = new AudioContext({ sampleRate: SAMPLING_RATE });
	try {
		const decoded = await audioContext.decodeAudioData(arrayBuffer);
		if (decoded.numberOfChannels === 1) return decoded.getChannelData(0);

		const mono = new Float32Array(decoded.length);
		for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
			const data = decoded.getChannelData(channel);
			for (let i = 0; i < data.length; i++) mono[i] = (mono[i] ?? 0) + data[i]! / decoded.numberOfChannels;
		}
		return mono;
	} finally {
		await audioContext.close();
	}
}

export interface TranscriptionResult {
	text: string;
	durationSeconds: number;
	rms: number;
	provider: string;
}

function buildMultipartFormData(
	fields: Record<string, string>,
	file: { fieldName: string; filename: string; contentType: string; data: ArrayBuffer },
): { body: ArrayBuffer; contentType: string } {
	const boundary = `----VaultToVoice${Date.now().toString(16)}`;
	const encoder = new TextEncoder();
	const parts: Uint8Array[] = [];

	for (const [name, value] of Object.entries(fields)) {
		parts.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
	}
	parts.push(
		encoder.encode(
			`--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
		),
	);
	parts.push(new Uint8Array(file.data));
	parts.push(encoder.encode(`\r\n--${boundary}--\r\n`));

	const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
	const body = new Uint8Array(totalLength);
	let offset = 0;
	for (const part of parts) {
		body.set(part, offset);
		offset += part.length;
	}
	return { body: body.buffer, contentType: `multipart/form-data; boundary=${boundary}` };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}

async function transcribeWithGroq(audioBlob: Blob, apiKey: string): Promise<string> {
	const fileBuffer = await audioBlob.arrayBuffer();
	const { body, contentType } = buildMultipartFormData(
		{ model: 'whisper-large-v3-turbo', language: 'es' },
		{ fieldName: 'file', filename: 'audio.webm', contentType: audioBlob.type || 'audio/webm', data: fileBuffer },
	);

	const response = await requestUrl({
		url: 'https://api.groq.com/openai/v1/audio/transcriptions',
		method: 'POST',
		throw: false,
		contentType,
		headers: { Authorization: `Bearer ${apiKey}` },
		body,
	});

	if (response.status >= 400) throw new Error(`Groq respondió ${response.status}`);
	const text = (response.json as { text?: string }).text;
	if (!text) throw new Error('Groq devolvió una respuesta vacía');
	return text;
}

async function transcribeWithHuggingFace(audioBlob: Blob, apiKey: string): Promise<string> {
	const fileBuffer = await audioBlob.arrayBuffer();
	const response = await requestUrl({
		url: 'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3',
		method: 'POST',
		throw: false,
		contentType: audioBlob.type || 'audio/webm',
		headers: { Authorization: `Bearer ${apiKey}` },
		body: fileBuffer,
	});

	if (response.status >= 400) throw new Error(`Hugging Face respondió ${response.status}`);
	const text = (response.json as { text?: string }).text;
	if (!text) throw new Error('Hugging Face devolvió una respuesta vacía');
	return text;
}

async function transcribeWithGemini(audioBlob: Blob, apiKey: string, model: string): Promise<string> {
	const fileBuffer = await audioBlob.arrayBuffer();
	const base64Audio = arrayBufferToBase64(fileBuffer);

	const response = await requestUrl({
		url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
		method: 'POST',
		throw: false,
		contentType: 'application/json',
		body: JSON.stringify({
			contents: [
				{
					parts: [
						{ inline_data: { mime_type: audioBlob.type || 'audio/webm', data: base64Audio } },
						{
							text: 'Transcribe este audio literalmente, en español. Devuelve únicamente el texto transcrito, sin comentarios ni explicaciones.',
						},
					],
				},
			],
		}),
	});

	if (response.status >= 400) throw new Error(`Gemini respondió ${response.status}`);
	const data = response.json as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
	const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
	if (!text) throw new Error('Gemini devolvió una respuesta vacía');
	return text.trim();
}

export async function transcribeAudio(audioBlob: Blob, settings: VaultToVoiceSettings): Promise<TranscriptionResult> {
	const audio = await decodeAudioForDiagnostics(audioBlob);
	const durationSeconds = audio.length / SAMPLING_RATE;
	const rms = Math.sqrt(audio.reduce((sum, sample) => sum + sample * sample, 0) / audio.length);
	if (rms < SILENCE_RMS_THRESHOLD) {
		throw new Error(
			`Audio prácticamente en silencio (${durationSeconds.toFixed(1)}s, RMS=${rms.toFixed(4)}) — problema de grabación, no del modelo.`,
		);
	}

	const attempts: { name: string; run: () => Promise<string> }[] = [];
	if (settings.groqApiKey) {
		attempts.push({ name: 'Groq', run: () => transcribeWithGroq(audioBlob, settings.groqApiKey) });
	}
	if (settings.huggingfaceApiKey) {
		attempts.push({ name: 'Hugging Face', run: () => transcribeWithHuggingFace(audioBlob, settings.huggingfaceApiKey) });
	}
	if (settings.geminiApiKey) {
		attempts.push({
			name: 'Gemini',
			run: () => transcribeWithGemini(audioBlob, settings.geminiApiKey, settings.geminiModel),
		});
	}

	if (attempts.length === 0) {
		throw new Error('No hay ninguna clave de API de transcripción configurada en los ajustes del plugin.');
	}

	const errors: string[] = [];
	for (const attempt of attempts) {
		try {
			const text = await attempt.run();
			return { text, durationSeconds, rms, provider: attempt.name };
		} catch (error) {
			errors.push(`${attempt.name}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	throw new Error(`Todos los proveedores de transcripción fallaron — ${errors.join(' | ')}`);
}
