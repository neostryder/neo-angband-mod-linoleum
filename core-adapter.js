/**
 * Every read this mod makes of the game's internals happens in this file. No
 * other file in the mod reads `ctx.registries` or `ctx.state`, or calls the
 * tile doors on the registry host. `register()` in plugin.js builds the adapter
 * once with `createAdapter(ctx)` and passes the pieces down. The exports are
 * grouped by the mod API 2 domain each one maps to, and `engine` holds what API
 * 2 does not give a mod at all.
 *
 * It is a module of its own, beside plugin.js, because this repository has no
 * build step: plugin.js is the shipped file as written, and the game loads a
 * relative import of a mod's own script on both the desktop and the browser.
 * tools/pack.mjs puts it in neo-linoleum-mod.zip next to plugin.js.
 */

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
