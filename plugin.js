/**
 * Linoleum's tile policy: a picture for content the pack has never heard of,
 * and a picture for a character who is currently a wolf.
 *
 * Two rules, one file, one capability (registry:tiles), and the same argument
 * behind both: what a tile set draws for something its art was never made for is
 * the tile set's call, not the game's. The first rule fills a blank; the second
 * replaces the player's own tile while a shapechange is running. They share
 * nothing but the door they arrive through, and each has its own switch.
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
 * honest answer for art that is not this mod's to guess at.
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

/* ------------------------------------------------------------------------- *
 * A SHAPECHANGED PLAYER, DRAWN AS THE CREATURE
 *
 * Angband 4.2.6 gives the Druid eight shapes (lib/gamedata/shape.txt: fox,
 * Pukel-man, bear, eagle, bat, warg, vampire, werewolf, plus "normal"), and
 * every one of them changes what the character IS without changing what the
 * character looks like: the map still draws the pack's `<player>` tile. That is
 * upstream's own behaviour and core keeps it, because 4.2.6 has no per-shape
 * player picture and inventing one in the port would be the port adding
 * something. A tile set is entitled to have an opinion about its own art, so the
 * opinion lives here.
 *
 * WHAT IT DRAWS. The tile of the closest real monster for that form, mirrored
 * horizontally and repainted from a palette chosen by the character's class and
 * race. No new art: every form has a creature already in the game with a tile
 * already in these packs, and the two transforms are what stop it reading as
 * "there is a wolf standing where I was".
 *
 * WHY MIRRORED. It is the cheapest possible signal that this is not that
 * creature, it costs no art, and it survives at 8x8 where a badge or an outline
 * does not. Angband's tiles all face the same way, so a mirrored one is visibly
 * the odd figure out on the level, which is exactly the read wanted: something
 * wearing a wolf, not a wolf.
 *
 * WHY A PALETTE SWAP AND NOT A HUE ROTATION. The kin rule above turns a donor's
 * own colours, which is right there - the point is a creature that resembles its
 * family. Here the point is the opposite: the figure has to read as the PLAYER,
 * in the player's own colours, whatever the donor's were. A rotation cannot do
 * that (it is a no-op on a grey wolf and it keeps a red one red); a ramp remap
 * replaces the palette outright. The engine's `TileFill.transform` is the
 * mechanism; every colour below is this mod's taste and nothing else.
 * ------------------------------------------------------------------------- */

/**
 * The forms, and which real monster each draws at each level band.
 *
 * EVERY NAME IS VERIFIED AGAINST lib/gamedata/monster.txt, Angband 4.2.6's own
 * monster list, and against these packs' target maps. That is not a formality:
 * a name that is plausible and absent resolves to no race, resolves to no tile,
 * and silently draws nothing, so the failure of a misremembered name looks
 * exactly like the feature being off. Where a name failed the check it was
 * replaced by the closest real entry rather than kept - "werewolf chieftain",
 * for instance, does not exist in 4.2.6 and `wolf chieftain` does.
 *
 * HOW A TIER IS PICKED: the highest band whose `minLevel` the character has
 * reached AND whose monster has a tile in the loaded pack. The second half is
 * what makes an incomplete pack degrade instead of vanishing - see the coverage
 * note in README.md, where two of these monsters are drawn by the Shockbolt
 * packs and by nothing else.
 *
 * WHERE THE BANDS COME FROM. A family whose most powerful real member is a
 * UNIQUE reserves that picture for level 50 (PY_MAX_LEVEL), so it is what a
 * finished character wears and not what a mid-game one does; the bands below it
 * are spread evenly over the levels beneath. A family with no unique at the top
 * spreads all of its bands evenly. The numbers are authored rather than computed
 * from each monster's own dungeon depth, because a monster's depth says where
 * the game puts it, not how impressive it looks at 32 pixels.
 *
 * A SHORT LIST IS A MEASUREMENT, NOT A GAP TO PAD. Two of these families are
 * short because 4.2.6 has nothing to fill them with, and a fifth wolf standing
 * in for a fox would be a worse answer than two tiers. Recorded per form below
 * and in README.md.
 */
