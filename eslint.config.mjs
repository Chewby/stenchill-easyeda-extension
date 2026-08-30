import antfu from '@antfu/eslint-config';

export default antfu({
	stylistic: {
		indent: 'tab',
		quotes: 'single',
		semi: true,
	},

	typescript: true,

	ignores: ['build/dist/', 'coverage/', 'dist/', 'node_modules/', '.eslintcache', 'debug.log'],

	rules: {
		'no-console': ['warn', { allow: ['log', 'warn', 'error'] }],
	},
}, {
	// `${1}` est la syntaxe d'emplacement du SDK d'EasyEDA, pas un litteral de
	// gabarit ecrit avec les mauvais guillemets. Les cles de traduction la
	// portent DANS des chaines simples, ou elle doit rester litterale : c'est
	// le dictionnaire qui la substitue, pas JavaScript. La regle ne peut pas
	// faire la difference, on la desarme la ou la convention s'applique et
	// nulle part ailleurs.
	files: ['src/i18n.ts', 'src/iframe-app.ts', 'src/index.ts', 'tests/i18n*.ts'],
	rules: {
		'no-template-curly-in-string': 'off',
	},
});
