# Nunito font notice

Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito).
Nunito is distributed under the SIL Open Font License, Version 1.1.
The complete copyright notice and license are in `public/licenses/Nunito-OFL.txt`.
Include that file with every distributed build containing the font; retain this
notice in source/asset distributions. The game is not endorsed by the font authors.

`Nunito-Variable.ttf` is the unmodified normal variable font, weights 200–1000.
Only its local filename differs from `Nunito[wght].ttf`; the font bytes, internal
names, metadata, outlines and tables are unchanged. No subsetting or conversion.

Downloaded 2026-10-08 from the official `google/fonts` repository:

- Distribution revision: `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5`.
- [Immutable font URL](https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/nunito/Nunito%5Bwght%5D.ttf).
- [Immutable license URL](https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/nunito/OFL.txt).
- [Immutable metadata URL](https://github.com/google/fonts/blob/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/nunito/METADATA.pb).
- Metadata identifies upstream source revision `8c6a9bb9732545b9ed53f29ec5e1ab0ff53c4e6f` in `googlefonts/nunito`. The downloaded binary is from the distribution revision above, not a locally rebuilt source.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `assets/fonts/Nunito-Variable.ttf` | 276932 | `bb55a5ca5c2042335b3991af27c4d0705d0ef41cac6164ac737fd8f2a1e85207` |
| `public/licenses/Nunito-OFL.txt` | 4385 | `580df76c95a1ec5ab878ceb25bb3d85c6a076804e9c970c8c6972aea775fdf65` |

The downloaded font's Git blob hash is `2ec1f4b0676c83ef33049db87b311171699e9192`, matching the official repository content response. The local license was compared byte-for-byte with its immutable upstream URL. The actual full license was read before use: it permits bundling and embedding with its copyright and license retained, prohibits sale of the font alone, retains OFL coverage of the font, and sets conditions on modified versions and author-name promotion. No Reserved Font Name is declared after the copyright statement in this included license.

Shipping: the stylesheet resolves the font through Vite's local asset pipeline;
Vite copies `public/licenses/Nunito-OFL.txt` to `licenses/Nunito-OFL.txt` in a
normal build. Primary integration should add a visible pause-menu credit:
“Nunito — The Nunito Project Authors · SIL Open Font License 1.1”, linked to
that local license using the application's base URL. The link is not added yet.
Do not add a remote font service or remove the license when packaging assets.