export const SHAPE_TIERS = {
  /* NO FOX EXISTS IN 4.2.6, and no vulpine monster base either (monster_base.txt
   * has `canine`, `feline`, `rodent`, `zephyr hound` and nothing closer). The
   * shape is small, swift and stealthy - STR-3, STEALTH+5, one extra blow and
   * one extra move - so the small end of the canine base is the honest match.
   * `blink dog` is the swift one and is where this stops: every canine above it
   * is a wolf, and the wolves are what the warg and werewolf forms already draw,
   * so a third form borrowing them would make three shapes look like one.
   * The zephyr hounds were considered and rejected: they are elemental
   * constructs whose tiles are drawn as breath-weapon hounds, not small canines. */
  fox: [
    { minLevel: 1, monster: "wild dog" },
    { minLevel: 25, monster: "blink dog" },
  ],
  /* `pukelman` (golem base, native depth 25) is the shape's own creature, spelled
   * as one lower-case word in monster.txt where the shape is "Pukel-man". Above
   * it the progression stays with STONE constructs, because the shape is one -
   * player-flags:ROCK, RES_SHARD, DAM_RED. `Eog golem` and `colossus` are those.
   * It stops at three: the deeper golems are `mithril golem`, `iron golem` and
   * `bronze golem`, which are metal rather than rock, and `drolem`, which is a
   * dragon construct. Each of those exists and each would be a different
   * creature wearing the same word. */
  "Pukel-man": [
    { minLevel: 1, monster: "pukelman" },
    { minLevel: 18, monster: "Eog golem" },
    { minLevel: 34, monster: "colossus" },
  ],
  /* The quadruped base carries four real bears and they happen to make a clean
   * progression: cave, grizzly, were, and Beorn in his bear shape as the unique
   * at the top. `catoblepas`, `mumak` and `night mare` share the base and are
   * not bears. */
  bear: [
    { minLevel: 1, monster: "cave bear" },
    { minLevel: 17, monster: "grizzly bear" },
    { minLevel: 33, monster: "werebear" },
    { minLevel: 50, monster: "Beorn, the Mountain Bear" },
  ],
  /* NO EAGLE EXISTS IN 4.2.6 either. The bird base has exactly two non-unique
   * birds of prey - `blood falcon` and `giant roc` - plus `The Phoenix` as the
   * unique. Three tiers, and the crows (`crow`, `crow of Durthang`, `craban`)
   * are deliberately left out: an eagle form drawn as a crow at low level would
   * be a smaller bird rather than a weaker one, which is the wrong axis.
   * `winged horror` shares the base and is not a raptor. */
  eagle: [
    { minLevel: 1, monster: "blood falcon" },
    { minLevel: 25, monster: "giant roc" },
    { minLevel: 50, monster: "The Phoenix" },
  ],
  /* The bat base is the deepest bench in the game for any of these forms - nine
   * real bats - so this is the one family that gets five tiers without reaching
   * for anything. `doombat` is the deepest of them and is not a unique, so there
   * is no level-50 reservation here. */
  bat: [
    { minLevel: 1, monster: "fruit bat" },
    { minLevel: 12, monster: "giant tan bat" },
    { minLevel: 23, monster: "vampire bat" },
    { minLevel: 34, monster: "bat of Gorgoroth" },
    { minLevel: 45, monster: "doombat" },
  ],
  /* `warg` is the shape's own creature. Above it the canine base gives
   * `wolf chieftain` and `hellhound`, then `Huan, Wolfhound of the Valar` as the
   * unique. Huan is on the other side in the story, which is not a reason to
   * leave the best wolf picture in the game unused: this is what the character
   * looks like, not who they are. The werewolves are kept for the werewolf form. */
  warg: [
    { minLevel: 1, monster: "warg" },
    { minLevel: 17, monster: "wolf chieftain" },
    { minLevel: 33, monster: "hellhound" },
    { minLevel: 50, monster: "Huan, Wolfhound of the Valar" },
  ],
  /* The vampire base runs five deep before its unique and every step is a
   * vampire, so this is the family the whole design was drawn from: base,
   * master, lord, elder, and `Thuringwethil, the Vampire Messenger` at 50.
   * `Vampire-Sauron` exists too and is deliberately not here - it is Sauron
   * wearing a shape, at native depth 99, and a character has no level that
   * earns it. */
  vampire: [
    { minLevel: 1, monster: "vampire" },
    { minLevel: 12, monster: "master vampire" },
    { minLevel: 23, monster: "vampire lord" },
    { minLevel: 34, monster: "elder vampire" },
    { minLevel: 50, monster: "Thuringwethil, the Vampire Messenger" },
  ],
  /* Four real werewolves, in the order 4.2.6 itself puts them: `werewolf`,
   * `werewolf of Sauron`, `Draugluin, Sire of All Werewolves`, and
   * `Carcharoth, the Jaws of Thirst` at 50. `Wolf-Sauron` is left out for the
   * same reason `Vampire-Sauron` is. NOTE that `werewolf of Sauron` is one of
   * the two monsters only the Shockbolt packs draw - under the other four its
   * band falls back to plain `werewolf` until level 33. */
  werewolf: [
    { minLevel: 1, monster: "werewolf" },
    { minLevel: 17, monster: "werewolf of Sauron" },
    { minLevel: 33, monster: "Draugluin, Sire of All Werewolves" },
    { minLevel: 50, monster: "Carcharoth, the Jaws of Thirst" },
  ],
};

