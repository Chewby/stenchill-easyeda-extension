# Stenchill

Turns the paste layers of your board into a stencil you can print on a normal
FDM printer, without ever leaving EasyEDA Pro. No manual Gerber export, no zip
to assemble, no file to drag into a browser.

## Installing it

Download the `.eext` from the [latest release](https://github.com/Chewby/stenchill-easyeda-extension/releases/latest),
then in EasyEDA Pro: `Advanced` → `Extension Manager` → `Import`.

Open a PCB and the menu appears under `Advanced` → `Stenchill`.

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

## Settings

| Setting | Default | Range | What it does |
|---|---|---|---|
| Thickness | 0.4 mm | 0.1 to 0.6 | Stencil plate thickness, which sets the paste deposit |
| Shrink | 0 mm | -0.2 to 0.3 | Reduces every opening by this much. A negative value enlarges them |
| Nozzle | 0.4 mm | 0.1 to 0.8 | Your printer's nozzle, which drives the compensation |
| Merge close pads | on | on/off | Fuses a fine-pitch row into one slot instead of leaving walls no nozzle can print |
| Fill in unprintable grids | on | on/off | Fills the openings of a grid whose walls are thinner than your nozzle |
| Alignment shoulders | on | on/off | Adds the corner supports that hold the board and align the stencil |
| PCB thickness | 1.6 mm | 0.4 to 3.2 | Your board's thickness, which sets how tall the shoulders are |
| Shoulder length | 15 mm | 1 to 200 | How far each L-bracket runs along the board edge |
| Shoulder width | 3 mm | 0.5 to 8 | Wall thickness of the L-brackets |
| Shoulder clearance | 0.3 mm | 0 to 1 | Gap left between the board and the shoulder walls |

## What it needs

**The EasyEDA Pro desktop client.** The web version is not supported: a browser
enforces the cross-origin rule that the desktop client does not, so the call to
stenchill.com is blocked there.

An internet connection. Generation runs on stenchill.com.

## Languages

The interface follows EasyEDA Pro's own display language, in English and
Simplified Chinese. Anything it has no translation for falls back to English.

## What it sends

Only the paste layers and the board outline of the open board, and only when
you click Generate. Nothing else on your PCB travels.

**It also asks stenchill.com whether a newer version exists**, each time you
open the dialog and never otherwise. That call carries the extension's version
and nothing else, gives up after 15 seconds, and fails silently. When a
new version is found the dialog says so straight away, in a banner under the
header.

## Your Gerber files

Generation runs on stenchill.com. I reserve the right to keep your Gerber
files in some cases, notably to diagnose a problem, and some are kept as
lasting test cases, replayed on every change to the engine so that a fix never
breaks a board that used to work. They remain strictly internal and are never
shared.

Full policy: https://www.stenchill.com/privacy-policy

## Links

- [stenchill.com](https://www.stenchill.com)
- [Source and issues](https://github.com/Chewby/stenchill-easyeda-extension)
- [The KiCad plugin](https://github.com/Chewby/stenchill-kicad-plugin), same
  idea for KiCad users.

MIT licensed.
