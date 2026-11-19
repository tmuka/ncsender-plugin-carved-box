# Changelog

## Unreleased

- **Glued-On Bottom**, quicker for big boxes: the base is a ring, its inside cut out through (the middle held by tabs) instead of pocketed, glued onto a bottom whose edge is stepped down round a plug that fits inside the ring and lines it up for the glue. The bottom comes from the stock, or from its own thinner board with the new **Cut: Bottom Only**. **Oversize** leaves the bottom a little bigger, to trim flush after the glue-up. About a third less time on a 250 × 180 × 38 mm box.
- **Chamfers cut higher up the V-bit's cone** where there's room beside the edge: the same chamfer, cut by a faster part of the bit, with less fuzz in pine (not on hearts and drawings).
- **Base Height**, as Lid Height: a lower base is faced down first, its outline still cut through the stock.
- **Presets** for each main option: lip on the lid, chamfered and rounded edges, two notches, a sloped lip, rounded floor corners and a glued-on bottom.

## 0.3.3: A sloped lip, two finger notches, bigger previews

- The outside size along X is now called **Width (X)** and along Y **Length (Y)**, as most people think of a width. Only the names changed: saved sizes stay as they were.
- **Finger Notches:** 1 to 4 evenly round, from a Start Angle (0 at the front). Two to start, opposite each other, so a tight lid lifts straight up instead of tipping. Boxes saved before keep their one notch. A notch turned toward the lid is checked against the Gap, and Auto Sizes picks a magnet count that misses the notches.
- More labels on the previews, each a tap away from its setting: Outside Seam, Lead-In, Slope Height, Inside Rim and Cove Radius in the side view (when they're on), Magnets and Notch in the top view.
- Easier to see in dark mode: buttons (Save, Delete, Open SVG or DXF, Edges Only…) and choices (Shape, Lip Stands Up On…) are filled with the darker background and outlined, as QuickCut's, instead of gray on gray.
- **Enlarge the previews:** a click on a blank spot of the top or side view (or ⤢ by its title) shows it over the whole window, to zoom in with the mouse wheel, a pinch or −, + and Fit, and drag around. Words stay readable. Esc, × or another click goes back.
- **Slope Height** for the Sloped Lip: only the lip's top that far is sloped, and the lip is straight below it, so the lid centers itself and still grips at the Clearance. The opening narrows to match at its floor in small steps of the box's bit. Empty slopes the whole lip, as before.
- Help: How the lid fits now lists the ways a lid can go on and what holds it: a straight lip, the Lead-In, a whole sloped lip (no grip: add magnets), a sloped top, and magnets.
- With Auto Sizes off, switching on an option that doesn't fit your sizes (Sloped Lip, Edges, Magnets, Finger Notch, Floor Corners) now changes just the sizes it needs, never the box's size, wall, stock or bit, and the note says what changed. A sloped lip gets thicker as far as the wall leaves room, then lower; edges and the notch get smaller; magnets fewer, or the lip thinner beside them; a rectangle's corners rounder.
- The side view no longer draws a sloped lip whose slant is wider than the lip as a shape that crosses itself: it comes to a point, as the V-bit would leave it. The sloped-lip problem now gives the slant and the Lip Thickness it needs.
- **Sloped Lip** (Edges, with a V-bit): the lip's outer side and the opening's wall cut at the V-bit's angle, so the lid centers itself as it closes, with the Clearance kept all the way down. It takes the Lead-In's place. Auto Sizes makes the lip thick enough and low enough for the V-bit, and Test Fit cuts the slopes too.
- The Finishing Pass card is gone: the finishing pass is always on, set by the Material as before. Settings saved with it off now get it too.

## 0.3.2: Your own shapes, cleaner steps, a tighter lip

- **Lip and opening:** the other half's opening is now cut just the Lip Height deep (it was Lip Height + Clearance), and the lip stands up the Clearance less, so the clearance no longer eats into the lid or base and the halves still close tight on the shoulder. A box closes the Clearance lower than before.
- **Drawing**: a new shape from your own SVG or DXF file (in a DXF, closed polylines with arcs, circles, ellipses and splines, or lines and arcs meeting end to end). Its biggest closed shape is the box's outline, stretched to the Length and Width (starting at the file's size when it gives one), with Keep its proportions. The Corner Radius rounds its outside corners for the lip; the lid is cut as its mirror image so it lands on the base. Outlines that cross themselves, or that the rounding cuts apart, are refused. The drawing is saved with your settings, and Test Fit and nested sets work with it (each nested box is the outline moved in, so it fits past inside corners).
- A box typed far too big no longer stalls the page while its outline is worked out.
- With the Finishing Pass, magnet holes in the half with the lip start on the shoulder as it was roughed, not 0.25 mm or so into wood that's skimmed later.
- Drawings: a drawing's Corner Radius no longer makes it smaller than its Length and Width, and its lid stays on the stock however lopsided it is; the finger notch sits on the outline even where the front is hollow; DXF arcs and polylines written from underneath (as some CAD programs do) are read the right way round; SVGs made of loose lines are joined; thousands of DXF lines are joined quickly.
- Floor Corners: the side view no longer draws a cove bulging the wrong way in the half without the lip when its inside is too shallow for it; the note says how much wall there is above the step and what to change.
- Finishing Pass: the steps' floors (the widened opening's, the shoulder round the lip) are roughed a little short too, then skimmed in one light pass; and all of a half's finishing comes after all its roughing (the floors, then the walls' laps), so later roughing no longer tears up a finished edge and a lap cuts off fibers the floor skim lifts over an edge. Less fuzz where the step meets the inside.

