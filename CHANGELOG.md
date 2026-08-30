# Changelog

## 26.8.1 — 2026-08-30

First release.

- Exports the top paste, bottom paste and board outline layers from the open
  board, with no manual Gerber export.
- Sends them to stenchill.com and follows the generation live: progress, queue
  position, and a Cancel that actually closes the stream.
- Saves the result as `<project>_<date>_<time>.zip`.
- Opens the stencil in 3D on stenchill.com, carrying your settings so the page
  shows the one you saved.
- Nine settings in three groups matching the website and the KiCad plugin, each
  with a help panel, remembered between runs.
- Interface in English and Simplified Chinese, following EasyEDA Pro's own
  language setting.

Requires the EasyEDA Pro desktop client. See
[RELEASE_NOTES_26.8.1.md](RELEASE_NOTES_26.8.1.md) for the details and the
known limitations.
