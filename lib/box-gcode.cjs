/**
 * Carved Box: the program for a box plan (box-plan.cjs). mm (G21), Z0 on
 * top of the stock. The box's bit: insides first (pockets: a ramp down
 * along a small loop in the middle, then loops out; the shoulder round a
 * lip: a ramp along its first loop, then loops out), each half's step
 * floors skimmed and a finishing lap round each wall after its roughing,
 * then the outlines, with tabs. Then the magnet bit (when
 * the holes have their own), the floor corners' bit and the edge bit,
 * each after a tool change. Roughing goes CCW (G3); the
 * finishing laps go the way the plan says (climb or conventional).
 */

// f: { feed, plunge, rpm, delay, doc, stepoverPct, toolNumber, safeZ, label,
// magnets, corners, edges } (mm, mm/min, seconds; safeZ: ncSender's Safe Z, in
// machine coordinates, null for machine Z0). Every move sideways between
// cuts is up there, clear of clamps; the bit comes down to 1 mm over the
// stock (or over a cut already made) quickly, then at the plunge rate.
// f.magnets, f.corners, f.edges: { toolNumber, feed, plunge, rpm, delay,
// doc, stepoverPct }: the magnet bit's, the floor corners' ball or bowl
// bit's, the edge bit's, for a program that changes to each (M6) and cuts
// the plan's magnet holes, its corners, then its edges, after
// the box; null leaves them out. only: 'corners' or 'edges' for just
// those, as their own program (that bit in, Z zeroed on the stock top as
// for the box).
function boxProgram(plan, f, only) {
  var o = plan.o, rb = o.bit / 2, HIGH = 1e6;
  var safe = typeof f.safeZ === 'number' && isFinite(f.safeZ) ? 'G53 G0 Z' + (+f.safeZ).toFixed(3) : 'G53 G0 Z0';
  var step = Math.max(0.05, Math.min(o.bit * (f.stepoverPct || 40) / 100, o.bit * 0.9));
  var doc = Math.max(0.05, f.doc);
  var L = [], minutes = 0, x = 0, y = 0, z = HIGH;
  // The box being cut (a nested set's halves are from several).
  var HS = plan.shape;
  var n3 = function(v) { var s = v.toFixed(3); return s === '-0.000' ? '0.000' : s; };
  var mm3 = function(v) { return +(+v).toFixed(3); };
  var comment = function(s) { L.push('(' + s.replace(/[()!?~]/g, '').slice(0, 77) + ')'); };

  // Sideways only at safe height.
  function rapid(px, py) { if (z !== HIGH) lift(); L.push('G0 X' + n3(px) + ' Y' + n3(py)); x = px; y = py; }
  function lift() { L.push(safe); z = HIGH; }
  // Down to toZ: quickly to 1 mm over the stock, or over the floor of a
  // cut already made there, then at the plunge rate.
  function down(toZ) {
    var near = Math.max(toZ, 0) + 1;
    if (z > near) { L.push('G0 Z' + n3(near)); z = near; }
    L.push('G1 Z' + n3(toZ) + ' F' + Math.round(f.plunge)); minutes += Math.abs(z - toZ) / f.plunge; z = toZ;
  }
  // Too long to load (a bit or a Depth of Cut far too small): stopped
  // early, said why.
  function tooLong() {
    if (L.length > MAX_LINES) throw new Error('The program would be over ' + MAX_LINES.toLocaleString('en-US') + ' lines: check the bit, the Depth of Cut and the Stepover, or make the box smaller');
  }
  // F: the feed (a ramp's, going down on the way); else the cutting feed.
  function line(px, py, toZ, F) {
    tooLong();
    F = F || f.feed;
    var zp = toZ == null ? '' : ' Z' + n3(toZ);
    L.push('G1 X' + n3(px) + ' Y' + n3(py) + zp + ' F' + Math.round(F));
    minutes += Math.hypot(px - x, py - y, toZ == null ? 0 : toZ - z) / F; x = px; y = py; if (toZ != null) z = toZ;
  }
  // CCW about (cx, cy) from where the bit is to angle b (radians), as arcs
  // of at most half a turn, going down to toZ on the way when given.
  // An arc whose ends round to the same point would be a whole circle to
  // the controller: a piece that short is left out. b < a: clockwise (G2).
  function arc(cx, cy, r, a, b, toZ, F) {
    tooLong();
    F = F || f.feed;
    var parts = Math.max(1, Math.ceil(Math.abs(b - a) / Math.PI - 1e-9)), z0 = z, g = b < a ? 'G2' : 'G3';
    for (var k = 1; k <= parts; k++) {
      var t = a + (b - a) * k / parts, px = cx + r * Math.cos(t), py = cy + r * Math.sin(t);
      var zk = toZ == null ? null : z0 + (toZ - z0) * k / parts;
      if (n3(px) === n3(x) && n3(py) === n3(y)) {
        if (zk != null && n3(zk) !== n3(z)) { L.push('G1 Z' + n3(zk) + ' F' + Math.round(F)); z = zk; }
        continue;
      }
      L.push(g + ' X' + n3(px) + ' Y' + n3(py) + ' I' + n3(cx - x) + ' J' + n3(cy - y) +
        (zk == null ? '' : ' Z' + n3(zk)) + ' F' + Math.round(F));
      minutes += Math.hypot(r * Math.abs(b - a) / parts, zk == null ? 0 : zk - z) / F; x = px; y = py; if (zk != null) z = zk;
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
      else if (s.cw) arc(cx + s.cx, cy + s.cy, s.r, s.a1, s.a0, zs, F);
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
  function levels(z0, depth, deep) {
    var out = [], d = 0;
    while (d < depth - 1e-9) { d = Math.min(depth, d + (deep || doc)); out.push(z0 - d); }
    return out;
  }
  // The bit's loops from offset a (inside) out to b, at most a stepover apart.
  function loopsBetween(S, a, b) {
    var n = Math.max(1, Math.ceil((b - a) / step - 1e-9)), out = [];
    for (var k = 0; k <= n; k++) { var lp = shapeLoop(S, a + (b - a) * k / n); if (lp) out.push(lp); }
    return out;
  }
  // Every loop of a cut, one after another from the inside out at each
  // level, each joined at its nearest point to where the last ended (along
  // +X, where a circle's or rectangle's start; a drawing's don't line up),
  // then back in the same way; the first is ramped down to the level.
  function cutLoops(cx, cy, loops, z0, depth, pitch) {
    var first = loops[0], s0 = start(first);
    rapid(cx + s0.x, cy + s0.y);
    levels(z0, depth).forEach(function(zl) {
      if (z > z0) down(z0);
      ramp(first, cx, cy, zl, pitch);
      loops.slice(1).forEach(function(lp) { var l2 = startNear(lp, x - cx, y - cy), p = start(l2); line(cx + p.x, cy + p.y); path(l2, cx, cy); });
      for (var k = loops.length - 2; k >= 0; k--) { var q = loopPoint(loops[k], loopNearest(loops[k], x - cx, y - cy)); line(cx + q.x, cy + q.y); }
      first = startNear(loops[0], x - cx, y - cy);
    });
    lift();
  }

  // A pocket inside the shape moved t, depth deep: from a small loop in
  // the middle (a circle, or a slot's center line out and back) out to the
  // bit a radius inside the wall.
  function pocket(cx, cy, cut) {
    var S = cut.shape || HS, rough = roughOf(cut);
    if (S.kind === 'outline') pocketOutline(cx, cy, rough, S);
    else pocketRough(cx, cy, rough, S);
    // A step's floor: from over the pocket inside it out to the wall's lap.
    if (rough !== cut) {
      var hi = cut.t - (cut.finish || 0) - rb, lo = Math.min(hi, cut.floorFrom + rb);
      afterwards('floors', cut.what + ': its floor skimmed', function() { cutLoops(cx, cy, loopsBetween(S, lo, hi), rough.z0 - rough.depth, cut.floor, 1); });
    }
    if (cut.finish) afterwards('laps', cut.what + ': finishing lap', function() { finishWall(cx, cy, S, cut.t - rb, -cut.finish, cut, o.finishDir !== 'climb'); });
  }
  // A step (cut.floor): roughed that much short of its floor, skimmed
  // after; else the cut as it is.
  function roughOf(cut) {
    var step = cut.op === 'ring' || cut.floorFrom !== undefined;
    return step && cut.floor > 0 && cut.depth > cut.floor + 1e-9 ? Object.assign({}, cut, { depth: cut.depth - cut.floor }) : cut;
  }
  // The finishing (floors, then laps) of each half after all its
  // roughing, so nothing roughed later tears up a finished edge; now when
  // not cutting a half.
  var later = null;
  function afterwards(kind, what, run) {
    if (later) later[kind].push({ what: what, run: run }); else run();
  }
  function pocketRough(cx, cy, cut, S) {
    var outer = cut.t - (cut.finish || 0) - rb, D = shapeDeepest(S) + outer;
    var n = Math.max(1, Math.ceil(D / step - 1e-9)), loops = [];
    for (var k = n; k >= 0; k--) { var lp = shapeLoop(S, outer - D * k / n); if (lp) loops.push(lp); }
    // Too small to go down along, or (a circle's, a square's) wider than
    // the bit leaves standing in the middle: a little circle there first.
    var pointMiddle = !shapeLoop(S, outer - D);
    if (!loops.length || loopLength(loops[0]) < 4 * rb || (pointMiddle && D / n > 0.9 * rb)) loops.unshift(shapeLoop({ kind: 'circle', r: Math.max(0.05, Math.min(rb * 0.5, D)) }, 0));
    cutLoops(cx, cy, loops, cut.z0, cut.depth, Math.max(0.2, Math.min(doc, rb)));
  }
  // An outline's pocket (a heart's, an oval's): its rings a stepover
  // apart from the wall in, each with the ring round it (a heart's can
  // come apart into its lobes); cut from the deepest out, a ring then the
  // one round it, joined straight across between them, lifting between
  // pieces; each piece ramped down along its first ring.
  function pocketOutline(cx, cy, cut, S) {
    var outer = cut.t - (cut.finish || 0) - rb, rings = [];
    // Islands shorter than the bit, deeper in: the ring round them is in
    // the bit's reach of all of it (a stepover under its radius).
    var tiny = step <= 0.9 * rb ? o.bit : 0;
    for (var e = outer, k = 0; k < 5000; k++, e -= step) {
      var ls = shapeLoops(S, e);
      if (k > 0) ls = ls.filter(function(lp) { return loopLength(lp) >= tiny; });
      if (!ls.length) break;
      rings.push(ls.map(function(lp) { return { loop: lp, kids: [], parent: null, inset: outer - e }; }));
    }
    for (var i = 1; i < rings.length; i++) rings[i].forEach(function(nd) {
      var p = loopPoint(nd.loop, 0);
      var par = rings[i - 1].filter(function(q) { return inLoop(q.loop, p.x, p.y); })[0] || rings[i - 1][0];
      nd.parent = par; par.kids.push(nd);
    });
    var order = [];
    var visit = function(nd) { nd.kids.forEach(visit); order.push(nd); };
    (rings[0] || []).forEach(visit);
    var pitch = Math.max(0.2, Math.min(doc, o.bit * 0.5)), above = cut.z0;
    levels(cut.z0, cut.depth).forEach(function(zl) {
      var prev = null;
      order.forEach(function(nd) {
        if (prev && prev.parent === nd) {
          var lp = startNear(nd.loop, x - cx, y - cy), p = loopPoint(lp, 0);
          line(cx + p.x, cy + p.y);
          path(lp, cx, cy);
        } else if (loopLength(nd.loop) >= 2 * o.bit || nd.inset < 0.05) {
          var p0 = loopPoint(nd.loop, 0);
          rapid(cx + p0.x, cy + p0.y);
          down(above);
          ramp(nd.loop, cx, cy, zl, pitch);
        } else {
          // Too short to go down along: a little circle round its middle
          // (inside where the bit may go: no further out than this ring's
          // inset), then out to the ring.
          var c = loopMiddle(nd.loop), hr = Math.max(0.05, Math.min(rb * 0.5, nd.inset));
          var circle = shapeLoop({ kind: 'circle', r: hr }, 0), q0 = loopPoint(circle, 0);
          rapid(cx + c.x + q0.x, cy + c.y + q0.y);
          down(above);
          ramp(circle, cx + c.x, cy + c.y, zl, pitch);
          var lp2 = startNear(nd.loop, x - cx, y - cy), p2 = loopPoint(lp2, 0);
          line(cx + p2.x, cy + p2.y);
          path(lp2, cx, cy);
        }
        prev = nd;
      });
      above = zl;
    });
    lift();
  }
  // The middle of a loop's points.
  function loopMiddle(loop) {
    var sx = 0, sy = 0;
    loop.forEach(function(sg) { sx += sg.x0; sy += sg.y0; });
    return { x: sx / loop.length, y: sy / loop.length };
  }
  // The loop started at its nearest point to (x, y).
  function startNear(loop, px, py) {
    var s = loopNearest(loop, px, py), len = loopLength(loop);
    return s < 1e-9 || s > len - 1e-9 ? loop : loopPart(loop, s, len).concat(loopPart(loop, 0, s));
  }
  // A ring between the shape moved tIn and tOut (the shoulder round a
  // lip), depth deep; about 3 degrees down along its first loop. finish:
  // a lap round its inner wall; finishOut: round its outer wall (a ring's
  // widened opening).
  function ring(cx, cy, cut) {
    var S = cut.shape || HS, a0 = cut.tIn + (cut.finish || 0) + rb, b0 = cut.tOut - (cut.finishOut || 0) - rb;
    var loops = loopsBetween(S, a0, Math.max(a0, b0)), rough = roughOf(cut);
    var pitch = Math.max(0.2, loopLength(loops[0]) * 0.05);
    cutLoops(cx, cy, loops, cut.z0, rough.depth, pitch);
    if (rough !== cut) afterwards('floors', cut.what + ': its floor skimmed', function() { cutLoops(cx, cy, loops, cut.z0 - rough.depth, cut.floor, pitch); });
    if (cut.finish) afterwards('laps', cut.what + ': finishing lap', function() { finishWall(cx, cy, S, cut.tIn + rb, cut.finish, cut, o.finishDir === 'climb'); });
    if (cut.finishOut) afterwards('laps', cut.what + ': finishing lap', function() { finishWall(cx, cy, S, cut.tOut - rb, -cut.finishOut, cut, o.finishDir !== 'climb'); });
  }
  // The finishing pass: the wall left `away` (into the air) by the
  // roughing cut down to it, one lap a level of up to 3 Depths of Cut,
  // clockwise (cw) or not: with the spindle turning clockwise, conventional
  // keeps the wood on the bit's left (clockwise round a pocket's wall,
  // counter-clockwise round the lip's), climb on its right. In from the air
  // beside the wall and back out.
  function finishWall(cx, cy, S, t, away, cut, cw) {
    var loop = shapeLoop(S, t), inside = shapeLoop(S, t + away);
    if (!loop || !inside) return;
    var p = loopPoint(loop, 0), q = loopPoint(inside, 0), segs = cw ? reverseLoop(loop) : loop;
    var d = 0, deep = Math.max(doc, 3 * doc);
    rapid(cx + q.x, cy + q.y);
    while (d < cut.depth - 1e-9) {
      d = Math.min(cut.depth, d + deep);
      down(cut.z0 - d);
      line(cx + p.x, cy + p.y);
      path(segs, cx, cy);
      line(cx + q.x, cy + q.y);
    }
    lift();
  }
  // The outline: the bit a radius outside it (side 'in': inside it, a
  // ring's inside), through the stock; on the levels below the tabs' tops
  // it goes straight down where it starts (clear of every tab) and lifts
  // over each. A ring's inside: clockwise (conventional), its Finish
  // Allowance left and then cut in a lap a few cuts deep at a time, its
  // direction as the other laps'.
  function profile(cx, cy, cut) {
    var fin = cut.side === 'in' && cut.finish > 0 ? cut.finish : 0;
    if (!fin) return profilePass(cx, cy, cut, cut.t, doc, cut.side === 'in');
    profilePass(cx, cy, cut, cut.t - fin, doc, true);
    profilePass(cx, cy, cut, cut.t, 3 * doc, o.finishDir !== 'climb');
  }
  function profilePass(cx, cy, cut, t, deep, back) {
    var loop = shapeLoop(cut.shape || HS, cut.side === 'in' ? t - rb : t + rb), len = loopLength(loop), tabs = cut.tabs, spans = [];
    // Backwards: the same pieces, from the far end (the tabs sit the same).
    var part = back ? function(a, b) { return reverseLoop(loopPart(loop, len - b, len - a)); } : function(a, b) { return loopPart(loop, a, b); };
    var whole = back ? reverseLoop(loop) : loop;
    // Tabs: Height from the half's bottom, each in the middle of its own
    // share of the way round (none where the cut starts).
    var tabTop = tabs ? cut.z0 - (cut.depth - o.through - tabs.height) : null;
    if (tabs) {
      var half = (tabs.width + o.bit) / 2;
      for (var k = 0; k < tabs.count; k++) { var c = len * (k + 0.5) / tabs.count; spans.push([c - half, c + half]); }
    }
    var s0 = start(loop);
    rapid(cx + s0.x, cy + s0.y);
    levels(cut.z0, cut.depth, deep).forEach(function(zl) {
      if (tabTop == null || zl >= tabTop - 1e-9) {
        if (z > cut.z0) down(cut.z0);
        ramp(whole, cx, cy, zl, Math.max(0.2, len * 0.05));
        return;
      }
      down(zl);
      var at = 0;
      spans.forEach(function(sp) {
        path(part(at, sp[0]), cx, cy);
        L.push('G1 Z' + n3(tabTop) + ' F' + Math.round(f.plunge)); minutes += (tabTop - z) / f.plunge; z = tabTop;
        path(part(sp[0], sp[1]), cx, cy);
        L.push('G1 Z' + n3(zl) + ' F' + Math.round(f.plunge)); minutes += (tabTop - zl) / f.plunge; z = zl;
        at = sp[1];
      });
      path(part(at, len), cx, cy);
    });
    lift();
  }

  // The header: what it is, how it's set up.
  var unit = 'mm';
  comment((f.label || 'Carved Box') + ': a ' + (plan.bottom ? 'ring, a bottom' : 'base') + ' and a lid, ' + (plan.shape.kind === 'rect'
    ? mm3(o.length) + ' x ' + mm3(o.width) + unit + ', corners ' + mm3(plan.shape.cr) + unit
    : plan.shape.kind === 'poly' ? plan.shape.n + ' sides, ' + mm3(o.flats) + unit + ' across, corners ' + mm3(plan.shape.cr) + unit
    : o.shape === 'oval' ? 'an oval ' + mm3(o.length) + ' x ' + mm3(o.width) + unit
    : o.shape === 'heart' ? 'a heart ' + mm3(o.length) + ' x ' + mm3(o.width) + unit + ', point ' + mm3(o.cornerRadius) + unit
    : o.shape === 'custom' ? 'a drawing ' + mm3(o.length) + ' x ' + mm3(o.width) + unit + ', corners ' + mm3(o.cornerRadius) + unit
    : mm3(o.diameter) + unit + ' across'));
  var B = plan.boards || { sep: false };
  if (B.sep) comment('Only the ' + o.cut + ', on its own board' + (o.grain && o.cut !== 'bottom' ? ', grain matched' : '') + ': cut the ' + (o.cut === 'bottom' ? 'base and lid with theirs' : (o.cut === 'base' ? 'lid' : 'base') + ' with its own program'));
  if (B.sep && o.cut !== 'bottom' && plan.bottom) comment('The bottom is not in this program: cut it with Bottom Only');
  else if (!B.sep && plan.bottom && plan.bottom.own) comment('The bottom is not in this program: cut it from its board with Bottom Only');
  comment((B.sep ? cap(o.cut) + '\'s board ' : 'Stock ') + mm3(plan.stock.thick || o.stock) + unit + ' thick, at least ' + n3(plan.stock.w) + ' x ' + n3(plan.stock.h) + unit);
  if (plan.set) plan.set.forEach(function(p, i) {
    comment('Box ' + (i + 1) + ': ' + boxSize(p, mm3, unit) + ', ' + n3(p.closedHeight) + unit + ' closed, ' + n3(p.insideHeight) + unit + ' inside');
  });
  var inset = plan.bottom && plan.bottom.style === 'inset', plugLid = plan.lidStyle === 'plug';
  comment('Wall ' + mm3(o.wall) + ', ' + (inset ? 'no floor (an inset bottom)' : plan.bottom ? 'no floor (the bottom glued on)' : 'floor ' + mm3(o.floor)) + ', ' + (plugLid ? 'a plug lid (solid)' : 'top ' + mm3(o.top)) + unit);
  if (inset) {
    comment('Inset bottom: a panel ' + mm3(plan.bottom.height) + unit + ' thick, glued into a rabbet');
    comment(mm3(plan.bottom.rabbet.width) + unit + ' wide, ' + mm3(plan.bottom.rabbet.depth) + unit + ' deep round the ring: turn the ring over,');
    comment('rabbet down, and the panel goes in from below' + (plan.bottom.recess > 0 ? ', ' + mm3(plan.bottom.recess) + unit + ' up' : ''));
  } else if (plan.bottom) comment('Bottom ' + mm3(plan.bottom.height) + unit + ' thick, stepped down ' + mm3(plan.bottom.step) + unit + ' round a plug that fits in the ring');
  if (plan.bottom && plan.bottom.oversize > 0) comment('Bottom ' + mm3(plan.bottom.oversize) + unit + ' oversize all round: trim it flush once glued');
  comment('Lip on the ' + o.lipOn + ': ' + mm3(plan.lipUp) + ' high, ' + mm3(o.lipWidth) + (plan.slope ? ' wide at its foot, its side sloped, ' : ' wide, ') + mm3(o.clearance) + unit + ' clearance');
  if (!plan.set) ['base', 'lid'].forEach(function(h) {
    if (plan.faces && plan.faces[h] > 0 && plan.halves.some(function(x) { return x.name === h; })) comment(cap(h) + ' ' + n3(h === 'lid' ? plan.lidHeight : plan.baseHeight) + unit + ' high: its area faced down ' + n3(plan.faces[h]) + unit + ' first');
  });
  if (plan.set) comment('Each box as its own settings say: magnets, notch, edges, corners');
  else if (plan.magnetAt.length && !(o.magnets.bit > 0)) comment('Magnets: ' + plan.magnetAt.length + ' holes ' + mm3(o.magnets.diameter) + unit + ' wide, ' + mm3(o.magnets.depth) + unit + ' deep, both halves');
  if (plan.notch && !plan.set) comment((plan.notches.length > 1 ? plan.notches.length + ' finger notches' : 'Finger notch') + ' in the base, ' + mm3(o.notch.width) + unit + ' wide, ' + mm3(o.notch.depth) + unit + ' deep');
  comment('Closed ' + n3(plan.closedHeight) + unit + ' high, ' + n3(plan.insideHeight) + unit + ' inside' + (insideSize(plan, mm3, unit) ? '; inside ' + insideSize(plan, mm3, unit) : ''));
  comment('Origin: ' + (plan.originSay || (o.origin === 'center' ? 'the middle of the pair' : 'the stock\'s front-left corner')));
  comment('Z0: top of the ' + (B.sep ? 'board' : 'stock'));
  if (!only) comment('Bit ' + mm3(o.bit) + unit + ', feed ' + Math.round(f.feed) + ', plunge ' + Math.round(f.plunge) + unit + '/min, ' + n3(doc) + unit + ' a pass');
  if (o.tabs) comment('Tabs: ' + o.tabs.count + ' x ' + mm3(o.tabs.width) + unit + ' wide, ' + mm3(o.tabs.height) + unit + ' high');
  // The bits after the box's: a smaller one for the magnet holes, a ball
  // or bowl bit for the floor corners, then the edge bit; each after a
  // tool change (M6), or (only) on its own.
  var co = o.corners, ed = o.edges, mg = o.magnets;
  var SECOND = [
    { key: 'magnets', name: 'Magnet holes', one: 'magnet', f: f.magnets, d: mg && mg.bit,
      bit: mg && 'a ' + mm3(mg.bit) + unit + ' bit',
      about: mg && 'Magnets: ' + plan.magnetAt.length + ' holes ' + mm3(mg.diameter) + unit + ' wide, ' + mm3(mg.depth) + unit + ' deep, both halves' },
    { key: 'corners', name: 'Corners', one: 'corner', cuts: plan.corners, f: f.corners,
      bit: co && 'a ' + mm3(co.diameter) + unit + (2 * co.radius >= co.diameter - 1e-9 ? ' ball bit' : ' bowl bit, ' + mm3(co.radius) + unit + ' corners'),
      about: co && 'Floor corners rounded ' + mm3(co.radius) + unit },
    { key: 'edges', name: 'Edges', one: 'edge', cuts: plan.edges, f: f.edges,
      bit: ed && (ed.bit === 'round' ? 'a ' + mm3(ed.radius) + unit + ' roundover bit' : 'a ' + mm3(ed.angle) + ' degree V-bit'),
      about: ed && 'Edges down: seam ' + mm3(ed.outside || 0) + (plan.slope ? ', the lip sloped' : ', lead-in ' + mm3(ed.inside || 0)) + ', pocket ' + mm3(ed.pocket || 0) + unit }
  ].filter(function(g) { return plan.halves.some(function(h) { return h.plan[g.key] && h.plan[g.key][h.name].length > 0; }); });
  var mine = SECOND.filter(function(g) { return only ? g.key === only : g.f; });
  SECOND.forEach(function(g) {
    if (only && only !== g.key) return;
    comment(g.about);
    if (only === g.key) { comment('Just the ' + g.name.toLowerCase() + ', after the box; Z0 on the stock top'); comment('With ' + g.bit); }
    else if (!only && g.f) comment(g.name + ' after the box, with ' + g.bit + ' (T' + g.f.toolNumber + ')');
    else if (!only) comment(g.name + ' not in this program: cut them after it with ' + g.name + ' Only');
  });
  L.push('');
  L.push('G21 ; Metric units', 'G17 ; XY plane selection', 'G90 ; Absolute positioning', 'G94 ; Feed rate per minute', '');
  L.push(safe + ' ; Up to safe height');
  var spun = false;
  function startBit(g, change) {
    var sf = g ? g.f : f;
    if (change) {
      L.push('', safe + ' ; Up to safe height');
      if (spun) L.push('M5 ; Stop spindle');
    }
    if (sf.toolNumber > 0) {
      L.push('M6 T' + sf.toolNumber + ' ; Tool change' + (g ? ': the ' + g.one + ' bit' : ''));
      // A tool change can leave it lower, or other units.
      L.push('G21 G90 ; Metric, absolute again', safe + ' ; Up to safe height');
    }
    if (sf.rpm > 0) {
      L.push('M3 S' + Math.round(sf.rpm) + ' ; Start spindle');
      if (sf.delay > 0) L.push('G4 P' + +(+sf.delay).toFixed(1) + ' ; Wait for the spindle');
      spun = true;
    } else spun = false;
    z = HIGH;
  }

  if (!only) {
    startBit(null, false);
    plan.halves.forEach(function(h) {
      HS = h.shape || h.plan.shape;
      later = { floors: [], laps: [] };
      var run = function(cut) {
        comment(cap(h.label) + ': ' + cut.what);
        (cut.op === 'pocket' ? pocket : cut.op === 'profile' ? profile : ring)(h.at.x + (cut.dx || 0), h.at.y + (cut.dy || 0), cut);
      };
      h.cuts.forEach(function(cut) { if (!cut.last) run(cut); });
      var done = later;
      later = null;
      done.floors.concat(done.laps).forEach(function(t) { comment(cap(h.label) + ': ' + t.what); t.run(); });
      // Then what frees a piece (a ring's middle), on finished floors.
      h.cuts.forEach(function(cut) { if (cut.last) run(cut); });
    });
    plan.halves.forEach(function(h) {
      HS = h.shape || h.plan.shape;
      comment(cap(h.label) + ': outline' + (h.outline.tabs ? ', with tabs' : ''));
      profile(h.at.x, h.at.y, h.outline);
    });
  }
  mine.forEach(function(g, i) {
    startBit(g, !only || i > 0);
    f = Object.assign({}, f, { feed: g.f.feed, plunge: g.f.plunge });
    doc = Math.max(0.05, g.f.doc || doc);
    var d = g.d || o.bit;
    rb = d / 2; step = Math.max(0.05, Math.min(d * ((g.d ? g.f : f).stepoverPct || 40) / 100, d * 0.9));
    plan.halves.forEach(function(h) {
      HS = h.shape || h.plan.shape;
      h.plan[g.key][h.name].forEach(function(e) {
        comment(cap(h.label) + ': ' + e.what);
        if (e.op === 'pocket') return pocket(h.at.x + e.dx, h.at.y + e.dy, e);
        var loop = shapeLoop(e.shape, e.t), air = e.air || 0;
        cutLoops(h.at.x, h.at.y, [loop], e.z0 - air, e.depth - air, Math.max(0.2, loopLength(loop) * 0.05));
      });
    });
  });

  L.push('', safe + ' ; Up to safe height');
  if (spun) L.push('M5 ; Stop spindle');
  L.push('M30 ; Program end');
  return { gcode: L.join('\n') + '\n', minutes: minutes };
}
// A loop the other way round (clockwise): its pieces in reverse, each
// from its end to its start.
function reverseLoop(loop) {
  return loop.slice().reverse().map(function(s) {
    return s.type === 'line' ? { type: 'line', x0: s.x1, y0: s.y1, x1: s.x0, y1: s.y0, len: s.len } : Object.assign({}, s, { cw: true });
  });
}
var MAX_LINES = 300000;
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
// A box's size, as said in the program.
// A round, rectangular or polygon box's inside, across (others: '').
function insideSize(p, mm3, unit) {
  var o = p.o, w2 = 2 * o.wall;
  return p.shape.kind === 'rect' ? mm3(o.length - w2) + ' x ' + mm3(o.width - w2) + unit : p.shape.kind === 'poly' ? mm3(o.flats - w2) + unit + ' across flats'
    : p.shape.kind === 'circle' && o.shape === 'circle' ? mm3(o.diameter - w2) + unit + ' across' : '';
}
function boxSize(p, mm3, unit) {
  var o = p.o;
  return p.shape.kind === 'rect' ? mm3(o.length) + ' x ' + mm3(o.width) + unit : p.shape.kind === 'poly' ? p.shape.n + ' sides, ' + mm3(o.flats) + unit + ' across'
    : o.shape === 'oval' ? 'oval ' + mm3(o.length) + ' x ' + mm3(o.width) + unit : o.shape === 'heart' ? 'heart ' + mm3(o.length) + ' x ' + mm3(o.width) + unit
    : o.shape === 'custom' ? 'drawing ' + mm3(o.length) + ' x ' + mm3(o.width) + unit : mm3(o.diameter) + unit + ' across';
}

if (typeof module !== 'undefined' && module.exports) {
  var shapeLib = require('./box-shape.cjs');
  var shapeLoops = shapeLib.shapeLoops, loopNearest = shapeLib.loopNearest, inLoop = require('./box-outline.cjs').inLoop;
  var shapeLoop = shapeLib.shapeLoop, shapeDeepest = shapeLib.shapeDeepest, loopLength = shapeLib.loopLength, loopPart = shapeLib.loopPart, loopPoint = shapeLib.loopPoint;
  module.exports = { boxProgram: boxProgram, MAX_LINES: MAX_LINES };
}
