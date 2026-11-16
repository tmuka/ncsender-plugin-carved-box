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
// { bit: 'v' (angle, degrees across the V; diameter) or 'round' (radius,
// tip: the diameter of its flat end), outside (the seam), inside (the
// lead-in: the lip's outer edge, the opening's), pocket (each pocket's
// top edge: the lip's inner edge, the step's in the other half): how far
// down each edge is cut, 0 for none }. corners: { diameter, radius }: a
// ball (radius half the diameter) or bowl bit rounding each pocket's
// floor corners.
var DEFAULTS = {
  shape: 'circle', diameter: 80, length: 120, width: 80, cornerRadius: 10,
  stock: 19, lidHeight: null, wall: 6, floor: 4, top: 4,
  lipOn: 'base', lipHeight: 4, lipWidth: 3, clearance: 0.2,
  gap: 12, layout: 'x', origin: 'front-left', margin: 5,
  bit: 3.175, through: 0.5, tabs: { count: 4, width: 6, height: 1.5 },
  magnets: null, notch: null, edges: null, corners: null
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
  need(o.bit >= 0.8, 'Bit Diameter must be at least 0.8 mm: check it\'s in the right units');
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
      var closest = Infinity;
      magnetAt.forEach(function(p, i) { if (magnetAt.length > 1) { var q = magnetAt[(i + 1) % magnetAt.length]; closest = Math.min(closest, Math.hypot(p.dx - q.dx, p.dy - q.dy)); } });
      need(closest >= o.magnets.diameter + 1, 'Too many magnets for the way round: their holes run together');
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
  // takes, and where the bit goes: a V-bit's axis on the edge, its tip at
  // the depth; a roundover bit's half its tip out on the air side, its
  // flat end at the depth. reachOut: how far past the outline the edge
  // bit reaches, for the waste round a seam below the stock top to be
  // cleared that far first.
  var edgeAt = { base: [], lid: [] }, ed = o.edges, reachOut = { base: 0, lid: 0 };
  if (ed && (ed.outside > 0 || ed.inside > 0 || ed.pocket > 0)) {
    var vbit = ed.bit !== 'round', tan = Math.tan((ed.angle || 90) * Math.PI / 360), R = ed.radius, tip = ed.tip || 0;
    if (vbit) {
      need(ed.angle >= 20 && ed.angle <= 150, 'Edges: the V-bit\'s angle must be between 20 and 150 degrees');
      need(ed.diameter > 0, 'Edges: give the V-bit\'s diameter');
    } else need(R > 0 && tip >= 0, 'Edges: give the roundover bit\'s radius, and its tip diameter (0 or more)');
    need(!(ed.outside < 0 || ed.inside < 0 || ed.pocket < 0), 'Edges: sizes can\'t be negative');
    if (!vbit && R > 0) need(!(ed.outside > R + 1e-9 || ed.inside > R + 1e-9 || ed.pocket > R + 1e-9), 'Edges: a roundover can\'t go deeper than the bit\'s radius');
    var width = function(d) { return !(d > 0) ? 0 : vbit ? d * tan : R - Math.sqrt(Math.max(0, R * R - d * d)); };
    var eOut = width(ed.outside), eIn = width(ed.inside), ePk = width(ed.pocket), eMax = Math.max(eOut, eIn, ePk);
    if (vbit) need(eMax <= ed.diameter / 2 + 1e-9, 'Edges: the V-bit is too small: the widest edge needs one ' + (2 * eMax).toFixed(2) + ' mm across');
    // An inside pocket's corners are at least the bit's radius: an edge
    // there follows them.
    var shapeFor = function(t) { return rect ? { kind: 'rect', hx: S.hx, hy: S.hy, cr: Math.max(S.cr, rb - t) } : S; };
    var add = function(h, t, u, z0, d, what) {
      if (d > 0) edgeAt[h].push({ op: 'edge', shape: u < 0 ? shapeFor(t) : S, t: vbit ? t : t + u * tip / 2, u: u, at: t, z0: z0, depth: d, width: width(d), what: what });
    };
    var tops = { base: 0, lid: -face };
    add(rabbetHalf, 0, 1, tops[rabbetHalf], ed.outside, 'outside seam edge');
    add(lipHalf, 0, 1, tops[lipHalf] - o.lipHeight, ed.outside, 'outside seam edge');
    add(rabbetHalf, tRabbet, -1, tops[rabbetHalf], ed.inside, 'opening edge');
    add(lipHalf, tLip, 1, tops[lipHalf], ed.inside, 'lip\'s outer edge');
    add(lipHalf, tInside, -1, tops[lipHalf], ed.pocket, 'lip\'s inner edge');
    add(rabbetHalf, tInside, -1, tops[rabbetHalf] - rabbetDepth, ed.pocket, 'step\'s inner edge');
    // What each edge leaves: the rim between the outline and the widened
    // opening, the shoulder outside the lip, the lip itself.
    need(eOut + eIn <= -tRabbet - 0.5, 'Edges too big for the rim round the widened opening: make them smaller, or the wall thicker');
    need(eIn + ePk <= o.lipWidth - 0.3, 'Lead-In and Pocket Edge too big for the lip: they take ' + (eIn + ePk).toFixed(2) + ' mm of it');
    // The step the lip sits on, in the other half: its inner edge is down
    // at the step, the widened opening's wall above it.
    if (ed.pocket > 0) {
      var step = o.lipWidth + o.clearance, upStep = rabbetDepth + ed.pocket;
      need(ePk <= step - 0.3, 'Pocket Edge too big for the step the lip sits on');
      need((vbit ? Math.min(upStep * tan, ed.diameter / 2) : R) <= step - 0.3, 'The Pocket Edge\'s bit would cut into the widened opening\'s wall: make it smaller, the Lip Width wider, or use a narrower V-bit');
      need(!(ed.pocket >= Math.min(T - o.floor, lidH - o.top) - rabbetDepth - 1), 'Pocket Edge too deep for the inside');
    }
    // The seam on the half with the lip is down at the shoulder: the bit,
    // as high as the lip, must clear it (a V-bit's cone at the lip's top,
    // no wider than the bit; a roundover bit's head).
    if (ed.outside > 0) {
      var upTo = o.lipHeight + ed.outside, inward = vbit ? Math.min(upTo * tan, ed.diameter / 2) : R;
      need(inward <= -tLip - 0.3, 'The outside seam\'s bit would cut into the lip: make the seam smaller, the Wall thicker, the Lip Height lower, or use a narrower V-bit');
      ['base', 'lid'].forEach(function(h) {
        var e = edgeAt[h].filter(function(x) { return x.what === 'outside seam edge'; })[0], high = e ? -e.z0 + e.depth : 0;
        if (e && -e.z0 > 1e-9) reachOut[h] = vbit ? Math.min(high * tan, ed.diameter / 2) : tip + R;
      });
    }
    // The bit's tip stays above what's below the edges inside: the
    // shoulder by the lip, the widened opening's floor.
    need(!(ed.inside >= o.lipHeight - 0.2) && !(ed.inside > rabbetDepth - 0.2), 'Lead-In edges must be less deep than the Lip Height');
    need(!(ed.outside >= Math.min(T, lidH) - o.lipHeight - (o.tabs ? o.tabs.height : 0) - 1), 'Outside seam edge too deep for the halves');
    // An inside edge's bit fits across the inside.
    var reach = vbit ? Math.max(eIn, ePk) : tip + R;
    if (ed.inside > 0 || ed.pocket > 0) need(deep + tInside > reach + 0.5, 'Edges: the inside is too small for the edge bit');
    // Beside the finger notch and the magnet holes.
    if (notchCut) {
      need(!(ed.outside > o.notch.depth - 0.3), 'The outside seam must be less deep than the finger notch');
      if (lipOnLid) need(notchCut.shape.r <= -tRabbet - eIn - 0.8, 'Finger notch too wide for the rim left by the opening\'s edge');
    }
    if (magnetAt.length) need(Math.max(eOut, eIn) + o.magnets.diameter / 2 <= -tRabbet / 2 - 0.5, 'Edges too big beside the magnet holes');
    // Clearing that far round the seam stays clear of the other half.
    need(Math.max(reachOut.base, reachOut.lid) + 1 <= o.gap - o.bit, 'The outside seam\'s bit reaches too far for the Gap: make the Gap wider');
  }

  // Rounded floor corners: the box's bit stops the corner's radius short
  // of the wall for that last bit of each pocket; a ball or bowl bit then
  // goes round the wall down to the floor, its side on the wall, its
  // rounded end leaving the cove.
  var cornerAt = { base: [], lid: [] }, cn = o.corners, rc = 0;
  if (cn && (cn.radius > 0 || cn.diameter > 0)) {
    rc = cn.radius;
    need(cn.diameter > 0 && rc > 0 && 2 * rc <= cn.diameter + 1e-9, 'Corners: give the bit\'s diameter, and its corner radius (half the diameter for a ball bit)');
    need(deep + tInside > cn.diameter / 2 + 0.5, 'Corners: the inside is too small for the corner bit');
    need(deep + tInside - rc > rb + 0.1, 'Corners: the inside is too small for the box\'s bit to clear the floor inside the rounded corners');
    ['base', 'lid'].forEach(function(h) {
      var depth = height[h] - under[h] - (h === rabbetHalf ? rabbetDepth : 0);
      need(rc <= depth - 0.5, 'Corners: the radius is too big for the ' + h + '\'s inside');
      var floorZ = (h === 'lid' ? -face : 0) - (height[h] - under[h]);
      cornerAt[h].push({ op: 'corner', shape: rect ? { kind: 'rect', hx: S.hx, hy: S.hy, cr: Math.max(S.cr, rb - tInside) } : S,
        t: tInside - cn.diameter / 2, z0: floorZ + rc, depth: rc, what: 'floor corners rounded' });
    });
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
    var waste = Math.max(2 * rb, reachOut[name] + 1);
    if (name === 'lid' && face > 1e-9) cuts.push({ op: 'pocket', t: waste, dx: 0, dy: 0, z0: 0, depth: face, what: 'faced down to the lid height' });
    if (name === rabbetHalf) cuts.push({ op: 'pocket', t: tRabbet, dx: 0, dy: 0, z0: z0, depth: rabbetDepth, what: 'opening widened for the lip' });
    var inDepth = height[name] - under[name];
    if (rc > 0) {
      cuts.push({ op: 'pocket', t: tInside, dx: 0, dy: 0, z0: z0, depth: inDepth - rc, what: 'inside' });
      cuts.push({ op: 'pocket', t: tInside - rc, dx: 0, dy: 0, z0: z0 - (inDepth - rc), depth: rc, what: 'inside, its floor short of the corners' });
    } else cuts.push({ op: 'pocket', t: tInside, dx: 0, dy: 0, z0: z0, depth: inDepth, what: 'inside' });
    // The shoulder: the wall top outside the lip, down by the Lip Height,
    // out past the outline into the waste.
    if (name === lipHalf) cuts.push({ op: 'ring', tIn: tLip, tOut: waste, dx: 0, dy: 0, z0: z0, depth: o.lipHeight, what: 'shoulder round the lip' });
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
    halves: halves, magnetAt: magnetAt, notch: notchCut, edges: edgeAt, corners: cornerAt,
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
    lidHeight: null, magnets: null, notch: null, edges: null, corners: null,
    floor: Math.max(1, o.stock - deep), top: Math.max(1, o.stock - deep)
  });
}

