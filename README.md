# Stenchill — EasyEDA Pro extension

Turns the paste layers of your board into a stencil you can print on a normal
FDM printer, without ever leaving EasyEDA Pro. No manual Gerber export, no zip
to assemble, no file to drag into a browser.

## Install

`Advanced → Extension Manager → Import`, then pick the `.eext` file from the
[latest release](https://github.com/Chewby/stenchill-easyeda-extension/releases).

It targets the **desktop client**. The web version is not supported: a browser
enforces the cross-origin rule that the Electron client does not, so the call
to stenchill.com is blocked there.

## Use

Open your board, then `Advanced → Stenchill → Generate stencil...`.

The extension exports the paste layers and the board outline, sends them to
stenchill.com, follows the generation live, and hands you back an archive of
STL and 3MF files. "View in 3D" opens the result on the site with the settings
you used.

The interface follows EasyEDA Pro's own display language, in English and
Simplified Chinese. Anything it has no translation for falls back to English.

**It calls stenchill.com once when EasyEDA starts**, to ask whether a newer
version exists. The call carries the extension's version and nothing else, it
gives up after 15 seconds, and it fails silently. There is no way to turn it
off yet.

## Development

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

Two bundles are produced, and both matter. `dist/index.js` is the extension
entry point that registers the menu; `iframe/app.js` carries the whole
interface, the iframe being a separate document that cannot import the first.

## Licence

MIT, see [LICENSE](LICENSE).
