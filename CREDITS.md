# Credits and licences

This mod is two separable things, and they are not under the same terms:

- **The format, the engine and the converter**: neo-linoleum's own code and docs,
  under the same dual licence as Neo Angband and Angband. See [LICENSE.md](LICENSE.md).
- **Tile art**: never this mod's to license. Each pack carries whatever licence the
  art in it carried.

## Why this mod needs a credits file of its own

Neo Angband ships the five tile sets Angband itself distributes as **tilesheets**
(one atlas PNG per set) and credits them in
[`public/tiles/CREDITS.md`](https://github.com/neostryder/neo-angband/blob/master/packages/web/public/tiles/CREDITS.md).
That file covers the tilesheets, which is the form the game itself draws, and it is
all of that art the game's own repository holds.

A **loose pack** is the same art in a different form: one PNG per tile, cut out of
that sheet. Producing one is a second, separate use of the art, and it belongs to this
mod: nothing in the game cuts up a tilesheet unless neo-linoleum is installed. So the
attribution for the converted form lives here, and this file is inside every archive,
so it arrives with the art wherever the art goes.

## What this repository ships

All six packs the manifest declares, pre-converted, as seven archives under `dist/`:

| Archive | Contents | Source art's terms |
| --- | --- | --- |
| `neo-linoleum-mod.zip` | manifest, README, LICENSE, this file | this mod's own |
| `neo-linoleum-original-tiles.zip` | 8x8 Original | GPL v2 or the Angband licence |
| `neo-linoleum-adam-bolt.zip` | 16x16 Adam Bolt | redistributable and modifiable for any purpose |
| `neo-linoleum-gervais.zip` | 32x32 David Gervais | Creative Commons Attribution 3.0 |
| `neo-linoleum-nomad.zip` | 8x16 Nomad | GPL v2 or the Angband licence |
| `neo-linoleum-shockbolt-dark.zip` | 64x64 Shockbolt, Dark | © Raymond "Shockbolt" Gaustadnes 2012, see below |
| `neo-linoleum-shockbolt-light.zip` | 64x64 Shockbolt, Light | © Raymond "Shockbolt" Gaustadnes 2012, see below |

Measured: 9161 files and 42 MiB of loose art, 24.6 MiB as zip. The five sets' terms
differ from one another, so **do not read "shipped with neo-linoleum" as one licence.**
Angband 4.2.6's `docs/copying.rst` is the authoritative statement for all five.

The loose files are not committed; the archives are. `tools/build-packs.mjs`
reconverts them from a Neo Angband checkout and `node tools/pack.mjs --verify` proves
the committed archives match a fresh conversion. CI runs that on every push.

## The Shockbolt packs

Copyright (C) Raymond "Shockbolt" Gaustadnes 2012. **A conversion is a modification**:
it cuts one sheet into hundreds of separate images, and Angband's licence for this set
grants no right to modify it. So these two packs are not covered by that licence.

They are here under permission the author granted **Neo Angband**, for use both as the
Angband tilesheet and as separate converted tiles, conditional on the project not
profiting from sales or other income. This repository is part of Neo Angband: it is the
first-party mod that delivers the converted form, by the same author, under the same
non-commercial terms, and it exists because the game's own repository should not carry
a mod's art.

That permission does **not** travel. Not to a fork of this repository, not to a pack
extracted from one of these archives, not to another project that vendors them. **If
you want to use this tileset in a project of your own, contact the author for
permission.**

## Converting somebody else's tile set

Convert your own copies freely for your own use. Before you *share* a pack, check the
source set's licence, the same rule the Shockbolt section above is an instance of.
David Gervais' set permits modification under CC BY 3.0, so attribute him in any pack
you publish from it.

If you publish a pack, state the art's licence in it.

## Credits

Built by neostryder / RPGM Tools as part of Neo Angband. Angband is the work of Ben
Harrison, James E. Wilson, Robert A. Koeneke and the Angband contributors.
