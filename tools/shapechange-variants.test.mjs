import { describe, expect, it } from "vitest";
import { CLASS_PALETTES, paletteFor, RACE_HIGHLIGHTS } from "../plugin.js";
import {
  averageFloorLuminance, bandCountForSize, blendToRamp, DARK_FLOOR_THRESHOLD,
  DARK_RAMP_FLOOR, luminance, rampForVariant, SHAPECHANGE_VARIANT, transformPixels,
} from "./shapechange-variants.mjs";

describe("shapechange palette candidates", () => {
  it("keeps the default at the existing five-band full remap", () => {
    expect(SHAPECHANGE_VARIANT).toBe("current");
    const ramp = paletteFor("Necromancer", "Human");
    expect(rampForVariant("Necromancer", "Human", 64, 0)).toEqual(ramp);
    const pixels = Buffer.from([0, 0, 0, 255, 51, 51, 51, 128, 52, 52, 52, 255, 255, 255, 255, 255, 7, 8, 9, 0]);
    transformPixels(pixels, ramp);
    expect([...pixels]).toEqual([...ramp[0], 255, ...ramp[0], 128, ...ramp[1], 255, ...ramp[4], 255, 7, 8, 9, 0]);
  });

  it.each([[8, 4], [16, 4], [24, 5], [32, 5], [48, 7], [64, 7]])("gives size %ipx a ramp with %i bands", (size, bands) => {
    expect(bandCountForSize(size)).toBe(bands);
    const ramp = rampForVariant("Ranger", "Human", size, 100, "adaptive");
    expect(ramp).toHaveLength(bands);
    expect(ramp[0]).toEqual(paletteFor("Ranger", "Human")[0]);
    expect(ramp.at(-1)).toEqual(RACE_HIGHLIGHTS.Human);
  });

  it("mixes 60 percent ramp and 40 percent source while preserving alpha and transparent RGB", () => {
    const pixels = Buffer.from([200, 60, 20, 128, 7, 8, 9, 0]);
    blendToRamp(pixels, paletteFor("Necromancer", "Human"));
    expect([...pixels]).toEqual([102, 40, 39, 128, 7, 8, 9, 0]);
    expect(rampForVariant("Necromancer", "Human", 64, 0, "blend")).toHaveLength(5);
  });

  it.each([8, 32, 64])("remaps the complete brightness range into the adaptive bands at %ipx", (size) => {
    const pixels = Buffer.from(Array.from({ length: 256 }, (_, value) => [value, value, value, 128]).flat());
    const ramp = rampForVariant("Necromancer", "Human", size, 25.09, "adaptive");
    transformPixels(pixels, ramp, "adaptive");
    const colours = new Set();
    for (let i = 0; i < pixels.length; i += 4) {
      colours.add(pixels.subarray(i, i + 3).join(","));
      expect(pixels[i + 3]).toBe(128);
    }
    expect([...colours]).toEqual(ramp.map((colour) => colour.join(",")));
  });

  it.each(Object.keys(CLASS_PALETTES))("preserves source luma order across saturated colours and band boundaries for %s", (cls) => {
    const colours = [];
    for (let r = 0; r <= 255; r += 17) {
      for (let g = 0; g <= 255; g += 17) {
        for (let b = 0; b <= 255; b += 17) colours.push([r, g, b]);
      }
    }
    for (let value = 0; value <= 255; value += 1) colours.push([value, value, value]);
    colours.sort((a, b) => luminance(a) - luminance(b));
    const pixels = Buffer.from(colours.flatMap((colour) => [...colour, 255]));
    const ramp = paletteFor(cls, "Human");
    const expectedMean = colours.reduce((sum, colour) => {
      const source = luminance(colour);
      return sum + source * 0.4 + luminance(ramp[Math.floor(source * 5 / 256)]) * 0.6;
    }, 0) / colours.length;
    blendToRamp(pixels, ramp);
    let previous = 0;
    let sum = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const value = luminance(pixels.subarray(i, i + 3));
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
      sum += value;
    }
    expect(Math.abs(sum / colours.length - expectedMean)).toBeLessThan(0.6);
  });

  it.each(["Necromancer", "Blackguard"])("lifts %s only below the dark-floor threshold", (cls) => {
    for (const race of Object.keys(RACE_HIGHLIGHTS)) {
      for (const size of [8, 16, 24, 32, 48, 64]) {
        const dark = rampForVariant(cls, race, size, 25.09, "adaptive");
        const light = rampForVariant(cls, race, size, DARK_FLOOR_THRESHOLD, "adaptive");
        expect(luminance(dark[0])).toBeGreaterThanOrEqual(DARK_RAMP_FLOOR);
        expect(light[0]).toEqual(paletteFor(cls, race)[0]);
        expect(dark.at(-1)).toEqual(light.at(-1));
        for (let i = 1; i < dark.length; i += 1) expect(luminance(dark[i])).toBeGreaterThan(luminance(dark[i - 1]));
      }
    }
    const nearThreshold = rampForVariant(cls, "Human", 64, 47, "adaptive");
    expect(luminance(nearThreshold[0])).toBeGreaterThanOrEqual(79);
  });

  it("keeps every other class ramp unchanged on dark floors and does not mutate the authored colours", () => {
    const original = paletteFor("Necromancer", "Human");
    rampForVariant("Necromancer", "Human", 64, 0, "adaptive");
    expect(paletteFor("Necromancer", "Human")).toEqual(original);
    for (const [cls, group] of Object.entries(CLASS_PALETTES)) {
      if (group === "dark") continue;
      expect(rampForVariant(cls, "Human", 64, 0, "adaptive")).toEqual(rampForVariant(cls, "Human", 64, 100, "adaptive"));
    }
    expect(rampForVariant("Unknown", "Human", 64, 0, "adaptive")).toBeNull();
    expect(rampForVariant("Ranger", "Unknown", 64, 0, "adaptive")).toBeNull();
  });

  it("measures floor pixels as they appear over black", () => {
    expect(averageFloorLuminance(Buffer.from([255, 255, 255, 255, 255, 255, 255, 0]))).toBe(127.5);
    expect(averageFloorLuminance(Buffer.from([255, 255, 255, 128]))).toBe(128);
  });
});
