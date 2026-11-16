# Changelog

## 0.1.0: Round and rectangular boxes
- A round or rectangular box (with rounded corners) with a lid from one board: base and lid side by side, a lip on either half with a set clearance, holding tabs, starting feeds from the bit and material.
- A lid lower than the stock (faced down first), magnet holes in both halves, a finger notch, and Test Fit: a small box with the same fit to try first.
- Auto Sizes (on for a first try): the wall, floor, top, lip, clearance (from the material), gap, margin, tabs, notch, magnet count and edges filled in for the box's size, stock and bit, made to fit each other; typing in one sets it yourself.
- Every move sideways is at the machine's safe height (ncSender's Safe Z, else machine Z0), after each tool change too; the bit comes down quickly to 1 mm over the stock. It went to 5 mm over the stock before moving, low enough to hit clamps.
- Finishing Pass (on by default): the roughing leaves an Allowance (0.3 mm) on the pockets', the opening's and the lip's walls; then one climbing lap round each (clockwise in a pocket) for cleaner walls.
- V-bits have a Tip Diameter (from the Tool Library when it has one): the bit goes half of it off the edge, so the chamfer starts at the edge instead of a small step.
- The Margin is to the outside of the cuts (it was to the outline's middle, so the bit took half its width of it).
- Floor Corners: a ball or bowl bit rounds each pocket's floor corners; the box's bit leaves the floor that radius short of the walls for it. Cut after the outlines (before the edges) after a tool change, or on their own with Corners Only.
- Edges: Lead-In (the lip's outer edge, the opening's) and Pocket Edge (each pocket's top edge, the step's too) sized on their own.
- A card switched off (Tabs, Magnets, Finger Notch, Edges) shows its header only.
- Bits picked from the Tool Library as in QuickCut: the picked tool shown, a list with a filter (T number, name, notes, size or slot); V-bits and roundovers first for the edge bit.
- Lengths and feeds in mm or inches, mixed as you like (1/4", 6.35mm, 12mm + 1/8in, 60ipm), shown in your units when you leave the field; Up / Down step them. Defaults on an inch machine are round inch sizes.
- Chamfered or rounded edges with a V-bit or roundover bit: the outside seam where the halves meet and the inside rim, cut last after a tool change, or as their own program (Edges Only) with no tool changer.
