# Changelog

All notable changes to this mod are recorded here. Versions follow the mod's own
`manifest.json`, which is what the game reads, and each released version has a
matching git tag that an install pins itself to.

An entry has to matter to somebody using the mod. Documentation wording,
internal refactoring and test-only additions are not recorded here, with one
standing exception this mod cannot avoid: `README.md`, `LICENSE.md` and
`CREDITS.md` ship inside `neo-linoleum-mod.zip`, so a wording fix there changes
an archive's bytes and reaches a player only through a release. Those are
recorded, because the release exists for them.

This file is not one of the archived root files, so editing it does not
invalidate an archive.

Starting with this entry, an entry opens with one or more bracketed tags.
`[Visible]` marks a change a player would notice in the game or mod itself;
`[Internal]` marks one that touches only code, tooling, or a maintainer's own
workflow, with nothing for a player to see. A further tag (`[Security]`,
`[Balance]`, `[UI]`, `[Modding-API]`, `[Localization]`, `[Save-Compat]`,
`[Docs]`, `[Content]`, `[Compatibility]`, and others as they come up) names
what kind of change it is. Lists appear in this order and each is omitted
when empty for a release: Added, Changed, Removed, Fixed. Earlier entries
were not retagged.

## Unreleased

## 1.1.0 - 2026-08-28

### Changed

- **The manifest id is `linoleum`, not `neo-linoleum`.** The "neo-" prefix
  existed only because the id used to leak into what a player saw before the
  game's own display-name handling was fixed; once that no longer happens,
  the plain id is what this mod was always meant to be called. An existing
  install migrates automatically - the game's rename map carries the enabled
  choice, any rule choices, and load-order entries across under the new id,
  the same mechanism that handled this mod's *previous* rename in the other
  direction. Nothing else changes: the six tile-pack archives keep their
  `neo-linoleum-*.zip` names, since a shipped filename is not the same
  question as the id a player's save records.

## 1.0.1 - 2026-08-27

### Fixed

- The six tile packs' `cacheKey` values were left at `0.17.0` when 1.0.0
  bumped `manifest.json`'s version and engine floor, so the shipped
  `neo-linoleum-mod.zip` still reported version `0.17.0` and engine
  `>=0.34.0` internally. Both now match the outer manifest.
- README's Releasing section wrongly claimed a patch-only bump stays quiet.
  Every tag posts a Discord announcement regardless of version-bump size,
  which is what the announcement workflow has always done.

## 1.0.0 - 2026-08-26

### Changed

- `manifest.json`'s version and engine floor move to 1.0.0, matching the
  host game's own public release.

## 0.17.0

### Changed

- The six selectable Graphics rows now ship their compact source tilesheets and
  pref texts, not 9,149 pre-sliced PNGs. The game converts a pack only when that
  row is first selected, then caches the same loose output locally. Gervais now
  installs as a four-entry source archive rather than an archive beyond the
  installer's entry limit.
- Shockbolt Dark and Light share their one upstream atlas in a single source
  archive, avoiding a duplicate 17 MiB PNG.
- `manifest.json`'s engine floor moves to `>=0.34.0`, the version the on-demand
  tilesheet conversion above needs; the shapechange rule's own floor (0.27.0)
  was already inside it.

## 0.16.1

Added a Terms of Use and a shared Code of Conduct alongside the existing
LICENSE and AI usage policies, and a README screenshot of the extra
Graphics-menu rows. Rebuilt `dist/neo-linoleum-mod.zip` to match.

## 0.16.0

### Added

- **A shapechanged character is drawn as the creature.** Angband 4.2.6 gives the
  Druid eight shapes and draws none of them: a character in bear form is still
  the tile set's usual figure, which is upstream's own behaviour and the game's
  to keep. Under this mod's packs the map now draws the closest real creature for
  that form instead, mirrored, and repainted from a five-entry palette picked
  from the character's class and race. Which creature depends on level, so a
  werewolf form runs from a plain werewolf to Carcharoth. No new art: every form
  already had a creature in these packs, and the tile is that creature's own
  picture transformed at render time.
- One switch, "Draw a shapechanged character as the creature", **off by
  default**. The other rule in this mod fills a tile that would otherwise be a
  letter, so it can only add; this one replaces the picture the pack draws for
  your character, which is not what installing a tile set asked for.
- `PLANNED.md`, which records what is intended or incomplete so the changelog
  does not. Its first entry is this feature: it is wired and measured end to end
  and has never been watched rendering, so "it draws correctly" is a claim this
  repository does not yet make.
- The tier tables are checked against Angband's own `monster.txt` and against
  every shipped pack's target map on each push. A creature name that is
  plausible and absent draws nothing, which looks exactly like the switch being
  off, so that check is not optional.

### Known gaps

