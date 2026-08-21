# Planned

What is intended, deferred, or known incomplete. `CHANGELOG.md` is for what has
shipped; an intention recorded there reads to somebody else as a feature, and they
go looking for it.

An item leaves this file by landing, by being found not to apply, or by being found
unreachable in Angband 4.2.6 - not by going quiet.

## Open: the shapechange rule has never been seen

**Opened with 0.16.0.** The rule that draws a shapechanged character as the
creature is wired end to end and has never produced a pixel anybody looked at.

What IS measured, and it is not nothing:

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

What is NOT measured is the part a player sees. A slot that is allocated correctly
still has to survive `getImageData`, the ramp write-back and the mirrored blit, and
this project has shipped several seams that were correct and invisible. The
instrument for it is the installed desktop build over CDP, which is the only one of
the three that reports pixels.

**Done means:** a screenshot of a shapechanged character under a linoleum pack, for
at least two forms and two class palettes, with what was seen written down - whether
the mirror is visible, whether the palette reads as the class, and whether the tile
is legible at the pack's own resolution. Two of those are aesthetic judgements that
no test can make, which is the other half of why this is open.

## Open: the palette is a first draft

Five bands, six class palettes and eleven race highlights, all authored rather than
derived, and the colour choices are the part of this feature most likely to be
wrong. Three things to revisit once it has been seen:

- **The band count.** Five is a judgement about tiles between 8 and 64 pixels wide
  with the small end weighted. Shockbolt's 64x64 art carries far more shading than
  five bands preserve, so it may want more; the 8x8 packs may want fewer. A per-pack
  count is possible - the pack's own resolution is known when the table is built -
  and is deliberately not done yet, because a knob added before anybody has looked
  is a knob set from a guess.
- **Whether a full remap is too much.** The current transform replaces the palette
  outright. Blending the ramp with the creature's own colours at some strength would
  keep more of the art and read less as "the player's colours", and which of those
  matters more is not answerable from here.
- **The dark palette against a dark pack.** Necromancer and Blackguard share a
  near-black ramp, and Shockbolt Dark is already dark. A figure that vanishes into
  the floor is the specific risk.

## Open: two mods answering for the player's cell is unreported

The game's player-tile door takes the first non-null answer in load order. Two mods
that both answer for the same character both had an opinion and one is silently
dropped. `mod-conflicts.ts` in the game reports contested slots - two mods wanting
the same menu, the same grafID - and has no row for this one. It is a gap in the
GAME rather than here, and it is recorded in that repository's own planned list; it
is noted here because this mod is currently the only thing that would trigger it.

## Open: the engine floor does not name the version it needs

`manifest.json` still asks for `>=0.23.0`, which is what the kin rule needs. The
shapechange rule needs the player-tile door, which arrived after 0.24.0 and has no
released version number yet. The mod probes for the door at registration and says so
in the log when it is absent, so an older game degrades cleanly rather than
breaking - but a player who turns the switch on and reads nothing has to find the
log to learn why. When the game next cuts a version, the floor and the README
paragraph should name it.

## Not planned: more tiers for the fox and the eagle

Angband 4.2.6 has no fox, no vulpine monster base, and no eagle. The fox draws from
the small end of the canine base and stops at two tiers; the eagle has the two
non-unique birds of prey the game contains plus the Phoenix. Both are recorded in
`README.md` with the candidates that were considered and why each was rejected.
Padding either with a creature that does not fit would make the feature worse, so
these stay short unless upstream adds something.
