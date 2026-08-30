# Stenchill — extension EasyEDA Pro

Génère un pochoir de pâte à souder imprimable en 3D depuis ta carte EasyEDA,
sans passer par un export Gerber manuel.

## Installation

`Advanced → Extension Manager → Import`, puis choisis le fichier `.eext`
téléchargé sur [stenchill.com](https://www.stenchill.com).

L'extension vise le **client desktop** d'EasyEDA Pro. La version web n'est pas
supportée : un navigateur applique la règle d'origine croisée, que le client
Electron n'applique pas.

## Utilisation

Ouvre ta carte, puis `Advanced → Stenchill → Generate stencil...`.

L'extension exporte les calques de pâte et le contour, les envoie à
stenchill.com, et te rend une archive contenant les STL.

## Développement

```bash
npm install
npm test          # typage + tests
npm run build     # produit build/dist/stenchill_vX.Y.Z.eext
```

Ce dossier est la **copie de travail** dans le monorepo Stenchill. Le dépôt
public d'où partent les releases est `stenchill-easyeda-extension`.

## Licence

MIT, voir [LICENSE](LICENSE).
