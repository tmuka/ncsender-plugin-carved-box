/**
 * Carved Box: the program for a box plan (box-plan.cjs). One bit, mm
 * (G21), Z0 on top of the stock. Insides first (pockets: a ramp down
 * along a small loop in the middle, then loops out; the shoulder round a
 * lip: a ramp along its first loop, then loops out), the outlines last,
 * with tabs. Arcs are CCW (G3), as QuickCut's.
 */

// f: { feed, plunge, rpm, delay, doc, stepoverPct, toolNumber, clear, label,
// edges } (mm, mm/min, seconds; clear: how high to lift between cuts).
// f.edges: { toolNumber, feed, plunge, rpm, delay, doc }: the edge bit's,
// for a program that changes to it (M6) and cuts the plan's edges last;
// null leaves them out. only: 'edges' for just the edges, as their own
// program (the edge bit in, Z zeroed on the stock top as for the box).
function boxProgram(plan, f, only) {
  var o = plan.o, rb = o.bit / 2, clear = f.clear || 5;
  var step = Math.max(0.05, Math.min(o.bit * (f.stepoverPct || 40) / 100, o.bit * 0.9));
  var doc = Math.max(0.05, f.doc);
  var L = [], minutes = 0, x = 0, y = 0, z = clear;
  var n3 = function(v) { var s = v.toFixed(3); return s === '-0.000' ? '0.000' : s; };
  var comment = function(s) { L.push('(' + s.replace(/[()!?~]/g, '').slice(0, 77) + ')'); };

  function rapid(px, py) { L.push('G0 X' + n3(px) + ' Y' + n3(py)); x = px; y = py; }
  function lift() { L.push('G0 Z' + n3(clear)); z = clear; }
  // Down to toZ: quickly to 1 mm over the stock, or over the floor of a
  // cut already made there, then at the plunge rate.
  function down(toZ) {
    var near = Math.max(toZ, 0) + 1;
    if (z > near) { L.push('G0 Z' + n3(near)); z = near; }
    L.push('G1 Z' + n3(toZ) + ' F' + Math.round(f.plunge)); minutes += Math.abs(z - toZ) / f.plunge; z = toZ;
  }
  // F: the feed (a ramp's, going down on the way); else the cutting feed.
  function line(px, py, toZ, F) {
    F = F || f.feed;
    var zp = toZ == null ? '' : ' Z' + n3(toZ);
    L.push('G1 X' + n3(px) + ' Y' + n3(py) + zp + ' F' + Math.round(F));
    minutes += Math.hypot(px - x, py - y, toZ == null ? 0 : toZ - z) / F; x = px; y = py; if (toZ != null) z = toZ;
  }
  // CCW about (cx, cy) from where the bit is to angle b (radians), as arcs
  // of at most half a turn, going down to toZ on the way when given.
  // An arc whose ends round to the same point would be a whole circle to
  // the controller: a piece that short is left out.
  function arc(cx, cy, r, a, b, toZ, F) {
    F = F || f.feed;
    var parts = Math.max(1, Math.ceil((b - a) / Math.PI - 1e-9)), z0 = z;
    for (var k = 1; k <= parts; k++) {
      var t = a + (b - a) * k / parts, px = cx + r * Math.cos(t), py = cy + r * Math.sin(t);
      var zk = toZ == null ? null : z0 + (toZ - z0) * k / parts;
      if (n3(px) === n3(x) && n3(py) === n3(y)) {
        if (zk != null && n3(zk) !== n3(z)) { L.push('G1 Z' + n3(zk) + ' F' + Math.round(F)); z = zk; }
        continue;
      }
      L.push('G3 X' + n3(px) + ' Y' + n3(py) + ' I' + n3(cx - x) + ' J' + n3(cy - y) +
        (zk == null ? '' : ' Z' + n3(zk)) + ' F' + Math.round(F));
      minutes += Math.hypot(r * (b - a) / parts, zk == null ? 0 : zk - z) / F; x = px; y = py; if (zk != null) z = zk;
    }
  }
  // Along a loop's segments (box-shape.cjs) about (cx, cy), going down
  // evenly to toZ on the way when given.
  // A ramp goes at the cutting feed, slower when that would take Z down
  // faster than the plunge rate.
  function path(segs, cx, cy, toZ) {
    var len = loopLength(segs), z0 = z, done = 0, dz = toZ == null ? 0 : Math.abs(z0 - toZ);
    var F = dz > 1e-9 ? Math.min(f.feed, f.plunge * Math.hypot(len, dz) / dz) : f.feed;
    segs.forEach(function(s) {
      done += s.len;
      var zs = toZ == null ? null : z0 + (toZ - z0) * done / len;
      if (s.type === 'line') line(cx + s.x1, cy + s.y1, zs, F);
      else arc(cx + s.cx, cy + s.cy, s.r, s.a0, s.a1, zs, F);
    });
  }
  // Down a loop's laps to toZ, at most `pitch` a lap, then once more round
  // at that depth.
  function ramp(loop, cx, cy, toZ, pitch) {
    var laps = Math.max(1, Math.ceil((z - toZ) / pitch - 1e-9));
    for (var k = 0; k < laps; k++) path(loop, cx, cy, z - (z - toZ) / (laps - k));
    path(loop, cx, cy);
  }
  function start(loop) { return loopPoint(loop, 0); }
  // The Z of each pass of a cut from z0 down `depth`.
  function levels(z0, depth) {
    var out = [], d = 0;
    while (d < depth - 1e-9) { d = Math.min(depth, d + doc); out.push(z0 - d); }
    return out;
  }
  // The bit's loops from offset a (inside) out to b, at most a stepover apart.
  function loopsBetween(S, a, b) {
    var n = Math.max(1, Math.ceil((b - a) / step - 1e-9)), out = [];
    for (var k = 0; k <= n; k++) { var lp = shapeLoop(S, a + (b - a) * k / n); if (lp) out.push(lp); }
    return out;
  }
  // Every loop of a cut, one after another from the inside out at each
  // level, joined along +X (where every loop starts); the first is ramped
  // down to the level.
  function cutLoops(cx, cy, loops, z0, depth, pitch) {
    var s0 = start(loops[0]);
    rapid(cx + s0.x, cy + s0.y);
    levels(z0, depth).forEach(function(zl) {
      if (z > z0) down(z0);
      ramp(loops[0], cx, cy, zl, pitch);
      loops.slice(1).forEach(function(lp) { var p = start(lp); line(cx + p.x, cy + p.y); path(lp, cx, cy); });
      line(cx + s0.x, cy + s0.y);
    });
    lift();
  }

  // A pocket inside the shape moved t, depth deep: from a small loop in
  // the middle (a circle, or a slot's center line out and back) out to the
  // bit a radius inside the wall.
  function pocket(cx, cy, cut) {
    var S = cut.shape || plan.shape, outer = cut.t - rb, D = shapeDeepest(S) + outer;
    var n = Math.max(1, Math.ceil(D / step - 1e-9)), loops = [];
    for (var k = n; k >= 0; k--) { var lp = shapeLoop(S, outer - D * k / n); if (lp) loops.push(lp); }
    // Too small to go down along, or (a circle's, a square's) wider than
    // the bit leaves standing in the middle: a little circle there first.
    var pointMiddle = !shapeLoop(S, outer - D);
    if (!loops.length || loopLength(loops[0]) < 2 * o.bit || (pointMiddle && D / n > 0.9 * rb)) loops.unshift(shapeLoop({ kind: 'circle', r: Math.max(0.05, Math.min(rb * 0.5, D)) }, 0));
    cutLoops(cx, cy, loops, cut.z0, cut.depth, Math.max(0.2, Math.min(doc, o.bit * 0.5)));
  }
  // A ring between the shape moved tIn and tOut (the shoulder round a
  // lip), depth deep; about 3 degrees down along its first loop.
  function ring(cx, cy, cut) {
    var loops = loopsBetween(plan.shape, cut.tIn + rb, Math.max(cut.tIn + rb, cut.tOut - rb));
    cutLoops(cx, cy, loops, cut.z0, cut.depth, Math.max(0.2, loopLength(loops[0]) * 0.05));
  }
  // The outline: the bit a radius outside it, through the stock; on the
  // levels below the tabs' tops it goes straight down where it starts
  // (clear of every tab) and lifts over each.
  function profile(cx, cy, cut) {
    var loop = shapeLoop(plan.shape, cut.t + rb), len = loopLength(loop), tabs = cut.tabs, spans = [];
    // Tabs: Height from the half's bottom, each in the middle of its own
    // share of the way round (none where the cut starts).
    var tabTop = tabs ? cut.z0 - (cut.depth - o.through - tabs.height) : null;
    if (tabs) {
      var half = (tabs.width + o.bit) / 2;
      for (var k = 0; k < tabs.count; k++) { var c = len * (k + 0.5) / tabs.count; spans.push([c - half, c + half]); }
    }
    var s0 = start(loop);
    rapid(cx + s0.x, cy + s0.y);
    levels(cut.z0, cut.depth).forEach(function(zl) {
      if (tabTop == null || zl >= tabTop - 1e-9) {
        if (z > cut.z0) down(cut.z0);
        ramp(loop, cx, cy, zl, Math.max(0.2, len * 0.05));
        return;
      }
      down(zl);
      var at = 0;
      spans.forEach(function(sp) {
        path(loopPart(loop, at, sp[0]), cx, cy);
        L.push('G1 Z' + n3(tabTop) + ' F' + Math.round(f.plunge)); z = tabTop;
        path(loopPart(loop, sp[0], sp[1]), cx, cy);
        L.push('G1 Z' + n3(zl) + ' F' + Math.round(f.plunge)); minutes += (tabTop - zl) / f.plunge; z = zl;
        at = sp[1];
      });
      path(loopPart(loop, at, len), cx, cy);
    });
    lift();
  }

  // The header: what it is, how it's set up.
  var unit = 'mm';
  comment((f.label || 'Carved Box') + ': a base and a lid, ' + (plan.shape.kind === 'rect'
    ? o.length + ' x ' + o.width + unit + ', corners ' + +n3(plan.shape.cr) + unit : o.diameter + unit + ' across'));
  comment('Stock ' + o.stock + unit + ' thick, at least ' + n3(plan.stock.w) + ' x ' + n3(plan.stock.h) + unit);
  comment('Wall ' + o.wall + ', floor ' + o.floor + ', top ' + o.top + unit);
  comment('Lip on the ' + o.lipOn + ': ' + o.lipHeight + ' high, ' + o.lipWidth + ' wide, ' + o.clearance + unit + ' clearance');
  if (plan.face > 0) comment('Lid ' + n3(plan.lidHeight) + unit + ' high: its area faced down ' + n3(plan.face) + unit + ' first');
  if (plan.magnetAt.length) comment('Magnets: ' + plan.magnetAt.length + ' holes ' + o.magnets.diameter + unit + ' wide, ' + o.magnets.depth + unit + ' deep, both halves');
  if (plan.notch) comment('Finger notch in the base, ' + o.notch.width + unit + ' wide, ' + o.notch.depth + unit + ' deep');
  comment('Closed ' + n3(plan.closedHeight) + unit + ' high, ' + n3(plan.insideHeight) + unit + ' inside');
  comment('Origin: ' + (o.origin === 'center' ? 'the middle of the pair' : 'the stock\'s front-left corner') + '; Z0: top of the stock');
  if (only !== 'edges') comment('Bit ' + o.bit + unit + ', feed ' + Math.round(f.feed) + ', plunge ' + Math.round(f.plunge) + unit + '/min, ' + n3(doc) + unit + ' a pass');
  if (o.tabs) comment('Tabs: ' + o.tabs.count + ' x ' + o.tabs.width + unit + ' wide, ' + o.tabs.height + unit + ' high');
  if (o.edges && plan.edges.base.length + plan.edges.lid.length) {
    var ed = o.edges, eb = ed.bit === 'round' ? 'a ' + ed.radius + unit + ' roundover bit' : 'a ' + ed.angle + ' degree V-bit';
    comment('Edges: outside seam ' + (ed.outside || 0) + unit + ', inside rim ' + (ed.inside || 0) + unit + ' down');
    if (only === 'edges') comment('Just the edges, after the box: ' + eb + ', Z0 on the stock top');
    else if (f.edges) comment('Edges cut last, with ' + eb + ' (T' + f.edges.toolNumber + ')');
    else comment('Edges not in this program: cut them after it with Edges Only');
  }
  L.push('');
  L.push('G21 ; Metric units', 'G17 ; XY plane selection', 'G90 ; Absolute positioning', 'G94 ; Feed rate per minute', '');
  L.push('G53 G0 Z0 ; Move to machine Z0');
  var ef = f.edges || f, sf = only === 'edges' ? ef : f;
  if (only !== 'edges' && f.toolNumber > 0) L.push('M6 T' + f.toolNumber + ' ; Tool change');
  if (sf.rpm > 0) {
    L.push('M3 S' + Math.round(sf.rpm) + ' ; Start spindle');
    if (sf.delay > 0) L.push('G4 P' + +(+sf.delay).toFixed(1) + ' ; Wait for the spindle');
  }
  L.push('G0 Z' + n3(clear));

  var boxCuts = only !== 'edges', edgeCuts = (only === 'edges' || f.edges) && (plan.edges.base.length + plan.edges.lid.length) > 0;
  if (boxCuts) {
  plan.halves.forEach(function(h) {
    h.cuts.forEach(function(cut) {
      comment(cap(h.name) + ': ' + cut.what);
      (cut.op === 'pocket' ? pocket : ring)(h.at.x + (cut.dx || 0), h.at.y + (cut.dy || 0), cut);
    });
  });
  plan.halves.forEach(function(h) {
    comment(cap(h.name) + ': outline' + (h.outline.tabs ? ', with tabs' : ''));
    profile(h.at.x, h.at.y, h.outline);
  });
  }
  if (edgeCuts) {
    if (boxCuts) {
      L.push('', 'G53 G0 Z0 ; Move to machine Z0');
      if (f.rpm > 0) L.push('M5 ; Stop spindle');
      L.push('M6 T' + ef.toolNumber + ' ; Tool change: the edge bit');
      if (ef.rpm > 0) {
        L.push('M3 S' + Math.round(ef.rpm) + ' ; Start spindle');
        if (ef.delay > 0) L.push('G4 P' + +(+ef.delay).toFixed(1) + ' ; Wait for the spindle');
      }
      L.push('G0 Z' + n3(clear));
    }
    f = Object.assign({}, f, { feed: ef.feed, plunge: ef.plunge });
    doc = Math.max(0.05, ef.doc || doc);
    plan.halves.forEach(function(h) {
      plan.edges[h.name].forEach(function(e) {
        comment(cap(h.name) + ': ' + e.what);
        var loop = shapeLoop(plan.shape, e.t);
        cutLoops(h.at.x, h.at.y, [loop], e.z0, e.depth, Math.max(0.2, loopLength(loop) * 0.05));
      });
    });
  }

  L.push('', 'G53 G0 Z0 ; Return to machine Z0');
  if (sf.rpm > 0 || (edgeCuts && ef.rpm > 0)) L.push('M5 ; Stop spindle');
  L.push('M30 ; Program end');
  return { gcode: L.join('\n') + '\n', minutes: minutes };
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

if (typeof module !== 'undefined' && module.exports) {
  var shapeLib = require('./box-shape.cjs');
  var shapeLoop = shapeLib.shapeLoop, shapeDeepest = shapeLib.shapeDeepest, loopLength = shapeLib.loopLength, loopPart = shapeLib.loopPart, loopPoint = shapeLib.loopPoint;
  module.exports = { boxProgram: boxProgram };
}