/**
 * Which palette a class draws from. Nine classes, six palettes, grouped by what
 * the class IS rather than by what it can cast.
 *
 * A GROUPING RATHER THAN NINE PALETTES, because the palette has one job: say at
 * a glance whose shape this is. Nine four-colour ramps would be nine that a
 * player cannot tell apart, and the classes that read alike do read alike - a
 * Priest and a Paladin are the same kind of character in the same kind of
 * armour. The RACE then supplies the brightest entry (see RACE_HIGHLIGHTS), so
 * two Druids of different races are still distinguishable without giving each of
 * the fifty-four class-and-race pairs a ramp of its own.
 */
export const CLASS_PALETTES = {
  /* The Druid casts every one of these forms; the Ranger casts none of them and
   * is grouped here for a different reason - it is the other class at home
   * outdoors, not a third shapechanger (the three classes that actually change
   * shape in 4.2.6 are Druid, Necromancer and Blackguard, below). This is the
   * earthy palette, forest shadow through sunlit leaf, and the one most players
   * will ever see, which is why it got the most care. */
  Druid: "wild",
  Ranger: "wild",
  /* Warm gold and bone. Bright, because a holy warrior wearing a wolf should
   * look like a blessing rather than a curse, and it is the clearest possible
   * contrast with the Necromancer's. */
  Priest: "holy",
  Paladin: "holy",
  /* Cool blue into violet: the conventional arcane reading, and the one colour
   * family none of the others use, so a Mage's shape is never mistaken. */
  Mage: "arcane",
  /* Cold, desaturated purple over near-black. The Necromancer's whole mechanic
   * is unlight, and the Blackguard's is bloodlust in the dark; both should look
   * like something that came up rather than something that was called. */
  Necromancer: "dark",
  Blackguard: "dark",
  /* Iron and steel, unromantic on purpose: the Warrior has no magic in the
   * shape, so the shape gets no colour that suggests any. */
  Warrior: "martial",
  /* Charcoal into a muted teal. Dark enough to read as a Rogue and cool enough
   * not to be the Warrior's grey, because those are the two that would
   * otherwise collide. */
  Rogue: "shadow",
};

