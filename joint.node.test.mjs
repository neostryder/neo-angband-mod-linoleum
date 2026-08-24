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

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import plugin, { SHAPE_TIERS, paletteFor, shapeTileFor, tierFor } from "./plugin.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const GAME = join(HERE, "..", "neo-angband");
const CORE_PACK = join(GAME, "packages", "content", "pack");
const TILES = join(GAME, "packages", "web", "public", "tiles");
const TUTORIALS = join(GAME, "samples", "tutorials");
const CONVERTER = join(GAME, "packages", "linoleum", "dist", "index.js");

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
    const hues = lino.derivedSlots(
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
    expect(hues.stats()).toEqual({ derived: 2, transformed: 0, overflow: 0 });
    expect({
      monsters: map.monster.filter(Boolean).length,
      objects: map.object.filter(Boolean).length,
    }).toEqual({ monsters: before.monsters + 1, objects: before.objects + 1 });

    /* And it said what it did, because a silent fill is indistinguishable from
     * none when somebody is trying to work out why their mod is a letter. */
    expect(logs.join()).toMatch(/drew 1 added creature\(s\) and 1 added item\(s\)/u);

    /* ----------------------------------------------------------------------- *
     * THE SHAPECHANGE RULE, over the same real registry, the same real door and
     * the same real slot allocator. Everything in `plugin.test.mjs` about it is
     * arithmetic over a hand-built door; this is the half where the monster
     * names have to resolve in a registry somebody else built and the tiles have
     * to be slots the engine really allocated.
     * ----------------------------------------------------------------------- */
    const shapeLogs = [];
    const shapeProviders = [];
    const shapeRegistry = new TileFillerRegistry((owner, why) => problems.push(`${owner}: ${why}`));
    const shapeAlloc = lino.derivedSlots(
      Array.from({ length: slots }, (_, i) => ({ kind: "asset", asset: `slot-${i}` })),
    );
    const door = shapeRegistry.forOwner("neo-linoleum");
    plugin.register(
      {
        tiles: {
          register: (filler) => door.register(filler),
          player: (provider) => {
            shapeProviders.push(provider);
            door.player(provider);
          },
        },
      },
      {
        id: "neo-linoleum",
        flags: { "linoleum.deriveTiles": false, "linoleum.shapeTiles": true },
        log: (m) => shapeLogs.push(m),
        registries: { monsters, objects },
        state: { actor: { player: { cls: { name: "Druid" }, race: { name: "Elf" } } } },
      },
    );
    expect(shapeProviders).toHaveLength(1);

    /* A fresh map, so the shape rule is measured over the pack's own assignments
     * and not over the two the kin rule added above. */
    const shapeMap = new core.TileMap();
    for (const f of [...prefs].sort((a, b) =>
      a.startsWith("graf-") ? -1 : b.startsWith("graf-") ? 1 : a.localeCompare(b),
    )) {
      const body = text(f);
      if (body !== null) core.parseTilePrefsInto(shapeMap, body, { ...deps, loadFile: text });
    }
    shapeRegistry.run(
      shapeMap,
      { engine: "linoleum", id: "joint", menuname: dir },
      shapeAlloc.derive,
      shapeAlloc.transform,
    );
    expect(problems).toEqual([]);

    /* Every band of every form that this pack can draw got a real slot, and the
     * engine allocated one per (donor, spec) - so the count of transformed slots
     * is the count of distinct creatures drawn, not the count of requests. */
    const bands = Object.values(SHAPE_TIERS).reduce((n, tiers) => n + tiers.length, 0);
    const stats = shapeAlloc.stats();
    expect(stats.derived).toBe(0);
    expect(stats.overflow).toBe(0);
    expect(stats.transformed).toBeGreaterThan(0);
    expect(stats.transformed).toBeLessThanOrEqual(bands);
    expect(shapeLogs.join()).toMatch(/drew \d+ shapechange tile\(s\) for a Elf Druid/u);

    /* THE ONE END-TO-END CLAIM: a level 50 Elf Druid in werewolf form draws a
     * slot that mirrors and repaints Carcharoth's own tile in that character's
     * palette - resolved from the real registry, allocated by the real engine. */
    const view = { shape: "werewolf", level: 50, cls: "Druid", race: "Elf" };
    const drawn = shapeRegistry.playerTile(view);
    expect(drawn, "no tile for a level 50 werewolf").not.toBeNull();
    const carcharoth = monsters.races.find((r) => r.name === "Carcharoth, the Jaws of Thirst");
    expect(carcharoth, "Carcharoth is not in the monster registry").toBeDefined();
    expect(shapeAlloc.slots()[lino.slotFromAtlas(drawn)]).toEqual({
      kind: "transformed",
      from: lino.slotFromAtlas(shapeMap.monster[carcharoth.ridx]),
      spec: { mirror: true, ramp: paletteFor("Druid", "Elf") },
    });
    /* Not the character's usual figure, and not Carcharoth's own tile either. */
    expect(drawn).not.toEqual(shapeMap.monster[0]);
    expect(drawn).not.toEqual(shapeMap.monster[carcharoth.ridx]);

    /* Unshapechanged, and a character the table was not built for, both fall
     * through to whatever the pack drew - which is the whole fallback story. */
    expect(shapeRegistry.playerTile({ ...view, shape: null })).toBeNull();
    expect(shapeRegistry.playerTile({ ...view, cls: "Necromancer" })).toBeNull();

    /* A level 1 werewolf is a plain werewolf, and a different slot. */
    const low = shapeRegistry.playerTile({ ...view, level: 1 });
    expect(low).not.toBeNull();
    expect(low).not.toEqual(drawn);

    /* The kin rule was OFF for this pass, so nothing was filled: two switches,
     * neither gating the other. */
    expect(shapeMap.monster[ant.ridx]).toBeUndefined();
  });
});

