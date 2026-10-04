import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

/**
 * core-adapter.js is the only file that reads the game's internals.
 *
 * Every other source file gets engine values from the adapter, so moving the
 * mod to a new mod API means rewriting that one file. This scans the code of
 * every other non-test source file, with comments removed, for the ways a
 * file could reach past it.
 */
describe("the engine adapter boundary", () => {
  const ADAPTER = "core-adapter.js";

  const FORBIDDEN: readonly (readonly [string, RegExp])[] = [
    [
      "a raw context member",
      /\bctx\s*(?:\?\.|\.)\s*(?:core|state|registries|snapshot|intent|events|characterStore|prefs|inspect|keymaps|ui|knownLevel|character|prompt)\b/u,
    ],
    ["a registries read", /\.\s*registries\b/u],
    ["a string-keyed context read", /\bctx\s*\[/u],
    ["an engine member destructured from the context", /\{[^}]*\b(?:core|state|registries)\b[^}]*\}\s*=\s*ctx\b/u],
    ["a tile door called on the registry host", /\bhost\s*(?:\?\.|\.)\s*tiles\b/u],
    ["a read of the live game state", /\.\s*actor\s*(?:\?\.|\.)\s*player\b/u],
  ];

  /** Any file, the adapter included: the engine arrives through the context, never by import. */
  const ENGINE_IMPORT = /\bfrom\s*["']@rpgm-tools\/neo-angband-core["']|\bimport\s*\(\s*["']@rpgm-tools\/neo-angband-core["']/u;

  const stripComments = (code: string): string =>
    code.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|[^:"'\\])\/\/[^\n]*/gu, "$1");

  const sources = (): string[] =>
    readdirSync(new URL("./", import.meta.url)).filter(
      (f) => /\.m?js$/u.test(f) && !/\.test\.m?js$/u.test(f),
    );

  const read = (f: string): string => stripComments(readFileSync(new URL(`./${f}`, import.meta.url), "utf8"));

  it("finds the adapter and the files it serves", () => {
    expect(sources()).toContain(ADAPTER);
    expect(sources()).toContain("plugin.js");
  });

  it("is crossed by no other source file", () => {
    const hits: string[] = [];
    for (const f of sources()) {
      if (f === ADAPTER) continue;
      const code = read(f);
      for (const [what, re] of FORBIDDEN) if (re.test(code)) hits.push(`${f}: ${what}`);
    }
    expect(hits).toEqual([]);
  });

  it("leaves no import of the engine anywhere", () => {
    const hits = sources().filter((f) => ENGINE_IMPORT.test(read(f)));
    expect(hits).toEqual([]);
  });
});
