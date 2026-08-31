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
	it('reads a complete event', () => {
		expect(collect(['event: progress\ndata: {"step":2}\n\n'])).toEqual([
			{ type: 'progress', data: '{"step":2}' },
		]);
	});

	it('stitches back an event split across two chunks', () => {
		expect(collect(['event: prog', 'ress\ndata: {"ste', 'p":2}\n\n'])).toEqual([
			{ type: 'progress', data: '{"step":2}' },
		]);
	});

	it('gives the message type when event is absent', () => {
		expect(collect(['data: {"a":1}\n\n'])).toEqual([{ type: 'message', data: '{"a":1}' }]);
	});

	it('joins multiple data lines with a newline', () => {
		expect(collect(['data: un\ndata: deux\n\n'])).toEqual([
			{ type: 'message', data: 'un\ndeux' },
		]);
	});

	it('accepts CRLF line endings', () => {
		expect(collect(['event: complete\r\ndata: {}\r\n\r\n'])).toEqual([
			{ type: 'complete', data: '{}' },
		]);
	});

	it('ignores keep-alive comments', () => {
		expect(collect([': keep-alive\n\ndata: {}\n\n'])).toEqual([{ type: 'message', data: '{}' }]);
	});

	it('strips the CR from the last line when the stream stops dead', () => {
		// The stream dies after a data: line in CRLF, with no blank line: without
		// stripping the CR, the payload would carry an invisible \r and the
		// caller's JSON.parse would fail without anyone understanding why.
		expect(collect(['event: complete\r\ndata: {"a":1}\r'])).toEqual([
			{ type: 'complete', data: '{"a":1}' },
		]);
	});

	it('emits the last event even without a final blank line', () => {
		expect(collect(['event: complete\ndata: {}\n'])).toEqual([{ type: 'complete', data: '{}' }]);
	});
});