## 0.3.1: Oval and heart lids fit
- Oval and heart boxes with the Finishing Pass on (the default): the finishing lap round each pocket's wall was left out, so the opening for the lip came out about 0.3 mm smaller each side than planned, and the lid wouldn't go on. Each pocket now gets its lap, as round, rectangular and polygon boxes always did.

## 0.3.0: Nested sets, grain matching, presets, Magnet Bit
- Nested Set: 2 to 5 boxes, each fitting inside the one before, all in one program on one board, or one at a time from boards as thick as each needs.
- Cut the base or the lid on its own board (Layout → Cut), the lid's from a thinner Lid Board if you like.
- Grain Match: the base and the lid from the two leaves of a resawn board, the lid cut where it lands on the base, so the grain runs on across the seam.
- Start: presets to begin from (ring, trinket, keepsake with magnets, hexagon, oval, heart, nested set), and your own settings saved under a name. Picking one loads it right away; Delete asks for a second tap.
- Magnet Bit: with a tool changer, the magnet holes can be cut with a smaller end mill from the Tool Library, after a tool change once the outlines are cut, with starting feeds for its size.
- Magnet holes start at 5 mm across (were 1/4"), for common 5 mm magnets.
- Auto Sizes with magnets: the lip down to 1/4" thick rather than the wall twice what the magnets need (a 6" x 4" box with 7 mm magnets: a 5/8" wall, was 0.72"). It no longer thickens the wall for what a wall can't fix (a hole narrower than the bit, too deep, a drill).
- Finishing Pass: its allowance and direction come from the Material (conventional in wood, climb in plastics and aluminum); the card is just the switch.
- Easier to follow: three columns on a wide screen, two on a tall one, the cards ordered from most used to least; Fit right after Box; clearer names (Wall Thickness, Base Floor, Lid Top, Lip Thickness, Clearance Each Side, Gap Between, Edge Margin, Inside Rim...); shape icons.
- Labels on the previews: tap one to go to its field. A problem under the settings goes to its field when tapped. A tap in a field picks its text, to type over.
- Each shape gets a usable size (round inches on an inch machine) when its saved one is too small or doesn't make the shape (a heart could show 0.003").
- A base lower than the stock is faced down first, as a lower lid is.

## 0.2.1: Help, Stock button, taller lips
- Help (top right): getting started, how the lid fits, Test Fit and Auto Sizes, with your box's and its test fit's previews. The README has the same, with screenshots.
- Stock Thickness: a Stock button puts in Spoilboard Toolbox's stock thickness, when Spoilboard Toolbox is installed and on. Hidden otherwise.
- Auto Sizes sets the Lid Height to the stock's thickness, so none of the lid's stock is faced away. Typed lower, it stays; otherwise it follows the Stock Thickness.
- Auto Sizes: the Lip Width is half the Wall, and in wood (MDF, softwood, hardwood) the Lip Height is at least 1/4" when the box is deep enough. For edges it thickens the wall before lowering the lip. Before, edges could bring a lip down to about 3/32".
- Edges: no Outside Seam by default (Auto Sizes too), and a bigger Lead-In (1.5 mm, 1/16") so the lid finds its way on more easily.

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
