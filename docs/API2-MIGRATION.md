# API 2 migration for Linoleum

The schema 2 manifest loads Linoleum on API 1 with `api: ">=1.0.0 <2.0.0"` and `runtime: "in-process"`. `plugin.js` continues to import `core-adapter.js`. The new twin stays outside the archive because the game has no API 2 tile registration yet.

The gap table gives each context read or callback member a destination. Its counts are:

| Status | Count |
| --- | --- |
| Moved in the running plugin | 0 |
| API 2 adapter implementation, not wired | 3 |
| Core request | 12 |

Linoleum has no controller, HUD, menu, screen, birth, frontend or regions member. It uses neither events nor hooks. The source has no `ctx.core` or raw snapshot read.

| Old member | API 2 home or Core request | Notes |
| --- | --- | --- |
| `ctx.flags` | `meta.flags`, not wired | The twin copies the resolved flags. |
| `ctx.log(message)` | `meta.log(message)`, not wired | The twin forwards diagnostic text. |
| `ctx.state.actor.player.cls.name`, `.race.name` | `view.player()`, not wired | The twin projects `KnownPlayer` to `{ cls, race }`. Its promise returns null on a result failure and rejects on a host fault. It requires `state:player.read` when wired. |
| `register(host, ctx)` | Core request R1 | The API 2 entry uses `start(mod)`. |
| `ctx.registries` via `content.tables()` | Core request R2 | JSON records lack the bound-index and ownership contract used by this policy. |
| `host.tiles.register`, `engine.hasTileDoor` | Core request R3 | Kin fill requires a policy registration. |
| `host.tiles.player`, `engine.hasPlayerDoor` | Core request R4 | Shape tiles require a player-tile declaration. |
| `fill.pack.engine`, `.menuname` | Core request R3 | The rules apply to Linoleum packs and log the pack name. |
| `fill.monsterTile(ridx)` | Core request R3 and R4 | Donor selection reads the current monster assignments. |
| `fill.objectTile(kidx)` | Core request R3 | Item donors come from the current object assignments. |
| `fill.derive(tile, hue)` | Core request R3 | Recolouring returns a tile or falls back to copying the donor. |
| `fill.fillMonster(ridx, tile)` | Core request R3 | An occupied monster slot refuses the write. |
| `fill.fillObject(kidx, tile)` | Core request R3 | An occupied object slot refuses the write. |
| `fill.transform(tile, { mirror, ramp })` | Core request R4 | The transformed tile uses a mirror and five palette colours. |
| Player provider `drawn.cls`, `.race`, `.shape`, `.level` | Core request R4 | The provider selects a level tier each frame. |

The twin exposes `meta` and `view` through `createAdapter`. The API 1 adapter keeps its internal `characterOf` helper, `content.tables()` and four engine members: `hasTileDoor`, `hasPlayerDoor`, `registerTileFiller` and `registerPlayerTile`. The synchronous pack callbacks still need tile declarations before the plugin can use the twin.

## Core requests

R1: The folder loader needs to call `api2Plugin` after checking the manifest and consent. This applies to all in-process mods. Linoleum's entry can change once Core provides tile declarations.

R2: Linoleum needs a `content.boundRecords(file)` lookup that returns monsters `{ key, index, name, base, owner, from, ext }` or objects `{ key, index, name, tval, owner, from, ext }` in bound order. `index` is the old `ridx` or `kidx`. `base` carries `base.name`, and `tval` stays numeric. `owner` names the pack that added the record. Optional `from` carries the bound record's provenance: `owner` names its defining pack, `modifiedBy` lists later patches, and `was` holds original values of changed fields. An absent `from` means Core supplied the record and no mod changed it. Linoleum fills a record only when `from` is present and `from.owner` differs from Core. A patch leaves the original owner intact. All mods can use these content facts. A temporary live `engine.registries` alias needs P-tier access.

R3: A proposed `content.declareTilePolicy` accepts a kin-fill policy with a pack engine, recipient ownership test, donor groups, hue list and opt-out keys. Linoleum supplies engine `linoleum`, monster group `base`, object group `tval`, bound-index donor order and recipients that are mod-added and unassigned. The host applies the policy after all tile assignments and returns counts for the log. The hue counter uses each donor's `{ attr, char }`, spans monster and object fills, and resets on pack load. Failed recolouring copies the donor. The opt-out keys are `linoleum:no-monster-kin-fill` and `linoleum:no-object-kin-fill`. The declaration can serve all tiers. A live `engine.tiles` filler seam is P-tier only.

R4: A proposed `content.declarePlayerTiles` accepts `{ engine, forms, classPalettes, raceHighlights, ramps, mirror }`. Linoleum supplies its existing `SHAPE_TIERS` as ordered `{ minLevel, monsterName }` candidates and sets `mirror` to true. The host builds the transformed donors once per pack load from the character palette, then reads `{ cls, race, shape, level }` for every frame. A missing donor falls back to a lower tier. A missing palette or unmatched character keeps the pack's player tile. A pack change clears the table. Existing provider load order and conflict reporting remain part of the contract. This data declaration can serve public mods too. Keeping a live callback through `engine.tiles.player` requires P-tier access.

## Removal list

The schema 2 manifest replaces `modApi` with an API range and moves the Core dependency to `dependencies.required.core.range`. The plugin keeps its runtime reads. `registry:tiles` installs both rules, and the Core dependency supplies their base content. The development packages support the joint tests. API 1 `view.player()` returns `{ cls, race }` or null synchronously. The twin returns a promise. Callers must await that promise before building shape tiles. The player read needs R4, bound registries need R2, and tile operations need R3 or R4. The eventual API 2 port needs `state:player.read`; today's manifest has no such grant.

## Verification

`pnpm test` checks the tile policy and adapter parity. The adapter tests use distinct flags objects with equal entries and check that API 1 returns a value while API 2 returns a promise. The joint tests call Core's tile door with disabled rules and a non-Linoleum pack. `node tools/pack.mjs --verify` checks the archives. A manifest edit needs `node tools/pack.mjs` to repack the six root files. Boundary fixtures cover context aliases, member-held contexts, direct flags and log reads, bare engine values, chained tile calls and CommonJS imports. The scanner allows the adapter binding and four tile calls. Quoted text stays outside the scan, including template text. Template expressions remain subject to the boundary rules. The twin rejects `ctx` identifiers outside quoted text.

The SDK's `ModApi2` type enters through JSDoc, so the adapter has no package import at runtime. The typecheck command is `node C:/Repositories/neo-angband/node_modules/typescript/bin/tsc --allowJs --checkJs --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext core-adapter-api2.js`. The changelog convention excludes internal refactoring and test additions.
