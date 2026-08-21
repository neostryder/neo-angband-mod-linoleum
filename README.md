# neo-linoleum

A second tile engine for [Neo Angband](https://github.com/neostryder/neo-angband),
and the loose-pack tile format it draws.

**This is a mod.** It is not part of the game, it is off until you enable it, and
disabling it leaves the game's own graphics untouched.

## What it is not

Neo Angband already ships the five tile sets Angband itself distributes: Original,
Adam Bolt, David Gervais, Nomad and Shockbolt, the last catalogued as two modes, Dark
and Light. Those are **core content**: all six rows appear in the Graphics screen with
no mod enabled, drawn by the classic tilesheet engine, exactly as upstream. Nothing
here is needed to see them, and nothing here replaces them.

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
    tall.txt                double-height tiles (only when the set has any)
  images/8/                 one PNG per tile, named for what it draws
    feat_granite_lit_0.png
    monster_cave_orc_0.png
  graf-*.prf, xtra-*.prf,   the source tileset's own pref files, mirrored
  flvr-*.prf                (present in a converted pack, optional in yours)
```

The `images/` subdirectory is the tile resolution in pixels: `images/8/` for an 8x8
set, `images/32/` for a 32x32 one, and it matches the `resolution:` line in
`manifest.txt`. A target map entry then names an image by base name with no path or
extension:

```
target:feat:GRANITE:asset:feat_granite_lit_0
```

You edit one file at a time, and the map says what it is for in words.

It also does two things a fixed sheet cannot:

- **Variant pools.** One symbol, creature or item can draw from several tiles instead
  of always the same one. Which tile a given square gets is chosen by map position, so
  it is identical on every replay of a seed: variety without breaking determinism.
- **Families.** Shared effect metadata across a group of tiles, declared once.
- **Double-height tiles, declared by name.** A tile listed in `maps/tall.txt` is two
  cells tall and is drawn over the cell above the one it stands in, which is how Shockbolt
  draws its larger monsters. A conventional sheet can only do this by reserving a
  band of rows in the image and telling the game which rows those are; here any tile
  can be tall, in a set with no sheet behind it at all.
- **A tile for a creature the pack has never heard of.** A mod's own monsters and
  items get a picture under these packs even though no pack was built with them in
  mind, and a picture of their own rather than a duplicate of a relative's. This
  mod supplies that; the game does not. See below.

## Tiles for modded content

**This mod needs Neo Angband 0.23.0 or newer, and 0.15.0 is where that changed.**
Everything below used to be the game's own behaviour. It is this mod's now, which
is why the whole mod asks for a newer game than it used to: the code that draws a
modded creature is here, and the door it writes through arrived in 0.23.0. If your
game is older, keep neo-linoleum 0.14.4 - the tile sets themselves are unchanged
between the two.

Why it moved: Neo Angband is a faithful port of Angband 4.2.6, and 4.2.6 has no
concept of a record a mod added, so it has no opinion about what one should look
like. "Take the picture of your nearest relative" is a judgement somebody made,
and the port does not get to make judgements. It is also a judgement about
somebody else's art - a tile set drawn in 2003 has no picture for content added
twenty years later, and a sibling's picture there is a confident lie where a letter
was the honest answer. A tile set deciding for its own art is on firmer ground, so
that is where the rule lives now.

**Under this mod's packs**, a creature or item a mod added, with no tile of its own,
is drawn from its nearest relative with the colour turned: an added monster from a
creature sharing its family, an added item from another item of its type. So a
modded ant is a recognisable ant without its author naming a single pixel
coordinate, and it is not the base game's ant either.

**Under Angband's own tile sheets, it stays a letter**, and that is deliberate
rather than a gap. Those sheets are one image cut into a fixed grid: every cell is
somebody's tile and there is no spare cell to put a variant in, so the best that
could be done there is an exact duplicate of another creature - and it is not our
art to make that call about.

What that means in practice:

- **Your added creature looks related to its family, and not identical to it.**
- **Several of them differ from each other too.** Colours are handed out per family,
  cycling through eight around the wheel, so the first eight creatures added to one
  family are all distinguishable.
- **The same mods always give the same colours.** Nothing here touches the game's
  randomness, the clock or your save.
- **Nothing you did not add is changed.** Only records a mod ADDED are given a tile
  this way, so an unmodded game draws exactly what it always drew, and a pack with
  no mods installed produces none of these at all. The game enforces the other
  half of that itself: this mod is handed a door that refuses any tile the pack or
  a pref file already assigned, so it cannot repaint your tile set even by mistake.
- **You can still choose the tile yourself.** Name an asset for your monster in a
  pref file and that wins outright.
- **You can turn it off.** "Draw modded content from its kin", in this mod's
  options, on by default. Off, modded content keeps its letter.

**If you write mods: draw your own tiles.** This is a fallback for the mods that
do not, not a substitute for drawing an orc. If you ship a mod with no art, say so
in its description and point your players here, so a letter in their dungeon is
something they were told about rather than something that looks broken.

One honest limit: turning a colour does nothing to a grey tile. If the family's tile
is stone, iron or bone, the derived one comes back the same colour it went in. The
alternative would be stamping a mark onto somebody else's art, which is a bigger lie
than a similar colour, so the limit stays. Full detail is in
[docs/LINOLEUM.md](https://github.com/neostryder/neo-angband/blob/master/docs/LINOLEUM.md)
in the main repository.

## Building a pack

The converter turns a conventional tileset into a loose pack. It lives in the main
repository and is **not published to a package registry**, because it is a workspace tool, so
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
tilesets Angband itself ships: `original-tiles`, `adam-bolt`, `gervais`, `nomad`,
`shockbolt-dark`, `shockbolt-light`, driven by each one's `graf`/`xtra`/`flvr` pref
files. To convert a tileset from somewhere else you add its geometry and pref-file
names to `ALL_PACKS` in `packages/linoleum/src/packs.ts`; there is no
arbitrary-tileset mode on the command line. And nothing stops you writing a pack by
hand, since the format is text plus PNGs, and the converter is a convenience, not a
gatekeeper.

Then point a `tilePacks` entry at the result:

```json
"tilePacks": [
  { "grafID": 101, "engine": "linoleum", "menuname": "My Set", "path": "my-set" }
]
```

**`path` is relative to the mod folder**, not to the site. A mod cannot know where a
host serves it from, and for two of the three ways a mod arrives the host serves it
from nowhere at all: a folder you picked in a browser has no URL for its files until
their bytes are wrapped in a `blob:`, and a mod installed from a repository lives in
IndexedDB. The game composes your `path` with however that mod's bytes are reached, so
a pack works identically whichever way it got there. Use `grafID` >= 100 for a set of
your own; 1 to 6 are Angband's own numbering, and claiming one of those re-skins that row.

See
[docs/LINOLEUM.md](https://github.com/neostryder/neo-angband/blob/master/docs/LINOLEUM.md)
in the main repository for the format in full.

**Packs you build are yours, and the art in them is not ours to license.** If you
convert a tileset the result carries whatever licence the original art carried:
converting does not change who owns it, and **a conversion is a modification**: it
cuts one sheet into hundreds of separate images, so a licence that permits
redistribution but not modification does not permit a converted pack at all.
Angband's own licence for the Shockbolt set is exactly that case; Neo Angband
converts and bundles it under permission its author granted that project
specifically, which does not travel to a pack you extract from a build. Convert your
own copies freely for your own use; check the licence before you share one.
[CREDITS.md](CREDITS.md) is this mod's attribution, and it is where those per-set
terms are spelled out.

## Installing

**All six packs ship here, pre-converted.** `dist/` holds seven archives, one per tile
pack, plus a small one for the manifest, this README, the licence and
[CREDITS.md](CREDITS.md):

| Archive | Files | Size |
| --- | --- | --- |
| `neo-linoleum-mod.zip` | 4 | 8 KiB |
| `neo-linoleum-original-tiles.zip` | 1505 | 0.5 MiB |
| `neo-linoleum-adam-bolt.zip` | 1503 | 0.9 MiB |
| `neo-linoleum-gervais.zip` | 1501 | 1.5 MiB |
| `neo-linoleum-nomad.zip` | 1471 | 0.5 MiB |
| `neo-linoleum-shockbolt-dark.zip` | 1590 | 10.6 MiB |
| `neo-linoleum-shockbolt-light.zip` | 1590 | 10.6 MiB |

That is 9161 files and 42 MiB of loose art, 24.6 MiB as zip. The game's installer
fetches each one and checks it against a digest built into the game *before* a single
byte is unzipped, and unpacks them into the mod's own folder, which is where the game
reads a tile pack from. Nothing about these packs lives in the game's repository.

You can also just use the folder: clone this repository into your mods directory, or
point the browser build at it with **Load mod folder**. The archives are ordinary zips,
so unzip the packs you want beside `manifest.json`, or rebuild them from source art
with `node tools/build-packs.mjs` (needs a built Neo Angband checkout at
`../neo-angband`) followed by `node tools/pack.mjs`.

<details>
<summary>Why seven archives rather than 9161 committed files, or one big zip</summary>

A loose pack is one PNG per tile. An `archive` payload is one HTTP request and one
digest; the alternative, a `files` payload, is one request per file, and 9161
requests is not an install.

Not one archive either. Measured, the whole thing is 24.6 MiB of zip: as a single blob
that is rewritten in full whenever one tile changes, and it carries one digest whose
failure says only "something in here is wrong". Per pack, a digest names which pack
failed and a fix rewrites one file.

The mod's four root files get their own archive because an installed mod's file list is
whatever its archives contained, and the game's shared validator wants a top-level
`manifest.json` from every source alike, so they have to be inside *something*, and
inside all seven they would collide (the installer rejects a path that arrives from two
archives rather than silently keeping the last one). `tools/pack.mjs --verify` fails if
any committed archive has drifted from a fresh conversion, and CI runs it on every push.

That last point has a consequence worth stating plainly, because it does not look like
one: **this README is shipped content.** `manifest.json`, `README.md`, `LICENSE.md` and
`CREDITS.md` are the four files inside `neo-linoleum-mod.zip`, so editing any of them
(even a typo fix, even a link) changes that archive's digest and makes the committed
copy stale. Re-run `node tools/pack.mjs` in the same commit. A documentation-only change
here is still a build.

The zips are written deterministically, with entries sorted, timestamps fixed, stdlib
`zlib` only, so a digest is a function of content and rebuilding anywhere gives the
same bytes. Verified: two builds into different directories produced seven identical
files.

</details>

## Status

**0.15.0: complete and working, held below 1.0 on purpose.** 0.15.0 is the first
version to carry CODE - one `plugin.js` holding the kin rule the game handed over,
with its own tests in this repository. The engine, the
format, the converter and all six packs are built and in use, and the chain has
been measured end to end rather than assumed: the converter's 1499 output PNGs are each
pixel-identical to the cell of the source tilesheet that Angband's own `graf-*.prf`
says they came from; enabling this mod adds its six Graphics rows and disabling it
removes them and nothing else, leaving the game's own six untouched; and choosing one
draws the map through the loose-pack engine, the same 1110 tiled cells as the tilesheet
engine on the same view, agreeing on ~96% of map pixels, with the remainder on cell
seams where the two engines round an 8-pixel source to a fractional destination height
differently. `packages/web/src/linoleum-equivalence.test.ts` in the main repository
holds the mechanical form of the first claim for **five** bundled packs, not just this
one, Shockbolt included, which is what turned up a comparator that cropped 64x64 out
of a double-height 64x128 tile.

What 1.0 is waiting on is exposure, not a known defect: this format has been driven by
one author against five tilesets, and a version number is a promise about stability
that a pack format should not make until someone else has authored a pack with it. If
you build one and something in the format fights you, that is the feedback that moves
this to 1.0. Until then treat `manifest.txt` and the map syntax as settled-in-practice
but not frozen.

Third-party tile sets are a licensing question per set, not a technical one: converting
a sheet into a loose pack is a *modification* of the art, which not every tileset
licence permits. Convert your own copies freely; check before you share.

## Working on this repo

This repository is public, and so is the main one. A privacy scan refuses a handful
of strings in either. See `CONTRIBUTING.md` in
[neo-angband](https://github.com/neostryder/neo-angband). The scanner lives there and
is used from there rather than copied here, so there is nothing to install; point this
clone's hooks at it once:

```sh
git config core.hooksPath /path/to/neo-angband/.githooks
```

That is the gate that sees a **new** file before it is committed. The `privacy`
workflow is the later one, because it reads tracked files, so by the time it can see a new
file the bytes are already published. Both, not either.

Since 0.15.0 there is code here as well, so there is one command to run before
pushing:

```sh
npm install && npm run verify
```

That runs the plugin's tests and then checks the committed archives under `dist/`
against a fresh build, which is what catches a manifest or a plugin edited without
the archive being rebuilt - an installed mod's files are whatever its archives held,
so a stale archive is a player running last week's code with nothing to say so.

One of those tests, `joint.node.test.mjs`, drives this mod's real `plugin.js`
through the GAME's real fill door over real tile art, which is the only place both
halves of the seam exist at once. It needs a built checkout of
[neo-angband](https://github.com/neostryder/neo-angband) beside this one (`../neo-angband`,
the same layout CI uses) and **fails** without it rather than skipping quietly. If
you have only this repository:

```sh
JOINT_OPTIONAL=1 npm test
```

## Questions, or something wrong

[**The RPGM Tools Discord**](https://discord.gg/YegtwbHTBQ) is the fastest way
to ask anything - whether a behaviour is intended, how to get this installed,
or what you should try next. No GitHub account needed.

[Open an issue here](../../issues/new/choose) for a bug in **this mod**. Two
things belong against the game instead, and the forms will point you there: the
mod **system** (an install that fails, a load order that will not stick, a
conflict report that looks wrong), and the game **not matching Angband 4.2.6**
once this mod is switched off - changing the game is what a mod is for.

For anything that should not be public, including a security report:
**strider-angband (at) rpgm.tools**. See
[SECURITY.md](https://github.com/neostryder/neo-angband/blob/master/SECURITY.md).

Asking about AI use in this project? [AI_USAGE_POLICY.md](https://github.com/neostryder/neo-angband/blob/master/AI_USAGE_POLICY.md)
in the main repository is the complete answer.

## Licence

Same dual licence as Neo Angband and Angband: GPL v2 or the Angband licence. See
[LICENSE.md](LICENSE.md).

The **art** in any pack is a separate matter from the code here, and is governed by
whatever licence that art carries.

## Credits

Built by neostryder / RPGM Tools as part of Neo Angband. Angband is the work of Ben
Harrison, James E. Wilson, Robert A. Koeneke and the Angband contributors.
