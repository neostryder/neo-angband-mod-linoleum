#!/usr/bin/env node
/**
 * Convert the tilesheets in a Neo Angband checkout into this mod's six loose packs.
 *
 * WHY THIS LIVES HERE AND NOT IN THE GAME. It used to be
 * packages/web/scripts/gen-linoleum-demo.mjs, run by the web package's `dev` and
 * `bundle` scripts, writing 9161 PNGs into the game's own public/mods/ directory.
 * That put a MOD's resources inside the game's build and served them from the
 * game's origin, which is exactly backwards: the packs are this mod's art, this
 * mod is what installs them, and the game should read them out of the installed
 * mod's folder. So the conversion moved to the mod, and the game's repository now
 * holds no pack bytes and no step that makes any.
 *
 * WHAT IT NEEDS. A Neo Angband checkout, BUILT (`pnpm build`), for two things:
 *   - the converter, @neo-angband/linoleum, imported from its dist;
 *   - the source art, packages/web/public/tiles/, which is upstream's own
 *     tilesheets and is core game data there, not mod content.
 * Defaults to a sibling checkout at ../neo-angband; override with --game.
 *
 * Output goes to packs/ in this repository, which is GITIGNORED. The committed
 * deliverable is the archives under dist/ that tools/pack.mjs builds from these -
 * one zip per pack, which is what the game's installer fetches and verifies.
 * Committing 9161 loose binaries as well would be the same bytes twice, kept in
 * step by hope.
 *
 * ATTRIBUTION travels with the art: CREDITS.md at the repository root states the
 * source sets' terms and that a conversion is a modification of them, and it is
 * inside every archive. Nothing is written per-pack here, because unlike the old
 * generated-into-a-web-build arrangement these files never move without the mod.
 *
 *   node tools/build-packs.mjs [--game <dir>] [--packs a,b|all] [--force]
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] !== undefined ? args[at + 1] : fallback;
};

const gameRoot = resolve(flag("game", join(root, "..", "neo-angband")));
const outputRoot = join(root, "packs");
const force = args.includes("--force");

function note(message) {
  console.log(`[build-packs] ${message}`);
}

function fail(message) {
  console.error(`[build-packs] ${message}`);
  process.exit(1);
}

const converterEntry = join(gameRoot, "packages", "linoleum", "dist", "index.js");
if (!existsSync(converterEntry)) {
  fail(
    `no built converter at ${converterEntry}\n` +
      `        Expected a Neo Angband checkout at ${gameRoot}, built with \`pnpm build\`.\n` +
      `        Pass --game <dir> if it is somewhere else.`,
  );
}
const tilesRoot = join(gameRoot, "packages", "web", "public", "tiles");
if (!existsSync(tilesRoot)) fail(`no source art at ${tilesRoot}`);

const linoleum = await import(pathToFileURL(converterEntry).href);

/**
 * The packs to build: every path this mod's manifest declares, in its order.
 *
 * Driven by the MANIFEST rather than by the converter's own ALL_PACKS, because the
 * manifest is what the game reads. A pack the converter knows and the manifest
 * does not declare would be built and then never selectable; the mismatch is worth
 * failing on rather than shipping.
 */
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const declared = (Array.isArray(manifest.tilePacks) ? manifest.tilePacks : [])
  .map((p) => p?.path)
  .filter((p) => typeof p === "string" && p !== "");
if (declared.length === 0) fail("manifest.json declares no tilePacks path");

const known = new Map(linoleum.ALL_PACKS.map((p) => [p.key, p]));
const undeclarable = declared.filter((key) => !known.has(key));
if (undeclarable.length > 0) {
  fail(`manifest.json declares pack(s) the converter does not know: ${undeclarable.join(", ")}`);
}

const requested = flag("packs", "all");
const keys =
  requested === "all"
    ? declared
    : requested
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k !== "");
for (const key of keys) {
  if (!declared.includes(key)) fail(`--packs names "${key}", which manifest.json does not declare`);
}

note(`converting ${keys.length} pack(s) from ${relative(root, tilesRoot) || tilesRoot}`);

let built = 0;
for (const key of keys) {
  const config = known.get(key);
  const packRoot = join(outputRoot, key);
  if (existsSync(join(packRoot, "manifest.txt"))) {
    if (!force) {
      note(`already built: packs/${key} (--force to redo)`);
      continue;
    }
    rmSync(packRoot, { recursive: true, force: true });
  }
  const sourceDir = join(tilesRoot, config.sourceDirectory);
  if (!existsSync(join(sourceDir, config.imageFile))) {
    /* Never a soft skip. A missing pack is a Graphics row that silently draws
     * ASCII, and this repository's whole job is to ship the art. */
    fail(`${key}: source art missing (${join(sourceDir, config.imageFile)})`);
  }
  mkdirSync(outputRoot, { recursive: true });
  const result = linoleum.buildPackExport(config, tilesRoot, outputRoot);
  note(`built ${result.displayName} -> packs/${key} (${result.exactSelectorCount} target rules)`);
  built++;
}

note(`${built} built, ${keys.length - built} already present; next: node tools/pack.mjs`);
