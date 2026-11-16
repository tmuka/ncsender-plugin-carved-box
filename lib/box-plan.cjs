/**
 * Carved Box: the plan of a two-part box, base and lid, carved side by
 * side out of one board. All lengths in mm.
 *
 * The box is round (Diameter) or a rectangle (Length along X, Width along
 * Y, Corner Radius). The base is the full thickness of the stock; the lid
 * is too, unless a Lid Height under it is set, when the lid's area is
 * faced down first. Each half's inside is pocketed from the top face,
 * leaving the Wall all round and the Floor (base) or Top (lid)
 * underneath; its outline is then cut free, with tabs. One half carries a
 * lip: its wall top is cut down by the Lip Height outside a ring Lip
 * Width thick, standing up round the opening. The other half's opening is
 * widened by the Lip Width plus the Clearance, Lip Height plus the
 * Clearance deep, so the lip slides in and the halves meet on the shoulder
 * outside it. The lid is turned over onto the base. Optional: magnet
 * holes facing each other where the halves meet, a finger notch in the
 * base's rim at the front, and chamfered or rounded edges (a second bit,
 * cut last): the outside seam (each rim's outer edge) and the inside rim
 * (the opening's edge, the lip's top edges).
 *
 * A cut: { op: 'pocket' (inside the outline moved t), op: 'ring' (between
 * the outline moved tIn and tOut), shape (its own, for a hole; else the
 * box's), dx, dy (from the half's middle), z0 (where it starts, <= 0),
 * depth, what }; the outline: { op: 'profile', t: 0, z0, depth, tabs }.
 * An edge: { op: 'edge', t (where the edge bit's axis goes), z0 (the
 * edge's top), depth (to the bit's tip), what }.
 */

// The settings a plan takes, with their defaults (mm). lidHeight null:
// the stock's thickness. magnets, notch, edges: null for none. edges:
// { bit: 'v' (angle, degrees across the V) or 'round' (radius, tip: the
// diameter of its flat end), outside, inside: how far down each edge is
// cut, 0 for none }.
var DEFAULTS = {
  shape: 'circle', diameter: 80, length: 120, width: 80, cornerRadius: 10,
  stock: 19, lidHeight: null, wall: 6, floor: 4, top: 4,
  lipOn: 'base', lipHeight: 4, lipWidth: 3, clearance: 0.2,
  gap: 12, layout: 'x', origin: 'front-left', margin: 5,
  bit: 3.175, through: 0.5, tabs: { count: 4, width: 6, height: 1.5 },
  magnets: null, notch: null, edges: null
};

