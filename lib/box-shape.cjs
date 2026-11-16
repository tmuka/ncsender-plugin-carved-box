/**
 * Carved Box: the box's outline (a circle, or a rectangle with rounded
 * corners) moved in or out, as a closed loop of lines and CCW arcs about
 * the middle: { type: 'line', x0, y0, x1, y1, len } and { type: 'arc',
 * cx, cy, r, a0, a1, len } (a1 > a0). Every loop starts on +X, at the
 * middle of the right side, so loops of one shape line up there.
 *
 * shape: { kind: 'circle', r } or { kind: 'rect', hx, hy, cr } (half the
 * length along X and the width along Y, the corner radius). mm.
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
function arcSeg(cx, cy, r, a0, a1) { return { type: 'arc', cx: cx, cy: cy, r: r, a0: a0, a1: a1, len: r * (a1 - a0) }; }

// How far in the outline can go before nothing's left.
function shapeDeepest(shape) { return shape.kind === 'circle' ? shape.r : Math.min(shape.hx, shape.hy); }

// The signed distance from (x, y) to the outline moved t: < 0 inside.
function shapeDistance(shape, t, x, y) {
  if (shape.kind === 'circle') return Math.hypot(x, y) - (shape.r + t);
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
    loopLength: loopLength, loopPart: loopPart, loopPoint: loopPoint };
}
