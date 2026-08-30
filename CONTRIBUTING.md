# Working on this extension

Development notes. This file is deliberately kept OUT of the packaged `.eext`:
EasyEDA Pro renders `README.md` as the extension's detail page in the Extension
Manager, so anything a user does not need has no place there.

```bash
npm install
npm test          # esbuild, then tsc --noEmit, then vitest
npm run lint
npm run build     # produces build/dist/stenchill_vX.Y.Z.eext
npm run debug     # watch mode, rebuilds both bundles and repackages
```

`npm test` compiles first, on purpose: `tests/package.contract.test.ts`
inspects the real packaged file list, and two of those files are generated.
Without that step the suite fails on a fresh clone, which is the first thing
anyone runs.

## Two bundles, and both matter

`dist/index.js` is the extension entry point that registers the menu.
`iframe/app.js` carries the whole interface, the iframe being a separate
document that cannot import the first. `npm run debug` watches both; it used
to watch only the first, so editing the interface rebuilt nothing while still
printing "Repackaging complete".

## What ships, and what does not

`.edaignore` is a DENYLIST, so anything added at the repo root ends up in the
package by default. That has already shipped a previous release's own `.eext`,
the CI definition and Sonar's working directory. `tests/package.contract.test.ts`
pins the OUTPUT instead: adding a line to its inventory is a gesture that has
to be defended in review.

## The version lives in four places

`src/version.ts`, `extension.json`, `package.json` and
`sonar-project.properties`, the last one only in the monorepo copy.
`tests/version.contract.test.ts` checks all four. `npm run update` pulls the
upstream SDK skeleton and used to overwrite both the version and the scripts
with the template's own; those two merges are neutralised on purpose.

## Translations

The dictionary key IS the English text, so `iframe/index.html` stays readable
and a missing entry degrades to English rather than showing a bare tag. The
price is that editing the markup silently stops matching an entry, which is
what `tests/i18n.contract.test.ts` exists to prevent: it re-extracts the
strings from the real `index.html`, and fails both on a string absent from the
dictionaries and on an entry nothing displays any more.
