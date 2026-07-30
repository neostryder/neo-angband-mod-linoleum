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
  manifest.txt
  maps/targets.txt      feat / trap / monster / object / flavour, by name
  maps/families.txt     shared effect metadata
  maps/pools.txt        variant pools
  tiles/monster/orc.png
  tiles/feat/granite-wall.png
```

You edit one file at a time, and the map says what it is for in words.

It also does two things a fixed sheet cannot:

- **Variant pools.** One symbol, creature or item can draw from several tiles instead
  of always the same one. Which tile a given square gets is chosen by map position, so
  it is identical on every replay of a seed — variety without breaking determinism.
- **Families.** Shared effect metadata across a group of tiles, declared once.

## Building a pack

The converter turns a conventional tileset into a loose pack:

```bash
npx @neo-angband/linoleum convert path/to/tileset --out my-pack
```

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

**Packs you build are yours.** None are redistributed here. If you convert a tileset,
the result carries whatever licence the original art carried — converting does not
change who owns it, and some tile sets do not permit modification at all. Check before
you share.

## Installing

`dist/neo-linoleum.zip` is the installable form of this mod: the manifest, this
README, the licence, and the `original-tiles` demo pack — 1508 files, 534 KB. It is
what the game's installer downloads, and it is checked against a digest the game
ships with before a single byte is unzipped.

You can also just use the folder: clone this repository into your mods directory (or
point the browser build at it with **Load mod folder**) and run
`node tools/pack.mjs --pack <a built pack>` if you want to rebuild the archive.

<details>
<summary>Why an archive rather than 1505 committed files</summary>

The demo pack is one PNG per tile. An `archive` payload is one HTTP request and one
digest; the alternative is one request per file, so a 1505-request install is not a
real option. The archive holds the *whole* mod because an installed mod's file list is
whatever the archive contained, and the game's shared validator wants a top-level
`manifest.json` from every source alike. That duplicates three text files, so
`tools/pack.mjs --verify` fails if the committed archive has drifted from the working
tree, and CI runs it on every push.

The zip is written deterministically — entries sorted, timestamps fixed, stdlib
`zlib` only — so its digest is a function of its content and rebuilding it anywhere
gives the same bytes.

</details>

## Status

The engine, the format and the demo pack are built and in use.

Third-party tile sets are a licensing question per set, not a technical one: converting
a sheet into a loose pack is a *modification* of the art, which not every tileset
licence permits. Convert your own copies freely; check before you share.

## Licence

Same dual licence as Neo Angband and Angband — GPL v2 or the Angband licence. See
[LICENSE.md](LICENSE.md).

The **art** in any pack is a separate matter from the code here, and is governed by
whatever licence that art carries.

## Credits

Built by neostryder / RPGM Tools as part of Neo Angband. Angband is the work of Ben
Harrison, James E. Wilson, Robert A. Koeneke and the Angband contributors.