/**
 * The four darker entries of each palette, DARKEST FIRST.
 *
 * FOUR PLUS ONE, not five: the top entry is the race's (RACE_HIGHLIGHTS), and it
 * is the top one deliberately. The brightest band is specular highlight - the
 * smallest area in any tile - so putting the race there makes the class the
 * thing that reads at a glance and the race the accent that separates two
 * characters of the same class. Reversed, every Elf of every class would look
 * like the same creature.
 *
 * FIVE BANDS IN TOTAL is the one number here most likely to want changing. Fewer
 * reads flatter and more stylised, more preserves the donor's own shading, and
 * five is a judgement about tiles between 8 and 64 pixels wide with the 8-pixel
 * end weighted: it keeps a readable light-to-dark and gives up the last of the
 * donor's texture. The engine takes up to sixteen.
 */
export const PALETTE_RAMPS = {
  wild: [
    [20, 32, 14],
    [44, 68, 25],
    [85, 116, 43],
    [147, 171, 74],
  ],
  holy: [
    [43, 33, 19],
    [107, 82, 32],
    [181, 141, 60],
    /* The brightest of the six third entries, and it is capped rather than
     * pushed further: every race highlight has to be brighter than every class
     * band, or the lit edges of the tile would come out darker than its shading
     * and the figure would read inside out. This is the band that decides how
     * much headroom the highlights have. */
    [214, 186, 118],
  ],
  arcane: [
    [13, 19, 48],
    [31, 47, 107],
    [74, 99, 184],
    [147, 168, 232],
  ],
  dark: [
    [10, 7, 16],
    [36, 26, 51],
    [74, 53, 96],
    [125, 99, 148],
  ],
  martial: [
    [20, 22, 26],
    [51, 57, 63],
    [102, 111, 120],
    [163, 173, 182],
  ],
  shadow: [
    [11, 18, 20],
    [29, 48, 51],
    [60, 95, 99],
    [111, 154, 156],
  ],
};

/**
 * The brightest palette entry, one per race, all eleven of 4.2.6's.
 *
 * Every one is a pale, low-saturation version of something the race already
 * suggests, which is what keeps it an accent instead of a second colour scheme
 * fighting the class: warm bone for Human, mint and near-white for the Elf
 * lines, wheat for Hobbit, copper for Dwarf, olive and moss for the Orc and
 * Troll halves, cyan for Gnome, silver for Dunadan, sulphur for Kobold. They are
 * pale rather than saturated because this band lands on the lit edges of the
 * tile, and a saturated highlight there reads as a rim light on the figure
 * rather than as part of it.
 */
export const RACE_HIGHLIGHTS = {
  Human: [242, 230, 208],
  "Half-Elf": [216, 240, 194],
  Elf: [205, 245, 221],
  Hobbit: [240, 224, 176],
  Gnome: [200, 240, 245],
  Dwarf: [244, 212, 176],
  "Half-Orc": [217, 224, 168],
  "Half-Troll": [206, 228, 182],
  Dunadan: [226, 232, 239],
  "High-Elf": [238, 244, 255],
  Kobold: [242, 240, 168],
};

/**
 * The five-entry ramp for one character, or null when either half is unknown.
 *
 * NULL RATHER THAN A DEFAULT, which is the whole fallback story in one line: a
 * class or race this mod has never heard of is one a content mod added, and
 * guessing that a modded class is "martial" would put a colour on somebody
 * else's character with nothing behind the choice. Null here means the provider
 * answers null, which means the pack's own player tile is drawn - which is what
 * an unmodded game does and what this mod did before the rule existed.
 */
export function paletteFor(cls, race) {
  const group = CLASS_PALETTES[cls];
  const base = group === undefined ? undefined : PALETTE_RAMPS[group];
  const highlight = RACE_HIGHLIGHTS[race];
  if (base === undefined || highlight === undefined) return null;
  return [...base.map((c) => [...c]), [...highlight]];
}