- The shapechange rule needs a player-tile seam the game first shipped in
  0.27.0. `manifest.json` still asks for `>=0.23.0`, which is what the other
  rule needs; on an older game the switch does nothing, everything else works
  unchanged, and the log says so once.
- Two creatures the tiers name have no tile in some packs. `werewolf of Sauron`
  and `Beorn, the Mountain Bear` were added to Angband in 4.2.x and only ever
  added to Shockbolt's own pref file upstream, so under Original Tiles, Adam Bolt
  and Nomad neither has one, and under Gervais the bear has none. Those bands
  fall back to the tier below rather than to nothing.
- The fox has two tiers and the eagle three, because 4.2.6 contains no fox, no
  vulpine monster base and no eagle. `README.md` names the candidates that were
  considered for each and why they were rejected.

## 0.15.1

### Fixed

- The install section said the game checks each archive against a digest built
  into the game before a byte is unzipped. It does not, and no digests ship in
  the build. The installer fetches each archive from a pinned tag and records the
  SHA-256 of the bytes that arrived, which is what later tells you whether an
  installed pack has changed since it was installed. What stops the download
  changing under you is the tag.
- The archive contents table, and two paragraphs below it, still described
  `neo-linoleum-mod.zip` as four files and 8 KiB. It has carried `plugin.js`
  since 0.15.0, so it is five files and 15 KiB.
- Prose that spoke as a group and called the converted art "ours" now names its
  subject. A converted tileset is not this mod's to license, and a public
  repository that reads as a team reads as something it is not.

### Changed

- The six tile archives are byte-identical to 0.15.0, so a player already holding
  them re-downloads no art. Only `neo-linoleum-mod.zip` moves.

## 0.15.0 - 2026-08-20

### Added

- **This mod decides what a modded creature looks like, and the game no longer
  does.** Neo Angband up to 0.22.0 drew a mod-added monster with the tile of a
  race sharing its base, and an added item with the tile of a kind sharing its
  tval. That rule did not belong in the game: Angband 4.2.6 has no concept of a
  record a mod added, so a faithful port has no opinion about what one should
  look like, and it was a judgement about art the game does not own. 0.23.0
  removed it and left a seam. This fills the seam, with the recolour the rule
  always wanted, and applies it to **linoleum packs only**. Under Angband's own
  fixed tile sheets an added creature keeps its letter, because a fixed atlas has
  no spare cell for a variant.
- One switch, "Draw modded content from its kin", on by default.
- The first version of this mod to carry code, so the first with tests. Sixteen,
  on the two things that would cost a player if they drifted: that only records a
  mod added get filled, which the game used to enforce and now does not, and that
  two creatures sharing one donor get different colours.

## 0.14.4 - 2026-08-20

### Fixed

- Plain ASCII punctuation across `README.md`, `CREDITS.md` and `LICENSE.md`:
  forty-one rewordings, with em-dashes reworded away rather than swapped for
  another mark, and the multiplication signs in the tile-dimension table turned
  into the plain `x` the README already used two sections earlier.
- Documents what a mod's own creatures and items draw here, naming which game
  version each half needs rather than describing both as available.

### Changed

- Only `neo-linoleum-mod.zip` moved. The six tile archives rebuild byte for byte
  identical from the same pack directories, so no art is re-downloaded.

## 0.14.3 - 2026-08-19

### Fixed

- Rebuilt `neo-linoleum-mod.zip`, which had gone stale when the README was edited
  without it. The rule is now written into the README's own build section rather
  than being something a red CI run teaches you: touch any archived root file and
  re-run `node tools/pack.mjs` in the same commit.
- The Status heading still read 0.9.1, several releases on.

## 0.14.2 - 2026-08-15

### Fixed

- Rebuilt the archive so that it matches `manifest.json`. 0.14.1 normalised line
  endings in the manifest and shipped an archive built before it, so the two
  disagreed. 0.14.1 was never tagged, and this release supersedes it.

## 0.14.0 - 2026-08-13

### Added

- **The packs say which tiles are two cells tall.** A tile drawn by this engine
  could not tell the game that it overdraws the cell above it, so every Shockbolt
  monster in these packs was squashed into one cell: Guardian Naga, Large Kobold,
  Spirit Naga and 244 others, plus the five shop entrances in the dark pack. The
  game had been asking Angband's own graphics-mode catalogue, keyed by a mode id
  these packs do not have. The converter now writes `maps/tall.txt` naming every
  asset it cropped two cells tall, and the manifest declares it. 252 assets in
  shockbolt-dark, 247 in shockbolt-light, none in the other four, which is right,
  because no other source mode declares a band.
- Recorded per asset rather than per sheet row, because that is what a loose pack
  can express, and because it lets a hand-authored set have a tall tile with no
  source sheet at all.

### Fixed

