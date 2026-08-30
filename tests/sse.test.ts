import type { SseEvent } from '../src/sse';
import { describe, expect, it } from 'vitest';
import { SseParser } from '../src/sse';

function collect(chunks: string[]): SseEvent[] {
	const seen: SseEvent[] = [];
	const parser = new SseParser(event => seen.push(event));
	for (const chunk of chunks) parser.push(chunk);
	parser.end();
	return seen;
}

describe('sseParser', () => {
	it('lit un evenement complet', () => {
		expect(collect(['event: progress\ndata: {"step":2}\n\n'])).toEqual([
			{ type: 'progress', data: '{"step":2}' },
		]);
	});

	it('recolle un evenement coupe entre deux blocs', () => {
		expect(collect(['event: prog', 'ress\ndata: {"ste', 'p":2}\n\n'])).toEqual([
			{ type: 'progress', data: '{"step":2}' },
		]);
	});

	it('donne le type message quand event est absent', () => {
		expect(collect(['data: {"a":1}\n\n'])).toEqual([{ type: 'message', data: '{"a":1}' }]);
	});

	it('recolle les lignes data multiples avec un saut de ligne', () => {
		expect(collect(['data: un\ndata: deux\n\n'])).toEqual([
			{ type: 'message', data: 'un\ndeux' },
		]);
	});

	it('accepte les fins de ligne CRLF', () => {
		expect(collect(['event: complete\r\ndata: {}\r\n\r\n'])).toEqual([
			{ type: 'complete', data: '{}' },
		]);
	});

	it('ignore les commentaires de maintien de connexion', () => {
		expect(collect([': keep-alive\n\ndata: {}\n\n'])).toEqual([{ type: 'message', data: '{}' }]);
	});

	it('nettoie le CR de la derniere ligne quand le flux s arrete net', () => {
		// The stream dies after a data: line in CRLF, with no blank line: without
		// stripping the CR, the payload would carry an invisible \r and the
		// caller's JSON.parse would fail without anyone understanding why.
		expect(collect(['event: complete\r\ndata: {"a":1}\r'])).toEqual([
			{ type: 'complete', data: '{"a":1}' },
		]);
	});

	it('emet le dernier evenement meme sans ligne vide finale', () => {
		expect(collect(['event: complete\ndata: {}\n'])).toEqual([{ type: 'complete', data: '{}' }]);
	});
});
