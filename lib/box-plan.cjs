/**
 * Carved Box: the plan of a two-part box, base and lid, carved side by
 * side out of one board. All lengths in mm.
 *
 * Each half is the full thickness of the stock. Its inside is pocketed
 * from the top face, leaving the Wall all round and the Floor (base) or
 * Top (lid) underneath; its outline is then cut free, with tabs. One half
 * carries a lip: its wall top is cut down by the Lip Height outside a
 * ring Lip Width thick, standing up round the opening. The other half's
 * opening is widened by the Lip Width plus the Clearance, Lip Height plus
 * the Clearance deep, so the lip slides in and the halves meet on the
 * shoulder outside it. The lid is turned over onto the base.
 */

// The settings a plan takes, with their defaults (mm).
var DEFAULTS = {
  diameter: 80, stock: 19, wall: 6, floor: 4, top: 4,
  lipOn: 'base', lipHeight: 4, lipWidth: 3, clearance: 0.2,
  gap: 12, layout: 'x', origin: 'front-left', margin: 5,
  bit: 3.175, through: 0.5, tabs: { count: 4, width: 6, height: 1.5 }
};

// The plan: radii, depths, where each half goes, its cuts in order (both
// insides first, the outlines last so the board stays stiff), and what's
// wrong with the numbers ([] when it can be cut).
function boxPlan(input) {
  var o = Object.assign({}, DEFAULTS, input || {});
  var problems = [], notes = [];
  var R = o.diameter / 2, rb = o.bit / 2, w = o.wall, T = o.stock;
  var Ri = R - w, rabbet = Ri + o.lipWidth + o.clearance, rabbetDepth = o.lipHeight + o.clearance;
  var cutDepth = T + o.through;
  var need = function(ok, msg) { if (!ok) problems.push(msg); };

  need(o.diameter > 0, 'Diameter must be more than 0');
  need(T > 0, 'Stock Thickness must be more than 0');
  need(o.bit > 0, 'Bit Diameter must be more than 0');
  need(w > 0, 'Wall must be more than 0');
  need(o.floor > 0 && o.floor < T, 'Floor must be between 0 and the stock thickness');
  need(o.top > 0 && o.top < T, 'Top must be between 0 and the stock thickness');
  need(o.lipHeight > 0, 'Lip Height must be more than 0');
  need(o.lipWidth > 0, 'Lip Width must be more than 0');
  need(o.clearance >= 0, 'Clearance can\'t be negative');
  need(Ri > rb, 'Wall too thick for the diameter: the inside must be wider than the bit');
  // Outside the rabbet, the wall left must hold.
  need(w - o.lipWidth - o.clearance >= 1, 'Wall must be at least 1 mm more than Lip Width + Clearance, for the wall outside the lip');
  // The lip and the rabbet sit in the half's depth, above its floor or top.
  var lipHalfDepth = T - (o.lipOn === 'lid' ? o.top : o.floor);
  var rabbetHalfDepth = T - (o.lipOn === 'lid' ? o.floor : o.top);
  need(o.lipHeight < lipHalfDepth, 'Lip Height must be less than the inside depth of the half with the lip');
  need(rabbetDepth < rabbetHalfDepth, 'Lip Height + Clearance must be less than the inside depth of the half without the lip');
  need(o.gap >= 2 * o.bit + 1, 'Gap must be at least 2 bit diameters + 1 mm, so the outlines don\'t meet');
  if (o.tabs) {
    need(o.tabs.height < cutDepth && o.tabs.height > 0 && o.tabs.width > 0 && o.tabs.count >= 1, 'Tabs: give a count, a width and a height less than the stock');
    // Each tab, with the bit's width either side, in its own share of the
    // way round, and clear of where the cut starts (an eighth of a turn).
    var round = 2 * Math.PI * (R + rb), each = o.tabs.width + o.bit;
    need(o.tabs.count * each < 0.6 * round && each / 2 < round / 8, 'Too many or too wide tabs for the outline');
  }
  if (o.floor < 2 || o.top < 2) notes.push('A floor or top under 2 mm can flex or crack.');
  if (o.clearance < 0.1) notes.push('Under 0.1 mm of clearance, the lid may bind once the wood moves.');

  // Where the halves go: side by side along X (base first) or Y (base in front).
  var span = 2 * R + o.gap, m = o.margin + rb;
  var base = { x: 0, y: 0 }, lid = o.layout === 'y' ? { x: 0, y: span } : { x: span, y: 0 };
  var stockW = (o.layout === 'y' ? 2 * R : 2 * R + span) + 2 * m, stockH = (o.layout === 'y' ? 2 * R + span : 2 * R) + 2 * m;
  // Origin: the stock's front-left corner, or the middle of the pair.
  var shift = o.origin === 'center'
    ? { x: -(lid.x / 2), y: -(lid.y / 2) }
    : { x: m + R, y: m + R };
  base = { x: base.x + shift.x, y: base.y + shift.y };
  lid = { x: lid.x + shift.x, y: lid.y + shift.y };

  // A half's inside: the opening (with its rabbet) or the shoulder round its lip.
  function inside(withLip, floorOrTop) {
    var cuts = [];
    if (!withLip) cuts.push({ op: 'pocket', r: rabbet, depth: rabbetDepth, what: 'rabbet for the lip' });
    cuts.push({ op: 'pocket', r: Ri, depth: T - floorOrTop, what: 'inside' });
    // The shoulder: the wall top outside the lip, down by the Lip Height,
    // out past the outline into the waste.
    if (withLip) cuts.push({ op: 'ring', rIn: Ri + o.lipWidth, rOut: R + 2 * rb, depth: o.lipHeight, what: 'shoulder round the lip' });
    return cuts;
  }
  var halves = [
    { name: 'base', at: base, cuts: inside(o.lipOn !== 'lid', o.floor) },
    { name: 'lid', at: lid, cuts: inside(o.lipOn === 'lid', o.top) }
  ];
  var outline = { op: 'profile', r: R, depth: cutDepth, tabs: o.tabs, what: 'outline' };
  return {
    o: o, problems: problems, notes: notes,
    R: R, Ri: Ri, rabbet: rabbet, rabbetDepth: rabbetDepth, cutDepth: cutDepth,
    halves: halves, outline: outline,
    // The stock needed: its size and front-left corner.
    stock: { w: stockW, h: stockH, x0: shift.x - m - R, y0: shift.y - m - R },
    // Closed: both halves, less the lip's height where they overlap.
    closedHeight: 2 * T - o.lipHeight,
    insideHeight: (T - o.floor) + (T - o.top) - o.lipHeight
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { boxPlan: boxPlan, BOX_DEFAULTS: DEFAULTS };
}
