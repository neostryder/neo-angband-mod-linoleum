/**
 * Test support, not part of the mod: the tile policy as the API 1 registry host
 * ran it.
 *
 * The mod itself is an API 2 definition (plugin.js). Kin fill and shapechange
 * tiles need a tile filler and a player-tile provider, and API 2 gives a mod
 * neither (gap register rows LN-1 and LN-2), so plugin.js says in the log that
 * they are waiting. This file keeps their wiring, driven by plugin.js's own
 * pure functions, so the suites keep checking what the game's additions must
 * match. It is not in the archive.
 */

import { buildShapeTiles, fillFromKin, shapeTileFor } from "./plugin.js";

/** The class and race of the character in a live game state, or null. */
export function characterOf(state) {
  const player = state && state.actor ? state.actor.player : null;
  if (!player || !player.cls || !player.race) return null;
  const cls = player.cls.name;
  const race = player.race.name;
  return typeof cls === "string" && typeof race === "string" ? { cls, race } : null;
}

/** Build the adapter from `register()`'s context. Members that read live state read it when called. */
export function createAdapter(ctx) {
  return {
    /** API 2 `meta`. */
    meta: {
      /** The resolved rule flags, undefined on a game too old to resolve them. API 2: `meta.flags`. */
      flags: ctx.flags,
      /** API 2: `meta.log(message)`. */
      log: (message) => ctx.log(message),
    },

    /** API 2 `view`. */
    view: {
      /** `{ cls, race }` of the live character, or null. API 2: `view.player()`, async and answering an Api2Result of KnownPlayer, whose `cls` and `race` carry the same names. */
      player: () => characterOf(ctx.state),
    },

    /** API 2 `content`. */
    content: {
      /** The live registries (`monsters.races`, `objects.kinds`), read at call time; undefined before 0.23.0. API 2: `content.records("monster")` and `content.records("object")`, which answer composed records, so the bound index (ridx, kidx) and provenance (`from`) each record carries here must be mapped. */
      tables: () => ctx.registries,
    },

    /** No API 2 counterpart: the registry host's tile doors. */
    engine: {
      /** Whether the registry host has the tile-filling door (Neo Angband 0.23.0 and later). API 2: none; the kin fill becomes a host-interpreted tile policy the mod declares. */
      hasTileDoor: (host) => !!host && !!host.tiles && typeof host.tiles.register === "function",
      /** Whether the registry host has the player-tile door. API 2: none; the shapechange table becomes a content declaration the host draws from. */
      hasPlayerDoor: (host) => typeof host.tiles.player === "function",
      /** Installs a registry:tiles filler, which the host calls with a live TileFill on every pack load. API 2: the same host-interpreted tile policy, declared rather than installed. */
      registerTileFiller: (host, filler) => host.tiles.register(filler),
      /** Installs the player-tile provider. API 2: the same shapechange declaration. */
      registerPlayerTile: (host, provider) => host.tiles.player(provider),
    },
  };
}

export default {
  register(host, ctx) {
    const { meta, view, content, engine } = createAdapter(ctx);
    const flags = meta.flags;

    /* An older game has no tile door at all. Say so once rather than throwing:
     * every tile pack in this mod still works, and the fallback art is the only
     * thing missing. */
    if (!engine.hasTileDoor(host)) {
      meta.log("this game has no tile-filling seam, so modded content keeps its letter");
      return;
    }

    const kin = !(flags && flags["linoleum.deriveTiles"] === false);

    /* ON ONLY WHEN THE PLAYER SAID SO, where the kin rule is on by default, and
     * the difference between the two is the reason. The kin rule fills a tile
     * that would otherwise be a LETTER, so it can only add; this one REPLACES
     * the picture the pack draws for the character, which is not what somebody
     * installing a tile set asked for. `!== true` rather than `!== false`, so a
     * game too old to resolve the rule at all leaves it off. */
    const wantShapes = !!(flags && flags["linoleum.shapeTiles"] === true);
    /* An older game has the fill door but not the player door. Everything else
     * here still works, so this is a line in the log rather than a refusal - and
     * it is only said when the player turned the rule on, because otherwise it
     * would be noise about a feature nobody asked for. */
    const canShape = engine.hasPlayerDoor(host);
    if (wantShapes && !canShape) {
      meta.log("this game has no player-tile seam, so a shapechanged character keeps its own picture");
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
      engine.registerPlayerTile(host, (drawn) => shapeTileFor(shapeTable, drawn));
    }

    engine.registerTileFiller(host, (fill) => {
      shapeTable = null;
      /* NOT THIS MOD'S ART TO GUESS AT. A linoleum pack is this mod's, converted or
       * hand-authored, and a fill there is a decision this mod is entitled to make.
       * A tilesheet is Angband's own fixed atlas, where the honest answer for
       * content it predates is the letter the game would draw anyway. */
      if (fill.pack.engine !== "linoleum") return;
      const registries = content.tables();
      /* Before Neo Angband 0.23.0 a plugin could not ask what the game was made
       * of, so there is nothing to walk and nothing to fill. */
      if (!registries) return;
      if (kin) {
        const filled = fillFromKin(fill, registries);
        if (filled.monsters > 0 || filled.objects > 0) {
          meta.log(
            `drew ${filled.monsters} added creature(s) and ${filled.objects} added item(s) ` +
              `from their nearest kin in ${fill.pack.menuname}`,
          );
        }
      }
      if (!shapes) return;
      /* AFTER the kin fill, so a shape whose creature was itself supplied by
       * that rule borrows the tile it just got rather than nothing. Nothing in
       * stock content needs that; a content mod replacing a werewolf would. */
      const table = buildShapeTiles(fill, registries, view.player());
      if (table === null) {
        /* No live character, or a class or race this mod has no palette for -
         * a content mod's own class. Said once per pack load, because a silent
         * nothing is indistinguishable from the rule being off. */
        meta.log("no shape palette for this character, so a shapechanged form keeps its own picture");
        return;
      }
      shapeTable = table;
      meta.log(
        `drew ${table.drawn} shapechange tile(s) for a ${table.race} ${table.cls} in ` +
          `${fill.pack.menuname}` +
          (table.absent.length > 0 ? `; ${table.absent.length} band(s) fell back: ${table.absent.join(", ")}` : ""),
      );
    });
  },
};
