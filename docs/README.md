# Linoleum: quick reference

An alternative tile engine, and a much easier way to build a tile set: a folder
of individual PNGs named after what they draw, instead of one sheet plus a table
of pixel coordinates.

This page is the short version: every setting, what the mod asks the game for,
and where the longer material is. The account of why each of these exists is in
[the repository README](../README.md).

## Settings

Each one is a named toggle on the game's own Mods screen, which shows the full
description. The identifier is the name a save and another mod see; where a
switch has no flag of its own, the game knows it by its section id instead.

| Setting | Identifier | Default | What it does |
| --- | --- | --- | --- |
| Draw modded content from its kin | `linoleum.deriveTiles` | on | A creature or item a mod added, with no tile of its own, is drawn from its nearest relative with the colour turned. |
| Draw a shapechanged character as the creature | `linoleum.shapeTiles` | off | While a shapechange is running - a Druid's fox, bear, eagle, bat, warg, vampire, werewolf or Pukel-man - the map draws the closest real creature for that form instead of your usual figure, mirrored and repainted in colours picked from your class and race. |

## What it needs

- **Engine:** `>=1.0.0`
- **Shape:** `tiles`
- **Facets:** `tiles`, `plugin`
- **Capabilities:** `registry:tiles`

What a capability string permits, and what a mod that asks for one cannot do
without it, is in [the mod lifecycle
document](https://github.com/neostryder/neo-angband/blob/master/docs/modding/MOD_LIFECYCLE.md).

## Elsewhere

- [README](../README.md), the full account
- [Changelog](../CHANGELOG.md), what changed in each version
- [Planned](../PLANNED.md), what is not built yet
- [The second tile
  engine](https://github.com/neostryder/neo-angband/blob/master/docs/LINOLEUM.md),
  in the game's own repository
- [Installing a
  mod](https://github.com/neostryder/neo-angband/blob/master/docs/MODS.md), the
  route every mod installs by
