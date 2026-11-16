# Carved Box

An [ncSender](https://github.com/siganberg/ncSender) plugin that carves a round or rectangular box with a lid out of one board. The base and the lid are cut side by side: each is pocketed down to its wall, floor and top, a lip on one half slides into the other with the clearance you set, and both outlines are cut free with holding tabs. One bit, one program.

## Settings

- **Box:** the **Shape**: **Round**, with its outside **Diameter**, or **Rectangle**, with its outside **X Length**, **Y Width** and **Corner Radius** (at least Wall − Lip Width − Clearance + half the bit, so the lip's corners fit the opening; the inside corners are tighter by the wall, at least half the bit). Then your measured **Stock Thickness** (the base is the full thickness), the **Wall**, the base's **Floor**, the lid's **Top**, and the **Lid Height**: empty for the full thickness, or lower, when the lid's area is faced down first.
- **Fit:** which half the **Lip** is on, its **Height** and **Width** (the inner part of the wall), and the **Clearance** each side: about 0.2–0.3 mm in wood (it moves with the weather), 0.1 mm in plastic. The other half's opening is widened by the Lip Width plus the Clearance, Lip Height plus the Clearance deep, so the halves meet on the shoulder outside the lip.
- **Layout:** the halves side by side **Along X** or **Along Y**, the **Gap** of wood left between them and the **Margin** to the stock's edges; the origin (X0 Y0) at the stock's **front-left corner** or the **middle of the pair**. Z0 is the top of the stock. The stock needed is shown.
- **Holding Tabs:** count, width and height (from the bottom of each half) on each outline.
- **Magnets:** holes of a set diameter and depth facing each other where the halves meet, the same in both, evenly round the wall outside the lip, half a space either side of the front so they miss the finger notch. A rectangle needs an even number, so they line up whichever way the lid turns over. Glue the magnets in with opposite poles up so they pull together. They need a wall at least Lip Width + Clearance + the hole + 1.6 mm thick.
- **Finger Notch:** a round scoop of a set width and depth in the base's rim at the front (the left side when the halves are along Y), to lift the lid by.
- **Edges:** chamfers (a V-bit, with its angle and diameter) or roundovers (a roundover bit, with its radius and tip diameter), each sized by how far down it goes. **Outside Seam** cuts each half's rim at its outer edge: closed, the two make a groove where the halves meet. **Inside Rim** cuts the opening's edge and the lip's top edges, to ease the lid on. On the half with the lip, the seam is down at the shoulder, so the bit must clear the lip standing above it: that needs a thicker wall, a smaller seam or a narrower V-bit, and the waste round it is cleared first as far as the bit reaches. Edges go down in passes of the box's Depth of Cut. The outer top and bottom of the closed box lie on the spoilboard, so they can't be reached. The edges are cut last, after the outlines. With a tool changer set up in ncSender (a manual one too) and the edge bit picked from the Tool Library, the program changes to it (M6). Otherwise cut the box, put the edge bit in, zero Z on the stock top (keep X and Y), and run **Edges Only**.
- **Tool & Feeds:** a bit from ncSender's Tool Library (with a tool changer, the program starts with `M6 T`) or a typed size, and starting feeds from the bit, its flutes and the material, as QuickCut's.

The previews show both halves on the stock, and the closed box cut through its middle: the lip in the other half's opening, the clearance drawn a little wider to be seen, the closed and inside heights.

**Test Fit** cuts a small box with the same fit, only as deep inside as the lip needs: try it before the real one, and adjust the Clearance. A rectangle's is square, with the same corner radius.

## What it cuts

1. A lower lid's area, faced down to the Lid Height. Then each half's inside: a ramp down along a small loop in the middle (a circle, or a long box's center line), loops out to the wall, a pass at a time; the widened opening for the lip first on the half without it; the shoulder round the lip (a ramp along its first loop, loops out past the outline) on the half with it; the magnet holes and the finger notch.
2. Both outlines, after the insides so the board stays stiff: a helical ramp, through the stock and 0.5 mm into the spoilboard, lifting over each tab on the last passes.
3. The edges, with the edge bit: a ramp down along each edge, a pass at a time.

Put the side of the board you want on the outside of the lid face down: the lid's top is the board's underside.

## License

GPL-3.0. The starting feeds are QuickCut's (siganberg/ncsender-plugin-quickcut), copied by `npm run sync-quickcut`.
