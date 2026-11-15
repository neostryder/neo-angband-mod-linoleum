#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { SHAPE_TIERS } from "../plugin.js";
import {
  averageFloorLuminance, DARK_FLOOR_THRESHOLD, DARK_RAMP_FLOOR,
  rampForVariant, RAMP_WEIGHT, SHAPECHANGE_VARIANT, transformPixels,
} from "./shapechange-variants.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputFlag = process.argv.indexOf("--output");
const output = outputFlag < 0 ? join(root, "sources/shapechange-variants") : resolve(process.argv[outputFlag + 1]);
const packs = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")).data.tilePacks;
const variants = ["current", "blend", "adaptive"];
const classes = ["Necromancer", "Ranger"];
const forms = ["bat", "warg", "bear", "vampire"];
const race = "Human";
const cellWidth = 72;
const groupWidth = cellWidth * forms.length * classes.length + 16;
const labelWidth = 156;
const headerHeight = 60;
const rowHeight = 160;
const width = labelWidth + variants.length * groupWidth;

// The font keeps the contact sheet usable without a platform font or a graphics process.
const font = {
  A: "01110/10001/10001/11111/10001/10001/10001", B: "11110/10001/10001/11110/10001/10001/11110",
  C: "01111/10000/10000/10000/10000/10000/01111", D: "11110/10001/10001/10001/10001/10001/11110",
  E: "11111/10000/10000/11110/10000/10000/11111", F: "11111/10000/10000/11110/10000/10000/10000",
  G: "01111/10000/10000/10111/10001/10001/01111", H: "10001/10001/10001/11111/10001/10001/10001",
  I: "11111/00100/00100/00100/00100/00100/11111", J: "00111/00010/00010/00010/10010/10010/01100",
  K: "10001/10010/10100/11000/10100/10010/10001", L: "10000/10000/10000/10000/10000/10000/11111",
  M: "10001/11011/10101/10101/10001/10001/10001", N: "10001/11001/10101/10011/10001/10001/10001",
  O: "01110/10001/10001/10001/10001/10001/01110", P: "11110/10001/10001/11110/10000/10000/10000",
  Q: "01110/10001/10001/10001/10101/10010/01101", R: "11110/10001/10001/11110/10100/10010/10001",
  S: "01111/10000/10000/01110/00001/00001/11110", T: "11111/00100/00100/00100/00100/00100/00100",
  U: "10001/10001/10001/10001/10001/10001/01110", V: "10001/10001/10001/10001/10001/01010/00100",
  W: "10001/10001/10001/10101/10101/10101/01010", X: "10001/10001/01010/00100/01010/10001/10001",
  Y: "10001/10001/01010/00100/00100/00100/00100", Z: "11111/00001/00010/00100/01000/10000/11111",
  0: "01110/10001/10011/10101/11001/10001/01110", 1: "00100/01100/00100/00100/00100/00100/01110",
  2: "01110/10001/00001/00010/00100/01000/11111", 3: "11110/00001/00001/01110/00001/00001/11110",
  4: "00010/00110/01010/10010/11111/00010/00010", 5: "11111/10000/10000/11110/00001/00001/11110",
  6: "01110/10000/10000/11110/10001/10001/01110", 7: "11111/00001/00010/00100/01000/01000/01000",
  8: "01110/10001/10001/01110/10001/10001/01110", 9: "01110/10001/10001/01111/00001/00001/01110",
  "-": "00000/00000/00000/11111/00000/00000/00000",
};

function canvas(height) {
  const image = new PNG({ width, height });
  for (let i = 0; i < image.data.length; i += 4) image.data.set([28, 30, 34, 255], i);
  return image;
}

function text(image, label, x, y) {
  for (const character of label.toUpperCase()) {
    const rows = (font[character] ?? "").split("/");
    rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx += 1) {
        if (row[dx] === "1") image.data.set([232, 234, 238, 255], ((y + dy) * image.width + x + dx) * 4);
      }
    });
    x += 6;
  }
}

function headers(image) {
  text(image, "HUMAN", 8, 12);
  variants.forEach((variant, v) => {
    const left = labelWidth + v * groupWidth;
    text(image, `${String.fromCharCode(65 + v)} ${variant}`, left, 8);
    classes.forEach((cls, c) => {
      text(image, cls, left + c * forms.length * cellWidth, 25);
      forms.forEach((form, f) => text(image, form, left + (c * forms.length + f) * cellWidth, 44));
    });
  });
}

function crop(sheet, selector, source) {
  const tileWidth = source.tileWidth ?? source.resolution;
  const tileHeight = source.tileHeight ?? source.resolution;
  const tall = source.overdrawRow > 0 && selector.row >= source.overdrawRow && selector.row <= source.overdrawMax;
  const x = selector.column * tileWidth;
  const y = (selector.row - Number(tall)) * tileHeight;
  const height = tileHeight * (tall ? 2 : 1);
  if (x < 0 || y < 0 || x + tileWidth > sheet.width || y + height > sheet.height) {
    throw new Error(`${source.key}: source rectangle is outside the atlas`);
  }
  const tile = new PNG({ width: tileWidth, height });
  PNG.bitblt(sheet, tile, x, y, tileWidth, height, 0, 0);
  return tile;
}

