# Settings reference

These rules are installed through the tile registry during registration. Changing either one requires a reload.

| Flag | Default | What it does | Reload required |
| --- | --- | --- | --- |
| `linoleum.deriveTiles` | on | Draws untiled modded creatures and items from a related tile. | Yes, register side. |
| `linoleum.shapeTiles` | off | Draws a shapechanged character as the matching creature form. | Yes, register side. |

Kin fill is the default for new mod-added content. When a relative's tile would mislead the player, an added item or monster can opt out: set `"linoleum:no-object-kin-fill": true` on its object record or `"linoleum:no-monster-kin-fill": true` on its monster record, and it keeps its plain glyph until it gets a tile of its own. Either field only survives composition when the content mod lists `linoleum` as a dependency or optional dependency.