// Sizes that suit a box of this size, stock, bit and material, for a
// first try: the wall, floor and top, the lip and its clearance, the gap
// and margin, the tabs, and (when they're on) the notch, the magnet count
// and the edges; a rectangle's corners as round as the lip needs. Made to
// fit each other: when they don't, the notch and edges are made smaller
// or the wall thicker until they do. input: the plan's settings (shape,
// size, stock, lidHeight, bit, and magnets, notch, edges when on);
// material: QuickCut's key (mdf, softwood, hardwood, hdpe, ...);
// imperial: sizes on a 1/32" grid (under a mm, 0.005") instead of 0.5 mm
// (0.05 mm). Returns the settings it sets (mm), and problems left when
// nothing fits.
var CLEARANCE = { mdf: 0.15, softwood: 0.25, hardwood: 0.2, hdpe: 0.15, acrylic: 0.1, polycarbonate: 0.1, aluminum: 0.05, foam: 0.2 };
function autoSizes(input, material, imperial) {
  var o = Object.assign({}, DEFAULTS, input || {});
  var rect = o.shape === 'rect', small = rect ? Math.min(o.length, o.width) : o.diameter;
  var T = o.stock, lidH = o.lidHeight > 0 ? o.lidHeight : T, b = o.bit;
  // To the grid: the nearest step, or (up) the next one.
  var grid = function(v) { return imperial ? (v < 1 ? 0.127 : 25.4 / 32) : (v < 1 ? 0.05 : 0.5); };
  var half = function(v) { var g = grid(v); return Math.max(g, Math.round(v / g) * g); };
  var upHalf = function(v) { var g = grid(v); return Math.ceil(v / g - 1e-9) * g; };
  var clamp = function(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var a = { clearance: half(CLEARANCE[material] != null ? CLEARANCE[material] : 0.2) };
  a.floor = half(clamp(T * 0.2, 2, 6));
  a.top = half(clamp(lidH * 0.2, 2, 6));
  a.wall = half(clamp(small * 0.08, 4, 15));
  var depth = Math.min(T - a.floor, lidH - a.top);
  a.lipHeight = half(clamp(depth * 0.3, 2, 8));
  a.margin = half(Math.max(5, b));
  a.gap = upHalf(Math.max(8, 2 * b + 2));
  var round = rect ? 2 * (o.length + o.width) : Math.PI * o.diameter;
  a.tabs = { count: clamp(Math.round(round / 90), 3, 8), width: half(Math.max(5, 1.5 * b)), height: half(clamp(T * 0.08, 1, 3)) };
  if (o.magnets) a.magnets = Object.assign({}, o.magnets, { count: rect ? 4 : clamp(Math.round(round / 80), 3, 6) });
  if (o.notch) a.notch = { width: half(clamp(small * 0.18, 10, 20)), depth: half(clamp(a.lipHeight, 3, 6)) };
  if (o.edges) a.edges = Object.assign({}, o.edges, { outside: half(o.edges.bit === 'round' ? Math.min(o.edges.radius || 1, 1.5) : 1), inside: half(0.5), pocket: half(0.5) });
  // Edges get room first from a lower lip, then a wall up to an eighth
  // of the size or 2 mm more than it was; then they're made smaller. A
  // notch narrower, to 12 mm.
  var plan, edgeWall = null;
  var smaller = function(d) { return d > 0.3 ? half(d * 0.7) : 0; };
  for (var k = 0; k < 80; k++) {
    a.lipWidth = half(clamp(a.wall * 0.4, 1.5, 3.5));
    if (rect) a.cornerRadius = Math.max(o.cornerRadius || 0, upHalf(a.wall - a.lipWidth - a.clearance + b / 2));
    plan = boxPlan(Object.assign({}, o, a));
    if (!plan.problems.length) break;
    var p = plan.problems[0], ed = a.edges;
    if (ed && /[Ee]dge|seam/.test(p) && !/Gap/.test(p) && (ed.outside > 0 || ed.inside > 0 || ed.pocket > 0)) {
      var seam = /seam/.test(p), lead = /Lead-In/.test(p), pk = /Pocket Edge/.test(p), any = !seam && !lead && !pk;
      if (edgeWall === null) edgeWall = Math.max(half(small / 8), a.wall + 2);
      if ((seam || pk) && a.lipHeight > 3) a.lipHeight = half(a.lipHeight - grid(3));
      else if (a.wall < edgeWall) a.wall = half(a.wall + grid(3));
      else {
        if (seam || any) ed.outside = smaller(ed.outside);
        if (lead || any) ed.inside = smaller(ed.inside);
        if (pk || any) ed.pocket = smaller(ed.pocket);
      }
    } else if (a.notch && /notch/.test(p) && a.notch.width > 12) a.notch.width = half(a.notch.width - 2 * grid(3));
    else if (/Gap/.test(p)) a.gap = half(a.gap + 2 * grid(3));
    else if (a.wall < small / 2 - b - 2) a.wall = half(a.wall + grid(3));
    else break;
  }
  a.problems = plan.problems;
  return a;
}

if (typeof module !== 'undefined' && module.exports) {
  var shapeLib = require('./box-shape.cjs');
  var shapeLoop = shapeLib.shapeLoop, shapeDeepest = shapeLib.shapeDeepest, loopLength = shapeLib.loopLength, loopPoint = shapeLib.loopPoint;
  module.exports = { boxPlan: boxPlan, testFitInput: testFitInput, autoSizes: autoSizes, BOX_DEFAULTS: DEFAULTS };
}
