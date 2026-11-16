/**
 * Carved Box: a shape from its outline, for the ones without a formula
 * for their offsets (a heart, an oval): { kind: 'outline', segs, step }.
 * segs: the outline, a closed CCW loop of lines and arcs as box-shape.cjs's
 * loops. Its signed distance (< 0 inside) is exact: to the nearest piece of
 * the outline. Its offsets are that distance's contours on a grid `step`
 * apart (0.2 mm or so), straightened where they're straight, so they're
 * lines only; moved in far enough, an outline can come apart, so there can
 * be several. mm.
 */

// The distance from (x, y) to a piece of the outline.
function segDistance(s, x, y) {
  if (s.type === 'line') {
    var dx = s.x1 - s.x0, dy = s.y1 - s.y0, l2 = dx * dx + dy * dy;
    var f = l2 > 0 ? Math.max(0, Math.min(1, ((x - s.x0) * dx + (y - s.y0) * dy) / l2)) : 0;
    return Math.hypot(x - s.x0 - f * dx, y - s.y0 - f * dy);
  }
  // An arc: to its circle where the point's angle is on it, else an end.
  var a = Math.atan2(y - s.cy, x - s.cx);
  while (a < s.a0) a += 2 * Math.PI;
  while (a > s.a0 + 2 * Math.PI) a -= 2 * Math.PI;
  if (a <= s.a1) return Math.abs(Math.hypot(x - s.cx, y - s.cy) - s.r);
  return Math.min(Math.hypot(x - s.cx - s.r * Math.cos(s.a0), y - s.cy - s.r * Math.sin(s.a0)),
    Math.hypot(x - s.cx - s.r * Math.cos(s.a1), y - s.cy - s.r * Math.sin(s.a1)));
}
// Inside the outline: an odd count of crossings to the right (arcs as
// fine chords).
function insideOutline(segs, x, y) {
  var c = 0, pts = outlinePoints(segs);
  for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    var p = pts[i], q = pts[j];
    if ((p.y > y) !== (q.y > y) && x < (q.x - p.x) * (y - p.y) / (q.y - p.y) + p.x) c++;
  }
  return c % 2 === 1;
}
// The outline as points: lines' ends, arcs every few degrees (kept).
function outlinePoints(segs) {
  if (segs._pts) return segs._pts;
  var pts = [];
  segs.forEach(function(s) {
    if (s.type === 'line') { pts.push({ x: s.x0, y: s.y0 }); return; }
    var n = Math.max(2, Math.ceil((s.a1 - s.a0) / (Math.PI / 90)));
    for (var k = 0; k < n; k++) { var a = s.a0 + (s.a1 - s.a0) * k / n; pts.push({ x: s.cx + s.r * Math.cos(a), y: s.cy + s.r * Math.sin(a) }); }
  });
  segs._pts = pts;
  return pts;
}
function outlineDistance(S, x, y) {
  if (S.sdf) return S.sdf(x, y);
  var d = Infinity;
  for (var i = 0; i < S.segs.length; i++) d = Math.min(d, segDistance(S.segs[i], x, y));
  return insideOutline(S.segs, x, y) ? -d : d;
}

