/**
 * The kin policy, which is this mod's and not the game's.
 *
 * WHAT THESE TESTS CAN AND CANNOT SEE. The fill door (`TileFill`) belongs to the
 * game's front end and is not a published package, so the door below is a stand-in
 * written against the documented contract: reads answer with what is assigned,
 * `fill*` writes only where nothing is and returns false otherwise, and `derive`
 * may answer null. If the real door ever stops matching this one, these tests go
 * green against a shape the game does not have - so the GAME's own
 * `tile-fillers.node.test.ts` runs a filler of exactly this shape against real
 * packs and real content, which is the half this cannot do. Two halves, and each
 * one names the other.
 *
 * WHAT MUST NOT DRIFT, in order of how much it would cost a player:
 *
 *   1. Only records a MOD ADDED are filled. Core's blanks are core's business:
 *      rings and mushrooms are drawn by flavour and are blank on purpose, and a
 *      2003 tile set has no art for content added since. A sibling's picture
 *      there is a confident lie where a letter is an honest answer. The game no
 *      longer enforces this - it used to - so this file is the only thing that
 *      does.
 *   2. Linoleum packs only. Angband's own tile sheets are not ours to guess at.
 *   3. Two added creatures on one donor get different colours.
 *   4. Deterministic: the same content produces the same colours every launch.
 */

import { describe, expect, it } from "vitest";
import plugin, { fillFromKin, HUES, addedByMod } from "./plugin.js";

/** A stand-in for the game's fill door - see the header. */
function door({ pack = { engine: "linoleum", id: "test", menuname: "Test" }, monster = {}, object = {}, derive } = {}) {
  const monsterTiles = new Map(Object.entries(monster).map(([k, v]) => [Number(k), v]));
  const objectTiles = new Map(Object.entries(object).map(([k, v]) => [Number(k), v]));
  const refused = [];
  let derived = 0;
  const fill = {
    pack,
    monsterTile: (ridx) => monsterTiles.get(ridx) ?? null,
    objectTile: (kidx) => objectTiles.get(kidx) ?? null,
    fillMonster: (ridx, tile) => {
      if (monsterTiles.has(ridx)) {
        refused.push(`monster:${ridx}`);
        return false;
      }
      monsterTiles.set(ridx, tile);
      return true;
    },
    fillObject: (kidx, tile) => {
      if (objectTiles.has(kidx)) {
        refused.push(`object:${kidx}`);
        return false;
      }
      objectTiles.set(kidx, tile);
      return true;
    },
    derive:
      derive ??
      ((donor, hue) => {
        derived += 1;
        /* The real allocator returns a slot; all this has to be is distinct per
         * (donor, hue) and different from the donor. */
        return { attr: 0xc0 | (donor.attr & 0x0f), char: hue };
      }),
  };
  return { fill, monsterTiles, objectTiles, refused, derivedCount: () => derived };
}

const CORE = { owner: "core" };
const MOD = { owner: "some-mod" };

/** Races shaped the way the bound registry hands them over. */
function races(...rows) {
  return rows.map((r, i) => ({ ridx: i, name: r.name, base: { name: r.base }, ...(r.from ? { from: r.from } : {}) }));
}
function kinds(...rows) {
  return rows.map((r, i) => ({ kidx: i, name: r.name, tval: r.tval, ...(r.from ? { from: r.from } : {}) }));
}

describe("addedByMod", () => {
  it("is true only for a record a mod added", () => {
    expect(addedByMod({})).toBe(false);
    /* A core record a mod PATCHED is stamped with core's own ownership, and it is
     * still core's record: the tile set drew it and knows what it looks like. */
    expect(addedByMod({ from: CORE })).toBe(false);
    expect(addedByMod({ from: MOD })).toBe(true);
    expect(addedByMod(null)).toBe(false);
  });
});

