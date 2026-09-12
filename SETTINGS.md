# Settings reference

These rules are installed through the tile registry during registration. Changing either one requires a reload.

| Flag | Default | What it does | Reload required |
| --- | --- | --- | --- |
| `linoleum.deriveTiles` | on | Draws untiled modded creatures and items from a related tile. | Yes, register side. |
| `linoleum.shapeTiles` | off | Draws a shapechanged character as the matching creature form. | Yes, register side. |

Kin fill is the default for new mod-added content. An added object can set `"linoleum:no-object-kin-fill": true` in its object record when a related item's tile would be actively misleading. It then falls back to its plain glyph until it has a tile of its own. The content mod must list `linoleum` as a dependency or optional dependency so the declared boolean field survives composition.
