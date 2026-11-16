# Changelog

## Unreleased
- Stock Thickness: a Stock button puts in Spoilboard Toolbox's stock thickness, when Spoilboard Toolbox is installed and on. Hidden otherwise.

## 0.2.0: Polygon, oval and heart boxes
- Polygon: 3 to 12 sides across the flats, rounded corners, a flat side to the front so the lid lines up turned over (odd sides too).
- Oval: an ellipse, its length along X and width along Y.
- Heart: across its lobes, from its point to the top, its point rounded (enough for the lip to fit); the point to the front. Its pocket comes apart into the lobes deep down, and each piece is cleared on its own.
- An oval's and a heart's walls and pockets are worked out from their outlines, to within 0.02 mm.
- Checks that the lip fits an oval's ends and a heart's point and notch; Auto Sizes picks a wall that does. Test Fit makes a small heart for a heart box.

## 0.1.0: Round and rectangular boxes
- A round or rectangular box (rounded corners) with a lid, carved side by side from one board: each half pocketed to its wall, floor and top, a lip on either half sliding into the other with the clearance you set, the outlines cut free with holding tabs.
- A lid lower than the stock (its area faced down first), magnet holes facing each other in both halves, a finger notch, and Test Fit: a small box with the same fit to try first.
- Auto Sizes (on for a first try): the wall, floor, top, lip, clearance (from the material), gap, margin, tabs, notch, magnet count and edges filled in for the box's size, stock and bit, made to fit each other; type in one to set it yourself.
- Finishing Pass (on by default): the roughing leaves an Allowance on the walls, then one lap round each, Conventional (the default) or Climb.
- Floor Corners: a ball or bowl bit rounds the pockets' floor corners.
- Edges: chamfers (a V-bit, with its flat tip allowed for) or roundovers on the outside seam where the halves meet, a Lead-In round the lip and the opening, and each Pocket Edge.
- The corner and edge bits are cut after the outlines, after a tool change when they're picked from the Tool Library and ncSender has a tool changer; otherwise with Corners Only and Edges Only, as their own programs.
- Every move sideways is at the machine's safe height (ncSender's Safe Z); the bit comes down quickly to 1 mm over the stock, then at the plunge rate.
- The Margin is wood left from the stock's edges to the outside of every cut.
- Bits picked from the Tool Library as in QuickCut: a list with a filter (T number, name, notes, size or slot); starting feeds from the bit and material.
- Lengths and feeds in mm or inches, mixed as you like (1/4", 6.35mm, 12mm + 1/8in, 60ipm); Up / Down step them.
- Checks before anything's cut: sizes that don't make a box, bits that don't fit, programs too big to load, a second bit with no speed or the wrong kind; a card switched off shows its header only.
