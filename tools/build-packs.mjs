#!/usr/bin/env node
/**
 * Stage the compact source inputs for neo-linoleum's on-demand conversion.
 *
 * A player downloads one PNG atlas plus the legacy pref texts for a selected
 * Graphics row. The host crops that source into loose PNGs on first enable and
 * caches it locally; the loose output is deliberately not a shipped artefact.
 *
 * This still requires a built Neo Angband checkout. `ALL_PACKS` is the shared
 * source-of-truth for image/pref names, so staging against the coupled host
 * catches manifest drift before an archive reaches a player.
 *
 *   node tools/build-packs.mjs [--game <dir>] [--packs a,b|all]
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] !== undefined ? args[at + 1] : fallback;
};
const gameRoot = resolve(flag("game", join(root, "..", "neo-angband")));

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
      "        Build the coupled Neo Angband checkout first (pnpm build), then pass --game if needed.",
  );
}
const tilesRoot = join(gameRoot, "packages", "web", "public", "tiles");
if (!existsSync(tilesRoot)) fail(`no source art at ${tilesRoot}; run packages/web sync-tiles first`);
const linoleum = await import(pathToFileURL(converterEntry).href);
const known = new Map(linoleum.ALL_PACKS.map((pack) => [pack.key, pack]));

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const declared = (Array.isArray(manifest.tilePacks) ? manifest.tilePacks : []).map((entry) => ({
  path: entry?.path,
  source: entry?.tilesheet,
}));
if (declared.length === 0) fail("manifest.json declares no tilePacks");

const packs = declared.map(({ path, source }) => {
  if (typeof path !== "string" || typeof source !== "object" || source === null) {
    fail("each tilePacks entry needs a path and tilesheet source declaration");
  }
  const key = source.key;
  const config = typeof key === "string" ? known.get(key) : undefined;
  if (!config) fail(`manifest names an unknown converter pack: ${String(key)}`);
  if (source.packId !== config.packId || source.resolution !== config.resolution) {
    fail(`${key}: tilesheet packId/resolution does not match Neo Angband's converter`);
  }
  if (source.cacheKey !== manifest.version) {
    fail(`${key}: tilesheet cacheKey must equal manifest version (${String(manifest.version)})`);
  }
  if (typeof source.image !== "string" || !Array.isArray(source.prefFiles)) {
    fail(`${key}: tilesheet image and prefFiles are required`);
  }
  return { key, path, source, config };
});

const requested = flag("packs", "all");
const wanted = requested === "all" ? packs.map((pack) => pack.key) : requested.split(",").map((key) => key.trim()).filter(Boolean);
for (const key of wanted) if (!packs.some((pack) => pack.key === key)) fail(`--packs names "${key}", not a declared pack`);

const groups = new Map();
for (const pack of packs) {
  let group = groups.get(pack.path);
  if (!group) {
    group = [];
    groups.set(pack.path, group);
  }
  group.push(pack);
}

let staged = 0;
for (const [path, group] of groups) {
  if (!group.some((pack) => wanted.includes(pack.key))) continue;
  const files = new Map();
  for (const pack of group) {
    const sourceDir = join(tilesRoot, pack.config.sourceDirectory);
    const pairs = [
      [pack.config.imageFile, pack.source.image],
      ...pack.config.prefFiles.map((name, index) => [name, pack.source.prefFiles[index]]),
    ];
    if (pairs.some(([, target]) => typeof target !== "string" || target === "")) {
      fail(`${pack.key}: tilesheet prefFiles does not match the converter's source files`);
    }
    for (const [from, target] of pairs) {
      const sourceFile = join(sourceDir, from);
      const previous = files.get(target);
      if (previous && previous !== sourceFile) fail(`${path}: two modes assign different source files to ${target}`);
      files.set(target, sourceFile);
    }
  }
  const packRoot = join(root, path);
  rmSync(packRoot, { recursive: true, force: true });
  let bytes = 0;
  for (const [target, sourceFile] of files) {
    if (!existsSync(sourceFile)) fail(`${path}: source art missing (${sourceFile})`);
    const destination = join(packRoot, target);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(sourceFile, destination);
    bytes += readFileSync(destination).length;
  }
  note(`staged ${path}: ${files.size} source files, ${(bytes / 1024 / 1024).toFixed(2)} MiB`);
  staged += 1;
}

note(`${staged} compact source archive(s) staged from ${relative(root, tilesRoot) || tilesRoot}; next: node tools/pack.mjs`);
