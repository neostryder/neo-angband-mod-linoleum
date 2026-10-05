import { describe, expect, it } from "vitest";
import { api2NotGranted, api2Ok, api2Refused, api2Unavailable, validateManifest } from "@rpgm-tools/neo-angband-mod-sdk";
import { readFileSync } from "node:fs";
import { createAdapter as api1 } from "./core-adapter.js";
import { createAdapter as api2 } from "./core-adapter-api2.js";

function facts(player, flags = {}) {
  const messages = [];
  const meta = { flags: { ...flags }, log: (message) => messages.push(message) };
  return {
    messages,
    old: api1({ ...meta, flags: { ...flags }, state: player ? { actor: { player: {
      cls: { name: player.cls }, race: { name: player.race },
    } } } : null }),
    next: api2({ meta, view: { player: async () => player ? api2Ok(player) : api2Unavailable("No character") } }),
  };
}

describe("the API 2 adapter", () => {
  it("keeps the same flags and diagnostic messages", () => {
    const { old, next, messages } = facts(null, { "linoleum.deriveTiles": false, "linoleum.shapeTiles": true });
    expect(next.meta.flags).toEqual(old.meta.flags);
    expect(next.meta.flags).not.toBe(old.meta.flags);
    old.meta.log("Tile pack loaded");
    next.meta.log("Tile pack loaded");
    expect(messages).toEqual(["Tile pack loaded", "Tile pack loaded"]);
  });

  it.each([
    { cls: "Druid", race: "Elf" },
    { cls: "Warrior", race: "Human" },
    { cls: "Mage", race: "Dwarf" },
    null,
  ])("returns the same character identity for %j", async (player) => {
    const { old, next } = facts(player);
    const oldPlayer = old.view.player();
    const nextPlayer = next.view.player();
    expect(oldPlayer?.then).toBeUndefined();
    expect(nextPlayer.then).toBeTypeOf("function");
    expect(await nextPlayer).toEqual(oldPlayer);
  });

  it("reads the player again after the character changes", async () => {
    let player = { cls: "Druid", race: "Elf" };
    const state = { actor: { player: { cls: { name: player.cls }, race: { name: player.race } } } };
    const old = api1({ state });
    const next = api2({ meta: {}, view: { player: async () => api2Ok(player) } });
    expect(await next.view.player()).toEqual(old.view.player());
    player = { cls: "Warrior", race: "Human" };
    state.actor.player = { cls: { name: player.cls }, race: { name: player.race } };
    expect(await next.view.player()).toEqual(old.view.player());
  });

  it.each([
    api2NotGranted("state:player.read"),
    api2Unavailable("No character"),
    api2Refused("not-ready", "The player is unavailable"),
  ])("returns null for $reason", async (result) => {
    const next = api2({ meta: {}, view: { player: async () => result } });
    expect(await next.view.player()).toBeNull();
  });

  it("keeps unexpected host faults visible", async () => {
    const next = api2({ meta: {}, view: { player: async () => { throw new Error("Host fault"); } } });
    await expect(next.view.player()).rejects.toThrow("Host fault");
  });

  it("keeps the schema 2 manifest on API 1 with its tile grant", () => {
    const document = JSON.parse(readFileSync(new URL("./manifest.json", import.meta.url), "utf8"));
    const manifest = validateManifest(document);
    expect(document.schemaVersion).toBe(2);
    expect(manifest.modApi).toBe(1);
    expect(manifest.runtime).toBe("in-process");
    expect(manifest.capabilities).toEqual(["registry:tiles"]);
  });
});
