/**
 * Carved Box: the program for a box plan (box-plan.cjs). One bit, mm
 * (G21), Z0 on top of the stock. Insides first (pockets: a helix down
 * in the middle, then rings out; the shoulder round a lip: a ramp along
 * its first ring, then rings out), the outlines last, with tabs. Arcs
 * are CCW (G3), as QuickCut's.
 */

// f: { feed, plunge, rpm, delay, doc, stepoverPct, toolNumber, clear, label }
// (mm, mm/min, seconds; clear: how high to lift between cuts).
function boxProgram(plan, f) {
  var o = plan.o, rb = o.bit / 2, clear = f.clear || 5;
  var step = Math.max(0.05, Math.min(o.bit * (f.stepoverPct || 40) / 100, o.bit * 0.9));
  var doc = Math.max(0.05, f.doc);
  var L = [], cutMm = 0, plungeMm = 0, x = 0, y = 0, z = clear;
  var n3 = function(v) { var s = v.toFixed(3); return s === '-0.000' ? '0.000' : s; };
  var comment = function(s) { L.push('(' + s.replace(/[()!?~]/g, '').slice(0, 77) + ')'); };

  function rapid(px, py) { L.push('G0 X' + n3(px) + ' Y' + n3(py)); x = px; y = py; }
  function lift() { L.push('G0 Z' + n3(clear)); z = clear; }
  // Down to toZ: quickly to 1 mm over the stock, or over the floor of a
  // cut already made there, then at the plunge rate.
  function down(toZ) {
    var near = Math.max(toZ, 0) + 1;
    if (z > near) { L.push('G0 Z' + n3(near)); z = near; }
    L.push('G1 Z' + n3(toZ) + ' F' + Math.round(f.plunge)); plungeMm += Math.abs(z - toZ); z = toZ;
  }
  function line(px, py) { L.push('G1 X' + n3(px) + ' Y' + n3(py) + ' F' + Math.round(f.feed)); cutMm += Math.hypot(px - x, py - y); x = px; y = py; }
  // CCW about (cx, cy) from where the bit is to angle b (radians), as arcs
  // of at most half a turn, going down to toZ on the way when given.
  function arc(cx, cy, r, a, b, toZ) {
    var parts = Math.max(1, Math.ceil((b - a) / Math.PI - 1e-9)), z0 = z;
    for (var k = 1; k <= parts; k++) {
      var t = a + (b - a) * k / parts, px = cx + r * Math.cos(t), py = cy + r * Math.sin(t);
      var zk = toZ == null ? null : z0 + (toZ - z0) * k / parts;
      L.push('G3 X' + n3(px) + ' Y' + n3(py) + ' I' + n3(cx - x) + ' J' + n3(cy - y) +
        (zk == null ? '' : ' Z' + n3(zk)) + ' F' + Math.round(zk == null ? f.feed : f.plunge));
      cutMm += r * (b - a) / parts; x = px; y = py; if (zk != null) z = zk;
    }
  }
  function circle(cx, cy, r) { var a = Math.atan2(y - cy, x - cx); arc(cx, cy, r, a, a + 2 * Math.PI); }
  // A helix of radius r down to toZ, at most `pitch` a turn, from angle 0.
  function helix(cx, cy, r, toZ, pitch) {
    var turns = Math.max(1, Math.ceil((z - toZ) / pitch - 1e-9));
    for (var k = 0; k < turns; k++) arc(cx, cy, r, 0, 2 * Math.PI, z - (z - toZ) / (turns - k));
  }
  // The Z of each pass of a cut from z0 down `depth`.
  function levels(z0, depth) {
    var out = [], d = 0;
    while (d < depth - 1e-9) { d = Math.min(depth, d + doc); out.push(z0 - d); }
    return out;
  }

  // A round pocket of radius r (the finished wall), depth deep.
  function pocket(cx, cy, cut) {
    var reach = cut.r - rb, hr = Math.min(rb * 0.5, reach), rings = [], q = hr;
    while (q < reach - 1e-9) { q = Math.min(q + step, reach); rings.push(q); }
    rapid(cx + hr, cy);
    levels(cut.z0, cut.depth).forEach(function(zl) {
      if (hr > 0.05) {
        if (z > cut.z0) down(cut.z0);
        helix(cx, cy, hr, zl, Math.max(0.2, Math.min(doc, o.bit * 0.5)));
        circle(cx, cy, hr);
      } else down(zl);
      rings.forEach(function(rr) { line(cx + rr, cy); circle(cx, cy, rr); });
      line(cx + hr, cy);
    });
    lift();
  }
  // A ring from rIn to rOut (the shoulder round a lip), depth deep.
  function ring(cx, cy, cut) {
    var a0 = cut.rIn + rb, a1 = Math.max(a0, cut.rOut - rb), rings = [], q = a0;
    while (q < a1 - 1e-9) { q = Math.min(q + step, a1); rings.push(q); }
    rapid(cx + a0, cy);
    levels(cut.z0, cut.depth).forEach(function(zl) {
      if (z > cut.z0) down(cut.z0);
      // About 3 degrees down along the ring.
      helix(cx, cy, a0, zl, Math.max(0.2, 2 * Math.PI * a0 * 0.05));
      circle(cx, cy, a0);
      rings.forEach(function(rr) { line(cx + rr, cy); circle(cx, cy, rr); });
      line(cx + a0, cy);
    });
    lift();
  }
  // The outline: the bit a radius outside it, through the stock; on the
  // levels below the tabs' tops it plunges where there's no tab and lifts
  // over each tab.
  function profile(cx, cy, cut) {
    var pr = cut.r + rb, tabs = cut.tabs, tabTop = tabs ? cut.z0 - (cut.depth - tabs.height) : null, spans = [];
    if (tabs) {
      var half = (tabs.width + o.bit) / 2 / pr;
      for (var k = 0; k < tabs.count; k++) {
        var c = Math.PI / 4 + 2 * Math.PI * k / tabs.count;
        spans.push([c - half, c + half]);
      }
    }
    rapid(cx + pr, cy);
    levels(cut.z0, cut.depth).forEach(function(zl) {
      if (tabTop == null || zl >= tabTop - 1e-9) {
        if (z > cut.z0) down(cut.z0);
        helix(cx, cy, pr, zl, Math.max(0.2, 2 * Math.PI * pr * 0.05));
        circle(cx, cy, pr);
        return;
      }
      // Below the tabs' tops: down at angle 0 (clear of every tab), round
      // with a lift over each.
      down(zl);
      var at = 0;
      spans.forEach(function(s) {
        arc(cx, cy, pr, at, s[0]);
        L.push('G1 Z' + n3(tabTop) + ' F' + Math.round(f.plunge)); z = tabTop;
        arc(cx, cy, pr, s[0], s[1]);
        L.push('G1 Z' + n3(zl) + ' F' + Math.round(f.plunge)); plungeMm += tabTop - zl; z = zl;
        at = s[1];
      });
      arc(cx, cy, pr, at, 2 * Math.PI);
    });
    lift();
  }

  // The header: what it is, how it's set up.
  var unit = 'mm';
  comment((f.label || 'Carved Box') + ': a base and a lid, ' + o.diameter + unit + ' across');
  comment('Stock ' + o.stock + unit + ' thick, at least ' + n3(plan.stock.w) + ' x ' + n3(plan.stock.h) + unit);
  comment('Wall ' + o.wall + ', floor ' + o.floor + ', top ' + o.top + unit);
  comment('Lip on the ' + o.lipOn + ': ' + o.lipHeight + ' high, ' + o.lipWidth + ' wide, ' + o.clearance + unit + ' clearance');
  if (plan.face > 0) comment('Lid ' + n3(plan.lidHeight) + unit + ' high: its area faced down ' + n3(plan.face) + unit + ' first');
  if (plan.magnetAt.length) comment('Magnets: ' + plan.magnetAt.length + ' holes ' + o.magnets.diameter + unit + ' wide, ' + o.magnets.depth + unit + ' deep, both halves');
  if (plan.notch) comment('Finger notch in the base, ' + o.notch.width + unit + ' wide, ' + o.notch.depth + unit + ' deep');
  comment('Closed ' + n3(plan.closedHeight) + unit + ' high, ' + n3(plan.insideHeight) + unit + ' inside');
  comment('Origin: ' + (o.origin === 'center' ? 'the middle of the pair' : 'the stock\'s front-left corner') + '; Z0: top of the stock');
  comment('Bit ' + o.bit + unit + ', feed ' + Math.round(f.feed) + ', plunge ' + Math.round(f.plunge) + unit + '/min, ' + n3(doc) + unit + ' a pass');
  if (o.tabs) comment('Tabs: ' + o.tabs.count + ' x ' + o.tabs.width + unit + ' wide, ' + o.tabs.height + unit + ' high');
  L.push('');
  L.push('G21 ; Metric units', 'G17 ; XY plane selection', 'G90 ; Absolute positioning', 'G94 ; Feed rate per minute', '');
  L.push('G53 G0 Z0 ; Move to machine Z0');
  if (f.toolNumber > 0) L.push('M6 T' + f.toolNumber + ' ; Tool change');
  if (f.rpm > 0) {
    L.push('M3 S' + Math.round(f.rpm) + ' ; Start spindle');
    if (f.delay > 0) L.push('G4 P' + f.delay + ' ; Wait for the spindle');
  }
  L.push('G0 Z' + n3(clear));

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

  L.push('', 'G53 G0 Z0 ; Return to machine Z0');
  if (f.rpm > 0) L.push('M5 ; Stop spindle');
  L.push('M30 ; Program end');
  return { gcode: L.join('\n') + '\n', minutes: cutMm / f.feed + plungeMm / f.plunge };
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { boxProgram: boxProgram };
}