// The distance on a grid round the outline, pad past it (PAD, or more for
// an offset further out): made once for
// each outline (by its key), the inside found a row at a time.
var PAD = 25, GRIDS = {}, GRID_KEYS = [];
function outlineGrid(S, pad) {
  pad = Math.max(PAD, pad || 0);
  var key = S.key && S.key + '|' + pad;
  if (key && GRIDS[key]) return GRIDS[key];
  var pts = S.segs ? outlinePoints(S.segs) : [], x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  pts.forEach(function(p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
  if (S.box) { x0 = S.box.minX; x1 = S.box.maxX; y0 = S.box.minY; y1 = S.box.maxY; }
  var h = S.step || 0.2;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  var nx = Math.ceil((x1 - x0) / h) + 1, ny = Math.ceil((y1 - y0) / h) + 1, v = new Float64Array(nx * ny), lo = Infinity;
  for (var j = 0; j < ny; j++) {
    var y = y0 + j * h, xs = [];
    for (var i = 0, k = pts.length - 1; i < pts.length; k = i++) {
      var p = pts[i], q = pts[k];
      if ((p.y > y) !== (q.y > y)) xs.push((q.x - p.x) * (y - p.y) / (q.y - p.y) + p.x);
    }
    xs.sort(function(m, n) { return m - n; });
    var c = 0;
    for (i = 0; i < nx; i++) {
      var x = x0 + i * h;
      while (c < xs.length && xs[c] <= x) c++;
      if (S.sdf) v[j * nx + i] = S.sdf(x, y);
      else {
        var d = Infinity;
        for (var m = 0; m < S.segs.length; m++) d = Math.min(d, segDistance(S.segs[m], x, y));
        v[j * nx + i] = c % 2 === 1 ? -d : d;
      }
      if (v[j * nx + i] < lo) lo = v[j * nx + i];
    }
  }
  var grid = { x0: x0, y0: y0, h: h, nx: nx, ny: ny, v: v, deepest: -lo };
  grid.pad = pad; grid.key = key;
  if (key) {
    GRIDS[key] = grid; GRID_KEYS.push(key);
    if (GRID_KEYS.length > 6) { var old = GRID_KEYS.shift(); delete GRIDS[old]; delete MEMO[old]; }
  }
  return grid;
}

// Where the distance is t: closed loops (CCW, lines), by marching squares.
function outlineLoops(S, t) {
  // Far enough out: a grid with room past t.
  var g = outlineGrid(S, t > PAD - 3 ? Math.ceil(t + 10) : PAD), nx = g.nx, ny = g.ny, v = g.v, h = g.h;
  // Contours of a shape are asked for many times: kept by level.
  var memo = g.key ? (MEMO[g.key] = MEMO[g.key] || {}) : null, mk = t.toFixed(6);
  if (memo && memo[mk]) return memo[mk];
  if (t <= -g.deepest + 1e-9 || t >= g.pad - h) return [];
  // An edge's crossing point, by its key (a cell's edge, shared).
  var pt = {};
  var cross = function(i0, j0, i1, j1) {
    var key = i0 < i1 || j0 < j1 ? i0 + ',' + j0 + ',' + i1 + ',' + j1 : i1 + ',' + j1 + ',' + i0 + ',' + j0;
    if (pt[key]) return key;
    var a = v[j0 * nx + i0] - t, b = v[j1 * nx + i1] - t, f = a / (a - b);
    pt[key] = { x: g.x0 + (i0 + (i1 - i0) * f) * h, y: g.y0 + (j0 + (j1 - j0) * f) * h };
    return key;
  };
  // Each cell's pieces: the two edges each joins (no direction yet).
  var adj = {};
  var link = function(p, q) { (adj[p] = adj[p] || []).push(q); (adj[q] = adj[q] || []).push(p); };
  for (var j = 0; j < ny - 1; j++) for (var i = 0; i < nx - 1; i++) {
    var a = v[j * nx + i] < t, b = v[j * nx + i + 1] < t, c = v[(j + 1) * nx + i + 1] < t, d = v[(j + 1) * nx + i] < t;
    var code = (a ? 1 : 0) | (b ? 2 : 0) | (c ? 4 : 0) | (d ? 8 : 0);
    if (code === 0 || code === 15) continue;
    var Sx = function() { return cross(i, j, i + 1, j); }, E = function() { return cross(i + 1, j, i + 1, j + 1); };
    var N = function() { return cross(i, j + 1, i + 1, j + 1); }, W = function() { return cross(i, j, i, j + 1); };
    // The edges whose ends differ, joined in pairs round the cell.
    if (code === 5 || code === 10) {
      // A saddle: the middle's value says which corners connect.
      var mid = (v[j * nx + i] + v[j * nx + i + 1] + v[(j + 1) * nx + i + 1] + v[(j + 1) * nx + i]) / 4 < t;
      if ((code === 5) === mid) { link(W(), N()); link(Sx(), E()); } else { link(W(), Sx()); link(E(), N()); }
      continue;
    }
    var es = [];
    if (a !== b) es.push(Sx()); if (b !== c) es.push(E()); if (c !== d) es.push(N()); if (d !== a) es.push(W());
    link(es[0], es[1]);
  }
  var loops = [], seen = {};
  Object.keys(adj).forEach(function(k0) {
    if (seen[k0]) return;
    var ring = [], prev = null, k = k0;
    while (k && !seen[k]) {
      seen[k] = true; ring.push(pt[k]);
      var ns = adj[k], nk = ns[0] !== prev && !seen[ns[0]] ? ns[0] : ns[1] !== prev && !seen[ns[1]] ? ns[1] : null;
      prev = k; k = nk;
    }
    if (ring.length < 3) return;
    // Counter-clockwise.
    var area = 0;
    for (var m = 0; m < ring.length; m++) { var P = ring[m], Q = ring[(m + 1) % ring.length]; area += P.x * Q.y - Q.x * P.y; }
    if (area < 0) ring.reverse();
    ring = straighten(ring, Math.min(0.02, h / 10));
    if (ring.length >= 3) loops.push(toSegs(ring));
  });
  // Largest first.
  loops.sort(function(p, q) { return loopArea(q) - loopArea(p); });
  if (memo) memo[mk] = loops;
  return loops;
}
var MEMO = {};
function loopArea(loop) {
  return loop.reduce(function(a, s) { return a + (s.x0 * s.y1 - s.x1 * s.y0) / 2; }, 0);
}
// Points on a closed ring with the ones that don't bend it more than tol
// left out (Douglas-Peucker, from its two furthest-apart points).
function straighten(ring, tol) {
  var far = 0, best = 0;
  for (var i = 1; i < ring.length; i++) { var dd = Math.hypot(ring[i].x - ring[0].x, ring[i].y - ring[0].y); if (dd > best) { best = dd; far = i; } }
  var keep = new Array(ring.length).fill(false);
  keep[0] = keep[far] = true;
  var dp = function(a, b) {
    var p = ring[a], q = ring[b % ring.length], dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1e-12, worst = 0, at = -1;
    for (var k = a + 1; k < b; k++) { var r = ring[k % ring.length], e = Math.abs((r.x - p.x) * dy - (r.y - p.y) * dx) / l; if (e > worst) { worst = e; at = k; } }
    if (worst > tol) { keep[at % ring.length] = true; dp(a, at); dp(at, b); }
  };
  dp(0, far); dp(far, ring.length);
  return ring.filter(function(p, i) { return keep[i]; });
}
function toSegs(ring) {
  var segs = [];
  for (var i = 0; i < ring.length; i++) {
    var p = ring[i], q = ring[(i + 1) % ring.length], len = Math.hypot(q.x - p.x, q.y - p.y);
    if (len > 1e-9) segs.push({ type: 'line', x0: p.x, y0: p.y, x1: q.x, y1: q.y, len: len });
  }
  return segs;
}
// Is (x, y) inside a loop of lines?
function inLoop(loop, x, y) {
  var c = 0;
  loop.forEach(function(s) { if ((s.y0 > y) !== (s.y1 > y) && x < (s.x1 - s.x0) * (y - s.y0) / (s.y1 - s.y0) + s.x0) c++; });
  return c % 2 === 1;
}

// A heart Width across its lobes and Height from its point to the top of
// the lobes, the point rounded `point` (mm), pointing to -Y (or turned to
// -X, along Y): two round lobes meeting in a notch at the top, their
// sides straight down to the point. As QuickCut's heart (lobes 0.72 of
// their radius either side of the middle). null when the point's too
// close under the lobes for a heart.
var HEART_LOBE = 0.72;
function heartShape(W, H, point, alongY) {
  var r = W / 2 / (1 + HEART_LOBE), a = HEART_LOBE * r, yc = H / 2 - r, rho = Math.max(0, point || 0);
  if (!(W > 0 && H > 0) || yc - (-H / 2) < r * 1.5) return null;
  // The point's circle: its bottom at -H/2.
  var ct = { x: 0, y: -H / 2 + rho }, cR = { x: a, y: yc };
  var dx = cR.x - ct.x, dy = cR.y - ct.y, L = Math.hypot(dx, dy);
  if (!(L > Math.abs(r - rho) + 1e-6) || rho >= r) return null;
  // The right side: the line touching both circles, its outward normal at phiR.
  var phiR = Math.atan2(dy, dx) - Math.acos((rho - r) / L), phiL = Math.PI - phiR;
  var notchR = Math.atan2(Math.sqrt(r * r - a * a), -a);
  var u = function(t) { return { x: Math.cos(t), y: Math.sin(t) }; }, nR = u(phiR), nL = u(phiL);
  var segs = [];
  var line = function(p, q) { var len = Math.hypot(q.x - p.x, q.y - p.y); if (len > 1e-9) segs.push({ type: 'line', x0: p.x, y0: p.y, x1: q.x, y1: q.y, len: len }); };
  var arc = function(cx, cy, rr, a0, a1) { if (rr > 1e-9) segs.push({ type: 'arc', cx: cx, cy: cy, r: rr, a0: a0, a1: a1, len: rr * (a1 - a0) }); };
  arc(ct.x, ct.y, rho, phiL, phiR + 2 * Math.PI);
  line({ x: ct.x + rho * nR.x, y: ct.y + rho * nR.y }, { x: cR.x + r * nR.x, y: cR.y + r * nR.y });
  arc(cR.x, cR.y, r, phiR, notchR);
  arc(-cR.x, cR.y, r, Math.PI - notchR, phiL);
  line({ x: -cR.x + r * nL.x, y: cR.y + r * nL.y }, { x: ct.x + rho * nL.x, y: ct.y + rho * nL.y });
  // Along Y, its point to -X: turned a quarter clockwise.
  if (alongY) segs = segs.map(function(sg) {
    if (sg.type === 'line') return { type: 'line', x0: sg.y0, y0: -sg.x0, x1: sg.y1, y1: -sg.x1, len: sg.len };
    return { type: 'arc', cx: sg.cy, cy: -sg.cx, r: sg.r, a0: sg.a0 - Math.PI / 2, a1: sg.a1 - Math.PI / 2, len: sg.len };
  });
  return { kind: 'outline', segs: segs, cr: rho, key: 'heart:' + [W, H, rho, alongY ? 'y' : 'x'].join(','), step: gridStep(Math.max(W, H)) };
}
// An oval (an ellipse) A across X and B across Y: its exact signed
// distance (the nearest point on it, found by Newton's method).
function ovalShape(A, B) {
  if (!(A > 0 && B > 0)) return null;
  var a = A / 2, b = B / 2;
  var sdf = function(x, y) {
    var px = Math.abs(x), py = Math.abs(y);
    if (Math.abs(a - b) < 1e-9) return Math.hypot(px, py) - a;
    // The nearest point (a cos t, b sin t): t by Newton, from the point's
    // angle and both ends of the quarter (inside, there can be more than
    // one point where the distance is level); the nearest of them.
    var d = Infinity;
    [Math.atan2(a * py, b * px), 0, Math.PI / 2].forEach(function(t) {
      for (var k = 0; k < 12; k++) {
        var ct = Math.cos(t), st = Math.sin(t);
        var f = (a * a - b * b) * st * ct - px * a * st + py * b * ct;
        var df = (a * a - b * b) * (ct * ct - st * st) - px * a * ct - py * b * st;
        if (Math.abs(df) < 1e-12) break;
        t = Math.max(0, Math.min(Math.PI / 2, t - f / df));
      }
      d = Math.min(d, Math.hypot(px - a * Math.cos(t), py - b * Math.sin(t)));
    });
    return (px * px) / (a * a) + (py * py) / (b * b) < 1 ? -d : d;
  };
  return { kind: 'outline', sdf: sdf, box: { minX: -a, maxX: a, minY: -b, maxY: b },
    // Its tightest round, at the ends of its long way: as a corner's radius.
    cr: Math.min(a, b) * Math.min(a, b) / Math.max(a, b), key: 'oval:' + A + ',' + B, step: gridStep(Math.max(A, B)) };
}
// Fine enough for a small box, not too many points for a big one.
function gridStep(size) { return Math.max(0.15, Math.min(0.4, size / 600)); }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { outlineDistance: outlineDistance, outlineLoops: outlineLoops, outlineGrid: outlineGrid, inLoop: inLoop,
    heartShape: heartShape, ovalShape: ovalShape };
}
