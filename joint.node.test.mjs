/**
 * The joint: THIS repository's real `plugin.js`, driven through THE GAME's real
 * fill door, over the game's real tile packs and real content.
 *
 * WHY IT EXISTS. `plugin.test.mjs` drives the policy through a stand-in door
 * written from the documentation, and the game's `tile-fillers.node.test.ts`
 * drives a filler shaped like this one through the real door. Both can be green
 * while the two halves disagree about the door's actual shape - which is the
 * failure mode this project has hit repeatedly under other names, and the reason
 * "wired" and "watched" are tracked separately.
 *
 * This is the only place both halves exist at once. The mod's CI already checks
 * out and builds the game (it needs the converter and the source art), so the
 * sibling checkout is present there, and this test is not a hiding place: when
 * the checkout is missing it FAILS unless `JOINT_OPTIONAL=1` is set, which is for
 * a developer who has only this repository.
 *
 * It imports the game's TypeScript SOURCE rather than its build output, because
 * the compiled web bundle uses extensionless relative imports (Vite resolves
 * them, node does not). Vitest transpiles it, and the door module imports nothing
 * from core at runtime - only types - so there is no second engine instance in
 * play.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import plugin from "./plugin.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const GAME = join(HERE, "..", "neo-angband");
const CORE_PACK = join(GAME, "packages", "content", "pack");
const TILES = join(GAME, "packages", "web", "public", "tiles");
const TUTORIALS = join(GAME, "samples", "tutorials");

const built = existsSync(join(GAME, "packages", "web", "src", "tile-registry.ts"));
const art = existsSync(TILES) && readdirSync(TILES).length > 0;
const optional = process.env["JOINT_OPTIONAL"] === "1";

describe("the real plugin against the real door", () => {
  it("has the game checkout it measures against", () => {
    /* Named separately so a missing checkout reads as "this test could not run"
     * rather than as a mod defect, and so that it cannot be silent. */
    if (!built || !art) {
      const why =
        `needs a built sibling checkout at ${GAME} ` +
        `(tile-registry.ts: ${String(built)}, generated tile art: ${String(art)})`;
      if (optional) {
        console.warn(`[joint] SKIPPED - ${why}`);
        return;
      }
      throw new Error(
        `${why}. Run with JOINT_OPTIONAL=1 to skip it locally; CI has both.`,
      );
    }
    expect(built && art).toBe(true);
  });

  /* 60s: this one imports the whole engine and parses a pack's entire pref set,
   * where every other test in this repository is arithmetic over a fixture. */
  it("fills a tutorial mod's monster and item, and declines a tilesheet", { timeout: 60_000 }, async () => {
    if (!built || !art) return;

    const core = await import("@rpgm-tools/neo-angband-core");
    const sdk = await import("@rpgm-tools/neo-angband-mod-sdk");
    const { TileFillerRegistry } = await import(
      join(GAME, "packages", "web", "src", "tile-registry.ts")
    );
    const lino = await import(join(GAME, "packages", "web", "src", "linoleum-pack.ts"));

    const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
    const packFile = (n) => readJson(join(CORE_PACK, `${n}.json`));
    const packRecords = (n) => packFile(n).records;
    const tutorial = (dir, files) => ({
      manifest: sdk.validateManifest(readJson(join(TUTORIALS, dir, "manifest.json"))),
      files: Object.fromEntries(files.map((f) => [f, readJson(join(TUTORIALS, dir, `${f}.json`))])),
    });
    const corePack = (files) => ({
      manifest: { id: "core", name: "Angband", version: "1.0.0", shape: "content" },
      files: Object.fromEntries(files.map((f) => [f, packFile(f)])),
    });

    /* REAL composition: core's own records plus two tutorial mods, through the
     * game's own composer, so the added records carry the provenance the policy
     * reads rather than a fixture agreeing with it. */
    const composed = sdk.composeContentPacks([
      corePack(["monster", "monster_base", "object"]),
      tutorial("tutorial-03-add-a-monster", ["monster"]),
      tutorial("tutorial-02-add-an-item", ["object"]),
    ]);
    expect(composed.problems).toEqual([]);

    const monsters = new core.MonsterRegistry({
      pain: packRecords("pain"),
      blowMethods: packRecords("blow_methods"),
      blowEffects: packRecords("blow_effects"),
      monsterSpells: packRecords("monster_spell"),
      monsterBases: packRecords("monster_base"),
      monsters: composed.records["monster"],
      summons: packRecords("summon"),
      pits: packRecords("pit"),
    });
    const objects = new core.ObjRegistry({
      objectBase: packFile("object_base"),
      object: { records: composed.records["object"] },
      egoItem: packFile("ego_item"),
      artifact: packFile("artifact"),
      curse: packFile("curse"),
      brand: packFile("brand"),
      slay: packFile("slay"),
      activation: packFile("activation"),
      objectProperty: packFile("object_property"),
      flavor: packFile("flavor"),
    });
    /* Real traps, because the pref parser stops at the first line it cannot
     * resolve: without them the map is empty 200 lines before the monsters and
     * every measurement below is vacuous. */
    const deps = {
      features: new core.FeatureRegistry(packRecords("terrain")),
      objects,
      monsters,
      traps: core.bindTraps(packRecords("trap")),
    };

    /* One real shipped pack, read the way loadTilePrefs reads it. */
    const dir = readdirSync(TILES, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .find((name) => readdirSync(join(TILES, name)).some((f) => f.startsWith("graf-")));
    expect(dir, "no shipped pack carries a graf-*.prf").toBeDefined();
    const packDir = join(TILES, dir);
    const text = (n) => (existsSync(join(packDir, n)) ? readFileSync(join(packDir, n), "utf8") : null);
    const map = new core.TileMap();
    const prefs = readdirSync(packDir).filter((f) => f.endsWith(".prf"));
    for (const f of [...prefs].sort((a, b) =>
      a.startsWith("graf-") ? -1 : b.startsWith("graf-") ? 1 : a.localeCompare(b),
    )) {
      const body = text(f);
      if (body !== null) core.parseTilePrefsInto(map, body, { ...deps, loadFile: text });
    }
    /* The pack really loaded. Without this the rest passes hardest when the
     * parse failed, because an empty map has no donor to borrow from. */
    expect(map.monster.filter(Boolean).length).toBeGreaterThan(500);

    const ant = monsters.races.find((r) => r.name === "carpenter ant");
    const jerkin = objects.kinds.find((k) => k.name === "Padded Jerkin~");
    expect(ant, "the tutorial monster is not in the registry").toBeDefined();
    expect(jerkin, "the tutorial item is not in the registry").toBeDefined();
    expect(map.monster[ant.ridx]).toBeUndefined();
    expect(map.object[jerkin.kidx]).toBeUndefined();
    const before = {
      monsters: map.monster.filter(Boolean).length,
      objects: map.object.filter(Boolean).length,
    };

    /* A slot table that owns every tile the pack assigned, which is the shape a
     * real loose-pack index has. */
    const slots = 1 + Math.max(
      ...map.monster.filter(Boolean).map(lino.slotFromAtlas),
      ...map.object.filter(Boolean).map(lino.slotFromAtlas),
    );
    const hues = lino.hueDerivedSlots(
      Array.from({ length: slots }, (_, i) => ({ kind: "asset", asset: `slot-${i}` })),
    );

    const problems = [];
    const logs = [];
    const registry = new TileFillerRegistry((owner, why) => problems.push(`${owner}: ${why}`));
    plugin.register({ tiles: registry.forOwner("neo-linoleum") }, {
      id: "neo-linoleum",
      flags: {},
      log: (m) => logs.push(m),
      registries: { monsters, objects },
    });

    /* A tilesheet pack is declined outright: not this mod's art to guess at. */
    const sheet = registry.run(map, { engine: "tilesheet", id: dir, menuname: dir }, null);
    expect({ ...sheet, fillers: 1 }).toEqual({ fillers: 1, monsters: 0, objects: 0, refused: 0 });
    expect(map.monster[ant.ridx]).toBeUndefined();

    /* Its own engine fills, and fills exactly the two added records. */
    const out = registry.run(map, { engine: "linoleum", id: "joint", menuname: dir }, hues.derive);
    expect(problems).toEqual([]);
    expect({ monsters: out.monsters, objects: out.objects }).toEqual({ monsters: 1, objects: 1 });
    /* Nothing was even offered where the pack had drawn - the policy checks before
     * it asks - so no write was refused. */
    expect(out.refused).toBe(0);

    /* The ant's tile is a NEW slot drawing its family's asset recoloured, and the
     * jerkin's likewise. Nothing else in the map moved. */
    const antTile = map.monster[ant.ridx];
    const donor = monsters.races.find(
      (r) => r.base.name === ant.base.name && r.ridx !== ant.ridx && map.monster[r.ridx],
    );
    expect(donor, "no other ant carries a tile in this pack").toBeDefined();
    expect(antTile).not.toEqual(map.monster[donor.ridx]);
    const antSlot = hues.slots()[lino.slotFromAtlas(antTile)];
    expect(antSlot).toEqual({
      kind: "derived",
      from: lino.slotFromAtlas(map.monster[donor.ridx]),
      hue: 30,
    });
    expect(hues.stats()).toEqual({ derived: 2, overflow: 0 });
    expect({
      monsters: map.monster.filter(Boolean).length,
      objects: map.object.filter(Boolean).length,
    }).toEqual({ monsters: before.monsters + 1, objects: before.objects + 1 });

    /* And it said what it did, because a silent fill is indistinguishable from
     * none when somebody is trying to work out why their mod is a letter. */
    expect(logs.join()).toMatch(/drew 1 added creature\(s\) and 1 added item\(s\)/u);
  });
});
