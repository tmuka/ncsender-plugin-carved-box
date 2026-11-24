# Compartments: plan (built: steps 1 to 5; uneven sizes, a glued-on floor and a lid tray are later)

Dividers carved into the base, so the inside is split into separate spaces: a ring box with a slot section, a keepsake box with a grid, a round box cut into wedges. The dividers are left standing in the solid wood, the same way the walls are, so there's nothing to glue.

## What it looks like in the dialog
A **Compartments** card, after Magnets and Finger Notch, off by default.

| Field | What | Default |
|---|---|---|
| **Layout** | **Grid** (rows and columns) or **Wedges** (round, oval and polygon boxes: sections from the middle) | Grid for a rectangle, Wedges for a circle |
| **Rows** / **Columns** | Grid: how many across Y and X | 1 × 2 |
| **Sections**, **Middle** | Wedges: how many, and an optional round middle compartment (its diameter) | 4, none |
| **Divider Thickness** | the dividers' width | the wall's, at least 6 mm in wood |
| **Divider Height** | from the floor; **Full** stops just under where the lid reaches down | Full |
| **Sizes** | Grid only, later: each column's and row's share ("1 2 1") instead of equal | equal |

The top view draws the dividers. The side view shows their height against the lid's lip. With Measure: Inside, the header and the Start card give each compartment's inside size.

## How it's cut
Today the base's inside is one pocket (`op: 'pocket', t: tInside`, from the floor's top down). With compartments it's two:
1. **Above the dividers:** the inside as now, down to the dividers' top. When the dividers are Full, this is just the part the lid's lip needs, or nothing.
2. **Each compartment:** its own pocket from the dividers' top down to the floor, with its own `shape`, `dx` and `dy` (as the magnet holes already do).

Compartment shapes:
- **A rectangle with a grid:** each compartment is an exact rounded rectangle (`kind: 'rect'`), its corners at least the bit's radius, plus a bit of extra. A compartment in a box corner takes the inside corner's radius there. No grid approximation, so the arcs are true G2/G3.
- **Every other shape, and wedges:** the compartment is the inside intersected with the grid cell or wedge. It's made as an outline (`kind: 'outline'`, from a signed-distance grid as hearts and drawings are), with its inside corners rounded to the bit.

Finishing passes, floor skims and the cut order work per compartment as they do for the inside now. Rounded floor corners (the ball or bowl bit) go round each compartment's floor; that comes second (below).

## The checks (problems, in red)
- **Divider Thickness:** at least 2.5 mm in wood (the thin-in-wood rule), with the 6 mm suggestion as a note.
- **Each compartment** at least the bit's diameter + 1 mm across, so the bit gets in. The message names the smallest and how many fit.
- **Full height and the lid:** with the lip on the lid (a Solid or plug lid), the lid's lip reaches down into the base by the Lip Height. Dividers stop the Clearance below that. With the lip on the base, they can go up to the seam.
- **Edges:** the Inside Rim chamfer runs round the opening's edge. Where a Full divider meets the wall, the V-bit would nick the divider's end. Either stop Full dividers below the chamfer's depth, or leave that chamfer off with a note. I'd stop them below.

## What doesn't work with it (first version)
- **A Glued-On Floor (Stepped or Inset):** the ring's inside is cut through, so a divider would be loose. Turned off with a note. A later version could cut the dividers into the floor board instead, as raised strips on the floor's plug.
- **A drop-in lid:** it comes with a glued-on floor, so it's out too.
- **The lid:** no compartments in the lid at first. A shallow tray in the lid (a ring's slot, earrings) could come later.
- **Nested sets:** the inner boxes are the compartments; off for those.

## Guided Setup
After the look question: **"Inside: one space, or compartments?"** with *one space*, *2 side by side*, *a grid of 4 or 6*, *wedges*. Choosing compartments with a glued-on look says that it changes the floor to carved, and asks first.

## Steps
1. **Plan:** `o.compartments` input, the checks, and the base's inside split into the two cuts above, for rectangles (exact rounded rectangles). Tests in the simulator: dividers left standing at their height, every compartment's floor cleared, nothing cut where a divider is.
2. **Other shapes and wedges:** compartments as outlines (intersections), the same tests on circles, ovals, hearts and drawings.
3. **Dialog:** the Compartments card, the top and side views, presets, saved settings.
4. **Rounded floor corners per compartment,** the edge checks, the time estimate.
5. **Guided Setup** question and recipe line. Help and README.
6. **Later:** uneven sizes ("1 2 1"), dividers on a glued-on floor, a lid tray.

## Decided
1. Round, oval and polygon boxes get **Wedges**; a rectangle gets a **Grid**.
2. Dividers are **Full** height by default (just under where the lid reaches); Divider Height lowers them.
3. Compartments with a glued-on floor wait for a later version.