describe("fillFromKin", () => {
  it("gives an added creature its family's picture, recoloured", () => {
    const registries = {
      monsters: { races: races({ name: "giant ant", base: "ant" }, { name: "joiner ant", base: "ant", from: MOD }) },
      objects: { kinds: kinds({ name: "Soft Leather", tval: 36 }, { name: "Quilted Coat", tval: 36, from: MOD }) },
    };
    const d = door({ monster: { 0: { attr: 0x81, char: 0x82 } }, object: { 0: { attr: 0x83, char: 0x84 } } });

    expect(fillFromKin(d.fill, registries)).toEqual({ monsters: 1, objects: 1 });

    /* Filled from the kin, and NOT identical to it - the whole point of asking
     * for a derived tile rather than copying one. */
    expect(d.monsterTiles.get(1)).toBeDefined();
    expect(d.monsterTiles.get(1)).not.toEqual(d.monsterTiles.get(0));
    expect(d.objectTiles.get(1)).not.toEqual(d.objectTiles.get(0));
    expect(d.derivedCount()).toBe(2);
  });

  it("leaves core's own blanks alone", () => {
    /*
     * The rule the game used to hold and now does not. A flavoured kind (a ring)
     * is blank by design, and an old pack is blank for content it predates - and
     * neither is something this mod gets to fill in.
     */
    const registries = {
      monsters: { races: races({ name: "giant ant", base: "ant" }, { name: "hill orc", base: "orc" }) },
      objects: { kinds: kinds({ name: "Soft Leather", tval: 36 }, { name: "Ring of Power", tval: 45 }, { name: "Mushroom", tval: 80, from: CORE }) },
    };
    const d = door({ monster: { 0: { attr: 0x81, char: 0x82 } }, object: { 0: { attr: 0x83, char: 0x84 } } });
    expect(fillFromKin(d.fill, registries)).toEqual({ monsters: 0, objects: 0 });
    expect(d.monsterTiles.has(1)).toBe(false);
    expect(d.objectTiles.has(1)).toBe(false);
    expect(d.objectTiles.has(2)).toBe(false);
    expect(d.derivedCount()).toBe(0);
  });

  it("never asks for a tile something already assigned", () => {
    /* The door would refuse it anyway, which is the game's guarantee. This is
     * this mod holding its own end: an author who named a tile in a pref file
     * has already answered the question. */
    const registries = {
      monsters: { races: races({ name: "giant ant", base: "ant" }, { name: "joiner ant", base: "ant", from: MOD }) },
      objects: { kinds: kinds() },
    };
    const named = { attr: 0x8f, char: 0x8f };
    const d = door({ monster: { 0: { attr: 0x81, char: 0x82 }, 1: named } });
    expect(fillFromKin(d.fill, registries)).toEqual({ monsters: 0, objects: 0 });
    expect(d.refused).toEqual([]);
    expect(d.monsterTiles.get(1)).toEqual(named);
  });

  it("gives creatures on one donor different colours, cycling after eight", () => {
    const rows = [{ name: "giant ant", base: "ant" }];
    for (let i = 0; i < 9; i += 1) rows.push({ name: `mod ant ${i}`, base: "ant", from: MOD });
    const registries = { monsters: { races: races(...rows) }, objects: { kinds: kinds() } };
    const hues = [];
    const d = door({
      monster: { 0: { attr: 0x81, char: 0x82 } },
      derive: (donor, hue) => {
        hues.push(hue);
        return { attr: 0xc0, char: hue };
      },
    });

    expect(fillFromKin(d.fill, registries).monsters).toBe(9);
    expect(hues.slice(0, 8)).toEqual([...HUES]);
    /* The ninth repeats the first, which is a better answer than a ninth colour
     * nobody can name. */
    expect(hues[8]).toBe(HUES[0]);
  });

  it("counts variants per DONOR, so two families do not share a cycle", () => {
    const registries = {
      monsters: {
        races: races(
          { name: "giant ant", base: "ant" },
          { name: "hill orc", base: "orc" },
          { name: "mod ant", base: "ant", from: MOD },
          { name: "mod orc", base: "orc", from: MOD },
        ),
      },
      objects: { kinds: kinds() },
    };
    const seen = [];
    const d = door({
      monster: { 0: { attr: 0x81, char: 0x82 }, 1: { attr: 0x81, char: 0x90 } },
      derive: (donor, hue) => {
        seen.push([donor.char, hue]);
        return { attr: 0xc0, char: hue };
      },
    });
    fillFromKin(d.fill, registries);
    /* Each family's first variant takes the FIRST hue. A single global counter
     * would have given the orc the second one, which is a colour chosen by how
     * many ants happened to load first. */
    expect(seen).toEqual([
      [0x82, HUES[0]],
      [0x90, HUES[0]],
    ]);
  });

  it("copies the donor plainly when the engine cannot derive", () => {
    /* A fixed atlas has no spare cell for a variant, and even a loose pack cannot
     * recolour a donor whose asset it does not own. A copy is then the best answer
     * available, and it is what the game did before any of this existed. */
    const registries = {
      monsters: { races: races({ name: "giant ant", base: "ant" }, { name: "mod ant", base: "ant", from: MOD }) },
      objects: { kinds: kinds() },
    };
    const donor = { attr: 0x81, char: 0x82 };
    const d = door({ monster: { 0: donor }, derive: () => null });
    expect(fillFromKin(d.fill, registries).monsters).toBe(1);
    expect(d.monsterTiles.get(1)).toEqual(donor);
    /* A copy, not the same object: a shared reference would let one write move two tiles. */
    expect(d.monsterTiles.get(1)).not.toBe(donor);
  });

  it("fills nothing when the family has no tile to lend", () => {
    const registries = {
      monsters: { races: races({ name: "mod wyrm", base: "dragon", from: MOD }) },
      objects: { kinds: kinds({ name: "Mod Wand", tval: 65, from: MOD }) },
    };
    const d = door();
    expect(fillFromKin(d.fill, registries)).toEqual({ monsters: 0, objects: 0 });
  });

  it("is deterministic", () => {
    const build = () => {
      const registries = {
        monsters: {
          races: races(
            { name: "giant ant", base: "ant" },
            { name: "mod ant a", base: "ant", from: MOD },
            { name: "mod ant b", base: "ant", from: MOD },
          ),
        },
        objects: { kinds: kinds() },
      };
      const d = door({ monster: { 0: { attr: 0x81, char: 0x82 } } });
      fillFromKin(d.fill, registries);
      return [...d.monsterTiles.entries()];
    };
    expect(build()).toEqual(build());
  });

  it("survives a host that hands over half a registry set", () => {
    /* `races` is optional on the game's own deps type, and a headless or partly
     * built session can hand over less than a full set. Filling nothing is right;
     * throwing would cost the player every tile in the pack. */
    const d = door();
    expect(fillFromKin(d.fill, {})).toEqual({ monsters: 0, objects: 0 });
    expect(fillFromKin(d.fill, { monsters: {}, objects: {} })).toEqual({ monsters: 0, objects: 0 });
  });
});

