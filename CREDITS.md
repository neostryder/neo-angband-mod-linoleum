# Credits and licences

This mod is two separable things, and they are not under the same terms:

- **The format, the engine and the converter** — neo-linoleum's own code and docs,
  under the same dual licence as Neo Angband and Angband. See [LICENSE.md](LICENSE.md).
- **Tile art** — never this mod's to license. Each pack carries whatever licence the
  art in it carried.

## Why this mod needs a credits file of its own

Neo Angband ships the five tile sets Angband itself distributes as **tilesheets** —
one atlas PNG per set — and credits them in
[`public/tiles/CREDITS.md`](https://github.com/neostryder/neo-angband/blob/master/packages/web/public/tiles/CREDITS.md).
That file covers the tilesheets, which is the form the game itself draws.

A **loose pack** is the same art in a different form: one PNG per tile, cut out of
that sheet. Producing one is a second, separate use of the art, and it belongs to this
mod — nothing in the game cuts up a tilesheet unless neo-linoleum is enabled. So the
attribution for the converted form lives here, and beside the packs themselves:
Neo Angband's `scripts/gen-linoleum-demo.mjs` writes a `CREDITS.md` into
`public/mods/neo-linoleum/` alongside every pack it converts. Wherever the loose
files go the credit goes with them.

## What this repository actually ships

`dist/neo-linoleum.zip` contains one built pack: **`original-tiles`**, the 8x8
original Angband tileset, converted. That art is part of the Angband distribution and
is released under the GNU General Public License version 2, or the Angband licence —
the project's standard dual licence — so a converted copy may be redistributed here.

**No other pack is shipped, and no Shockbolt or Gervais art is in this repository.**
The manifest declares all six rows because a player who builds those packs should get
a Graphics row for them; a declared pack that is not present simply falls back to
ASCII.

## Converting somebody else's tile set

**A conversion is a modification.** It cuts one sheet into hundreds of separate
images, so a licence that permits redistribution but not modification does not permit
a converted pack at all. Converting does not change who owns the art.

Convert your own copies freely for your own use. Before you *share* a pack, check the
source set's licence. Two cases worth naming:

- **David Gervais' 32x32 tiles** — Creative Commons Attribution 3.0, which permits
  modification. Attribute him in any pack you publish.
- **Shockbolt's 64x64/128x64 tiles** — copyright (C) Raymond "Shockbolt" Gaustadnes
  2012. Angband's licence for this set grants **no right to modify it**, so a
  converted pack is not covered by that licence. Neo Angband converts and bundles it
  under permission the author granted **that project specifically**, for use both as
  the Angband tilesheet and as separate converted tiles, conditional on the project
  remaining non-commercial. That permission is Neo Angband's. It does not travel to a
  fork, to this mod as used elsewhere, or to a pack extracted from a Neo Angband
  build. **If you want to use this tileset in a project of your own, contact the
  author for permission.**

If you publish a pack, state the art's licence in it.

## Credits

Built by neostryder / RPGM Tools as part of Neo Angband. Angband is the work of Ben
Harrison, James E. Wilson, Robert A. Koeneke and the Angband contributors.
