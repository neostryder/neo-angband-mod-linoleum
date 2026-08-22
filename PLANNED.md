# Planned

What is intended, deferred, or known incomplete. `CHANGELOG.md` is for what has
shipped; an intention recorded there reads to somebody else as a feature, and they
go looking for it.

An item leaves this file by landing, by being found not to apply, or by being found
unreachable in Angband 4.2.6 - not by going quiet.

## Landed: the shapechange rule has been watched rendering

**Opened with 0.16.0.** The rule that draws a shapechanged character as the
creature has now produced a pixel someone looked at, over the installed desktop
build's own CDP port rather than a test's stand-in door.

What was already measured before this, and is still true:

- Every monster the tier tables name exists in `reference/lib/gamedata/monster.txt`
  verbatim, and every shape in `shape.txt` has a table.
- Every tier of every form resolves to a tile in the shipped packs, with the two
  known gaps enumerated by name rather than tolerated.
- The tier walk-down, the palette composition and the five fallback paths are
  covered by tests over a stand-in door.
- `joint.node.test.mjs` drives the real `plugin.js` through the game's real fill
  door and real slot allocator, over the real monster registry and real tile art,
  and asserts that a level 50 Elf Druid in werewolf form ends up on a slot that
  mirrors and repaints Carcharoth's own tile in that character's palette.

What is now ALSO measured is the part a player sees: a level 2 Human Druid, under
Adam Bolt's tiles (neo-linoleum), cast Fox Form and the map tile at the player's
own square changed from the normal figure to a small quadruped rendered in the
"wild" palette's dark forest greens - visibly mirrored, tracking the player through
a move rather than sitting fixed as terrain, and distinct at a glance from both the
character's own tile and the donor wild dog's native reddish-brown colouring.

This was one form and one class palette under one pack, not the two-and-two survey
below - that broader pass, and the aesthetic judgements it requires, stays open
under "the palette is a first draft".

## Open: the palette is a first draft

Five bands, six class palettes and eleven race highlights are all authored rather
than derived, and the colour choices are the part of this feature most likely to
be wrong. Band count per pack resolution, whether a full palette remap is too
heavy compared to a blend, and whether the near-black class ramps vanish against
a dark pack all remain open pending a broader look at rendered output. Tracked as
issue #2.

## Open: two mods answering for the player's cell is unreported

The game's player-tile door takes the first non-null answer in load order. Two mods
that both answer for the same character both had an opinion and one is silently
dropped. `mod-conflicts.ts` in the game reports contested slots - two mods wanting
the same menu, the same grafID - and has no row for this one. It is a gap in the
GAME rather than here, and it is recorded in that repository's own planned list; it
is noted here because this mod is currently the only thing that would trigger it.

## Landed: the engine floor now names the version the shapechange rule needs

`manifest.json`'s overall floor stays `>=0.23.0`, which is what the kin rule
needs - the shapechange rule degrades cleanly on an older game rather than
raising the floor for everybody. The README now names 0.27.0 as the release
that first shipped the player-tile door, since that is the version this got
tagged against.

## Not planned: more tiers for the fox and the eagle

Angband 4.2.6 has no fox, no vulpine monster base, and no eagle. The fox draws from
the small end of the canine base and stops at two tiers; the eagle has the two
non-unique birds of prey the game contains plus the Phoenix. Both are recorded in
`README.md` with the candidates that were considered and why each was rejected.
Padding either with a creature that does not fit would make the feature worse, so
these stay short unless upstream adds something.
