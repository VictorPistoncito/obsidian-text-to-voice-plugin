import type { VaultToVoiceSettings } from '../settings';
import { LANGUAGE_LABELS } from '../language';
import { callChatChain } from './chatClient';

interface RelationshipType {
	key: string;
	label: string;
	description: string;
}

// Mismo vocabulario que trae por defecto el plugin "Wikilink Types", para que el
// frontmatter que generamos sea compatible con él (y con Graph Link Types, que lo lee).
export const RELATIONSHIP_TYPES: RelationshipType[] = [
	{ key: 'supersedes', label: 'Supersedes', description: 'Esto sustituye a un conocimiento desactualizado' },
	{ key: 'contradicts', label: 'Contradicts', description: 'Esto contradice una creencia existente' },
	{ key: 'supports', label: 'Supports', description: 'Esto aporta evidencia a favor de una afirmación' },
	{ key: 'causes', label: 'Causes', description: 'Esto fue causado por otro evento' },
	{ key: 'influenced_by', label: 'Influenced By', description: 'Esto fue influido por un factor externo' },
	{ key: 'parent_of', label: 'Parent Of', description: 'Esto engloba un concepto más específico' },
	{ key: 'child_of', label: 'Child Of', description: 'Esto es un subconjunto de un concepto más amplio' },
	{ key: 'sibling_of', label: 'Sibling Of', description: 'Esto es paralelo a un concepto relacionado del mismo nivel' },
	{ key: 'updates', label: 'Updates', description: 'Esto actualiza conocimiento existente' },
	{ key: 'evolution_of', label: 'Evolution Of', description: 'Esto evoluciona a partir de un concepto anterior' },
	{ key: 'prerequisite_for', label: 'Prerequisite For', description: 'Entender esto es necesario para el siguiente concepto' },
	{ key: 'implements', label: 'Implements', description: 'Esto aplica un concepto teórico' },
	{ key: 'documents', label: 'Documents', description: 'Esto describe un sistema o proceso' },
	{ key: 'example_of', label: 'Example Of', description: 'Esto es un ejemplo de un principio general' },
	{ key: 'tests', label: 'Tests', description: 'Esto valida una implementación o hipótesis' },
	{ key: 'responds_to', label: 'Responds To', description: 'Esto responde a una pregunta o afirmación anterior' },
	{ key: 'references', label: 'References', description: 'Esto cita una fuente' },
	{ key: 'inspired_by', label: 'Inspired By', description: 'Esto está motivado por un trabajo anterior' },
	{ key: 'follows', label: 'Follows', description: 'Esto viene después de un paso anterior' },
	{ key: 'precedes', label: 'Precedes', description: 'Esto viene antes de un paso siguiente' },
	{ key: 'depends_on', label: 'Depends On', description: 'Esto requiere un prerrequisito' },
	{ key: 'composed_of', label: 'Composed Of', description: 'Esto contiene partes componentes' },
	{ key: 'part_of', label: 'Part Of', description: 'Esto pertenece a un conjunto más grande' },
	{ key: 'disputes', label: 'Disputes', description: 'Esto discrepa de otra perspectiva' },
];

function buildSystemPrompt(languageLabel: string): string {
	const list = RELATIONSHIP_TYPES.map((type) => `- ${type.key}: ${type.description}`).join('\n');
	return (
		'Eres un asistente que clasifica la relación hablada entre dos notas dentro de una lista cerrada de tipos. ' +
		`La descripción hablada está en ${languageLabel}. ` +
		'Estos son los únicos tipos válidos:\n' +
		`${list}\n\n` +
		'Responde ÚNICAMENTE con la clave exacta (la palabra antes de los dos puntos) del tipo que mejor describa la relación, ' +
		'en minúsculas, sin explicaciones, sin comillas, sin puntuación.'
	);
}

export async function interpretRelationType(
	spokenInstruction: string,
	currentTitle: string,
	targetTitle: string,
	settings: VaultToVoiceSettings,
): Promise<string> {
	const userPrompt =
		`Nota de origen: "${currentTitle}"\nNota de destino: "${targetTitle}"\n\n` +
		`Descripción hablada de la relación: "${spokenInstruction}"`;

	const raw = await callChatChain(settings, buildSystemPrompt(LANGUAGE_LABELS[settings.language]), userPrompt);
	const key = raw.trim().toLowerCase().replace(/[^a-z_]/g, '');

	const match = RELATIONSHIP_TYPES.find((type) => type.key === key);
	if (!match) {
		throw new Error(`La IA devolvió un tipo de relación no reconocido: "${raw}"`);
	}
	return match.key;
}
