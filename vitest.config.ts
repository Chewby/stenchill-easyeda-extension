import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
			// Ce qui est LIVRE et testable hors EasyEDA. `iframe-app.ts` et
			// `index.ts` en sont exclus : ils ne font qu'appeler l'objet `eda`,
			// qui n'existe pas en dehors du client, et les inclure collerait un
			// 0 % qui ne dit rien de la qualite du code teste.
			include: ['src/**/*.ts'],
			exclude: ['src/iframe-app.ts', 'src/index.ts', 'src/iframe-id.ts'],
		},
	},
});