/**
 * Which monster a form draws at a level, ignoring what the pack can actually
 * draw. Exported for the tier tests, which is the half of the decision that has
 * to be right whatever art is loaded.
 *
 * Below the first band's `minLevel` there is no answer at all rather than the
 * first tier, because a shape a character cannot yet take is not a case to
 * invent art for. In stock 4.2.6 every band starts at 1, so this only arises
 * under a table somebody edited.
 */
export function tierFor(form, level) {
  const tiers = SHAPE_TIERS[form];
  if (tiers === undefined || !Number.isFinite(level)) return null;
  let chosen = null;
  for (const tier of tiers) if (tier.minLevel <= level) chosen = tier;
  return chosen === null ? null : chosen.monster;
}

/**
 * Build the whole shape table for one character against one loaded pack: every
 * form, every band, resolved to a real transformed tile or to null.
 *
 * ONCE PER PACK LOAD, NOT PER FRAME, and that is a hard constraint rather than
 * an optimisation. `fill.transform` ALLOCATES a slot in the pack's tile table,
 * and the table is fixed when the pack finishes loading - so every tile the
 * provider could ever answer with has to exist by then. The provider is a table
 * lookup and nothing else.
 *
 * ONE CHARACTER'S PALETTE, not all fifty-four, because the character is known
 * here: the game re-runs the whole tile load once race and class are final
 * (reset_visuals at ui_leave_init, ui-display.c) precisely so a pack's own
 * `?:[EQU $CLASS ...]` rules can be evaluated. The provider re-checks the class
 * and race it built for and declines if they have moved, so a table built for
 * somebody else is never drawn.
 */
export function buildShapeTiles(fill, registries, character) {
  if (character === null || typeof character !== "object") return null;
  const ramp = paletteFor(character.cls, character.race);
  if (ramp === null) return null;

  const races = registries && registries.monsters && registries.monsters.races
    ? registries.monsters.races
    : [];
  /* Lowest index wins, matching the kin rule above and for the same reason: the
   * registries are in bound order, so the choice is the same every launch. */
  const byName = new Map();
  for (const race of races) if (!byName.has(race.name)) byName.set(race.name, race);

  const forms = {};
  let drawn = 0;
  const absent = [];
  for (const form of Object.keys(SHAPE_TIERS)) {
    forms[form] = SHAPE_TIERS[form].map((tier) => {
      const race = byName.get(tier.monster);
      /* No race is a name that does not exist in this game's content; no tile is
       * a monster this pack does not draw. Both end in the same place - the band
       * is skipped and a lower one answers - and they are told apart in the log,
       * because one is a defect in this file and the other is the pack's own
       * coverage. */
      const donor = race === undefined ? null : fill.monsterTile(race.ridx);
      const tile = donor === null ? null : fill.transform(donor, { mirror: true, ramp });
      if (tile === null) absent.push(`${form}/${tier.monster}${race === undefined ? " (no such monster)" : ""}`);
      else drawn += 1;
      return { minLevel: tier.minLevel, monster: tier.monster, tile };
    });
  }
  return { cls: character.cls, race: character.race, forms, drawn, absent };
}

/**
 * The provider itself: the tile for the character being drawn right now, or null
 * to leave the pack's own player picture alone.
 *
 * Every one of the five ways out is a null, and all five are ordinary rather
 * than exceptional: no table (the pack is not this mod's, or the rule is off),
 * not shapechanged, a different character than the table was built for, a form
 * with no entry, and a level below every band this pack can draw.
 */
export function shapeTileFor(table, view) {
  if (table === null || typeof table !== "object") return null;
  if (view === null || typeof view !== "object") return null;
  if (typeof view.shape !== "string" || view.shape.length === 0) return null;
  if (view.cls !== table.cls || view.race !== table.race) return null;
  const tiers = table.forms[view.shape];
  if (tiers === undefined) return null;
  let chosen = null;
  for (const tier of tiers) {
    if (tier.minLevel <= view.level && tier.tile !== null) chosen = tier.tile;
  }
  return chosen;
}

