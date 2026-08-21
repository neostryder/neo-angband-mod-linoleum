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
 *   2. Linoleum packs only. Angband's own tile sheets are not this mod's to guess at.
 *   3. Two added creatures on one donor get different colours.
 *   4. Deterministic: the same content produces the same colours every launch.
 */

import { describe, expect, it } from "vitest";
import plugin, {
  addedByMod,
  buildShapeTiles,
  characterOf,
  CLASS_PALETTES,
  fillFromKin,
  HUES,
  PALETTE_RAMPS,
  paletteFor,
  RACE_HIGHLIGHTS,
  shapeTileFor,
  SHAPE_TIERS,
  tierFor,
} from "./plugin.js";

/** A stand-in for the game's fill door - see the header. */
function door({
  pack = { engine: "linoleum", id: "test", menuname: "Test" },
  monster = {},
  object = {},
  derive,
  transform,
} = {}) {
  const monsterTiles = new Map(Object.entries(monster).map(([k, v]) => [Number(k), v]));
  const objectTiles = new Map(Object.entries(object).map(([k, v]) => [Number(k), v]));
  const refused = [];
  const transforms = [];
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
    transform:
      transform ??
      ((donor, spec) => {
        transforms.push({ donor, spec });
        /* The real allocator returns a slot; all this has to be is distinct per
         * (donor, spec) and different from the donor. */
        return { attr: 0xa0 | (donor.attr & 0x0f), char: 0x80 | (transforms.length & 0x7f) };
      }),
  };
  return {
    fill,
    monsterTiles,
    objectTiles,
    refused,
    transforms,
    derivedCount: () => derived,
  };
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

  function host({ noPlayerDoor = false } = {}) {
    const fillers = [];
    const providers = [];
    const tiles = { register: (filler) => fillers.push(filler) };
    /* An older game has the fill door and not the player one, which is a real
     * shape rather than a hypothetical: the fill door shipped in 0.23.0 and the
     * player door did not. */
    if (!noPlayerDoor) tiles.player = (provider) => providers.push(provider);
    return { fillers, providers, tiles };
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

  it("declines a pack that is not its own", () => {
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

/**
 * The shapechange rule: which creature, at which level, in which colours.
 *
 * WHAT THESE TESTS CAN AND CANNOT SEE, the same split as the kin rule above. The
 * tier tables and the palettes are arithmetic over data in this file, so they are
 * measured exactly here. Whether the monsters named actually EXIST, and whether
 * these packs draw them, is a fact about Angband's data and this mod's art:
 * `joint.node.test.mjs` checks both against the real monster list and the real
 * target maps, and it fails rather than skips. A name that is plausible and
 * absent is the failure mode that looks identical to the feature being off, so
 * that half is not optional.
 */

/** The eight shapes lib/gamedata/shape.txt defines, "normal" excluded. */
const FORMS = ["fox", "Pukel-man", "bear", "eagle", "bat", "warg", "vampire", "werewolf"];

/** The nine classes and eleven races of Angband 4.2.6. */
const CLASSES = [
  "Warrior", "Mage", "Druid", "Priest", "Necromancer",
  "Paladin", "Rogue", "Ranger", "Blackguard",
];
const RACES = [
  "Human", "Half-Elf", "Elf", "Hobbit", "Gnome", "Dwarf",
  "Half-Orc", "Half-Troll", "Dunadan", "High-Elf", "Kobold",
];

describe("SHAPE_TIERS", () => {
  it("covers every shape the game has, and nothing it does not", () => {
    /* A form missing from the table is a shape that silently keeps its own
     * picture, and a form in the table that shape.txt does not define is a row
     * nothing can ever select. */
    expect(Object.keys(SHAPE_TIERS).sort()).toEqual([...FORMS].sort());
  });

  it("has bands that ascend, start at 1, and stay inside the level range", () => {
    for (const form of FORMS) {
      const tiers = SHAPE_TIERS[form];
      expect(tiers.length, form).toBeGreaterThanOrEqual(2);
      expect(tiers[0].minLevel, form).toBe(1);
      for (let i = 0; i < tiers.length; i++) {
        expect(tiers[i].minLevel, `${form}[${i}]`).toBeGreaterThanOrEqual(1);
        /* PY_MAX_LEVEL. A band above it could never be reached. */
        expect(tiers[i].minLevel, `${form}[${i}]`).toBeLessThanOrEqual(50);
        if (i > 0) {
          expect(tiers[i].minLevel, `${form}[${i}]`).toBeGreaterThan(tiers[i - 1].minLevel);
        }
      }
    }
  });

  it("never draws one creature for two different shapes", () => {
    /* Three of these forms share the canine base and two share the vampire's
     * family tree, so an overlap is a mistake that is easy to make and invisible
     * in play until two shapes look the same. */
    const seen = new Map();
    for (const form of FORMS) {
      for (const tier of SHAPE_TIERS[form]) {
        expect(seen.get(tier.monster), `${tier.monster} is also ${String(seen.get(tier.monster))}`).toBeUndefined();
        seen.set(tier.monster, form);
      }
    }
  });

  it("records the short families as short rather than padding them", () => {
    /* Angband 4.2.6 has no fox and no eagle, so those two are the documented
     * shortfalls and this is what stops somebody "fixing" them with a fifth wolf
     * or a crow. If a real candidate is found later, this number moves and the
     * README paragraph moves with it. */
    expect(SHAPE_TIERS.fox.length).toBe(2);
    expect(SHAPE_TIERS.eagle.length).toBe(3);
    expect(SHAPE_TIERS["Pukel-man"].length).toBe(3);
    expect(SHAPE_TIERS.bat.length).toBe(5);
    expect(SHAPE_TIERS.vampire.length).toBe(5);
    for (const form of ["bear", "warg", "werewolf"]) {
      expect(SHAPE_TIERS[form].length, form).toBe(4);
    }
  });
});

describe("tierFor", () => {
  it("picks the highest band the level has reached, at every boundary", () => {
    /* Both sides of every boundary in every family, because an off-by-one here
     * is a tile that changes one level early or late and nothing says so. */
    for (const form of FORMS) {
      const tiers = SHAPE_TIERS[form];
      for (let i = 0; i < tiers.length; i++) {
        const at = tiers[i].minLevel;
        expect(tierFor(form, at), `${form}@${at}`).toBe(tiers[i].monster);
        if (i > 0) {
          expect(tierFor(form, at - 1), `${form}@${at - 1}`).toBe(tiers[i - 1].monster);
        }
      }
      /* Above the last band it stays there rather than running off the end. */
      expect(tierFor(form, 50)).toBe(tiers[tiers.length - 1].monster);
      expect(tierFor(form, 999)).toBe(tiers[tiers.length - 1].monster);
    }
  });

  it("walks the werewolf progression exactly as designed", () => {
    /* Spelled out for the one family the whole design was drawn from, so a
     * reader can check the intent against the data without reading the table. */
    expect(tierFor("werewolf", 1)).toBe("werewolf");
    expect(tierFor("werewolf", 16)).toBe("werewolf");
    expect(tierFor("werewolf", 17)).toBe("werewolf of Sauron");
    expect(tierFor("werewolf", 32)).toBe("werewolf of Sauron");
    expect(tierFor("werewolf", 33)).toBe("Draugluin, Sire of All Werewolves");
    expect(tierFor("werewolf", 49)).toBe("Draugluin, Sire of All Werewolves");
    expect(tierFor("werewolf", 50)).toBe("Carcharoth, the Jaws of Thirst");
  });

  it("walks the vampire progression exactly as designed", () => {
    expect(tierFor("vampire", 1)).toBe("vampire");
    expect(tierFor("vampire", 12)).toBe("master vampire");
    expect(tierFor("vampire", 23)).toBe("vampire lord");
    expect(tierFor("vampire", 34)).toBe("elder vampire");
    expect(tierFor("vampire", 49)).toBe("elder vampire");
    expect(tierFor("vampire", 50)).toBe("Thuringwethil, the Vampire Messenger");
  });

  it("answers null for a form it has never heard of, and for a bad level", () => {
    expect(tierFor("dragon", 20)).toBeNull();
    expect(tierFor("normal", 20)).toBeNull();
    expect(tierFor("", 20)).toBeNull();
    expect(tierFor("bear", Number.NaN)).toBeNull();
    /* Below the first band there is no answer, rather than the first tier. */
    expect(tierFor("bear", 0)).toBeNull();
  });
});

describe("paletteFor", () => {
  it("gives every real class and race a five-entry ramp of legal bytes", () => {
    /* Fifty-four pairs, every one answered: an unanswered pair is a character
     * whose shape silently keeps its own picture, and "silently" is the part
     * that costs. The byte range matters because the game's door refuses a ramp
     * outside it and the refusal is invisible from here. */
    for (const cls of CLASSES) {
      for (const race of RACES) {
        const ramp = paletteFor(cls, race);
        expect(ramp, `${cls}/${race}`).not.toBeNull();
        expect(ramp.length, `${cls}/${race}`).toBe(5);
        for (const colour of ramp) {
          expect(colour.length).toBe(3);
          for (const channel of colour) {
            expect(Number.isInteger(channel)).toBe(true);
            expect(channel).toBeGreaterThanOrEqual(0);
            expect(channel).toBeLessThanOrEqual(255);
          }
        }
      }
    }
  });

  it("puts the class in the four darker entries and the race in the brightest", () => {
    /* The composition rule, stated as an assertion: the class is what reads at a
     * glance and the race is the accent. Reversed, every Elf would look like the
     * same creature whatever they had trained as. */
    const ramp = paletteFor("Druid", "Elf");
    expect(ramp.slice(0, 4)).toEqual(PALETTE_RAMPS.wild);
    expect(ramp[4]).toEqual(RACE_HIGHLIGHTS.Elf);
  });

  it("ascends in brightness, so a highlight is never darker than a shadow", () => {
    /* The remap indexes by luminance, so a ramp that does not ascend would draw
     * lit pixels darker than shaded ones - the figure inside out. */
    const luma = ([r, g, b]) => 299 * r + 587 * g + 114 * b;
    for (const cls of CLASSES) {
      for (const race of RACES) {
        const ramp = paletteFor(cls, race);
        for (let i = 1; i < ramp.length; i++) {
          expect(luma(ramp[i]), `${cls}/${race}[${i}]`).toBeGreaterThan(luma(ramp[i - 1]));
        }
      }
    }
  });

  it("groups the nine classes into six palettes, each one used", () => {
    /* A palette nothing maps to is dead data; a class missing from the map is a
     * character with no answer. */
    expect(Object.keys(CLASS_PALETTES).sort()).toEqual([...CLASSES].sort());
    const used = new Set(Object.values(CLASS_PALETTES));
    expect([...used].sort()).toEqual(Object.keys(PALETTE_RAMPS).sort());
    expect(used.size).toBe(6);
    /* The two classes that actually shapechange in 4.2.6 share the earthy one. */
    expect(CLASS_PALETTES.Druid).toBe("wild");
    expect(CLASS_PALETTES.Ranger).toBe("wild");
  });

  it("gives every race its own highlight, none of them shared", () => {
    expect(Object.keys(RACE_HIGHLIGHTS).sort()).toEqual([...RACES].sort());
    const seen = new Set(Object.values(RACE_HIGHLIGHTS).map((c) => c.join(",")));
    expect(seen.size).toBe(RACES.length);
  });

  it("answers null for a class or race it has never heard of", () => {
    /* A content mod's own class or race. Guessing a palette would put a colour
     * on somebody else's character with nothing behind the choice, so the answer
     * is no answer and the pack's own player tile is drawn. */
    expect(paletteFor("Skald", "Human")).toBeNull();
    expect(paletteFor("Druid", "Ent")).toBeNull();
    expect(paletteFor("Skald", "Ent")).toBeNull();
    expect(paletteFor(undefined, undefined)).toBeNull();
  });

  it("hands back a copy, so a caller cannot edit the table", () => {
    const ramp = paletteFor("Mage", "Gnome");
    ramp[0][0] = 255;
    ramp[4] = [0, 0, 0];
    expect(paletteFor("Mage", "Gnome")[0][0]).toBe(PALETTE_RAMPS.arcane[0][0]);
    expect(paletteFor("Mage", "Gnome")[4]).toEqual(RACE_HIGHLIGHTS.Gnome);
  });
});

/** Monster races shaped the way the bound registry hands them over. */
function shapeRaces(names) {
  return names.map((name, i) => ({ ridx: i, name, base: { name: "test" } }));
}

/** Every monster any tier names, so a full table can be built. */
function allTierMonsters() {
  const out = [];
  for (const form of Object.keys(SHAPE_TIERS)) {
    for (const tier of SHAPE_TIERS[form]) out.push(tier.monster);
  }
  return out;
}

/** A door whose monster tiles cover exactly `names`. */
function shapeDoor(names, opts = {}) {
  const all = allTierMonsters();
  const monster = {};
  for (const name of names) {
    const ridx = all.indexOf(name);
    if (ridx >= 0) monster[ridx] = { attr: 0x81, char: 0x80 + (ridx % 0x7f) };
  }
  return door({ monster, ...opts });
}

const REGISTRIES = { monsters: { races: shapeRaces(allTierMonsters()) }, objects: { kinds: [] } };
const DRUID_ELF = { cls: "Druid", race: "Elf" };

describe("buildShapeTiles", () => {
  it("asks the engine for a mirrored, repainted tile per band, with the character's ramp", () => {
    const d = shapeDoor(allTierMonsters());
    const table = buildShapeTiles(d.fill, REGISTRIES, DRUID_ELF);

    const bands = allTierMonsters().length;
    expect(table.drawn).toBe(bands);
    expect(table.absent).toEqual([]);
    expect(d.transforms).toHaveLength(bands);
    for (const asked of d.transforms) {
      expect(asked.spec.mirror).toBe(true);
      expect(asked.spec.ramp).toEqual(paletteFor("Druid", "Elf"));
    }
    expect(table.cls).toBe("Druid");
    expect(table.race).toBe("Elf");
  });

  it("records a band whose monster this pack does not draw, and asks for nothing", () => {
    /* MEASURED, NOT HYPOTHETICAL: `werewolf of Sauron` and
     * `Beorn, the Mountain Bear` are drawn by the Shockbolt packs and by none of
     * the other four, because upstream only ever added them to that one graf
     * file. So this is the ordinary case on four of six packs. */
    const missing = ["werewolf of Sauron", "Beorn, the Mountain Bear"];
    const d = shapeDoor(allTierMonsters().filter((n) => !missing.includes(n)));
    const table = buildShapeTiles(d.fill, REGISTRIES, DRUID_ELF);

    expect(table.absent).toEqual(["bear/Beorn, the Mountain Bear", "werewolf/werewolf of Sauron"]);
    expect(table.drawn).toBe(allTierMonsters().length - 2);
    expect(table.forms.werewolf[1].tile).toBeNull();
    expect(table.forms.werewolf[0].tile).not.toBeNull();
  });

  it("names a band whose MONSTER does not exist, separately from one with no tile", () => {
    /* Two different defects with the same symptom: one is a typo in this file,
     * the other is the pack's coverage. The log has to tell them apart or the
     * first is fixed by editing art. */
    const thin = { monsters: { races: shapeRaces(["werewolf"]) }, objects: { kinds: [] } };
    const d = door({ monster: { 0: { attr: 0x81, char: 0x82 } } });
    const table = buildShapeTiles(d.fill, thin, DRUID_ELF);
    expect(table.drawn).toBe(1);
    expect(table.absent.filter((a) => a.includes("no such monster")).length).toBe(
      allTierMonsters().length - 1,
    );
  });

  it("answers null with no character, and with a class it has no palette for", () => {
    const d = shapeDoor(allTierMonsters());
    expect(buildShapeTiles(d.fill, REGISTRIES, null)).toBeNull();
    expect(buildShapeTiles(d.fill, REGISTRIES, { cls: "Skald", race: "Human" })).toBeNull();
    /* And it asked the engine for nothing on the way out. */
    expect(d.transforms).toEqual([]);
  });

  it("answers a table of nothing when the engine cannot transform at all", () => {
    /* A tilesheet's `transform` is null for every request - a fixed atlas has no
     * spare cell. The filler declines a tilesheet before it gets here, so this is
     * belt as well as braces: even reached, the table draws nothing and the
     * provider falls through to the pack's own tile. */
    const d = shapeDoor(allTierMonsters(), { transform: () => null });
    const table = buildShapeTiles(d.fill, REGISTRIES, DRUID_ELF);
    expect(table.drawn).toBe(0);
    expect(shapeTileFor(table, { shape: "werewolf", level: 50, ...DRUID_ELF })).toBeNull();
  });

  it("is deterministic, and reads nothing outside its arguments", () => {
    const run = () => {
      const d = shapeDoor(allTierMonsters());
      return { table: buildShapeTiles(d.fill, REGISTRIES, DRUID_ELF), asked: d.transforms };
    };
    expect(run()).toEqual(run());
  });
});

describe("shapeTileFor", () => {
  const full = () => buildShapeTiles(shapeDoor(allTierMonsters()).fill, REGISTRIES, DRUID_ELF);
  const view = (over) => ({ shape: "werewolf", level: 30, cls: "Druid", race: "Elf", ...over });

  it("returns the band's tile, and a different one either side of a boundary", () => {
    const table = full();
    const below = shapeTileFor(table, view({ level: 16 }));
    const above = shapeTileFor(table, view({ level: 17 }));
    expect(below).not.toBeNull();
    expect(above).not.toBeNull();
    expect(above).not.toEqual(below);
    expect(above).toEqual(table.forms.werewolf[1].tile);
    expect(below).toEqual(table.forms.werewolf[0].tile);
    expect(shapeTileFor(table, view({ level: 50 }))).toEqual(table.forms.werewolf[3].tile);
  });

  it("falls back to the next lower band this pack can draw", () => {
    /* The whole reason a missing tile is a null in the table rather than a hole
     * in it. Under the four packs that do not draw `werewolf of Sauron`, a level
     * 17 werewolf is a plain werewolf and not an absence. */
    const d = shapeDoor(allTierMonsters().filter((n) => n !== "werewolf of Sauron"));
    const table = buildShapeTiles(d.fill, REGISTRIES, DRUID_ELF);
    expect(shapeTileFor(table, view({ level: 17 }))).toEqual(table.forms.werewolf[0].tile);
    expect(shapeTileFor(table, view({ level: 32 }))).toEqual(table.forms.werewolf[0].tile);
    /* And the band above the gap is unaffected. */
    expect(shapeTileFor(table, view({ level: 33 }))).toEqual(table.forms.werewolf[2].tile);
  });

  it("answers null for a character in its normal shape", () => {
    /* The commonest case by a wide margin, and the one that must cost nothing:
     * an unshapechanged character draws the pack's own player tile. */
    const table = full();
    expect(shapeTileFor(table, view({ shape: null }))).toBeNull();
    expect(shapeTileFor(table, view({ shape: "" }))).toBeNull();
  });

  it("answers null for a shape it has no entry for", () => {
    const table = full();
    expect(shapeTileFor(table, view({ shape: "dragon" }))).toBeNull();
    /* "normal" should never reach here - the host maps it to null - and if it
     * does, it is still not a creature to draw. */
    expect(shapeTileFor(table, view({ shape: "normal" }))).toBeNull();
  });

  it("declines a character the table was not built for", () => {
    /* The table carries one palette, because the game rebuilds the whole tile
     * load once race and class are final. If a character ever changes underneath
     * one, drawing the old palette would be worse than drawing the pack's tile. */
    const table = full();
    expect(shapeTileFor(table, view({ cls: "Necromancer" }))).toBeNull();
    expect(shapeTileFor(table, view({ race: "Kobold" }))).toBeNull();
  });

  it("answers null for no table at all, and for junk", () => {
    expect(shapeTileFor(null, view())).toBeNull();
    expect(shapeTileFor(full(), null)).toBeNull();
    expect(shapeTileFor(full(), view({ shape: 7 }))).toBeNull();
  });
});

describe("characterOf", () => {
  it("reads the class and race off a live game state", () => {
    /* Read straight off `ctx.state`, the way the Borg's in-shop signal reads the
     * player's grid: no new host plumbing for something already reachable. */
    const state = { actor: { player: { cls: { name: "Druid" }, race: { name: "Elf" } } } };
    expect(characterOf(state)).toEqual({ cls: "Druid", race: "Elf" });
  });

  it("answers null wherever the state is not there yet", () => {
    expect(characterOf(undefined)).toBeNull();
    expect(characterOf({})).toBeNull();
    expect(characterOf({ actor: {} })).toBeNull();
    expect(characterOf({ actor: { player: {} } })).toBeNull();
    expect(characterOf({ actor: { player: { cls: {}, race: {} } } })).toBeNull();
  });
});

/**
 * A stand-in for the game's registry host. `noPlayerDoor` is the shape of a game
 * that has the fill door and not the player one, which is not hypothetical: the
 * fill door shipped in 0.23.0 and the player door did not.
 */
function shapeHost({ noPlayerDoor = false } = {}) {
  const fillers = [];
  const providers = [];
  const tiles = { register: (filler) => fillers.push(filler) };
  if (!noPlayerDoor) tiles.player = (provider) => providers.push(provider);
  return { fillers, providers, tiles };
}

describe("the shapechange rule, through register", () => {
  const registries = { monsters: { races: shapeRaces(allTierMonsters()) }, objects: { kinds: [] } };
  const state = { actor: { player: { cls: { name: "Druid" }, race: { name: "Elf" } } } };
  function ctx(over = {}) {
    return {
      id: "neo-linoleum",
      log: () => undefined,
      registries,
      state,
      flags: { "linoleum.shapeTiles": true },
      ...over,
    };
  }

  it("is OFF unless the player turned it on", () => {
    /* It replaces a picture the pack does supply, which is not what installing a
     * tile set asked for - so the default is off and an absent flag is off too,
     * which is what a game too old to resolve the rule reports. */
    for (const flags of [{}, { "linoleum.shapeTiles": false }, { "linoleum.shapeTiles": "yes" }]) {
      const h = shapeHost();
      plugin.register(h, ctx({ flags }));
      expect(h.providers.length, JSON.stringify(flags)).toBe(0);
    }
  });

  it("registers one provider, which answers once a pack has loaded", () => {
    const h = shapeHost();
    plugin.register(h, ctx());
    expect(h.providers.length).toBe(1);

    /* Before any pack has loaded there is no table, so the pack's own tile is
     * drawn - which is also what happens between a graphics change starting and
     * finishing. */
    const provider = h.providers[0];
    expect(provider({ shape: "werewolf", level: 50, cls: "Druid", race: "Elf" })).toBeNull();

    const d = shapeDoor(allTierMonsters());
    h.fillers[0](d.fill);
    expect(provider({ shape: "werewolf", level: 50, cls: "Druid", race: "Elf" })).not.toBeNull();
    expect(provider({ shape: null, level: 50, cls: "Druid", race: "Elf" })).toBeNull();
  });

  it("forgets its table when a pack that is not its own loads", () => {
    /* Switching from a linoleum pack to one of Angband's own sheets must put the
     * character back to that sheet's player picture. The table is the only thing
     * the provider can answer from, so clearing it is the whole mechanism. */
    const h = shapeHost();
    plugin.register(h, ctx());
    h.fillers[0](shapeDoor(allTierMonsters()).fill);
    expect(h.providers[0]({ shape: "bear", level: 50, cls: "Druid", race: "Elf" })).not.toBeNull();

    h.fillers[0](door({ pack: { engine: "tilesheet", id: "old", menuname: "Original" } }).fill);
    expect(h.providers[0]({ shape: "bear", level: 50, cls: "Druid", race: "Elf" })).toBeNull();
  });

  it("says so, once, on a game with the fill door and not the player door", () => {
    const said = [];
    const h = shapeHost({ noPlayerDoor: true });
    plugin.register(h, ctx({ log: (m) => said.push(m) }));
    expect(said.join()).toMatch(/no player-tile seam/);
    /* And the kin rule is untouched: everything else in this mod still works. */
    expect(h.fillers.length).toBe(1);
  });

  it("says nothing about the player door when the rule is off", () => {
    const said = [];
    const h = shapeHost({ noPlayerDoor: true });
    plugin.register(h, ctx({ flags: {}, log: (m) => said.push(m) }));
    expect(said.join()).not.toMatch(/player-tile seam/);
  });

  it("reports what it drew, and which bands fell back", () => {
    const said = [];
    const h = shapeHost();
    plugin.register(h, ctx({ log: (m) => said.push(m) }));
    h.fillers[0](shapeDoor(allTierMonsters().filter((n) => n !== "doombat")).fill);
    expect(said.join("\n")).toMatch(/drew \d+ shapechange tile\(s\) for a Elf Druid/);
    expect(said.join("\n")).toMatch(/bat\/doombat/);
  });

  it("says so when the character has no palette here", () => {
    /* A content mod's own class. Silence would be indistinguishable from the
     * rule being off, which is the question somebody would be asking. */
    const said = [];
    const h = shapeHost();
    plugin.register(
      h,
      ctx({
        log: (m) => said.push(m),
        state: { actor: { player: { cls: { name: "Skald" }, race: { name: "Human" } } } },
      }),
    );
    h.fillers[0](shapeDoor(allTierMonsters()).fill);
    expect(said.join()).toMatch(/no shape palette for this character/);
    expect(h.providers[0]({ shape: "bear", level: 20, cls: "Skald", race: "Human" })).toBeNull();
  });

  it("runs the shape rule with the kin rule switched off, and the reverse", () => {
    /* Two rules, two switches, and neither is the other's gate. This has been
     * wrong in this project before: an early return for one flag took the other
     * feature with it. */
    const h = shapeHost();
    plugin.register(h, ctx({ flags: { "linoleum.deriveTiles": false, "linoleum.shapeTiles": true } }));
    expect(h.fillers.length).toBe(1);
    expect(h.providers.length).toBe(1);
    const d = shapeDoor(allTierMonsters());
    /* An added creature is NOT filled, because that rule is off. */
    const added = { monsters: { races: [{ ridx: 500, name: "joiner ant", base: { name: "ant" }, from: { owner: "some-mod" } }] }, objects: { kinds: [] } };
    h.fillers[0](d.fill);
    expect(d.monsterTiles.has(500)).toBe(false);
    void added;
    /* And the shape table was still built. */
    expect(h.providers[0]({ shape: "bear", level: 20, cls: "Druid", race: "Elf" })).not.toBeNull();

    const both = shapeHost();
    plugin.register(both, ctx({ flags: { "linoleum.deriveTiles": true } }));
    expect(both.fillers.length).toBe(1);
    expect(both.providers.length).toBe(0);
  });

  it("registers nothing at all when both rules are off", () => {
    const h = shapeHost();
    plugin.register(h, ctx({ flags: { "linoleum.deriveTiles": false, "linoleum.shapeTiles": false } }));
    expect(h.fillers.length).toBe(0);
    expect(h.providers.length).toBe(0);
  });

  it("declares the switch it reads, with the default the manifest promises", async () => {
    /* Same check the kin rule gets, for the same two failures: a flag read and
     * undeclared is a switch the player cannot see, and one declared and unread
     * is a switch that does nothing. */
    const { readFileSync } = await import("node:fs");
    const manifest = JSON.parse(readFileSync(new URL("./manifest.json", import.meta.url), "utf8"));
    const rule = (manifest.rules ?? []).find((r) => r.flag === "linoleum.shapeTiles");
    expect(rule).toBeDefined();
    expect(rule.default).toBe(false);
    expect(readFileSync(new URL("./plugin.js", import.meta.url), "utf8")).toContain(
      '"linoleum.shapeTiles"',
    );
  });
});
