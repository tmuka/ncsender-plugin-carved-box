/**
 * Carved Box: the plan of a two-part box, base and lid, carved side by
 * side out of one board. All lengths in mm.
 *
 * The base is the full thickness of the stock; the lid is too, unless a
 * Lid Height under it is set, when the lid's area is faced down first.
 * Each half's inside is pocketed from the top face, leaving the Wall all
 * round and the Floor (base) or Top (lid) underneath; its outline is then
 * cut free, with tabs. One half carries a lip: its wall top is cut down
 * by the Lip Height outside a ring Lip Width thick, standing up round the
 * opening. The other half's opening is widened by the Lip Width plus the
 * Clearance, Lip Height plus the Clearance deep, so the lip slides in and
 * the halves meet on the shoulder outside it. The lid is turned over onto
 * the base. Optional: magnet holes facing each other where the halves
 * meet, and a finger notch in the base's rim at the front.
 *
 * A cut: { op: 'pocket' (a round pocket of radius r) | 'ring' (rIn to
 * rOut), dx, dy (from the half's middle), z0 (where it starts, <= 0),
 * depth, what }; the outline: { op: 'profile', r, depth, z0, tabs }.
 */

// The settings a plan takes, with their defaults (mm). lidHeight null:
// the stock's thickness. magnets, notch: null for none.
var DEFAULTS = {
  diameter: 80, stock: 19, lidHeight: null, wall: 6, floor: 4, top: 4,
  lipOn: 'base', lipHeight: 4, lipWidth: 3, clearance: 0.2,
  gap: 12, layout: 'x', origin: 'front-left', margin: 5,
  bit: 3.175, through: 0.5, tabs: { count: 4, width: 6, height: 1.5 },
  magnets: null, notch: null
};

