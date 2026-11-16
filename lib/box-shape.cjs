/**
 * Carved Box: the box's outline (a circle, or a rectangle with rounded
 * corners) moved in or out, as a closed loop of lines and CCW arcs about
 * the middle: { type: 'line', x0, y0, x1, y1, len } and { type: 'arc',
 * cx, cy, r, a0, a1, len } (a1 > a0). Every loop starts on +X, at the
 * middle of the right side, so loops of one shape line up there.
 *
 * shape: { kind: 'circle', r }, { kind: 'rect', hx, hy, cr } (half the
 * length along X and the width along Y, the corner radius), or { kind:
 * 'poly', n, a, cr, rot } (a regular polygon: n sides, a the apothem, half
 * across the flats, the corner radius, rot the angle of a corner). mm.
 */

// The outline moved t out (in, t < 0): null when there's nothing left.
// A rectangle's corners keep their centers: radius cr + t, square once
// that's 0; one moved in to a line (or a point) is a slot's center line,
// out and back.
function shapeLoop(shape, t) {
  if (shape.kind === 'circle') {
    var r = shape.r + t;
    if (!(r > 1e-6)) return null;
    return [arcSeg(0, 0, r, 0, Math.PI), arcSeg(0, 0, r, Math.PI, 2 * Math.PI)];
  }
  if (shape.kind === 'poly') { var pl = polyLoop(shape, t); return pl && startAtPlusX(pl); }
  var hx = shape.hx + t, hy = shape.hy + t, cr = Math.max(0, Math.min(shape.cr + t, hx, hy));
  if (hx < -1e-9 || hy < -1e-9) return null;
  hx = Math.max(0, hx); hy = Math.max(0, hy);
  if (hx < 1e-6 && hy < 1e-6) return null;
  var segs = [];
  var line = function(x0, y0, x1, y1) { var len = Math.hypot(x1 - x0, y1 - y0); if (len > 1e-9) segs.push({ type: 'line', x0: x0, y0: y0, x1: x1, y1: y1, len: len }); };
  var corner = function(cx, cy, a0) { if (cr > 1e-9) segs.push(arcSeg(cx, cy, cr, a0, a0 + Math.PI / 2)); };
  var ix = hx - cr, iy = hy - cr;
  if (hy < 1e-6) { line(hx, 0, -hx, 0); line(-hx, 0, hx, 0); return segs; }
  if (hx < 1e-6) { line(0, 0, 0, hy); line(0, hy, 0, -hy); line(0, -hy, 0, 0); return segs; }
  line(hx, 0, hx, iy); corner(ix, iy, 0);
  line(ix, hy, -ix, hy); corner(-ix, iy, Math.PI / 2);
  line(-hx, iy, -hx, -iy); corner(-ix, -iy, Math.PI);
  line(-ix, -hy, ix, -hy); corner(ix, -iy, 3 * Math.PI / 2);
  line(hx, -iy, hx, 0);
  return segs;
}
// A regular polygon moved t: its corners' centers stay put while their
// radius cr + t lasts, then the corners are sharp, the sides moved t.
function polyLoop(shape, t) {
  var n = shape.n, a = shape.a + t, r = Math.max(0, Math.min(shape.cr + t, a)), half = Math.PI / n;
  if (!(a > 1e-6)) return null;
  var c = (a - r) / Math.cos(half), segs = [], corners = [];
  for (var k = 0; k < n; k++) {
    var th = shape.rot + 2 * Math.PI * k / n, cx = c * Math.cos(th), cy = c * Math.sin(th);
    // From the side before it to the side after it, CCW.
    corners.push({ cx: cx, cy: cy, a0: th - half, a1: th + half });
  }
  corners.forEach(function(k, i) {
    var p = function(ang) { return { x: k.cx + r * Math.cos(ang), y: k.cy + r * Math.sin(ang) }; };
    if (r > 1e-9) segs.push(arcSeg(k.cx, k.cy, r, k.a0, k.a1));
    var q = corners[(i + 1) % n], e = p(k.a1), f = { x: q.cx + r * Math.cos(q.a0), y: q.cy + r * Math.sin(q.a0) };
    var len = Math.hypot(f.x - e.x, f.y - e.y);
    if (len > 1e-9) segs.push({ type: 'line', x0: e.x, y0: e.y, x1: f.x, y1: f.y, len: len });
  });
  return segs;
}
// A closed CCW loop round the middle, started where it crosses +X.
function startAtPlusX(loop) {
  var at = loopAt(loop, 0);
  if (at === null || at < 1e-9) return loop;
  var len = loopLength(loop);
  return loopPart(loop, at, len).concat(loopPart(loop, 0, at));
}
// How far along a loop round the middle the ray from the middle at angle
// ang crosses it; null when it doesn't.
function loopAt(loop, ang) {
  var at = 0, best = null, dx = Math.cos(ang), dy = Math.sin(ang);
  for (var i = 0; i < loop.length && best === null; i++) {
    var s = loop[i];
    if (s.type === 'line') {
      // Where (x, y) on the line is on the ray: cross product 0, dot > 0.
      var c0 = s.x0 * dy - s.y0 * dx, c1 = s.x1 * dy - s.y1 * dx;
      if ((c0 > 0) !== (c1 > 0) || Math.abs(c1) < 1e-12) {
        var f = Math.abs(c0 - c1) < 1e-15 ? 0 : c0 / (c0 - c1), x = s.x0 + (s.x1 - s.x0) * f, y = s.y0 + (s.y1 - s.y0) * f;
        if (x * dx + y * dy > 0 && f >= -1e-12 && f <= 1 + 1e-12) best = at + s.len * Math.max(0, Math.min(1, f));
      }
    } else {
      for (var k = 0; k <= 64 && best === null; k++) {
        var f0 = k / 64, f1 = (k + 1) / 64;
        if (f1 > 1) break;
        var p0 = segAt(s, f0), p1 = segAt(s, f1), d0 = p0.x * dy - p0.y * dx, d1 = p1.x * dy - p1.y * dx;
        if ((d0 > 0) !== (d1 > 0) || Math.abs(d1) < 1e-12) {
          // Narrowed down by halves.
          for (var j = 0; j < 40; j++) { var fm = (f0 + f1) / 2, pm = segAt(s, fm), dm = pm.x * dy - pm.y * dx; if ((dm > 0) === (d0 > 0)) { f0 = fm; d0 = dm; } else f1 = fm; }
          var pq = segAt(s, f1);
          if (pq.x * dx + pq.y * dy > 0) best = at + s.len * f1;
        }
      }
    }
    at += s.len;
  }
  return best;
}
// The loop's extent: { minX, maxX, minY, maxY }.
function loopExtent(loop) {
  var e = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  var take = function(p) { e.minX = Math.min(e.minX, p.x); e.maxX = Math.max(e.maxX, p.x); e.minY = Math.min(e.minY, p.y); e.maxY = Math.max(e.maxY, p.y); };
  loop.forEach(function(s) {
    take(segAt(s, 0)); take(segAt(s, 1));
    // An arc's extremes, where it passes the axes' directions.
    if (s.type === 'arc') for (var q = Math.ceil(s.a0 / (Math.PI / 2) - 1e-9); q * Math.PI / 2 <= s.a1 + 1e-9; q++) {
      var ang = q * Math.PI / 2;
      take({ x: s.cx + s.r * Math.cos(ang), y: s.cy + s.r * Math.sin(ang) });
    }
  });
  return e;
}
function arcSeg(cx, cy, r, a0, a1) { return { type: 'arc', cx: cx, cy: cy, r: r, a0: a0, a1: a1, len: r * (a1 - a0) }; }