/** The class and race of the character in a live game state, or null. */
export function characterOf(state) {
  const player = state && state.actor ? state.actor.player : null;
  if (!player || !player.cls || !player.race) return null;
  const cls = player.cls.name;
  const race = player.race.name;
  return typeof cls === "string" && typeof race === "string" ? { cls, race } : null;
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

    const kin = !(ctx.flags && ctx.flags["linoleum.deriveTiles"] === false);

    /* ON ONLY WHEN THE PLAYER SAID SO, where the kin rule is on by default, and
     * the difference between the two is the reason. The kin rule fills a tile
     * that would otherwise be a LETTER, so it can only add; this one REPLACES
     * the picture the pack draws for the character, which is not what somebody
     * installing a tile set asked for. `!== true` rather than `!== false`, so a
     * game too old to resolve the rule at all leaves it off. */
    const wantShapes = !!(ctx.flags && ctx.flags["linoleum.shapeTiles"] === true);
    /* An older game has the fill door but not the player door. Everything else
     * here still works, so this is a line in the log rather than a refusal - and
     * it is only said when the player turned the rule on, because otherwise it
     * would be noise about a feature nobody asked for. */
    const canShape = typeof host.tiles.player === "function";
    if (wantShapes && !canShape) {
      ctx.log("this game has no player-tile seam, so a shapechanged character keeps its own picture");
    }
    const shapes = wantShapes && canShape;

    if (!kin && !shapes) return;

    /* Rebuilt by the filler on every pack load and CLEARED first, so a pack this
     * mod has no business drawing for leaves the character alone: the table is
     * the only thing the provider can answer from. */
    let shapeTable = null;

    if (shapes) {
      /* Registered once, outside the filler, because a provider is a lookup and
       * the thing it looks in is what the filler rebuilds. Registering it inside
       * would tie "is there a provider" to "has a pack loaded yet". */
      host.tiles.player((view) => shapeTileFor(shapeTable, view));
    }

    host.tiles.register((fill) => {
      shapeTable = null;
      /* NOT THIS MOD'S ART TO GUESS AT. A linoleum pack is this mod's, converted or
       * hand-authored, and a fill there is a decision this mod is entitled to make.
       * A tilesheet is Angband's own fixed atlas, where the honest answer for
       * content it predates is the letter the game would draw anyway. */
      if (fill.pack.engine !== "linoleum") return;
      const registries = ctx.registries;
      /* Before Neo Angband 0.23.0 a plugin could not ask what the game was made
       * of, so there is nothing to walk and nothing to fill. */
      if (!registries) return;
      if (kin) {
        const filled = fillFromKin(fill, registries);
        if (filled.monsters > 0 || filled.objects > 0) {
          ctx.log(
            `drew ${filled.monsters} added creature(s) and ${filled.objects} added item(s) ` +
              `from their nearest kin in ${fill.pack.menuname}`,
          );
        }
      }
      if (!shapes) return;
      /* AFTER the kin fill, so a shape whose creature was itself supplied by
       * that rule borrows the tile it just got rather than nothing. Nothing in
       * stock content needs that; a content mod replacing a werewolf would. */
      const table = buildShapeTiles(fill, registries, characterOf(ctx.state));
      if (table === null) {
        /* No live character, or a class or race this mod has no palette for -
         * a content mod's own class. Said once per pack load, because a silent
         * nothing is indistinguishable from the rule being off. */
        ctx.log("no shape palette for this character, so a shapechanged form keeps its own picture");
        return;
      }
      shapeTable = table;
      ctx.log(
        `drew ${table.drawn} shapechange tile(s) for a ${table.race} ${table.cls} in ` +
          `${fill.pack.menuname}` +
          (table.absent.length > 0 ? `; ${table.absent.length} band(s) fell back: ${table.absent.join(", ")}` : ""),
      );
    });
  },
};
