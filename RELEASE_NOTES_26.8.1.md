# Stenchill for EasyEDA, v26.8.1

First release. Stenchill turns the paste layers of your board into a stencil you can print on a normal FDM printer, and this extension does it without ever leaving EasyEDA Pro. No manual Gerber export, no zip to assemble, no file to drag into a browser.

Open a board, pick your settings, click once. The extension exports the paste and outline layers, sends them to stenchill.com, follows the generation live, and hands you back the STL archive.

## What it does

- **Exports the right layers, and only those.** Top paste, bottom paste, board outline. Nothing else travels, so a large board still uploads in a few kilobytes rather than a full fabrication package.
- **Exports everything on those layers**, not just pads. Solder paste is sometimes drawn by hand as a filled region, typically the thermal pad under a power component. Filtering on pads would drop it and produce a stencil with a hole in it, with no error to warn you.
- **Follows the generation live.** A progress bar, the current step, and your position in the queue when the server is busy. A generation can take up to a minute on a dense board, and a window that does not move looks like a window that has crashed.
- **Lets you stop.** The bottom button turns into Cancel while a generation runs, and cancelling actually closes the stream instead of leaving it to run in the background.
- **Names the archive after your project and the time**, for example `torture-test_20260830_204126.zip`. You will regenerate the same board with a different thickness or a different nozzle, and each attempt should be recognisable rather than overwrite the last one.
- **Speaks English and Simplified Chinese**, following whichever language EasyEDA Pro itself is set to. Every label, every help panel and every status message is translated; an entry it cannot find falls back to English rather than showing you a blank.
- **Opens the result in 3D on stenchill.com**, with your exact settings carried along so the page shows the stencil you just saved and not a default one.

## Settings

Three groups, in the same order and under the same names as the website and the KiCad plugin: Printability, Stencil, Alignment. If you have used either of those, nothing here needs relearning. Every setting has a help icon; click it and a titled panel explains what the setting does and when to change it.

The defaults are the ones that work for most boards: 0.4 mm thickness, no shrink, a 0.4 mm nozzle, close pads merged, unprintable grids filled in, and alignment shoulders on. A 0.2 mm nozzle gives noticeably better results if your printer has one.

Your settings are remembered between runs.

## Installing

Download `stenchill-easyeda-extension-26.8.1.eext` from this release, then in EasyEDA Pro:

`Advanced` → `Extension Manager` → `Import`

Open a PCB and the menu appears under `Advanced` → `Stenchill`.

## What it needs

**The EasyEDA Pro desktop client.** The web version is not supported: a browser enforces the cross-origin rule that the desktop client does not, so the call to stenchill.com is blocked there. Supporting it needs two changes on the server side, neither of them done: the EasyEDA origin would have to be allowed, and so would the `X-API-Key` header the extension sends on every call.

An internet connection. Generation runs on stenchill.com, and your Gerber files are not kept after it.

## Known limitations

- The EasyEDA export API this extension relies on is marked BETA by EasyEDA itself, and may change without notice.
- The update check is in place but its server route is not live yet, so this version will never tell you a newer one exists. It fails silently by design rather than showing an error.

## Links

- [stenchill.com](https://www.stenchill.com)
- [The KiCad plugin](https://github.com/Chewby/stenchill-kicad-plugin), same idea for KiCad users.