// How far in the outline can go before nothing's left.
function shapeDeepest(shape) { return shape.kind === 'circle' ? shape.r : shape.kind === 'poly' ? shape.a : Math.min(shape.hx, shape.hy); }

// The signed distance from (x, y) to the outline moved t: < 0 inside.
function shapeDistance(shape, t, x, y) {
  if (shape.kind === 'circle') return Math.hypot(x, y) - (shape.r + t);
  if (shape.kind === 'poly') {
    // In the sector of the nearest side: its distance, or past its end, the corner's.
    var pr = Math.max(0, Math.min(shape.cr + t, shape.a + t)), ap = shape.a + t - pr, half = Math.PI / shape.n, w = 2 * half;
    var ph = Math.atan2(y, x) - (shape.rot + half);
    ph = ph - w * Math.round(ph / w);
    var rho = Math.hypot(x, y), lx = rho * Math.cos(ph), ly = Math.abs(rho * Math.sin(ph)), hh = Math.max(0, ap) * Math.tan(half);
    var dx = lx - ap, dy = ly - hh;
    return (dy > 0 ? Math.hypot(Math.max(dx, 0), dy) : dx) - pr;
  }
  var r = Math.max(0, shape.cr + t), qx = Math.abs(x) - (shape.hx + t - r), qy = Math.abs(y) - (shape.hy + t - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function loopLength(loop) { return loop.reduce(function(t, s) { return t + s.len; }, 0); }
function segAt(s, f) {
  if (s.type === 'line') return { x: s.x0 + (s.x1 - s.x0) * f, y: s.y0 + (s.y1 - s.y0) * f };
  var a = s.a0 + (s.a1 - s.a0) * f;
  return { x: s.cx + s.r * Math.cos(a), y: s.cy + s.r * Math.sin(a) };
}
// The part of a segment from f0 to f1 (fractions along it).
function segPart(s, f0, f1) {
  if (s.type === 'line') {
    var p = segAt(s, f0), q = segAt(s, f1);
    return { type: 'line', x0: p.x, y0: p.y, x1: q.x, y1: q.y, len: s.len * (f1 - f0) };
  }
  return arcSeg(s.cx, s.cy, s.r, s.a0 + (s.a1 - s.a0) * f0, s.a0 + (s.a1 - s.a0) * f1);
}
// The loop from s0 to s1 along it (0 <= s0 < s1 <= its length).
function loopPart(loop, s0, s1) {
  var out = [], at = 0;
  loop.forEach(function(s) {
    var a = Math.max(s0, at), b = Math.min(s1, at + s.len);
    if (b - a > 1e-9) out.push(segPart(s, (a - at) / s.len, (b - at) / s.len));
    at += s.len;
  });
  return out;
}
// The point s along the loop.
function loopPoint(loop, s) {
  var at = 0;
  for (var i = 0; i < loop.length; i++) {
    if (s <= at + loop[i].len + 1e-12) return segAt(loop[i], Math.max(0, (s - at) / loop[i].len));
    at += loop[i].len;
  }
  return segAt(loop[loop.length - 1], 1);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { shapeLoop: shapeLoop, shapeDeepest: shapeDeepest, shapeDistance: shapeDistance,
    loopLength: loopLength, loopPart: loopPart, loopPoint: loopPoint, loopAt: loopAt, loopExtent: loopExtent };
}
