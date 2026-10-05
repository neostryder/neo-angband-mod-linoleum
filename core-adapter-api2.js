/** @param {import("@rpgm-tools/neo-angband-mod-sdk").ModApi2} mod */
export function createAdapter(mod) {
  return {
    meta: {
      flags: mod.meta.flags,
      log: (/** @type {string} */ message) => mod.meta.log(message),
    },
    view: {
      player: async () => {
        const result = await mod.view.player();
        if (!result.ok) return null;
        const { cls, race } = result.value;
        return { cls, race };
      },
    },
  };
}
