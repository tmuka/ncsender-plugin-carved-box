# Guided setup: plan (steps 1 and 2 built in 0.3.6; the machine is read from ncSender, not asked)

A short series of questions that sets up Carved Box for the box you want, and then shows the whole job as a list of steps. It's for people who don't yet know which options matter. Everything it sets stays editable in the normal dialog afterwards.

## Why
Carved Box has many interacting choices:
- a carved floor or a glued-on floor (plug or inset)
- a carved or solid lid, and which half the lip is on
- one board or two, grain match
- magnets, notches, edges, rounded floor corners
- one program with tool changes, or several programs

Each is explained, but the consequences of a combination (how many programs, a flip, a glue-up, which features rule each other out) only show up as problems after you've picked. A guided setup asks about the *box and the shop*, not the options, and picks the options.

## Where it lives
- A **Guided Setup** button in the Start card, next to the presets. It opens an overlay with one question per screen, Back and Next, and a summary at the end.
- **Apply** loads the result through the same path a preset uses (`restore(from)`): your stock, bit and feeds stay unless a question changed them, and Auto Sizes is on.
- Nothing is cut or generated from the overlay. After Apply you're in the normal dialog, with the recipe (below) shown in the Start card until you change something.

## The questions
Each has a "not sure" answer that picks the common case. Answers that don't apply are skipped.

1. **What kind of box?** Ring or trinket box (small), keepsake box (medium), big box for tools or documents, or a nested set. This sets the shape presets and the size range, and leans small boxes to a carved floor and big ones to a glued-on floor.
2. **How big, and what board?** The outside size (or the inside, with Measure: Inside), and the board's thickness. Spoilboard Toolbox's Stock button fills the thickness when it's there. It warns if the board can't make the height asked for.
3. **What should it look like from outside?**
   - *Solid, no joints*: carved floor, or an inset floor.
   - *A contrasting or plywood bottom is fine*: glued-on plug bottom.
   - *The grain running round the seam*: grain match from a resawn board.
4. **How should the lid sit?**
   - *Lifts off*: carved lid; ask about magnets and finger notches.
   - *Drops in flat*: solid lid.
   - *Snug, it grips*: a straight lip.
   - *Centers itself*: a sloped lip, with magnets to hold it.
5. **Finishing touches?** Chamfered or rounded edges, and rounded floor corners. Each one is offered only if the bit for it is in the Tool Library, or the answer says "I'll change bits by hand".
6. **Your machine:** see the next section. This is asked once and remembered, not every time.

## Tool changer or not
The plugin already knows whether ncSender has a tool changer set up (`state.changer`) and reads the Tool Library. The guided setup uses that to decide how the job is split into programs, and says so plainly.

| Machine | Extra bits (edges, corners, small magnet bit) | What the recipe says |
|---|---|---|
| **ATC** (rack changer) | One program; the bits are picked from the Tool Library and changed with M6. | "One program. Load T3, T7 and T12 in the rack first." |
| **Manual tool change** set up in ncSender | One program; it pauses at each change and asks you to swap the bit, then measures it if a tool length setter is set up. | "One program. You'll be asked to change bits twice; keep the 60° V-bit and the 1/8" ball bit at hand." |
| **No tool change** | The box program, then **Edges Only** and **Corners Only** as separate programs, each zeroed in Z on the stock top with X and Y unchanged. | "Three programs. Don't move the board between them; re-zero Z on the stock top after each bit change." |
| **No tool length setter** (any of the above) | As above, but Z is re-zeroed by hand after each change. | Adds the step to each change. |

It also checks bits against the job:
- a pocket deeper than the box bit's flute length (the Tool Library's flute length or Max plunge)
- a magnet bit that's a drill
- a V-bit too small for a sloped lip or chamfer

Each of these is a question ("Your 1/4" bit's flutes are 19 mm and the pocket is 22 mm deep: use a longer bit, or make the box shallower?"), not a problem in red.

## The recipe: the summary screen
The answers become a short numbered list of what will happen, with times:

1. **Boards:** "One board, 3/4" × 14" × 6", for the ring and lid. One 1/4" plywood piece, 6" × 4", for the panel."
2. **Programs, in order,** each with its zero, bits and estimated minutes:
   - "Ring and lid: X0 Y0 at the front-left corner, Z0 on the board's top. 1/4" bit. About 28 min."
   - "Panel (Floor Only): on the plywood, same zero. About 4 min."
3. **Assembly:** cut the tabs, sand them flush; glue the panel into the ring's rabbet (plywood all round; solid wood only at the front and back middles); magnets with opposite poles up.
4. **Test Fit first?** On by default for a first box: "Cut a 6-minute test in scrap of the same board and try the lid."

The recipe uses the same plan and time estimate the dialog already computes (`boxPlan`, `boxProgram(...).minutes`), so it can't disagree with what's generated.

## How it's built
- **A pure function in `lib/`**, for example `guidedSettings(answers, machine)`, that returns the settings (the same keys a preset uses) and the recipe steps. Unit tests cover every answer path, and check that each result plans with no problems, or with only the questions it says it will ask.
- **The overlay in `config.html`**, reusing the Help overlay's styles, one `<section>` per question. Answers are kept in `state.guided`, so Back works and a reopened guide starts from the last answers.
- **The machine answers** are saved with the plugin's settings (`guidedMachine`), so the question is asked once.
- **A test-kit run** clicks through every path in the local harness: no page errors, a layout audit on each screen, and a screenshot of each summary.

## Order of work
1. `guidedSettings` with the box, size and look questions, and the summary, for a carved floor and a plug bottom.
2. The machine question, the tool-change split and the bit checks.
3. Inset floor, solid lid, grain match and nested sets in the guide.
4. Remember the answers; show the recipe in the Start card after Apply.

## Open questions
- Should the guide also offer to **save** the result as a named setting at the end?
- For **no tool change**, should it suggest dropping the finishing touches, to keep it to one program, when the user says they want it simple?
- Should the recipe be **printable** or saved as a note in the program's header, for the shop floor?
