export interface SseEvent {
	type: string;
	data: string;
}

/**
 * SSE event parser fed chunk by chunk.
 *
 * A network chunk does not align with event boundaries: the `rest`
 * buffer carries what remains of an incomplete line from one call to the
 * next. Without it, an event cut in half is silently lost.
 */
export class SseParser {
	private rest = '';
	private type: string | null = null;
	private data: string[] = [];

	constructor(private readonly onEvent: (event: SseEvent) => void) {}

	push(chunk: string): void {
		this.rest += chunk;
		for (let index = this.rest.indexOf('\n'); index >= 0; index = this.rest.indexOf('\n')) {
			const line = this.rest.slice(0, index).replace(/\r$/, '');
			this.rest = this.rest.slice(index + 1);
			this.handleLine(line);
		}
	}

	/** Flushes what remains: a stream can end without a final blank line. */
	end(): void {
		if (this.rest.length > 0) {
			this.handleLine(this.rest.replace(/\r$/, ''));
			this.rest = '';
		}
		this.flush();
	}

	private handleLine(line: string): void {
		if (line === '') {
			this.flush();
			return;
		}
		if (line.startsWith(':'))
			return; // comment, keep-alive
		if (line.startsWith('event:')) {
			this.type = line.slice('event:'.length).trim();
			return;
		}
		if (line.startsWith('data:')) {
			this.data.push(line.slice('data:'.length).replace(/^ /, ''));
		}
	}

	private flush(): void {
		if (this.data.length === 0) {
			this.type = null;
			return;
		}
		// By the SSE specification, an event with no event field is "message".
		this.onEvent({ type: this.type ?? 'message', data: this.data.join('\n') });
		this.type = null;
		this.data = [];
	}
}