function boxPlan(input) {
  var o = Object.assign({}, DEFAULTS, input || {});
  var problems = [], notes = [];
  var R = o.diameter / 2, rb = o.bit / 2, w = o.wall, T = o.stock;
  var lidH = o.lidHeight > 0 ? o.lidHeight : T, face = Math.max(0, T - lidH);
  var Ri = R - w, rabbet = Ri + o.lipWidth + o.clearance, rabbetDepth = o.lipHeight + o.clearance;
  var need = function(ok, msg) { if (!ok) problems.push(msg); };
  var lipOnLid = o.lipOn === 'lid';
  // Each half's height and the thickness left under its inside.
  var height = { base: T, lid: lidH }, under = { base: o.floor, lid: o.top };
  var lipHalf = lipOnLid ? 'lid' : 'base', rabbetHalf = lipOnLid ? 'base' : 'lid';

  need(o.diameter > 0, 'Diameter must be more than 0');
  need(T > 0, 'Stock Thickness must be more than 0');
  need(lidH <= T + 1e-9, 'Lid Height can\'t be more than the stock thickness');
  need(o.bit > 0, 'Bit Diameter must be more than 0');
  need(w > 0, 'Wall must be more than 0');
  need(o.floor > 0 && o.floor < T, 'Floor must be between 0 and the stock thickness');
  need(o.top > 0 && o.top < lidH, 'Top must be between 0 and the lid height');
  need(o.lipHeight > 0, 'Lip Height must be more than 0');
  need(o.lipWidth > 0, 'Lip Width must be more than 0');
  need(o.clearance >= 0, 'Clearance can\'t be negative');
  need(Ri > rb, 'Wall too thick for the diameter: the inside must be wider than the bit');
  need(w - o.lipWidth - o.clearance >= 1, 'Wall must be at least 1 mm more than Lip Width + Clearance, for the wall outside the lip');
  need(o.lipHeight < height[lipHalf] - under[lipHalf], 'Lip Height must be less than the inside depth of the half with the lip');
  need(rabbetDepth < height[rabbetHalf] - under[rabbetHalf], 'Lip Height + Clearance must be less than the inside depth of the half without the lip');
  need(o.gap >= 2 * o.bit + 1, 'Gap must be at least 2 bit diameters + 1 mm, so the outlines don\'t meet');
  if (o.tabs) {
    need(o.tabs.height > 0 && o.tabs.width > 0 && o.tabs.count >= 1 && o.tabs.height < lidH, 'Tabs: give a count, a width and a height less than the halves');
    // Each tab, with the bit's width either side, in its own share of the
    // way round, and clear of where the cut starts (an eighth of a turn).
    var round = 2 * Math.PI * (R + rb), each = o.tabs.width + o.bit;
    need(o.tabs.count * each < 0.6 * round && each / 2 < round / 8, 'Too many or too wide tabs for the outline');
  }
  if (o.floor < 2 || o.top < 2) notes.push('A floor or top under 2 mm can flex or crack.');
  if (o.clearance < 0.1) notes.push('Under 0.1 mm of clearance, the lid may bind once the wood moves.');

  // Where the halves meet, from each half's top: the shoulder round a lip,
  // or the rim of the other.
  var meet = { base: 0, lid: 0 };
  meet[lipHalf] = o.lipHeight;

  // Magnets: holes on a circle midway across the wall the halves meet on
  // (outside the widened opening), the same in both halves.
  var magnetAt = [];
  if (o.magnets && o.magnets.count > 0) {
    var mr = o.magnets.diameter / 2, rm = (rabbet + R) / 2;
    need(o.magnets.diameter > o.bit + 0.2, 'Magnet holes must be wider than the bit');
    need(rm - mr >= rabbet + 0.8 && rm + mr <= R - 0.8, 'Magnet holes too wide for the wall: they need Wall ≥ Lip Width + Clearance + magnet + 1.6 mm');
    need(o.magnets.depth > 0, 'Magnet hole depth must be more than 0');
    ['base', 'lid'].forEach(function(h) {
      need(meet[h] + o.magnets.depth <= height[h] - 1, 'Magnet holes too deep for the ' + h);
    });
    for (var k = 0; k < o.magnets.count; k++) {
      var a = Math.PI / 2 + 2 * Math.PI * k / o.magnets.count;
      magnetAt.push({ dx: rm * Math.cos(a), dy: rm * Math.sin(a) });
    }
  }
  // A finger notch: a round scoop centred on the base's outline at the
  // front, as deep as asked below where the halves meet, biting into the
  // wall no further than its rim (outside any lip or widened opening).
  var notchCut = null;
  if (o.notch && o.notch.width > 0) {
    var rn = o.notch.width / 2, rim = lipOnLid ? rabbet : Ri + o.lipWidth;
    need(rn > rb + 0.1, 'Finger notch must be wider than the bit');
    need(rn <= R - rim - 0.8, 'Finger notch too wide for the wall outside the ' + (lipOnLid ? 'opening' : 'lip'));
    need(o.notch.depth > 0 && meet.base + o.notch.depth <= T - o.floor, 'Finger notch depth must be more than 0 and above the floor');
    // At the front: -Y with the halves along X, -X along Y (the side they don't share).
    var na = o.layout === 'y' ? Math.PI : -Math.PI / 2;
    notchCut = { op: 'pocket', r: rn, dx: R * Math.cos(na), dy: R * Math.sin(na), z0: -meet.base, depth: o.notch.depth, what: 'finger notch' };
  }

  // Where the halves go: side by side along X (base first) or Y (base in front).
  var span = 2 * R + o.gap, m = o.margin + rb;
  var base = { x: 0, y: 0 }, lid = o.layout === 'y' ? { x: 0, y: span } : { x: span, y: 0 };
  var stockW = (o.layout === 'y' ? 2 * R : 2 * R + span) + 2 * m, stockH = (o.layout === 'y' ? 2 * R + span : 2 * R) + 2 * m;
  // Origin: the stock's front-left corner, or the middle of the pair.
  var shift = o.origin === 'center' ? { x: -(lid.x / 2), y: -(lid.y / 2) } : { x: m + R, y: m + R };
  base = { x: base.x + shift.x, y: base.y + shift.y };
  lid = { x: lid.x + shift.x, y: lid.y + shift.y };

  function inside(name) {
    var z0 = name === 'lid' ? -face : 0, cuts = [];
    if (name === 'lid' && face > 1e-9) cuts.push({ op: 'pocket', r: R + 2 * rb, dx: 0, dy: 0, z0: 0, depth: face, what: 'faced down to the lid height' });
    if (name === rabbetHalf) cuts.push({ op: 'pocket', r: rabbet, dx: 0, dy: 0, z0: z0, depth: rabbetDepth, what: 'opening widened for the lip' });
    cuts.push({ op: 'pocket', r: Ri, dx: 0, dy: 0, z0: z0, depth: height[name] - under[name], what: 'inside' });
    // The shoulder: the wall top outside the lip, down by the Lip Height,
    // out past the outline into the waste.
    if (name === lipHalf) cuts.push({ op: 'ring', rIn: Ri + o.lipWidth, rOut: R + 2 * rb, dx: 0, dy: 0, z0: z0, depth: o.lipHeight, what: 'shoulder round the lip' });
    magnetAt.forEach(function(p, i) {
      cuts.push({ op: 'pocket', r: o.magnets.diameter / 2, dx: p.dx, dy: p.dy, z0: z0 - meet[name], depth: o.magnets.depth, what: 'magnet hole ' + (i + 1) });
    });
    if (name === 'base' && notchCut) cuts.push(notchCut);
    return cuts;
  }
  var halves = [
    { name: 'base', at: base, height: T, cuts: inside('base'),
      outline: { op: 'profile', r: R, z0: 0, depth: T + o.through, tabs: o.tabs, what: 'outline' } },
    { name: 'lid', at: lid, height: lidH, cuts: inside('lid'),
      outline: { op: 'profile', r: R, z0: -face, depth: lidH + o.through, tabs: o.tabs, what: 'outline' } }
  ];
  return {
    o: o, problems: problems, notes: notes,
    R: R, Ri: Ri, rabbet: rabbet, rabbetDepth: rabbetDepth, lidHeight: lidH, face: face,
    halves: halves, magnetAt: magnetAt, notch: notchCut,
    cutDepth: T + o.through,
    // The stock needed: its size and front-left corner.
    stock: { w: stockW, h: stockH, x0: shift.x - m - R, y0: shift.y - m - R },
    // Closed: both halves, less the lip's height where they overlap.
    closedHeight: T + lidH - o.lipHeight,
    insideHeight: (T - o.floor) + (lidH - o.top) - o.lipHeight
  };
}

// A small box with the same fit, only as deep inside as the lip needs:
// cut it first to try the Clearance. No magnets, notch or faced lid.
function testFitInput(input) {
  var o = Object.assign({}, DEFAULTS, input || {});
  var Rt = o.wall + Math.max(10, 2 * o.bit);
  var deep = o.lipHeight + o.clearance + 2;
  return Object.assign({}, o, {
    diameter: 2 * Rt, lidHeight: null, magnets: null, notch: null,
    floor: Math.max(1, o.stock - deep), top: Math.max(1, o.stock - deep)
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { boxPlan: boxPlan, testFitInput: testFitInput, BOX_DEFAULTS: DEFAULTS };
}
