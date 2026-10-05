import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

/** The boundary keeps engine access in core-adapter.js so a port changes one import. */
describe("the engine adapter boundary", () => {
  const ADAPTER = "core-adapter.js";
  const API2_ADAPTER = "core-adapter-api2.js";
  const CONTEXT = String.raw`\bctx\s*!?\s*(?:as\s+[\w.<>[\]|&]+\s*)?\)*\s*`;

  const FORBIDDEN: readonly (readonly [string, RegExp])[] = [
    [
      "a raw context member",
      new RegExp(`${CONTEXT}(?:\\?\\.|\\.)\\s*(?:core|state|registries|snapshot|intent|events|characterStore|prefs|inspect|keymaps|ui|knownLevel|character|prompt)\\b`, "u"),
    ],
    ["a registries read", /\.\s*registries\b/u],
    ["a string-keyed context read", new RegExp(`${CONTEXT}(?:\\?\\.)?\\[`, "u")],
    ["an engine member destructured from the context", /\{[^}]*\b(?:core|state|registries)\b[^}]*\}\s*=\s*\(*\s*ctx\b/u],
    ["a tile door called on the registry host", /\bhost\s*!?\s*(?:as\s+[\w.<>[\]|&]+\s*)?\)*\s*(?:\?\.|\.)\s*tiles\b/u],
    ["a read of the live game state", /\.\s*actor\s*!?\s*(?:\?\.|\.)\s*player\b/u],
    ["an engine namespace outside the adapter", /\b[\w$]+engine\b|\bengine\s*!?\s*(?:as\s+[\w.<>[\]|&]+\s*)?\)*\s*(?:\?\.|\.|\[)/iu],
  ];

  const ENGINE_IMPORT = /\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)["']@rpgm-tools\/neo-angband-core(?:\/[^"']*)?["']/u;

  const stripComments = (code: string): string =>
    code.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu, (whole: string, quoted: string | undefined) => quoted ?? " ");

  const scan = (file: string, source: string): string[] => {
    const code = stripComments(source);
    const hits: string[] = [];
    if (ENGINE_IMPORT.test(code)) hits.push("an import of the engine");
    if (file === ADAPTER) return hits;
    const identifiers = code.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gu, " ");
    if (file === API2_ADAPTER && /\bctx\b/u.test(identifiers)) hits.push("a context identifier in the API 2 adapter");
    const withoutTileAdapter = identifiers.replace(/\bengine\s*\.\s*(?:hasTileDoor|hasPlayerDoor|registerTileFiller|registerPlayerTile)\b/gu, " ");
    for (const [what, re] of FORBIDDEN) {
      if (re.test(what === "an engine namespace outside the adapter" ? withoutTileAdapter : identifiers)) hits.push(what);
    }
    return hits;
  };

  const sources = (): string[] =>
    readdirSync(new URL("./", import.meta.url)).filter(
      (f) => /\.m?js$/u.test(f) && !/\.test\.m?js$/u.test(f),
    );

  const read = (f: string): string => stripComments(readFileSync(new URL(`./${f}`, import.meta.url), "utf8"));

  it("finds the adapter and the files it serves", () => {
    expect(sources()).toContain(ADAPTER);
    expect(sources()).toContain("plugin.js");
    expect(sources()).toContain(API2_ADAPTER);
  });

  it("is crossed by no other source file", () => {
    const hits: string[] = [];
    for (const f of sources()) {
      for (const what of scan(f, read(f))) hits.push(`${f}: ${what}`);
    }
    expect(hits).toEqual([]);
  });

  it("leaves no import of the engine anywhere", () => {
    const hits = sources().filter((f) => ENGINE_IMPORT.test(read(f)));
    expect(hits).toEqual([]);
  });

  it.each([
    "ctx!.state;",
    "(ctx as any).core;",
    "ctx . registries;",
    "ctx?.state;",
    "(ctx as any)[\"state\"];",
    "const { state } = (ctx as any);",
    "host!.tiles;",
    "(host as any).tiles;",
    "gameEngine.core;",
    "otherengine[\"state\"];",
    "const stolenEngine = value;",
    "return stolenengine;",
    "engine.core;",
    "export { player } from \"@rpgm-tools/neo-angband-core\";",
    "import(\"@rpgm-tools/neo-angband-core\");",
    "import \"@rpgm-tools/neo-angband-core\";",
    "import { player } from \"@rpgm-tools/neo-angband-core/player\";",
    "require(\"@rpgm-tools/neo-angband-core\");",
  ])("rejects %s", (source) => {
    expect(scan("plugin.js", source).length).toBeGreaterThan(0);
  });

  it.each(["ctx;", "ctx.flags;", "ctx.log;", "const { flags } = ctx;"])("rejects %s in the API 2 adapter", (source) => {
    expect(scan(API2_ADAPTER, source)).toContain("a context identifier in the API 2 adapter");
  });

  it("allows tile adapter calls and ignores comments and quoted context names", () => {
    expect(scan("plugin.js", 'engine.hasTileDoor(host); // ctx.state\n"ctx.state";')).toEqual([]);
    expect(scan(API2_ADAPTER, 'mod.meta.log("ctx"); /* ctx.state */')).toEqual([]);
  });
});
