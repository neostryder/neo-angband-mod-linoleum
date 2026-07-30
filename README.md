# neo-linoleum

A second tile engine for [Neo Angband](https://github.com/neostryder/neo-angband),
and the loose-pack tile format it draws.

**This is a mod.** It is not part of the game, it is off until you enable it, and
disabling it leaves the game's own graphics untouched.

## What it is not

Neo Angband already ships the four tile sets Angband itself distributes — Original,
Adam Bolt, David Gervais and Nomad. Those are **core content**: they appear in the
Graphics screen with no mod enabled, drawn by the classic tilesheet engine, exactly as
upstream. Nothing here is needed to see them, and nothing here replaces them.

## What it adds

A different way to store a tile set, and an engine that draws it.

A conventional tileset is one big image plus pixel coordinates: to change the orc you
open a 4096-pixel-wide PNG, find the orc, and edit in place. A **loose pack** is a
directory of individual images addressed by readable names:

```
my-pack/
  manifest.txt              pack id, format, resolution, which maps to read
  maps/
    targets.txt             feat / trap / monster / object / flavour, by name
    families.txt            shared effect metadata (only when authored)
    pools.txt               variant pools (only when authored)
  images/8/                 one PNG per tile, named for what it draws
    feat_granite_lit_0.png
    monster_cave_orc_0.png
  graf-*.prf, xtra-*.prf,   the source tileset's own pref files, mirrored
  flvr-*.prf                (present in a converted pack, optional in yours)
```

The `images/` subdirectory is the tile resolution in pixels — `images/8/` for an 8x8
set, `images/32/` for a 32x32 one — and it matches the `resolution:` line in
`manifest.txt`. A target map entry then names an image by base name with no path or
extension:

```
target:feat:GRANITE:asset:feat_granite_lit_0
```

You edit one file at a time, and the map says what it is for in words.

It also does two things a fixed sheet cannot:

- **Variant pools.** One symbol, creature or item can draw from several tiles instead
  of always the same one. Which tile a given square gets is chosen by map position, so
  it is identical on every replay of a seed — variety without breaking determinism.
- **Families.** Shared effect metadata across a group of tiles, declared once.

## Building a pack

The converter turns a conventional tileset into a loose pack. It lives in the main
repository and is **not published to a package registry** — it is a workspace tool, so
you run it from a clone rather than fetching it:

```bash
git clone https://github.com/neostryder/neo-angband.git
```

```bash
cd neo-angband && pnpm install && pnpm build
```

```bash
node packages/linoleum/dist/cli.js --packs original-tiles --out ./my-packs
```

`--tiles <dir>` is the tiles root to read (default `reference/lib/tiles`, the Angband
4.2.6 tree that ships in that repo), `--out <dir>` is where packs are written, and
`--packs <keys>` picks which to convert. `--help` lists the keys. It converts the six
tilesets Angband itself ships — `original-tiles`, `adam-bolt`, `gervais`, `nomad`,
`shockbolt-dark`, `shockbolt-light` — driven by each one's `graf`/`xtra`/`flvr` pref
files. To convert a tileset from somewhere else you add its geometry and pref-file
names to `ALL_PACKS` in `packages/linoleum/src/packs.ts`; there is no
arbitrary-tileset mode on the command line. And nothing stops you writing a pack by
hand — the format is text plus PNGs, and the converter is a convenience, not a
gatekeeper.

Then point a `tilePacks` entry at the result:

```json
"tilePacks": [
  { "grafID": 101, "engine": "linoleum", "menuname": "My Set", "path": "my-set" }
]
```

**`path` is relative to the mod folder**, not to the site. A mod cannot know where a
host serves it from, and for two of the three ways a mod arrives the host serves it
from nowhere at all — a folder you picked in a browser has no URL for its files until
their bytes are wrapped in a `blob:`, and a mod installed from a repository lives in
IndexedDB. The game composes your `path` with however that mod's bytes are reached, so
a pack works identically whichever way it got there. Use `grafID` >= 100 for a set of
your own; 1–6 are Angband's own numbering, and claiming one of those re-skins that row.

See
[docs/LINOLEUM.md](https://github.com/neostryder/neo-angband/blob/master/docs/LINOLEUM.md)
in the main repository for the format in full.

**Packs you build are yours, and the art in them is not ours to license.** No
converted pack is redistributed here or with the game. If you convert a tileset the
result carries whatever licence the original art carried: converting does not change
who owns it, and **a conversion is a modification** — it cuts one sheet into hundreds
of separate images — so a licence that permits redistribution but not modification does
not permit a converted pack at all. Angband's own Shockbolt set is exactly that case.
Convert your own copies freely for your own use; check the licence before you share
one. Per-set terms are in
[public/tiles/CREDITS.md](https://github.com/neostryder/neo-angband/blob/master/packages/web/public/tiles/CREDITS.md).

## Installing

`dist/neo-linoleum.zip` is the installable form of this mod: **1508 entries, 535 KiB** —
the `original-tiles` demo pack (1505 files, of which 1499 are tile PNGs) plus the
manifest, this README and the licence. It is what the game's installer downloads, and
it is checked against a digest the game ships with before a single byte is unzipped.

You can also just use the folder: clone this repository into your mods directory (or
point the browser build at it with **Load mod folder**) and run
`node tools/pack.mjs --pack <a built pack>` if you want to rebuild the archive.

<details>
<summary>Why an archive rather than 1505 committed files</summary>

The demo pack is one PNG per tile — 1499 of them. An `archive` payload is one HTTP
request and one digest; the alternative is one request per file, so a 1505-request
install is not a real option. The archive holds the *whole* mod because an installed mod's file list is
whatever the archive contained, and the game's shared validator wants a top-level
`manifest.json` from every source alike. That duplicates three text files, so
`tools/pack.mjs --verify` fails if the committed archive has drifted from the working
tree, and CI runs it on every push.

The zip is written deterministically — entries sorted, timestamps fixed, stdlib
`zlib` only — so its digest is a function of its content and rebuilding it anywhere
gives the same bytes.

</details>

## Status

**0.9.0 — complete and working, held one notch below 1.0 on purpose.** The engine, the
format, the converter and the demo pack are all built and in use, and the chain has
been measured end to end rather than assumed: the converter's 1499 output PNGs are each
pixel-identical to the cell of the source tilesheet that Angband's own `graf-*.prf`
says they came from; enabling this mod adds exactly one row to the Graphics screen and
disabling it removes that row and nothing else; and choosing that row draws the map
through the loose-pack engine — same 1110 tiled cells as the tilesheet engine on the
same view, agreeing on ~96% of map pixels, with the remainder on cell seams where the
two engines round an 8-pixel source to a fractional destination height differently.
`packages/web/src/linoleum-equivalence.test.ts` in the main repository holds the
mechanical form of the first claim for **all four** bundled tilesets, not just this one.

What 1.0 is waiting on is exposure, not a known defect: this format has been driven by
one author against four tilesets, and a version number is a promise about stability
that a pack format should not make until someone else has authored a pack with it. If
you build one and something in the format fights you, that is the feedback that moves
this to 1.0. Until then treat `manifest.txt` and the map syntax as settled-in-practice
but not frozen.

Third-party tile sets are a licensing question per set, not a technical one: converting
a sheet into a loose pack is a *modification* of the art, which not every tileset
licence permits. Convert your own copies freely; check before you share.

## Working on this repo

This repository is public, and so is the main one. A privacy scan refuses a handful
of strings in either — see `CONTRIBUTING.md` in
[neo-angband](https://github.com/neostryder/neo-angband). The scanner lives there and
is used from there rather than copied here, so there is nothing to install; point this
clone's hooks at it once:

```sh
git config core.hooksPath /path/to/neo-angband/.githooks
```

That is the gate that sees a **new** file before it is committed. The `privacy`
workflow is the later one — it reads tracked files, so by the time it can see a new
file the bytes are already published. Both, not either.

## Licence

Same dual licence as Neo Angband and Angband — GPL v2 or the Angband licence. See
[LICENSE.md](LICENSE.md).

The **art** in any pack is a separate matter from the code here, and is governed by
whatever licence that art carries.

## Credits

Built by neostryder / RPGM Tools as part of Neo Angband. Angband is the work of Ben
Harrison, James E. Wilson, Robert A. Koeneke and the Angband contributors.
