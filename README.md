# Stenchill

Turns the paste layers of your board into a stencil you can print on a normal
FDM printer, without ever leaving EasyEDA Pro. No manual Gerber export, no zip
to assemble, no file to drag into a browser.

## How to use it

Open a PCB, then `Advanced → Stenchill → Generate stencil...`.

Pick your settings and click once. The extension exports the paste layers and
the board outline, sends them to stenchill.com, follows the generation live,
and hands you back an archive of STL and 3MF files, named after your project
and the time. "View in 3D" opens the result on the site with the settings you
used.

Every setting has a help icon. The defaults suit most boards: 0.4 mm thickness,
no shrink, a 0.4 mm nozzle, close pads merged, unprintable grids filled in, and
alignment shoulders on. A 0.2 mm nozzle gives noticeably better results if your
printer has one.

Your settings are remembered between runs.

## What it needs

**The EasyEDA Pro desktop client.** The web version is not supported: a browser
enforces the cross-origin rule that the desktop client does not, so the call to
stenchill.com is blocked there.

An internet connection. Generation runs on stenchill.com, and your Gerber files
are not kept after it.

## Languages

The interface follows EasyEDA Pro's own display language, in English and
Simplified Chinese. Anything it has no translation for falls back to English.

## What it sends

Only the paste layers and the board outline of the open board, and only when
you click Generate. Nothing else on your PCB travels.

**It also asks stenchill.com whether a newer version exists**, each time you
open the dialog and never otherwise. That call carries the extension's version
and nothing else, gives up after 15 seconds, and fails silently. When a new
version is found the dialog says so, from the following open onwards.

## Links

- [stenchill.com](https://www.stenchill.com)
- [Source and issues](https://github.com/Chewby/stenchill-easyeda-extension)
- [The KiCad plugin](https://github.com/Chewby/stenchill-kicad-plugin), same
  idea for KiCad users.

MIT licensed.
