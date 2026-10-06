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

R1: Once the folder loader has checked the manifest and consent, it needs to call `api2Plugin`, and that holds for every in-process mod. Linoleum's entry can change after Core provides tile declarations.

R2: Linoleum needs a `content.boundRecords(file)` lookup that hands back records in bound order, monsters as `{ key, index, name, base, owner, from, ext }` and objects as `{ key, index, name, tval, owner, from, ext }`. Here `index` is what used to be `ridx` or `kidx`, `base` carries `base.name`, `tval` stays a number, and `owner` is the pack that added the record. The optional `from` describes where the bound record came from: `owner` for the pack that defined it, `modifiedBy` for the patches applied after that, and `was` for the original values of any field they changed. If `from` is missing, Core supplied the record and no mod has changed it. Linoleum only fills a record whose `from` is present and whose `from.owner` is something other than Core. A patch does not change the original owner. Any mod can use these content facts, while a temporary live `engine.registries` alias would need P-tier access.

R3: The proposed `content.declareTilePolicy` takes a kin-fill policy made up of a pack engine, a test for recipient ownership, donor groups, a hue list and opt-out keys. Linoleum would pass engine `linoleum`, monster group `base` and object group `tval`, with donors in bound-index order and recipients limited to records a mod added that have no tile assigned. The host runs the policy once every tile assignment is done and returns counts for the log. Its hue counter works from each donor's `{ attr, char }`, runs across both monster and object fills, and starts over when a pack loads. If recolouring fails, the donor is copied as it is. The opt-out keys are `linoleum:no-monster-kin-fill` and `linoleum:no-object-kin-fill`. Every tier can use the declaration, but a live `engine.tiles` filler seam would be P-tier only.

R4: The proposed `content.declarePlayerTiles` takes `{ engine, forms, classPalettes, raceHighlights, ramps, mirror }`. Linoleum passes its existing `SHAPE_TIERS` as ordered `{ minLevel, monsterName }` candidates, with `mirror` set to true. The host builds the transformed donors from the character palette once per pack load, and on every frame it reads `{ cls, race, shape, level }`. When a donor is missing, it drops to a lower tier. A missing palette or a character with no match keeps the pack's own player tile, and switching packs clears the table. The existing provider load order and conflict reporting are still part of the contract. Public mods can use this data declaration too. Keeping a live callback through `engine.tiles.player` needs P-tier access.

## Removal list

The schema 2 manifest replaces `modApi` with an API range and moves the Core dependency to `dependencies.required.core.range`. The plugin keeps its runtime reads. `registry:tiles` installs both rules, and the Core dependency supplies their base content. The development packages support the joint tests. API 1 `view.player()` returns `{ cls, race }` or null synchronously. The twin returns a promise. Callers must await that promise before building shape tiles. The player read needs R4, bound registries need R2, and tile operations need R3 or R4. The eventual API 2 port needs `state:player.read`; today's manifest has no such grant.

## Verification

`pnpm test` checks the tile policy and adapter parity. The adapter tests use distinct flags objects with equal entries and check that API 1 returns a value while API 2 returns a promise. The joint tests call Core's tile door with disabled rules and a non-Linoleum pack. `node tools/pack.mjs --verify` checks the archives. A manifest edit needs `node tools/pack.mjs` to repack the six root files. Boundary fixtures cover context aliases, member-held contexts, direct flags and log reads, bare engine values, chained tile calls and CommonJS imports. The scanner allows the adapter binding and four tile calls. Quoted text stays outside the scan, including template text. Template expressions remain subject to the boundary rules. The twin rejects `ctx` identifiers outside quoted text.

The SDK's `ModApi2` type enters through JSDoc, so the adapter has no package import at runtime. The typecheck command is `node C:/Repositories/neo-angband/node_modules/typescript/bin/tsc --allowJs --checkJs --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext core-adapter-api2.js`. The changelog convention excludes internal refactoring and test additions.
