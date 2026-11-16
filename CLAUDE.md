# Carved Box: notes for working on it

An ncSender plugin (`com.tmuka.carved-box`): a two-part box with a lid carved side by side from one board.
GPL-3.0: it reuses QuickCut's starting feeds (siganberg/ncsender-plugin-quickcut).

| File | What |
| --- | --- |
| `config.html` | The dialog. ncSender runs it inline, so `lib/*.cjs` and the unit-input library are copied in between `/* BEGIN x */` markers by `.scripts/inline.cjs` (`npm test` checks they're current). |
| `lib/box-plan.cjs` | The plan: radii, depths, the halves' places and cuts, problems and notes. mm. |
| `lib/box-gcode.cjs` | The program from a plan: pockets, the shoulder ring, outlines with tabs; G21, arcs G3. |
| `lib/starting-feeds.cjs` | QuickCut's, copied by `npm run sync-quickcut` from a QuickCut checkout's upstream/main; `tests/sync.test.cjs` checks it when one is there. |

Tests (`npm test`): the program run through a small simulator: nothing cut where wood stays (walls, lip, floor/top, tabs), no rapids sideways or down below the top, floors cleared, outlines through.
UI: `~/Documents/projects/ncsender-plugin-testkit` (`openLocal({ config: 'config.html', pluginId: 'com.tmuka.carved-box' })`).
Not in the plugin manifest (ncsender-plugin-manifest) until the user says it's ready.
