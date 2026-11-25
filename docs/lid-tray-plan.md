# Lid Tray: plan (built; the fixture way and compartments in the dish are later)

A shallow dish carved into the outside of the lid's top, so the closed box works as a catch-all tray for keys, rings or coins. Today nothing is cut on that face: the lid's top is the board's underside while the box is carved. So the board has to be turned over, and the dish is carved in a second setup.

## The idea in short
1. **First program, Cut "Tray (Turned Over)":** with the board's underside facing up, it drills two pin holes through the board and a little way into the spoilboard. Then it carves the dish where the lid will be.
2. Turn the board over end for end, across the line between the halves (the way the lid turns over onto the base), and drop two 1/4" dowel pins through it into the spoilboard holes.
3. **Second program, the box as it is today.** Don't change X0 Y0. Only zero Z again, on the new top.

The pins put the board back in exactly the same place, mirrored, so the dish lines up with the lid. The whole board stays clamped for both programs, so no small loose part has to be held.

## What it looks like in the dialog
A **Lid Tray** card after Compartments, off by default.

| Field | What | Default |
|---|---|---|
| **Tray Depth** | how deep the dish is, from the lid's top | 6 mm (1/4") |
| **Tray Rim** | how wide the flat rim round the dish is, from the lid's outside edge | the Wall Thickness |
| **Tray Floor** | flat, or rounded with the Corner Bit (the ball or bowl bit, as compartments and the base's floor do) | flat |
| **Pin Diameter** | the dowel pins; the holes are bored to it with the box's bit | 6.35 mm (1/4") |

- **Cut** gets a new choice, **Tray (Turned Over)**, which is the first program (not "Lid Top": that's already the field for how thick the lid's top is). **Both, Side by Side** stays the second program, unchanged apart from the bigger board and the pins drawn in its top view.
- **Edges:** while that face is up, the lid's top outside edge and the dish's edge can take the Edge Bit's chamfer or roundover too. Today the closed box's top edge is left square. **Tray Edges** sets how far down.
- **The top view** shows the pins on both programs. With Lid Top selected, it shows the board as it lies turned over: the lid mirrored, with the dish.
- **The side view** draws the dish in the lid's top.
- **The note** gives the dish's size and the wood left under it.

## How it's cut
- **Pins:** two holes on the line the board turns over on: across the board between the halves, at its middle. There's one at each side, past the parts, so the board is about 2 × (pin + bit + 3 mm) wider. Turned over that way, the dish is the box's own outline (the lid's mirrored back), with no new shapes. Each hole is helix-bored to the Pin Diameter, through the board and 3 mm into the spoilboard. The bit must be smaller than the pins.
- **The dish:** a pocket the lid's outline, moved in by the Tray Rim, Tray Depth deep. It uses the lid's own shape, and it's mirrored about the pin line, since the board is upside down. For a drawing, that undoes the lid's mirroring, so the dish matches the lid as you see it. It uses the same pocket code as the base's inside, with finishing passes and floor skims, and the rounded floor when it's on.
- **Tray Edges:** the lid's outline and the dish's opening, with the same edge code, on this face.
- **Z:** zero on the board's top for each program. The Stock Thickness is the same for both, so nothing else changes.

## The checks (problems, in red)
- **Wood under the dish:** Lid Top − Tray Depth must be at least 3 mm. Auto Sizes raises the Lid Top to make room, which makes the inside shallower, and the note says so.
- **Rim:** the dish is at least the bit's diameter + 1 mm across, and the rim at least 3 mm.
- **Magnets in the lid:** at least 2 mm of wood between the dish and each magnet hole. The holes go up into the lid's rim from the other face.
- **Pins:** they must fit inside the board with the Edge Margin, and the box's bit must be smaller than the Pin Diameter.

## What doesn't work with it (first version)
- **A Drop-In Lid:** the lid is a panel from the Floor Board, not this board.
- **Grain Match, or a separate Lid Board:** the lid is on a different board. A later version could turn just that board over.
- **Nested sets.**
- **An Inset Floor's ring** is already turned over in the other direction, so it's out for now.

## Other ways I looked at
- **Afterwards, on a fixture:** cut a plug (or a pocket) in scrap that the lid fits on, the way it fits the base, then carve the dish in the loose lid. It works for a box that's already made, but a small part held by its fit can move or spin under the bit. This could come later, as "Lid Top only".
- **Square the board against stops** (such as dog-hole pins) instead of drilled pins. The flip then depends on how exactly the board is cut to size. Drilled pins don't.

## Steps
1. **Plan:** the `o.tray` input, the checks, the pins in the layout, and the Lid Top half (pins, dish) mirrored about the pin line. Simulator tests: the dish depth and rim, nothing cut under 3 mm from the cavity or a magnet, the pin holes the same in both programs, the dish lining up with the lid after the flip.
2. **Program:** the Lid Top program and the pin holes. Its header says to turn the board over end for end onto the pins and keep X0 Y0.
3. **Dialog:** the card, Program For, the top view turned over, the side view, presets, saved settings.
4. **Tray Edges**, a rounded tray floor, the time estimate.
5. **Help and README:** the two-program workflow, with a picture of turning the board over. Guided Setup could ask about it later.
6. **Later:** compartments in the dish, Lid Top only on a fixture, the Lid Board turned over.

## To decide
1. **Pins drilled through, or stops?** I'd drill pins: they're exact, and you already have 1/4" dowel pins.
2. **Dish first, then the box?** I'd do the dish first. The box program cuts the halves free, so it has to be last.
3. **Edges on the Lid Top in the first version, or later?** It's little extra work and fixes the square top edge, so I'd put it in the first version.