- Rebuilt from current game data, which caught a second drift: these archives
  predated the game's gamedata correction, so the nomad pack still carried Sip of
  Miruvor and Draught of the Ents, objects that exist in upstream master and not
  in Angband 4.2.6, the version this game ports.

### Requires

- A game build that asks the pack for its overdraw band. Older builds ignore the
  declaration and draw these packs as they did before.

## 0.13.0 - 2026-08-06

### Added

- `manifest.json` declares its `repository`. This is the field an import reads:
  install the mod from a `.zip` and the copy on disk pins itself to the
  repository its own manifest names. Without it an imported copy binds to
  `file:import`, and the update check has no repository to ask.

### Changed

- `author` is `neostryder` rather than `neostryder (RPGM Tools)`, which nested
  brackets in the mod list row and read as two names for one person in the detail
  pane.

## 0.12.1 - 2026-08-03

### Fixed

- **The mod declares its payload, which for this mod is mandatory rather than
  tidy.** The game asks a repository what it contains and works the rest out from
  the file list, and what it cannot work out is that `dist/*.zip` are packs to
  unpack rather than files to store. Found by a canary running real discovery
  against this repository, which reported eleven files guessed: seven archives
  that would have installed shut. The three code mods need no declaration,
  because the fallback guess produces exactly their files, which is the point of
  the fallback.

## 0.12.0 - 2026-08-01

### Changed

- The description is rewritten as short paragraphs. The previous one was long
  enough to squeeze the mod manager's list down to a single visible row with no
  way to scroll it.

## 0.11.0 - 2026-07-31

### Fixed

- **All six tile archives were stale, and the local check could not see it.** The
  engine's package rename changed one line the converter writes at the head of
  every generated map file, so packs built before it carry a stamp naming a
  package that no longer exists. The local build skipped any pack whose directory
  already existed, so the verify step compared the committed archives against a
  cache built by the old converter, agreed with itself, and reported all seven up
  to date. CI has no cache, converted from scratch, and disagreed on six.
- The skip is now converter-aware: it reads the stamp out of a built pack and
  rebuilds when it does not match the loaded converter, and rebuilds outright
  when the converter is too old to say rather than guessing.
- The rebuilt archives hash identically to what CI computed from its own fresh
  conversion on a different machine and operating system, which is the packer's
  determinism claim standing up to the test it had just failed to be given.

## 0.10.0 - 2026-07-31

### Fixed

- `engine` ranged over Angband's version rather than this port's. The field is
  evaluated against the port's own version, so the manifest as written would now
  be refused. It is now a permissive range on purpose: `modApi` is the
  exact-match gate for the plugin ABI, which is what makes a loose engine range
  the right shape here.

## 0.9.1 - 2026-07-30

### Added

- **All six tile packs ship here, because the packs are this mod's art and not
  the game's.** The game's build used to generate 9161 PNGs into its own output
  and serve them from its own origin, which put a mod's resources inside the
  game. The game now holds no pack bytes and no step that makes any.
- Seven archives rather than one. Measured, the whole thing is 24.6 MiB of zip; a
  single blob is rewritten in full for a one-tile change and carries one digest
  whose failure says only that something inside is wrong. Per pack, a failure
  names the pack.
- Determinism verified rather than assumed: two builds into different directories
  produced seven byte-identical files.
- The Shockbolt packs are here for the first time, under the same permission
  already recorded in `CREDITS.md` and `LICENSE.md`.

### Changed

- Pack building fails on missing source art instead of skipping it. A skipped
  pack is a Graphics row that silently draws ASCII, which is the failure this mod
  exists to prevent.

## 0.9.0 - 2026-07-30

### Fixed

- **The README taught a pack layout the engine cannot read**, showing
  `tiles/monster/orc.png` and an unconditional `maps/pools.txt` where the real
  format is `images/<resolution>/<asset>.png` with a pools file only when a pack
  authors pools. Anyone following it built a pack that resolved to nothing.
- The install command named a package that has never been published, a subcommand
  that does not exist and a positional path the tool does not read. Corrected to
  the real invocation.
- The converter handles the six tilesets Angband ships, driven by their pref
  files, and not "any legacy tileset", which was an over-claim in the README and
  in the manifest description. The honest consolation is that the format is text
  plus PNGs, so a hand-authored pack needs no converter at all.

### Changed

- Held at 0.9.0 rather than 1.0.0. Nothing here is known to be broken and the
  chain is measured end to end, but a version number is a promise about format
  stability, and this format has been driven by one author against four tilesets.
- The licensing note now says the thing that bites: converting a tileset to the
  loose-pack format is a modification of that art, so a set whose licence forbids
  modification cannot ship in this format without the artist's permission.

## Before 0.9.0 - 2026-07-30

- Extracted from the game's monorepo so the mod is developed, versioned and
  reported against on its own. The manifest was unchanged, so the mod the game
  loaded was the same mod. No tile art was redistributed at this point.
