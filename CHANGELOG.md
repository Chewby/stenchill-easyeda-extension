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
- Project names in any script are kept in the archive's filename. A Chinese or
  Cyrillic name used to vanish entirely and fall back to `stencil`, and an
  accented one came out cut in half.
- Out-of-range settings are written back to the form, so the value you see is
  the value that was used.
- Deadlines on the version check and on the share, so neither can hang.
- The update check works at all. It never sent the API key that the route
  requires, so it answered 401 and the extension stayed silent for ever.

Requires the EasyEDA Pro desktop client. See
[RELEASE_NOTES_26.8.1.md](RELEASE_NOTES_26.8.1.md) for the details and the
known limitations.
