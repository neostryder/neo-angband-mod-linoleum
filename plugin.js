/**
 * neo-linoleum's tile filler: a picture for content the pack has never heard of.
 *
 * WHY THIS LIVES HERE AND NOT IN THE GAME. Until Neo Angband 0.23.0 the game
 * itself did this: a mod-added monster with no tile was drawn with the tile of a
 * race sharing its `base`, and an added object kind with the tile of a kind
 * sharing its `tval`. It worked, and it was the wrong place for it. Neo Angband
 * is a faithful port of Angband 4.2.6, 4.2.6 has no concept of a record a mod
 * added, and so it has no opinion about what one should look like - "the
 * lowest-index relative's picture" is a judgement somebody made, not ported
 * behaviour. Worse, the game was making that judgement on behalf of tile sets it
 * does not own: a set drawn in 2003 has no art for content added twenty years
 * later, and a sibling's picture there is a confident lie where a letter was an
 * honest answer.
 *
 * So the game keeps the mechanism - a door that only writes where nothing has,
 * and a `derive` that recolours - and the tile set holds the policy. This file is
 * that policy, and it applies to LINOLEUM PACKS ONLY. Under Angband's own tile
 * sheets, content this mod knows nothing about stays a letter, which is the
 * honest answer for art that is not ours to guess at.
 *
 * WHAT AN AUTHOR SHOULD DO INSTEAD. Ship tiles with your content. This is a
 * fallback for the mods that do not, not a substitute for drawing an orc.
 */

/**
 * The hue rotations a derived tile takes, in the order they are handed out.
 *
 * Eight, spread around the wheel and none of them near zero, because a rotation
 * of nothing is a tile indistinguishable from its donor and that is the whole
 * failure this exists to fix. They are handed out per DONOR rather than per
 * entity, so the first eight added creatures sharing one base differ from each
 * other as well as from the base's own art; the ninth repeats the first, which
 * is a better answer than a ninth colour nobody can name.
 *
 * A HUE ROTATION IS A NO-OP ON GREY. A donor with no saturation - stone, iron,
 * bone - comes back the colour it went in, so a derived tile is distinctive
 * exactly when its donor has colour to turn. That is a limit, not a defect to
 * chase: the alternative is compositing a mark onto somebody's art, which is a
 * bigger lie than a similar colour.
 */
export const HUES = [30, 60, 90, 135, 180, 225, 270, 315];

/**
 * The pack whose content is NOT provisioned - the base game. A record with no
 * provenance is core's own and unmodified, and a record owned by `core` is
 * core's own with a mod's patch applied; neither is something a tile pack could
 * not have known about.
 */
const BASE_PACK = "core";

/** Whether a record was ADDED by a mod, rather than being core's own. */
export function addedByMod(rec) {
  return rec !== null && typeof rec === "object" && rec.from !== undefined && rec.from !== null && rec.from.owner !== BASE_PACK;
}

/** A tile's slot-independent identity, for counting variants per donor. */
function donorKey(tile) {
  return `${tile.attr}:${tile.char}`;
}

/**
 * Fill blanks for mod-added content from its nearest kin.
 *
 * Exported and pure-ish (its whole input is the fill door plus the registries)
 * so the tests can drive it without a game. `fill` refuses any index something
 * else assigned, so this cannot repaint the pack even if the rules below are
 * wrong; what it can get wrong is filling something that ought to have stayed a
 * letter, which is what the provenance check is for.
 */
export function fillFromKin(fill, registries) {
  const races = registries.monsters && registries.monsters.races ? registries.monsters.races : [];
  const kinds = registries.objects && registries.objects.kinds ? registries.objects.kinds : [];
  let monsters = 0;
  let objects = 0;

  /* How many variants a donor has handed out, which is what makes two creatures
   * sharing one base differ from each other and not only from it. */
  const handedOut = new Map();
  const variantOf = (donor) => {
    const key = donorKey(donor);
    const seen = handedOut.get(key) ?? 0;
    handedOut.set(key, seen + 1);
    const hue = HUES[seen % HUES.length];
    /* A derive the engine cannot do - a fixed atlas, or a donor whose asset this
     * pack does not own - comes back null, and a plain copy is then the best
     * answer available. It is what the game did before any of this. */
    return fill.derive(donor, hue) ?? { attr: donor.attr, char: donor.char };
  };

  /* DONORS ARE NOT RESTRICTED BY PROVENANCE, deliberately: core's art is exactly
   * what a mod's ant should borrow from. Only the RECIPIENT has to be a record a
   * mod added. Lowest index wins, and the registries are in bound order, so the
   * choice is the same every launch. */
  const monsterDonors = new Map();
  for (const race of races) {
    const tile = fill.monsterTile(race.ridx);
    if (tile && !monsterDonors.has(race.base.name)) monsterDonors.set(race.base.name, tile);
  }
  for (const race of races) {
    if (!addedByMod(race) || fill.monsterTile(race.ridx)) continue;
    const donor = monsterDonors.get(race.base.name);
    if (!donor) continue;
    if (fill.fillMonster(race.ridx, variantOf(donor))) monsters += 1;
  }

  const objectDonors = new Map();
  for (const kind of kinds) {
    const tile = fill.objectTile(kind.kidx);
    if (tile && !objectDonors.has(kind.tval)) objectDonors.set(kind.tval, tile);
  }
  for (const kind of kinds) {
    if (!addedByMod(kind) || fill.objectTile(kind.kidx)) continue;
    const donor = objectDonors.get(kind.tval);
    if (!donor) continue;
    if (fill.fillObject(kind.kidx, variantOf(donor))) objects += 1;
  }

  return { monsters, objects };
}

export default {
  api: 1,

  register(host, ctx) {
    /* An older game has no tile door at all. Say so once rather than throwing:
     * every tile pack in this mod still works, and the fallback art is the only
     * thing missing. */
    if (!host || !host.tiles || typeof host.tiles.register !== "function") {
      ctx.log("this game has no tile-filling seam, so modded content keeps its letter");
      return;
    }
    if (ctx.flags && ctx.flags["linoleum.deriveTiles"] === false) return;

    host.tiles.register((fill) => {
      /* NOT OUR ART TO GUESS AT. A linoleum pack is this mod's, converted or
       * hand-authored, and a fill there is a decision we are entitled to make.
       * A tilesheet is Angband's own fixed atlas, where the honest answer for
       * content it predates is the letter the game would draw anyway. */
      if (fill.pack.engine !== "linoleum") return;
      const registries = ctx.registries;
      /* Before Neo Angband 0.23.0 a plugin could not ask what the game was made
       * of, so there is nothing to walk and nothing to fill. */
      if (!registries) return;
      const filled = fillFromKin(fill, registries);
      if (filled.monsters > 0 || filled.objects > 0) {
        ctx.log(
          `drew ${filled.monsters} added creature(s) and ${filled.objects} added item(s) ` +
            `from their nearest kin in ${fill.pack.menuname}`,
        );
      }
    });
  },
};
