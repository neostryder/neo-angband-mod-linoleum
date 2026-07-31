#!/usr/bin/env node
/**
 * Build (or verify) `dist/neo-linoleum.zip`, the installable form of this mod.
 *
 * WHY AN ARCHIVE AND NOT 1505 COMMITTED FILES. The demo tile pack is one PNG per
 * tile: 1505 files, 2.3 MB. The game's installer fetches an `archive` payload as a
 * SINGLE request, checks one digest, and unzips only after the digest matches
 * (packages/web/src/mod-install.ts). The alternative - a `files` payload - is one
 * HTTP request per file, so a 1505-request install is not a real option. The
 * archive is therefore the shape the installer already expects, not a convenience.
 *
 * WHY THE ARCHIVE HOLDS THE WHOLE MOD. An installed mod's file list IS what the
 * archive contained, and the shared validator (readModDir) requires a top-level
 * manifest.json like every other source. So manifest.json / README.md / LICENSE.md /
 * CREDITS.md travel inside the zip beside the pack directory. That duplicates them,
 * and duplication drifts - which is what `--verify` is for, and why CI runs it:
 * editing manifest.json without rebuilding is caught here rather than by a player
 * whose installed mod behaves like last week's.
 *
 * ONE PACK, SIX DECLARED. The manifest declares all six tile sets Angband ships
 * (grafID 101-106); the archive carries ONE of them, the cheap 8x8 demo, because a
 * 64x64 pack is 15 MB of generated PNGs and the other five are a player's own build.
 * A declared pack that is not present is not a broken row - the engine finds no
 * manifest.txt and that row falls back to ASCII, exactly as a missing tilesheet does.
 * So this script takes the pack it is given and checks its NAME against the declared
 * paths, rather than requiring the manifest to declare exactly what the zip holds.
 * It used to require exactly one, which is what made it exit 1 - and the `archive`
 * workflow red - from the commit that declared all six onward.
 *
 * DETERMINISTIC. Entries sorted, timestamps fixed, stdlib zlib only. The digest is a
 * function of the CONTENT, so rebuilding on another machine produces the same bytes
 * and the same sha256 - which is what makes the digest the game ships worth pinning.
 *
 *   node tools/pack.mjs [--pack <dir>] [--out <file>] [--verify]
 *
 * `--pack` is a built Linoleum pack directory. It is generated, not committed:
 * `pnpm --filter @neo-angband/web gen-linoleum-demo` in the main repository writes
 * it to packages/web/public/mods/linoleum/original-tiles, which is the default this
 * looks for in a sibling checkout.
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
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Files from the repository root that travel inside the archive. */
const ROOT_FILES = ["manifest.json", "README.md", "LICENSE.md", "CREDITS.md"];

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] !== undefined ? args[at + 1] : fallback;
};
const verify = args.includes("--verify");

const packDir = resolve(
  flag(
    "pack",
    /* The main repo's generator writes under public/mods/<modId>/, and the mod id is
     * neo-linoleum. This default said `linoleum` for two commits after the rename -
     * a sibling-checkout path that no test in either repository is in a position to
     * see, so it only ever fails in someone's hands. */
    join(
      root,
      "..",
      "neo-angband",
      "packages",
      "web",
      "public",
      "mods",
      "neo-linoleum",
      "original-tiles",
    ),
  ),
);
const outFile = resolve(flag("out", join(root, "dist", "neo-linoleum.zip")));

/**
 * Where the given pack must sit inside the zip: its own directory name, checked
 * against the manifest's declared paths.
 *
 * The check is the point. The runtime composes `mods/<id>/<declared path>/...`, so a
 * pack stored in the zip under any other name is invisible - a Graphics row that
 * silently draws nothing. Deriving the name from the directory and validating it
 * catches that, and unlike "the manifest must declare exactly one" it works whichever
 * of the six a build produced.
 */
function packPathFor(dir) {
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
  const packs = Array.isArray(manifest.tilePacks) ? manifest.tilePacks : [];
  const declared = packs
    .map((p) => p?.path)
    .filter((p) => typeof p === "string" && p !== "");
  if (declared.length === 0) fail("manifest.json declares no tilePacks path");

  /* MOD-relative by design (see the main repo's docs/LINOLEUM.md). A site path would
   * resolve to mods/<id>/mods/<id>/... and 404 into ASCII. */
  for (const path of declared) {
    if (/^([a-z]+:)?[/\\]/iu.test(path) || path.split(/[/\\]/u).includes("..")) {
      fail(`manifest.json tilePacks path "${path}" must be relative to the mod folder`);
    }
  }

  const name = basename(dir);
  if (!declared.includes(name)) {
    fail(
      `the pack at ${relative(root, dir) || dir} is named "${name}", which manifest.json\n` +
        `        does not declare. Declared: ${declared.join(", ")}`,
    );
  }
  return name;
}

function fail(message) {
  console.error(`[pack] ${message}`);
  process.exit(1);
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

if (!existsSync(join(packDir, "manifest.txt"))) {
  fail(
    `no pack at ${relative(root, packDir) || packDir} - build it first:\n` +
      `        pnpm --filter @neo-angband/web gen-linoleum-demo   (in the main repository)\n` +
      `      or pass --pack <dir>`,
  );
}

const packPath = packPathFor(packDir);

const entries = [];
for (const name of ROOT_FILES) {
  const full = join(root, name);
  if (!existsSync(full)) fail(`${name} is missing from the repository root`);
  entries.push([name, readFileSync(full)]);
}
for (const rel of walk(packDir)) {
  entries.push([`${packPath}/${rel}`, readFileSync(join(packDir, rel))]);
}
/* Sorted so the archive's byte order does not depend on the filesystem's. */
entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

const bytes = zip(entries);
const digest = createHash("sha256").update(bytes).digest("hex");

if (verify) {
  if (!existsSync(outFile)) fail(`${relative(root, outFile)} has not been built`);
  const committed = readFileSync(outFile);
  const committedDigest = createHash("sha256").update(committed).digest("hex");
  if (committedDigest !== digest) {
    fail(
      `${relative(root, outFile)} is stale.\n` +
        `        committed: ${committedDigest}\n` +
        `        rebuilt:   ${digest}\n` +
        `      Run: node tools/pack.mjs`,
    );
  }
  console.log(`[pack] up to date: ${relative(root, outFile)} (${digest})`);
  process.exit(0);
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, bytes);
console.log(
  `[pack] wrote ${relative(root, outFile)} - ${entries.length} files, ` +
    `${(bytes.length / 1024 / 1024).toFixed(2)} MB`,
);
console.log(`[pack] sha256 ${digest}`);