describe("register", () => {
  const registries = {
    monsters: { races: races({ name: "giant ant", base: "ant" }, { name: "mod ant", base: "ant", from: MOD }) },
    objects: { kinds: kinds() },
  };

  function host() {
    const fillers = [];
    return { fillers, tiles: { register: (filler) => fillers.push(filler) } };
  }
  function ctx(over = {}) {
    return { id: "neo-linoleum", log: () => undefined, registries, flags: {}, ...over };
  }

  it("registers one filler, which fills a linoleum pack", () => {
    const h = host();
    plugin.register(h, ctx());
    expect(h.fillers.length).toBe(1);

    const d = door({ monster: { 0: { attr: 0x81, char: 0x82 } } });
    h.fillers[0](d.fill);
    expect(d.monsterTiles.has(1)).toBe(true);
  });

  it("declines a pack that is not ours", () => {
    /* The one place this mod says "not my art to guess at". Under Angband's own
     * tile sheets a modded creature keeps its letter, on purpose. */
    const h = host();
    plugin.register(h, ctx());
    const d = door({
      pack: { engine: "tilesheet", id: "old", menuname: "Original Tiles" },
      monster: { 0: { attr: 0x81, char: 0x82 } },
    });
    h.fillers[0](d.fill);
    expect(d.monsterTiles.has(1)).toBe(false);
  });

  it("does nothing on a host that cannot say what the game is made of", () => {
    /* Before Neo Angband 0.23.0 there was no ctx.registries, so there is nothing
     * to walk. Silence rather than a throw: every tile pack still works. */
    const h = host();
    plugin.register(h, ctx({ registries: undefined }));
    const d = door({ monster: { 0: { attr: 0x81, char: 0x82 } } });
    h.fillers[0](d.fill);
    expect(d.monsterTiles.has(1)).toBe(false);
  });

  it("registers nothing, and says so, on a host with no tile seam", () => {
    const said = [];
    plugin.register({}, ctx({ log: (m) => said.push(m) }));
    expect(said.join()).toMatch(/no tile-filling seam/);
  });

  it("honours the player's switch", () => {
    const h = host();
    plugin.register(h, ctx({ flags: { "linoleum.deriveTiles": false } }));
    expect(h.fillers.length).toBe(0);
  });

  it("declares the switch it reads, with the default the manifest promises", async () => {
    /* A flag read by the code and absent from the manifest is a switch the player
     * cannot see; one in the manifest and unread is a switch that does nothing.
     * Both have shipped in this project, so the two are compared. */
    const { readFileSync } = await import("node:fs");
    const manifest = JSON.parse(readFileSync(new URL("./manifest.json", import.meta.url), "utf8"));
    const flags = (manifest.rules ?? []).map((r) => r.flag);
    expect(flags).toContain("linoleum.deriveTiles");
    expect(readFileSync(new URL("./plugin.js", import.meta.url), "utf8")).toContain(
      '"linoleum.deriveTiles"',
    );
    expect(manifest.capabilities).toContain("registry:tiles");
    expect(manifest.facets).toContain("plugin");
  });
});