/**
 * The shapechange tables against the data they are claims about.
 *
 * WHY THIS IS NOT IN `plugin.test.mjs`. Every tier in `SHAPE_TIERS` is an
 * assertion that a monster with that exact name exists in Angband 4.2.6 and that
 * these packs draw it. A name that is plausible and absent resolves to no race,
 * resolves to no tile, and draws nothing - which looks exactly like the rule
 * being switched off, so it could sit undetected for a long time. Nothing inside
 * this repository can check it: the monster list is the game's, and the built
 * packs used to be gitignored output. They are now generated only when a player
 * selects a tilesheet, so this measurement builds a throwaway loose-pack tree
 * from this mod's staged source atlases with the host converter. That encoder and
 * the browser's on-demand converter share `planTilesheetConversion`, which owns
 * the target maps this check measures. It still FAILS rather than skips.
 */
describe("the shape tiers against real Angband data", () => {
  const SHAPES = join(GAME, "reference", "lib", "gamedata", "shape.txt");
  const MONSTERS = join(GAME, "reference", "lib", "gamedata", "monster.txt");
  const data = existsSync(SHAPES) && existsSync(MONSTERS);

  /** Every `name:` value in one of upstream's own gamedata files. */
  const namesIn = (path) => {
    const out = new Set();
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      if (line.startsWith("name:")) out.add(line.slice(5));
    }
    return out;
  };

  it("has upstream's own gamedata to measure against", () => {
    if (!data) {
      const why = `needs upstream gamedata under ${join(GAME, "reference", "lib", "gamedata")}`;
      if (optional) {
        console.warn(`[joint] SKIPPED - ${why}`);
        return;
      }
      throw new Error(`${why}. Run with JOINT_OPTIONAL=1 to skip it locally; CI has it.`);
    }
    expect(data).toBe(true);
  });

  it("names every shape shape.txt defines, and only those", () => {
    if (!data) return;
    /* "normal" is the un-shapechanged state and has no creature to draw. Every
     * other shape in the file must have a table, or that form silently keeps the
     * pack's own player picture with nothing saying so. */
    const shapes = [...namesIn(SHAPES)].filter((n) => n !== "normal");
    expect([...shapes].sort()).toEqual(Object.keys(SHAPE_TIERS).sort());
  });

  it("names only monsters that really exist, spelled exactly as monster.txt spells them", () => {
    if (!data) return;
    const monsters = namesIn(MONSTERS);
    const missing = [];
    for (const form of Object.keys(SHAPE_TIERS)) {
      for (const tier of SHAPE_TIERS[form]) {
        if (!monsters.has(tier.monster)) missing.push(`${form}/${tier.monster}`);
      }
    }
    /* Named in the failure rather than counted, because the fix is a spelling and
     * the message should be the spelling. */
    expect(missing).toEqual([]);
  });

  it("draws every tier from a monster the shipped packs can actually draw", { timeout: 60_000 }, async () => {
    /* The preceding joint checks already report the real reason a checkout is
     * absent. JOINT_OPTIONAL is only for that no-sibling-checkout case; once the
     * game is here this measurement is never optional. */
    if (!built || !art || !data) return;
    if (!existsSync(CONVERTER)) {
      throw new Error(
        `needs the built host converter at ${CONVERTER} (run pnpm build in ${GAME})`,
      );
    }

    const manifest = JSON.parse(readFileSync(join(HERE, "manifest.json"), "utf8"));
    const declared = manifest.tilePacks;
    if (!Array.isArray(declared) || declared.length === 0) {
      throw new Error("manifest.json declares no tilesheet packs to measure");
    }

    /* This is the host's Node encoder, not the retired mod build output. It
     * reads the exact staged bytes a player downloads and writes a fresh loose
     * tree, including every cropped PNG. Its maps come from the same shared plan
     * that linoleum-cache.ts uses before Canvas crops those source bytes in the
     * browser. */
    const linoleum = await import(pathToFileURL(CONVERTER).href);
    const outputRoot = mkdtempSync(join(tmpdir(), "neo-linoleum-shape-tiers-"));
    const coverage = new Map();
    try {
      for (const declaredPack of declared) {
        const source = declaredPack?.tilesheet;
        if (
          typeof declaredPack?.path !== "string" ||
          source === null ||
          typeof source !== "object" ||
          typeof source.key !== "string" ||
          typeof source.packId !== "string" ||
          typeof source.displayName !== "string" ||
          typeof source.image !== "string" ||
          !Array.isArray(source.prefFiles) ||
          typeof source.resolution !== "number"
        ) {
          throw new Error("each manifest tilePacks entry needs a complete tilesheet source declaration");
        }

        const sourceDir = dirname(source.image);
        if (source.prefFiles.some((path) => typeof path !== "string" || dirname(path) !== sourceDir)) {
          throw new Error(`${source.key}: tilesheet image and pref files must share one staged directory`);
        }
        const prefFiles = source.prefFiles.map((path) => basename(path));
        if (prefFiles.length === 0) throw new Error(`${source.key}: tilesheet source declares no pref files`);

        /* Match browserLinoleumConverter's PackConfig, but point its source
         * directory at this mod's staged archive rather than the host's bundled
         * tiles. No pre-converted pack is read or reused. */
        const config = {
          key: source.key,
          packId: source.packId,
          displayName: source.displayName,
          sourceMode: source.key,
          sourceDirectory: join(declaredPack.path, sourceDir),
          imageFile: basename(source.image),
          resolution: source.resolution,
          ...(source.tileWidth === undefined ? {} : { tileWidth: source.tileWidth }),
          ...(source.tileHeight === undefined ? {} : { tileHeight: source.tileHeight }),
          ...(source.overdrawRow === undefined ? {} : { overdrawRow: source.overdrawRow }),
          ...(source.overdrawMax === undefined ? {} : { overdrawMax: source.overdrawMax }),
          primaryPref: prefFiles[0],
          prefFiles,
        };
        const sourceRoot = join(HERE, config.sourceDirectory);
        if (!existsSync(join(sourceRoot, config.imageFile))) {
          throw new Error(
            `${source.key}: needs staged source art at ${sourceRoot} (node tools/build-packs.mjs)`,
          );
        }
        for (const prefFile of config.prefFiles) {
          if (!existsSync(join(sourceRoot, prefFile))) {
            throw new Error(`${source.key}: staged source is missing ${prefFile} under ${sourceRoot}`);
          }
        }
        linoleum.buildPackExport(config, HERE, outputRoot);

        /* Which monsters this freshly converted pack assigns an actual cropped
         * image to. The selector's casing comes from graf-*.prf rather than
         * monster.txt, hence the fold. */
        const targets = join(outputRoot, config.key, "maps", "targets.txt");
        const drawn = new Set();
        for (const line of readFileSync(targets, "utf8").split(/\r?\n/)) {
          const m = /^target:monster:([^:]+):asset:([^:]+)$/u.exec(line);
          if (m) {
            const [, monster, asset] = m;
            expect(
              existsSync(join(outputRoot, config.key, "images", String(config.resolution), `${asset}.png`)),
              `${config.key}/${monster} maps to a missing converted image`,
            ).toBe(true);
            drawn.add(monster.toLowerCase());
          }
        }
        coverage.set(config.key, drawn);
      }
    } finally {
      rmSync(outputRoot, { recursive: true, force: true });
    }
    expect(coverage.size, "no declared source archive produced a target map").toBeGreaterThan(0);

    const gaps = [];
    for (const [pack, drawn] of coverage) {
      for (const form of Object.keys(SHAPE_TIERS)) {
        for (const tier of SHAPE_TIERS[form]) {
          if (!drawn.has(tier.monster.toLowerCase())) gaps.push(`${pack}/${tier.monster}`);
        }
      }
    }

    /* THE MEASURED GAP, recorded rather than tolerated silently. Two monsters
     * added in 4.2.x were only ever added to Shockbolt's graf file upstream, so
     * four (Beorn) or three (the werewolf) of the six packs have no picture for
     * them and the tier walks down to the band below. Anything ELSE appearing
     * here is a name this mod chose badly, which is the case worth failing on.
     * README.md carries the same two names. */
    const expected = [
      "adam-bolt/Beorn, the Mountain Bear",
      "adam-bolt/werewolf of Sauron",
      "gervais/Beorn, the Mountain Bear",
      "nomad/Beorn, the Mountain Bear",
      "nomad/werewolf of Sauron",
      "original-tiles/Beorn, the Mountain Bear",
      "original-tiles/werewolf of Sauron",
    ];
    expect([...gaps].sort()).toEqual(
      expected.filter((e) => coverage.has(e.slice(0, e.indexOf("/")))).sort(),
    );

    /* And every form still has a drawable band at level 1 in every pack, which
     * is what makes the walk-down a degradation rather than a hole. */
    for (const [pack, drawn] of coverage) {
      for (const form of Object.keys(SHAPE_TIERS)) {
        const first = SHAPE_TIERS[form][0];
        expect(drawn.has(first.monster.toLowerCase()), `${pack}/${form}`).toBe(true);
      }
    }
  });

});
