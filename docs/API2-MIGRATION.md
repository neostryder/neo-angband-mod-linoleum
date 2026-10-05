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

The twin exports `createAdapter` with only `meta` and `view`. It omits the raw-state helper `characterOf`, `content.tables()`, and the engine members `hasTileDoor`, `hasPlayerDoor`, `registerTileFiller` and `registerPlayerTile`. A complete port must also replace synchronous pack callbacks with declarations. Swapping the import alone cannot make those callbacks await a player read.

## Core requests

R1: Folder loading needs the existing `api2Plugin` wrapper called after the manifest and consent checks. The SDK checker must accept an API range on the definition. This loader change serves every in-process tier. Linoleum can change its entry only after the tile declarations also exist.

R2: The donor search needs bound order and each record's original owner. A proposed `content.boundRecords(file)` lookup returns monsters `{ key, index, name, base, owner, ext }` or objects `{ key, index, name, tval, owner, ext }`. `index` corresponds to `ridx` or `kidx`, `base` carries `base.name`, and `tval` remains numeric. A patch to a Core record keeps its Core owner. These content facts can be public. A temporary live `engine.registries` alias is P-tier only.

R3: A proposed `content.declareTilePolicy` accepts a kin-fill policy with a pack engine, recipient ownership test, donor groups, hue list and opt-out keys. Linoleum supplies engine `linoleum`, monster group `base`, object group `tval`, bound-index donor order and recipients that are mod-added and unassigned. The host applies the policy after all tile assignments and returns counts for the log. The hue counter uses each donor's `{ attr, char }`, spans monster and object fills, and resets on pack load. Failed recolouring copies the donor. The opt-out keys are `linoleum:no-monster-kin-fill` and `linoleum:no-object-kin-fill`. The declaration can serve all tiers. A live `engine.tiles` filler seam is P-tier only.

R4: A proposed `content.declarePlayerTiles` accepts `{ engine, forms, classPalettes, raceHighlights, ramps, mirror }`. Linoleum supplies its existing `SHAPE_TIERS` as ordered `{ minLevel, monsterName }` candidates and sets `mirror` to true. The host builds the transformed donors once per pack load from the character palette, then reads `{ cls, race, shape, level }` for every frame. A missing donor falls back to a lower tier. A missing palette or unmatched character keeps the pack's player tile. A pack change clears the table. Existing provider load order and conflict reporting remain part of the contract. This data declaration can serve public mods too. Keeping a live callback through `engine.tiles.player` requires P-tier access.

## Removal list

The converter removes schema 1 `modApi` and moves the Core dependency to `dependencies.required.core.range`. Runtime reads stay in place. `registry:tiles` still installs both rules, the Core dependency supplies their base content, and the development packages support the joint tests. Removing any of these now would change drawing or stop verification. The player read waits for R4, bound registries wait for R2, and tile operations wait for R3 or R4. `state:player.read` belongs to the eventual API 2 port and is absent from today's manifest.

## Verification

`pnpm test` exercises the existing tile policy and compares both adapters on the same character facts. The joint tests use Core's tile door with disabled rules and a non-Linoleum pack. The archive check is `node tools/pack.mjs --verify`. Repacking after a manifest edit uses `node tools/pack.mjs` and retains the six root files. Boundary tests cover context assertions, whitespace, engine aliases, re-exports and dynamic imports. The twin rejects every `ctx` identifier.

The SDK's `ModApi2` type enters through JSDoc, so the adapter has no package import at runtime. The typecheck command is `node C:/Repositories/neo-angband/node_modules/typescript/bin/tsc --allowJs --checkJs --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext core-adapter-api2.js`. The changelog convention excludes internal refactoring and test additions.
