#!/usr/bin/env node
/**
 * Build (or verify) the installable archives under `dist/` - what this mod actually
 * ships.
 *
 * WHY ARCHIVES AND NOT 9161 COMMITTED FILES. A loose pack is one PNG per tile:
 * measured, the six packs are 9161 files and 42 MiB. The game's installer fetches an
 * `archive` payload, checks a digest, and unzips only after the digest matches
 * (packages/web/src/mod-install.ts). The alternative - a `files` payload - is one
 * HTTP request per file, and 9161 requests is not an install.
 *
 * WHY SEVEN ARCHIVES AND NOT ONE. Measured: 42 MiB of loose art becomes 24.6 MiB of
 * zip, the largest pack 10.6 MiB. As ONE archive that is a 24.6 MiB blob rewritten in
 * full whenever a single tile changes, carrying one digest whose failure says only
 * "something in here is wrong". Per pack, a digest names which pack failed, a fix
 * rewrites one file, and the installer is free to offer a subset later. So: one
 * archive per tile pack, plus one small archive for the mod's own root files.
 *
 * WHY THE ROOT FILES GET THEIR OWN ARCHIVE. An installed mod's file list IS what its
 * archives contained, and the shared validator (readModDir) requires a top-level
 * manifest.json like every other source. Those files therefore have to be inside
 * SOMETHING - but inside all seven they would collide, and the installer rejects a
 * path that arrives from two archives rather than silently keeping whichever unzipped
 * last. One archive owns them.
 *
 * DETERMINISTIC. Entries sorted, timestamps fixed, stdlib zlib only. A digest is a
 * function of CONTENT, so rebuilding on another machine produces the same bytes and
 * the same sha256 - which is what makes the digest the game ships worth pinning.
 *
 *   node tools/pack.mjs [--packs <dir>] [--verify] [--json]
 *
 * `--packs` is the directory holding the built pack directories; default `packs/`,
 * which `tools/build-packs.mjs` writes and .gitignore excludes. `--json` prints
 * path/sha256 pairs in the shape the game's RECOMMENDED_MODS catalogue wants.
 */

import { createHash } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Files from the repository root that travel inside the mod archive.
 *
 * `plugin.js` is here because an installed mod's code is loaded BY NAME from the
 * mod folder, and the mod folder is whatever the archives unpacked. A plugin left
 * out of the archive is a mod whose manifest declares code the game then cannot
 * find, which reports as a mod fault with nothing in this repository able to have
 * noticed - so it is listed beside the manifest that declares it.
 */
const ROOT_FILES = ["manifest.json", "plugin.js", "README.md", "LICENSE.md", "CREDITS.md"];

/** The archive that carries ROOT_FILES, and nothing else. */
const MOD_ARCHIVE = "neo-linoleum-mod.zip";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] !== undefined ? args[at + 1] : fallback;
};
const verify = args.includes("--verify");
const asJson = args.includes("--json");

const packsRoot = resolve(flag("packs", join(root, "packs")));
const distRoot = resolve(flag("dist", join(root, "dist")));

function fail(message) {
  console.error(`[pack] ${message}`);
  process.exit(1);
}

function note(message) {
  if (!asJson) console.log(`[pack] ${message}`);
}

/**
 * The tile pack directories the manifest declares, validated.
 *
 * MOD-relative by design (see the main repo's docs/LINOLEUM.md): the runtime
 * composes `mods/<id>/<declared path>/...`, so a site path would resolve to
 * mods/<id>/mods/<id>/... and 404 into ASCII, and a pack stored in a zip under any
 * other name is a Graphics row that silently draws nothing.
 */
function declaredPacks() {
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
  const packs = Array.isArray(manifest.tilePacks) ? manifest.tilePacks : [];
  const declared = packs.map((p) => p?.path).filter((p) => typeof p === "string" && p !== "");
  if (declared.length === 0) fail("manifest.json declares no tilePacks path");
  for (const path of declared) {
    if (/^([a-z]+:)?[/\\]/iu.test(path) || path.split(/[/\\]/u).includes("..")) {
      fail(`manifest.json tilePacks path "${path}" must be relative to the mod folder`);
    }
    if (path.includes("/") || path.includes("\\")) {
      fail(`manifest.json tilePacks path "${path}" must be a single directory name`);
    }
  }
  return declared;
}

/** Every file under `dir`, by path relative to it, sorted. */
function walk(dir, prefix = "", out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, `${prefix}${name}/`, out);
    else out.push(`${prefix}${name}`);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * A deterministic ZIP writer.
 *
 * Stdlib only, so this repository needs no dependencies and no lockfile to produce
 * a byte-identical artefact. Every field that could vary between runs or machines -
 * mtime, order, the "made by" host - is fixed.
 * ------------------------------------------------------------------ */

