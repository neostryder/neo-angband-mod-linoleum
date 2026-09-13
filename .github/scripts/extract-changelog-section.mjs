import { readFileSync, writeFileSync } from "node:fs";

const [tag, outputPath] = process.argv.slice(2);

if (!tag || !outputPath) {
  throw new Error("Usage: node .github/scripts/extract-changelog-section.mjs <tag> <output-path>");
}

if (!tag.startsWith("v")) {
  throw new Error(`Expected a version tag beginning with v, got ${tag}`);
}

const version = tag.slice(1);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const versionPattern = escapeRegExp(version);
const changelog = readFileSync("CHANGELOG.md", "utf8");
const heading = new RegExp(
  `^## (?:${versionPattern}|\\[${versionPattern}\\])(?:\\s+-.*)?\\s*$`,
  "m",
).exec(changelog);

if (!heading || heading.index === undefined) {
  throw new Error(`No CHANGELOG.md section found for ${tag}`);
}

const nextHeading = changelog.indexOf("\n## ", heading.index + heading[0].length);
const section = changelog.slice(heading.index, nextHeading === -1 ? undefined : nextHeading);

writeFileSync(outputPath, section);
