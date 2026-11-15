import { CLASS_PALETTES, paletteFor } from "../plugin.js";

// These experiments stay outside the archive so the installed transform stays unchanged.
export const SHAPECHANGE_VARIANT = "current";
export const RAMP_WEIGHT = 0.6;
export const DARK_FLOOR_THRESHOLD = 48;
export const DARK_RAMP_FLOOR = 64;

export function luminance([r, g, b]) {
  return (299 * r + 587 * g + 114 * b) / 1000;
}

export function bandCountForSize(size) {
  // Small tiles need four steps through 16px, medium tiles five through 32px, and larger tiles seven.
  return size <= 16 ? 4 : size <= 32 ? 5 : 7;
}

function resampleRamp(ramp, bands) {
  return Array.from({ length: bands }, (_, i) => {
    const position = i * (ramp.length - 1) / (bands - 1);
    const low = Math.floor(position);
    const high = Math.min(low + 1, ramp.length - 1);
    return ramp[low].map((value, c) => Math.round(value + (ramp[high][c] - value) * (position - low)));
  });
}

export function rampForVariant(cls, race, size, floorLuminance, variant = SHAPECHANGE_VARIANT) {
  const ramp = paletteFor(cls, race);
  if (ramp === null) return null;
  if (variant !== "adaptive") return ramp;
  if (CLASS_PALETTES[cls] === "dark" && floorLuminance < DARK_FLOOR_THRESHOLD) {
    // Lifting the low end towards the highlight preserves order instead of inverting the next band.
    const low = luminance(ramp[0]);
    const high = luminance(ramp.at(-1));
    const target = Math.max(DARK_RAMP_FLOOR, floorLuminance + 32);
    const lift = Math.max(0, (target - low) / (high - low));
    const highlight = ramp.at(-1);
    for (const colour of ramp) {
      for (let c = 0; c < 3; c += 1) colour[c] = Math.ceil(colour[c] + (highlight[c] - colour[c]) * lift);
    }
  }
  return resampleRamp(ramp, bandCountForSize(size));
}

export function averageFloorLuminance(pixels) {
  let sum = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    // The grid uses a black canvas, so translucent floor pixels contribute their composited brightness.
    sum += luminance(pixels.subarray(i, i + 3)) * pixels[i + 3] / 255;
  }
  return pixels.length === 0 ? 0 : sum / (pixels.length / 4);
}

function rampColour(colour, ramp) {
  const index = Math.max(0, Math.min(ramp.length - 1, Math.floor(luminance(colour) * ramp.length / 256)));
  return ramp[index];
}

export function blendToRamp(pixels, ramp, weight = RAMP_WEIGHT) {
  const colours = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    const source = Array.from(pixels.subarray(i, i + 3));
    colours.set(source.join(","), source);
  }
  const mapped = new Map();
  const ordered = [...colours.entries()].sort((a, b) => luminance(a[1]) - luminance(b[1]));
  const blocks = [];
  function colourOf(block) {
    return block.sum.map((value) => Math.round(value / block.count));
  }
  for (const [index, [, source]] of ordered.entries()) {
    const slot = rampColour(source, ramp);
    blocks.push({ start: index, end: index + 1, count: 1, sum: source.map((value, c) => value * (1 - weight) + slot[c] * weight) });
    // Pooling rounding reversals preserves byte luma order without accumulating brightness corrections.
    while (blocks.length > 1 && luminance(colourOf(blocks.at(-2))) > luminance(colourOf(blocks.at(-1)))) {
      const right = blocks.pop();
      const left = blocks.at(-1);
      left.end = right.end;
      left.count += right.count;
      for (let c = 0; c < 3; c += 1) left.sum[c] += right.sum[c];
    }
  }
  for (const block of blocks) {
    const colour = colourOf(block);
    for (let i = block.start; i < block.end; i += 1) mapped.set(ordered[i][0], colour);
  }
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    const colour = mapped.get(Array.from(pixels.subarray(i, i + 3)).join(","));
    for (let c = 0; c < 3; c += 1) pixels[i + c] = colour[c];
  }
  return pixels;
}

export function transformPixels(pixels, ramp, variant = SHAPECHANGE_VARIANT) {
  if (variant === "blend") return blendToRamp(pixels, ramp);
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    const colour = rampColour(pixels.subarray(i, i + 3), ramp);
    for (let c = 0; c < 3; c += 1) pixels[i + c] = colour[c];
  }
  return pixels;
}