/** A fixed DOS timestamp: 1980-01-01 00:00:00, the earliest the format allows. */
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1; // year 1980, month 1, day 1

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function zip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, bytes] of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(bytes);
    const deflated = deflateRawSync(bytes, { level: 9 });
    /* Store when deflate does not help, which for already-compressed PNGs is
     * common - and a stored entry is smaller than a deflated one that grew. */
    const stored = deflated.length >= bytes.length;
    const body = stored ? bytes : deflated;
    const method = stored ? 0 : 8;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // no extra field
    locals.push(local, nameBuf, body);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4); // version made by (fixed: no host byte)
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(method, 10);
    dir.writeUInt16LE(DOS_TIME, 12);
    dir.writeUInt16LE(DOS_DATE, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(body.length, 20);
    dir.writeUInt32LE(bytes.length, 24);
    dir.writeUInt16LE(nameBuf.length, 28);
    dir.writeUInt16LE(0, 30); // extra
    dir.writeUInt16LE(0, 32); // comment
    dir.writeUInt16LE(0, 34); // disk
    dir.writeUInt16LE(0, 36); // internal attrs
    dir.writeUInt32LE(0, 38); // external attrs
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4); // disk
  end.writeUInt16LE(0, 6); // central dir disk
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // comment
  return Buffer.concat([...locals, centralBuf, end]);
}

/* ------------------------------------------------------------------ *
 * Build.
 * ------------------------------------------------------------------ */

/** One archive to produce: its name in dist/, and its sorted entries. */
function plan() {
  const jobs = [];

  const rootEntries = [];
  for (const name of ROOT_FILES) {
    const full = join(root, name);
    if (!existsSync(full)) fail(`${name} is missing from the repository root`);
    rootEntries.push([name, readFileSync(full)]);
  }
  jobs.push({ file: MOD_ARCHIVE, entries: rootEntries });

  const missing = [];
  for (const key of declaredPacks()) {
    const packDir = join(packsRoot, key);
    if (!existsSync(join(packDir, "manifest.txt"))) {
      missing.push(key);
      continue;
    }
    const entries = walk(packDir).map((rel) => [
      `${key}/${rel}`,
      readFileSync(join(packDir, rel)),
    ]);
    jobs.push({ file: `neo-linoleum-${key}.zip`, entries });
  }
  /* EVERY declared pack, always. A declared pack with no archive is a Graphics row
   * that falls back to ASCII - the exact failure this mod exists to avoid - and it
   * would pass a check that only looked at the packs it happened to find. */
  if (missing.length > 0) {
    fail(
      `no built pack for: ${missing.join(", ")}\n` +
        `        Build them first:  node tools/build-packs.mjs\n` +
        `        (needs a built Neo Angband checkout at ../neo-angband)`,
    );
  }

  for (const job of jobs) {
    job.entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  }
  return jobs;
}

const results = [];
let stale = 0;

for (const job of plan()) {
  const bytes = zip(job.entries);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const outFile = join(distRoot, job.file);
  results.push({ path: `dist/${job.file}`, sha256: digest, bytes: bytes.length });

  if (verify) {
    if (!existsSync(outFile)) {
      console.error(`[pack] ${relative(root, outFile)} has not been built`);
      stale++;
      continue;
    }
    const committed = createHash("sha256").update(readFileSync(outFile)).digest("hex");
    if (committed !== digest) {
      console.error(
        `[pack] ${relative(root, outFile)} is stale.\n` +
          `        committed: ${committed}\n` +
          `        rebuilt:   ${digest}`,
      );
      stale++;
      continue;
    }
    note(`up to date: dist/${job.file} (${digest})`);
    continue;
  }

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, bytes);
  note(
    `wrote dist/${job.file} - ${job.entries.length} files, ` +
      `${(bytes.length / 1024 / 1024).toFixed(2)} MiB, ${digest}`,
  );
}

if (verify && stale > 0) {
  fail(`${stale} archive(s) stale or missing. Run: node tools/pack.mjs`);
}

const total = results.reduce((n, r) => n + r.bytes, 0);
note(`${results.length} archive(s), ${(total / 1024 / 1024).toFixed(1)} MiB total`);

if (asJson) {
  /* The shape RECOMMENDED_MODS wants, so wiring the catalogue is a copy rather
   * than a transcription of 7 digests by hand. */
  console.log(
    JSON.stringify(
      {
        approxBytes: total,
        archives: results.map(({ path, sha256 }) => ({ path, sha256 })),
      },
      null,
      2,
    ),
  );
}