function boxPlan(input) {
  var o = Object.assign({}, DEFAULTS, input || {});
  var problems = [], notes = [];
  var need = function(ok, msg) { if (!ok) problems.push(msg); };
  var rect = o.shape === 'rect', rb = o.bit / 2, w = o.wall, T = o.stock;
  var S = rect ? { kind: 'rect', hx: o.length / 2, hy: o.width / 2, cr: Math.max(0, Math.min(o.cornerRadius || 0, o.length / 2, o.width / 2)) }
    : { kind: 'circle', r: o.diameter / 2 };
  var halfX = rect ? S.hx : S.r, halfY = rect ? S.hy : S.r, deep = shapeDeepest(S);
  var lidH = o.lidHeight > 0 ? o.lidHeight : T, face = Math.max(0, T - lidH);
  var lipOnLid = o.lipOn === 'lid';
  // The outline moved in to the inside, the widened opening, the lip's outside.
  var tInside = -w, tRabbet = -(w - o.lipWidth - o.clearance), tLip = -(w - o.lipWidth);
  var rabbetDepth = o.lipHeight + o.clearance;
  var height = { base: T, lid: lidH }, under = { base: o.floor, lid: o.top };
  var lipHalf = lipOnLid ? 'lid' : 'base', rabbetHalf = lipOnLid ? 'base' : 'lid';

  if (rect) {
    need(o.length > 0 && o.width > 0, 'Length and Width must be more than 0');
    need((o.cornerRadius || 0) >= 0, 'Corner Radius can\'t be negative');
    // Under this, the bit leaves the opening's corners rounder than the
    // lip's, and the lip binds there.
    need(S.cr + tRabbet >= rb - 1e-9, 'Corner Radius must be at least Wall \u2212 Lip Width \u2212 Clearance + half the bit, so the lip\'s corners fit the opening');
  } else need(o.diameter > 0, 'Diameter must be more than 0');
  need(T > 0, 'Stock Thickness must be more than 0');
  need(lidH <= T + 1e-9, 'Lid Height can\'t be more than the stock thickness');
  need(o.bit > 0, 'Bit Diameter must be more than 0');
  need(w > 0, 'Wall must be more than 0');
  need(o.floor > 0 && o.floor < T, 'Floor must be between 0 and the stock thickness');
  need(o.top > 0 && o.top < lidH, 'Top must be between 0 and the lid height');
  need(o.lipHeight > 0, 'Lip Height must be more than 0');
  need(o.lipWidth > 0, 'Lip Width must be more than 0');
  need(o.clearance >= 0, 'Clearance can\'t be negative');
  need(deep - w > rb, 'Wall too thick for the size: the inside must be wider than the bit');
  need(w - o.lipWidth - o.clearance >= 1, 'Wall must be at least 1 mm more than Lip Width + Clearance, for the wall outside the lip');
  need(o.lipHeight < height[lipHalf] - under[lipHalf], 'Lip Height must be less than the inside depth of the half with the lip');
  need(rabbetDepth < height[rabbetHalf] - under[rabbetHalf], 'Lip Height + Clearance must be less than the inside depth of the half without the lip');
  need(o.margin >= 0, 'Margin can\'t be negative');
  need(o.gap >= 2 * o.bit + 1, 'Gap must be at least 2 bit diameters + 1 mm, so the outlines don\'t meet');
  var outlineLoop = shapeLoop(S, rb), round = outlineLoop ? loopLength(outlineLoop) : 0;
  if (o.tabs) {
    need(o.tabs.height > 0 && o.tabs.width > 0 && o.tabs.count >= 1 && o.tabs.height < lidH - o.top, 'Tabs: give a count, a width and a height less than the halves');
    // Each tab, with the bit's width either side, well inside its own
    // share of the way round (it sits in the middle of it).
    var each = o.tabs.width + o.bit;
    need(o.tabs.count * each < 0.6 * round, 'Too many or too wide tabs for the outline');
  }
  if (o.floor < 2 || o.top < 2) notes.push('A floor or top under 2 mm can flex or crack.');
  if (o.clearance < 0.1) notes.push('Under 0.1 mm of clearance, the lid may bind once the wood moves.');

  // Where the halves meet, from each half's top: the shoulder round a lip,
  // or the rim of the other.
  var meet = { base: 0, lid: 0 };
  meet[lipHalf] = o.lipHeight;

  // Magnets: holes on the line midway across the wall the halves meet on
  // (outside the widened opening), the same in both halves.
  var magnetAt = [];
  if (o.magnets && o.magnets.count > 0) {
    var mr = o.magnets.diameter / 2, band = -tRabbet;
    need(o.magnets.diameter > o.bit + 0.2, 'Magnet holes must be wider than the bit');
    need(band / 2 - mr >= 0.8, 'Magnet holes too wide for the wall: they need Wall ≥ Lip Width + Clearance + magnet + 1.6 mm');
    need(o.magnets.depth > 0, 'Magnet hole depth must be more than 0');
    need(o.magnets.count >= 1 && o.magnets.count === Math.round(o.magnets.count), 'Magnets: the count must be a whole number, 1 or more');
    // An even count on a rectangle: the lid's land on the base's turned
    // over either way.
    if (rect) need(o.magnets.count % 2 === 0, 'A rectangular box needs an even number of magnets, so they line up when the lid is turned over');
    ['base', 'lid'].forEach(function(h) { need(meet[h] + o.magnets.depth <= height[h] - 1, 'Magnet holes too deep for the ' + h); });
    // Spaced evenly from the front (where a notch goes), half a space off
    // it: turned over between the halves, the lid's land on the base's.
    var mid = shapeLoop(S, tRabbet / 2), alongY = o.layout === 'y';
    if (mid) {
      var L = loopLength(mid), front = alongY ? L / 2 : 0.75 * L;
      for (var k = 0; k < o.magnets.count; k++) {
        var p = loopPoint(mid, (front + (k + 0.5) * L / o.magnets.count) % L);
        magnetAt.push({ dx: p.x, dy: p.y });
      }
      if (magnetAt.length > 1) need(Math.hypot(magnetAt[0].dx - magnetAt[1].dx, magnetAt[0].dy - magnetAt[1].dy) >= o.magnets.diameter + 1, 'Too many magnets for the way round: their holes run together');
    }
  }
  // A finger notch: a round scoop centered on the base's outline at the
  // front (-Y; along Y, -X, a side the halves don't share), as deep as
  // asked below where the halves meet, biting no further than the rim
  // (outside any lip or widened opening).
  var notchCut = null;
  if (o.notch && o.notch.width > 0) {
    var rn = o.notch.width / 2, rim = lipOnLid ? -tRabbet : -tLip;
    need(rn > rb + 0.1, 'Finger notch must be wider than the bit');
    need(rn <= rim - 0.8, 'Finger notch too wide for the wall outside the ' + (lipOnLid ? 'opening' : 'lip'));
    need(o.notch.depth > 0 && meet.base + o.notch.depth <= T - o.floor, 'Finger notch depth must be more than 0 and above the floor');
    var front = o.layout === 'y' ? { x: -halfX, y: 0 } : { x: 0, y: -halfY };
    magnetAt.forEach(function(m) {
      need(Math.hypot(m.dx - front.x, m.dy - front.y) >= rn + o.magnets.diameter / 2 + 1, 'The finger notch runs into a magnet hole: use fewer magnets or a narrower notch');
    });
    // From the stock's top: past the outline, the shoulder round a lip
    // doesn't reach.
    notchCut = { op: 'pocket', shape: { kind: 'circle', r: rn }, t: 0, dx: front.x, dy: front.y, z0: 0, depth: meet.base + o.notch.depth, what: 'finger notch' };
  }

  // Chamfered or rounded edges: per half, its edges (u: which side the
  // wood is, 1 inside the loop, -1 outside it), how much of the top each
  // takes, and where the bit goes.
  var edgeAt = { base: [], lid: [] }, ed = o.edges;
  if (ed && (ed.outside > 0 || ed.inside > 0)) {
    var vbit = ed.bit !== 'round', tan = Math.tan((ed.angle || 90) * Math.PI / 360), R = ed.radius, tip = ed.tip || 0;
    if (vbit) need(ed.angle >= 20 && ed.angle <= 150, 'Edges: the V-bit\'s angle must be between 20 and 150 degrees');
    else need(R > 0 && tip >= 0, 'Edges: give the roundover bit\'s radius, and its tip diameter (0 or more)');
    need(!(ed.outside < 0 || ed.inside < 0), 'Edges: sizes can\'t be negative');
    if (!vbit && R > 0) need(!(ed.outside > R + 1e-9 || ed.inside > R + 1e-9), 'Edges: a roundover can\'t go deeper than the bit\'s radius');
    var width = function(d) { return !(d > 0) ? 0 : vbit ? d * tan : R - Math.sqrt(Math.max(0, R * R - d * d)); };
    var eOut = width(ed.outside), eIn = width(ed.inside);
    var add = function(h, t, u, z0, d, what) {
      if (d > 0) edgeAt[h].push({ op: 'edge', t: vbit ? t : t - u * tip / 2, u: u, at: t, z0: z0, depth: d, width: width(d), what: what });
    };
    var tops = { base: 0, lid: -face };
    add(rabbetHalf, 0, 1, tops[rabbetHalf], ed.outside, 'outside seam edge');
    add(lipHalf, 0, 1, tops[lipHalf] - o.lipHeight, ed.outside, 'outside seam edge');
    add(rabbetHalf, tRabbet, -1, tops[rabbetHalf], ed.inside, 'opening edge');
    add(lipHalf, tLip, 1, tops[lipHalf], ed.inside, 'lip\'s outer edge');
    add(lipHalf, tInside, -1, tops[lipHalf], ed.inside, 'lip\'s inner edge');
    // What each edge leaves: the rim between the outline and the widened
    // opening, the shoulder outside the lip, the lip itself.
    need(eOut + eIn <= -tRabbet - 0.5, 'Edges too big for the rim round the widened opening: make them smaller, or the wall thicker');
    need(eOut <= -tLip - 0.5, 'Outside seam edge too big for the shoulder outside the lip');
    need(2 * eIn <= o.lipWidth - 0.3, 'Inside rim edges too big for the lip: they take ' + (2 * eIn).toFixed(2) + ' mm of it');
    // The bit's tip stays above what's below the edges inside: the
    // shoulder by the lip, the widened opening's floor.
    need(!(ed.inside >= o.lipHeight - 0.2) && !(ed.inside > rabbetDepth - 0.2), 'Inside rim edges must be less deep than the Lip Height');
    need(!(ed.outside >= Math.min(T, lidH) - o.lipHeight - 1), 'Outside seam edge too deep for the halves');
    // An inside edge's bit fits across the inside.
    var reach = vbit ? eIn : tip + R;
    if (ed.inside > 0) need(deep + tInside > reach + 0.5, 'Edges: the inside is too small for the edge bit');
  }

  // Where the halves go: side by side along X (base first) or Y (base in front).
  var m = o.margin + rb, base = { x: 0, y: 0 };
  var lid = o.layout === 'y' ? { x: 0, y: 2 * halfY + o.gap } : { x: 2 * halfX + o.gap, y: 0 };
  var stockW = 2 * halfX + lid.x + 2 * m, stockH = 2 * halfY + lid.y + 2 * m;
  // Origin: the stock's front-left corner, or the middle of the pair.
  var shift = o.origin === 'center' ? { x: -(lid.x / 2), y: -(lid.y / 2) } : { x: m + halfX, y: m + halfY };
  base = { x: base.x + shift.x, y: base.y + shift.y };
  lid = { x: lid.x + shift.x, y: lid.y + shift.y };

  function inside(name) {
    var z0 = name === 'lid' ? -face : 0, cuts = [];
    if (name === 'lid' && face > 1e-9) cuts.push({ op: 'pocket', t: 2 * rb, dx: 0, dy: 0, z0: 0, depth: face, what: 'faced down to the lid height' });
    if (name === rabbetHalf) cuts.push({ op: 'pocket', t: tRabbet, dx: 0, dy: 0, z0: z0, depth: rabbetDepth, what: 'opening widened for the lip' });
    cuts.push({ op: 'pocket', t: tInside, dx: 0, dy: 0, z0: z0, depth: height[name] - under[name], what: 'inside' });
    // The shoulder: the wall top outside the lip, down by the Lip Height,
    // out past the outline into the waste.
    if (name === lipHalf) cuts.push({ op: 'ring', tIn: tLip, tOut: 2 * rb, dx: 0, dy: 0, z0: z0, depth: o.lipHeight, what: 'shoulder round the lip' });
    magnetAt.forEach(function(p, i) {
      cuts.push({ op: 'pocket', shape: { kind: 'circle', r: o.magnets.diameter / 2 }, t: 0, dx: p.dx, dy: p.dy, z0: z0 - meet[name], depth: o.magnets.depth, what: 'magnet hole ' + (i + 1) });
    });
    if (name === 'base' && notchCut) cuts.push(notchCut);
    return cuts;
  }
  var halves = [
    { name: 'base', at: base, height: T, cuts: inside('base'),
      outline: { op: 'profile', t: 0, z0: 0, depth: T + o.through, tabs: o.tabs, what: 'outline' } },
    { name: 'lid', at: lid, height: lidH, cuts: inside('lid'),
      outline: { op: 'profile', t: 0, z0: -face, depth: lidH + o.through, tabs: o.tabs, what: 'outline' } }
  ];
  return {
    o: o, problems: problems, notes: notes, shape: S, halfX: halfX, halfY: halfY,
    tInside: tInside, tRabbet: tRabbet, tLip: tLip, rabbetDepth: rabbetDepth, lidHeight: lidH, face: face,
    halves: halves, magnetAt: magnetAt, notch: notchCut, edges: edgeAt,
    // The stock needed: its size and front-left corner.
    stock: { w: stockW, h: stockH, x0: shift.x - m - halfX, y0: shift.y - m - halfY },
    // Closed: both halves, less the lip's height where they overlap.
    closedHeight: T + lidH - o.lipHeight,
    insideHeight: (T - o.floor) + (lidH - o.top) - o.lipHeight
  };
}

// A small box with the same fit, only as deep inside as the lip needs:
// cut it first to try the Clearance. No magnets, notch, edges or faced lid. A
// rectangle keeps its corner radius (where a lip fits worst).
function testFitInput(input) {
  var o = Object.assign({}, DEFAULTS, input || {});
  var half = o.wall + Math.max(10, 2 * o.bit), deep = o.lipHeight + o.clearance + 2;
  var cr = Math.min(o.cornerRadius || 0, half);
  return Object.assign({}, o, {
    diameter: 2 * half, length: 2 * half, width: 2 * half, cornerRadius: cr,
    lidHeight: null, magnets: null, notch: null, edges: null,
    floor: Math.max(1, o.stock - deep), top: Math.max(1, o.stock - deep)
  });
}

if (typeof module !== 'undefined' && module.exports) {
  var shapeLib = require('./box-shape.cjs');
  var shapeLoop = shapeLib.shapeLoop, shapeDeepest = shapeLib.shapeDeepest, loopLength = shapeLib.loopLength, loopPoint = shapeLib.loopPoint;
  module.exports = { boxPlan: boxPlan, testFitInput: testFitInput, BOX_DEFAULTS: DEFAULTS };
}