function drawTile(image, tile, floor, x, y, scale) {
  const height = tile.height * scale;
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < tile.width * scale; dx += 1) {
      const sx = Math.floor(dx / scale);
      const sy = Math.floor(dy / scale);
      const background = ((sy % floor.height) * floor.width + sx % floor.width) * 4;
      const foreground = (sy * tile.width + tile.width - sx - 1) * 4;
      const destination = ((y + dy) * image.width + x + dx) * 4;
      const alpha = tile.data[foreground + 3] / 255;
      const floorAlpha = floor.data[background + 3] / 255;
      for (let c = 0; c < 3; c += 1) {
        image.data[destination + c] = Math.round(tile.data[foreground + c] * alpha + floor.data[background + c] * floorAlpha * (1 - alpha));
      }
    }
  }
}

mkdirSync(output, { recursive: true });
const overview = canvas(headerHeight + packs.length * rowHeight);
headers(overview);
const legend = {
  defaultVariant: SHAPECHANGE_VARIANT,
  variants: { current: { bands: 5 }, blend: { bands: 5, rampWeight: RAMP_WEIGHT }, adaptive: {
    bands: { through16px: 4, through32px: 5, above32px: 7 },
    darkFloorBelow: DARK_FLOOR_THRESHOLD, minimumDarkRampLuminance: DARK_RAMP_FLOOR, floorMargin: 32,
  } },
  luminance: "Rec. 601 byte luma: (299R + 587G + 114B) / 1000",
  floorSelection: "Unconditional FLOOR:lit; contrast uses the mean of all unconditional FLOOR lighting variants, composited over black",
  columns: variants.flatMap((variant) => classes.flatMap((cls) => forms.map((form) => ({ variant, cls, race, form, monster: SHAPE_TIERS[form][0].monster })))),
  packs: [],
};

for (const [row, pack] of packs.entries()) {
  const source = pack.tilesheet;
  const sheet = PNG.sync.read(readFileSync(join(root, pack.path, source.image)));
  const selectors = JSON.parse(readFileSync(join(root, pack.path, source.tileMap), "utf8")).data.files.flatMap((file) => file.selectors);
  function select(type, name) {
    const matches = selectors.filter((entry) => entry.type === type && entry.selector.toLowerCase() === name.toLowerCase() && !entry.condition);
    if (matches.length === 0) throw new Error(`${source.key}: no unconditional ${type}:${name}`);
    // The converter overwrites repeated selectors with the last source rectangle.
    return matches.at(-1);
  }
  const floorSelector = select("feat", "FLOOR:lit");
  const floor = crop(sheet, floorSelector, source);
  const floorSelectors = [...new Set(selectors.filter((entry) => entry.type === "feat" && /^FLOOR:/i.test(entry.selector) && !entry.condition).map((entry) => entry.selector))];
  const floorLuminance = floorSelectors.reduce((sum, name) => sum + averageFloorLuminance(crop(sheet, select("feat", name), source).data), 0) / floorSelectors.length;
  const scale = Math.ceil(64 / (source.tileWidth ?? source.resolution));
  const image = canvas(headerHeight + rowHeight);
  headers(image);
  text(image, source.key, 8, headerHeight + 16);
  text(image, `${source.tileWidth ?? source.resolution} X ${source.tileHeight ?? source.resolution}`, 8, headerHeight + 32);
  const packLegend = { key: source.key, image: `${source.key}.png`, floorLuminance, displayedFloorLuminance: averageFloorLuminance(floor.data), floorSelector, scale, ramps: {}, creatures: [] };
  for (const [v, variant] of variants.entries()) {
    for (const [c, cls] of classes.entries()) {
      const ramp = rampForVariant(cls, race, source.resolution, floorLuminance, variant);
      packLegend.ramps[`${variant}/${cls}`] = ramp;
      for (const [f, form] of forms.entries()) {
        const monster = SHAPE_TIERS[form][0].monster;
        const selector = select("monster", monster);
        const tile = crop(sheet, selector, source);
        if (v === 0 && c === 0) packLegend.creatures.push({ form, monster, selector });
        transformPixels(tile.data, ramp, variant);
        const x = labelWidth + v * groupWidth + (c * forms.length + f) * cellWidth;
        const y = headerHeight + rowHeight - 12 - tile.height * scale;
        drawTile(image, tile, floor, x, y, scale);
      }
    }
  }
  PNG.bitblt(image, overview, 0, headerHeight, width, rowHeight, 0, headerHeight + row * rowHeight);
  writeFileSync(join(output, packLegend.image), PNG.sync.write(image));
  legend.packs.push(packLegend);
  console.log(`[shapechange] ${source.key}: floor ${floorLuminance.toFixed(2)}, adaptive ${packLegend.ramps["adaptive/Necromancer"].length} bands`);
}
writeFileSync(join(output, "overview.png"), PNG.sync.write(overview));
writeFileSync(join(output, "legend.json"), `${JSON.stringify(legend, null, 2)}\n`);
console.log(`[shapechange] wrote ${packs.length + 1} PNGs and legend.json to ${output}`);
