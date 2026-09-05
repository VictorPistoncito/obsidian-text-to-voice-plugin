const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'];

function pickSupportedMimeType(): string | undefined {
	return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export class VoiceRecorder {
	private mediaRecorder: MediaRecorder | null = null;
	private chunks: BlobPart[] = [];
	private stream: MediaStream | null = null;

	get isRecording(): boolean {
		return this.mediaRecorder?.state === 'recording';
	}

	get mimeType(): string {
		return this.mediaRecorder?.mimeType ?? '';
	}

	async start(): Promise<void> {
		this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		this.chunks = [];
		const mimeType = pickSupportedMimeType();
		this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
		this.mediaRecorder.ondataavailable = (event) => {
			if (event.data.size > 0) this.chunks.push(event.data);
		};
		this.mediaRecorder.start();
	}

	stop(): Promise<Blob> {
		const recorder = this.mediaRecorder;
		if (!recorder) return Promise.reject(new Error('No hay ninguna grabación en curso.'));

		return new Promise((resolve) => {
			recorder.addEventListener('stop', () => {
				this.stream?.getTracks().forEach((track) => track.stop());
				this.stream = null;
				this.mediaRecorder = null;
				resolve(new Blob(this.chunks, { type: recorder.mimeType }));
			});
			recorder.stop();
		});
	}
}
