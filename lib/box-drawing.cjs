/**
 * Carved Box: a box's outline from a drawing, an SVG file's text: every
 * closed shape in it (paths, rectangles, circles, ellipses, polygons) as
 * points, through the groups' transforms, curves as short lines; the
 * largest is the box's. mm, +Y to the back (an SVG's Y is down the page).
 */

// The file's outline: { pts: [x0, y0, x1, y1, ...] (mm, about the middle
// of its extent), size: { w, h } (mm), sized: false when the file gives
// no real size (its units taken as px, 96 to the inch), others (closed
// shapes left out), open (open ones left out) }, or { problem }.
function svgOutline(text) {
  var found;
  try { found = svgLoops(String(text || '')); } catch (err) { return { problem: 'Couldn\'t read that SVG file: ' + err.message }; }
  var loops = found.loops;
  if (!loops.length) return { problem: found.open ? 'The drawing has no closed shape: its outline must be closed (a path ending in Z, a rectangle, a circle, an ellipse or a polygon)' : 'No shapes found in that SVG file' };
  // The biggest by area: the box's outline.
  loops.sort(function(a, b) { return Math.abs(ringArea(b)) - Math.abs(ringArea(a)); });
  var ring = loops[0].map(function(p) { return { x: p.x * found.mm, y: -p.y * found.mm }; });
  var e = ringExtent(ring), size = Math.max(e.maxX - e.minX, e.maxY - e.minY);
  if (!(size > 1e-6)) return { problem: 'The drawing\'s outline has no size' };
  ring = simplify(ring, size * 2e-4);
  if (ring.length < 3) return { problem: 'The drawing\'s outline has no area' };
  var cx = (e.minX + e.maxX) / 2, cy = (e.minY + e.maxY) / 2, pts = [];
  ring.forEach(function(p) { pts.push(+(p.x - cx).toFixed(3), +(p.y - cy).toFixed(3)); });
  return { pts: pts, size: { w: e.maxX - e.minX, h: e.maxY - e.minY }, sized: found.sized, others: loops.length - 1, open: found.open };
}

// Every closed loop of points in the file (its user units), how many
// open ones there were, its mm per user unit and whether that's real.
function svgLoops(text) {
  text = text.replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[^>[]*(\[[\s\S]*?\])?\s*>/gi, '');
  var tagRe = /<(\/?)([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g, m;
  var stack = [], M = [1, 0, 0, 1, 0, 0], skip = 0, loops = [], open = 0, mm = 25.4 / 96, sized = false, root = true;
  // Not drawn: definitions, clipping, masks, and what's hidden.
  var HIDDEN = { defs: 1, clippath: 1, mask: 1, symbol: 1, marker: 1, pattern: 1, metadata: 1, title: 1, desc: 1, style: 1, script: 1, lineargradient: 1, radialgradient: 1, filter: 1, text: 1 };
  while ((m = tagRe.exec(text))) {
    var close = m[1] === '/', name = m[2].replace(/^.*:/, '').toLowerCase(), selfClose = m[4] === '/';
    if (close) {
      var top = stack.pop();
      if (top) { M = top.M; skip = top.skip; }
      continue;
    }
    var a = attrs(m[3]), hidden = HIDDEN[name] || a.display === 'none' || /display\s*:\s*none/.test(a.style || '');
    var here = skip ? M : multiply(M, transformOf(a.transform));
    if (name === 'svg' && root) {
      root = false;
      // Its size in mm over its viewBox's: mm per user unit.
      var vb = (a.viewBox || a.viewbox || '').split(/[\s,]+/).filter(Boolean).map(Number), w = lengthMm(a.width), h = lengthMm(a.height);
      if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
        if (w && w.real) { mm = w.mm / vb[2]; sized = true; }
        else if (h && h.real) { mm = h.mm / vb[3]; sized = true; }
        here = multiply(here, [1, 0, 0, 1, -vb[0], -vb[1]]);
      } else if (w && w.real) sized = true;
    }
    if (!selfClose) stack.push({ M: M, skip: skip });
    var nowSkip = skip || hidden;
    if (!nowSkip) {
      var shapes = shapeLoopsOf(name, a);
      shapes.forEach(function(sp) {
        if (!sp.closed) { open++; return; }
        var pts = sp.pts.map(function(p) { return apply(here, p); });
        if (pts.length >= 3) loops.push(pts);
      });
    }
    if (!selfClose) { M = here; skip = nowSkip ? 1 : 0; }
  }
  return { loops: loops, open: open, mm: mm, sized: sized };
}
function attrs(s) {
  var a = {}, re = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g, m;
  while ((m = re.exec(s))) a[m[1]] = m[3] !== undefined ? m[3] : m[4];
  return a;
}
// A length's mm: real when it has units (not px or none: 96 to the inch).
function lengthMm(s) {
  var m = /^\s*([-+]?[\d.]+(?:e[-+]?\d+)?)\s*([a-z%]*)\s*$/i.exec(s || '');
  if (!m) return null;
  var v = +m[1], u = m[2].toLowerCase(), per = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, px: 25.4 / 96, '': 25.4 / 96 }[u];
  if (per === undefined) return null;
  return { mm: v * per, real: u !== 'px' && u !== '' };
}
// [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f.
function multiply(A, B) {
  return [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
}
function apply(M, p) { return { x: M[0] * p.x + M[2] * p.y + M[4], y: M[1] * p.x + M[3] * p.y + M[5] }; }
function transformOf(s) {
  var M = [1, 0, 0, 1, 0, 0], re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g, m;
  while ((m = re.exec(s || ''))) {
    var v = numbers(m[2]), T;
    if (m[1] === 'matrix') T = v.length === 6 ? v : [1, 0, 0, 1, 0, 0];
    else if (m[1] === 'translate') T = [1, 0, 0, 1, v[0] || 0, v[1] || 0];
    else if (m[1] === 'scale') T = [v[0], 0, 0, v.length > 1 ? v[1] : v[0], 0, 0];
    else if (m[1] === 'rotate') {
      var r = (v[0] || 0) * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r), cx = v[1] || 0, cy = v[2] || 0;
      T = multiply(multiply([1, 0, 0, 1, cx, cy], [c, sn, -sn, c, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
    } else if (m[1] === 'skewX') T = [1, 0, Math.tan((v[0] || 0) * Math.PI / 180), 1, 0, 0];
    else T = [1, Math.tan((v[0] || 0) * Math.PI / 180), 0, 1, 0, 0];
    M = multiply(M, T);
  }
  return M;
}
function numbers(s) { return (String(s || '').match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || []).map(Number); }
function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : d; }

// A shape element's pieces: [{ pts, closed }], in its own units.
function shapeLoopsOf(name, a) {
  if (name === 'path') return pathLoops(a.d || '');
  if (name === 'polygon' || name === 'polyline') {
    var v = numbers(a.points), pts = [];
    for (var i = 0; i + 1 < v.length; i += 2) pts.push({ x: v[i], y: v[i + 1] });
    var shut = name === 'polygon' || (pts.length > 2 && same(pts[0], pts[pts.length - 1]));
    if (shut && pts.length > 1 && same(pts[0], pts[pts.length - 1])) pts.pop();
    return [{ pts: pts, closed: shut }];
  }
  if (name === 'circle') return [{ pts: ellipsePts(num(a.cx, 0), num(a.cy, 0), num(a.r, 0), num(a.r, 0)), closed: num(a.r, 0) > 0 }];
  if (name === 'ellipse') return [{ pts: ellipsePts(num(a.cx, 0), num(a.cy, 0), num(a.rx, 0), num(a.ry, 0)), closed: num(a.rx, 0) > 0 && num(a.ry, 0) > 0 }];
  if (name === 'rect') {
    var x = num(a.x, 0), y = num(a.y, 0), w = num(a.width, 0), h = num(a.height, 0);
    if (!(w > 0 && h > 0)) return [];
    var rx = a.rx !== undefined ? num(a.rx, 0) : num(a.ry, 0), ry = a.ry !== undefined ? num(a.ry, 0) : rx;
    rx = Math.min(Math.max(0, rx), w / 2); ry = Math.min(Math.max(0, ry), h / 2);
    if (!(rx > 0 && ry > 0)) return [{ pts: [{ x: x, y: y }, { x: x + w, y: y }, { x: x + w, y: y + h }, { x: x, y: y + h }], closed: true }];
    var d = 'M' + (x + rx) + ',' + y + 'H' + (x + w - rx) + 'A' + rx + ',' + ry + ' 0 0 1 ' + (x + w) + ',' + (y + ry) + 'V' + (y + h - ry) + 'A' + rx + ',' + ry + ' 0 0 1 ' + (x + w - rx) + ',' + (y + h) +
      'H' + (x + rx) + 'A' + rx + ',' + ry + ' 0 0 1 ' + x + ',' + (y + h - ry) + 'V' + (y + ry) + 'A' + rx + ',' + ry + ' 0 0 1 ' + (x + rx) + ',' + y + 'Z';
    return pathLoops(d);
  }
  if (name === 'line') return [{ pts: [], closed: false }];
  return [];
}
function ellipsePts(cx, cy, rx, ry) {
  var pts = [];
  for (var k = 0; k < 144; k++) { var t = 2 * Math.PI * k / 144; pts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) }); }
  return pts;
}
function same(p, q) { return Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9; }

// A path's subpaths as points, curves in short lines.
var CURVE = 32;
function pathLoops(d) {
  var tok = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
  var out = [], cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = '', i = 0, lastC = null, lastQ = null;
  var isCmd = function(t) { return /^[A-Za-z]$/.test(t); };
  var next = function() { if (i >= tok.length || isCmd(tok[i])) throw new Error('a path is missing a number'); return +tok[i++]; };
  // A flag: 0 or 1, maybe run together with what follows ("a1 1 0 01.5 2").
  var flag = function() {
    if (i >= tok.length) throw new Error('a path is missing an arc flag');
    var t = tok[i];
    if (t === '0' || t === '1') { i++; return +t; }
    if (/^[01]/.test(t)) { tok[i] = t.slice(1); return +t[0]; }
    throw new Error('a path has a bad arc flag');
  };
  var start = function() { if (cur && cur.pts.length > 1) out.push(cur); cur = { pts: [{ x: x, y: y }], closed: false }; };
  var to = function(px, py) { if (!cur) start(); cur.pts.push({ x: px, y: py }); x = px; y = py; };
  while (i < tok.length) {
    if (isCmd(tok[i])) cmd = tok[i++];
    else if (!cmd) throw new Error('a path starts without a command');
    var rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0, c1, c2, k;
    if (C === 'M') {
      x = next() + ox; y = next() + oy; sx = x; sy = y; start();
      cmd = rel ? 'l' : 'L';
    } else if (C === 'L') to(next() + ox, next() + oy);
    else if (C === 'H') to(next() + ox, y);
    else if (C === 'V') to(x, next() + oy);
    else if (C === 'C' || C === 'S') {
      if (C === 'C') c1 = { x: next() + ox, y: next() + oy };
      else c1 = lastC ? { x: 2 * x - lastC.x, y: 2 * y - lastC.y } : { x: x, y: y };
      c2 = { x: next() + ox, y: next() + oy };
      var e = { x: next() + ox, y: next() + oy }, p0 = { x: x, y: y };
      for (k = 1; k <= CURVE; k++) { var t = k / CURVE, u = 1 - t; to(u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * e.x, u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * e.y); }
      lastC = c2; lastQ = null;
      continue;
    } else if (C === 'Q' || C === 'T') {
      if (C === 'Q') c1 = { x: next() + ox, y: next() + oy };
      else c1 = lastQ ? { x: 2 * x - lastQ.x, y: 2 * y - lastQ.y } : { x: x, y: y };
      var q = { x: next() + ox, y: next() + oy }, q0 = { x: x, y: y };
      for (k = 1; k <= CURVE; k++) { var tq = k / CURVE, uq = 1 - tq; to(uq * uq * q0.x + 2 * uq * tq * c1.x + tq * tq * q.x, uq * uq * q0.y + 2 * uq * tq * c1.y + tq * tq * q.y); }
      lastQ = c1; lastC = null;
      continue;
    } else if (C === 'A') {
      var rx = Math.abs(next()), ry = Math.abs(next()), rot = next(), large = flag(), sweepF = flag(), ex = next() + ox, ey = next() + oy;
      arcPts(x, y, rx, ry, rot, large, sweepF, ex, ey).forEach(function(p) { to(p.x, p.y); });
      x = ex; y = ey;
    } else if (C === 'Z') {
      if (cur) {
        if (cur.pts.length > 1 && same(cur.pts[cur.pts.length - 1], cur.pts[0])) cur.pts.pop();
        cur.closed = true;
        if (cur.pts.length > 2) out.push(cur);
        cur = null;
      }
      x = sx; y = sy;
    } else throw new Error('a path has an unknown command ' + cmd);
    lastC = lastQ = null;
  }
  if (cur && cur.pts.length > 1) {
    // Open, unless it ends where it began.
    if (same(cur.pts[cur.pts.length - 1], cur.pts[0]) || Math.hypot(cur.pts[cur.pts.length - 1].x - cur.pts[0].x, cur.pts[cur.pts.length - 1].y - cur.pts[0].y) < 1e-6) { cur.pts.pop(); cur.closed = true; }
    out.push(cur);
  }
  return out;
}
// An SVG arc from (x0, y0) to (x1, y1) as points after the first (the
// spec's endpoint to center conversion).
function arcPts(x0, y0, rx, ry, rotDeg, large, sweepF, x1, y1) {
  if (!(rx > 0 && ry > 0) || (x0 === x1 && y0 === y1)) return [{ x: x1, y: y1 }];
  var phi = rotDeg * Math.PI / 180, cp = Math.cos(phi), sp = Math.sin(phi);
  var dx = (x0 - x1) / 2, dy = (y0 - y1) / 2, x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  var lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  var num_ = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  var co = Math.sqrt(Math.max(0, num_ / den)) * (large === sweepF ? -1 : 1);
  var cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
  var cx = cp * cxp - sp * cyp + (x0 + x1) / 2, cy = sp * cxp + cp * cyp + (y0 + y1) / 2;
  var ang = function(ux, uy, vx, vy) { return Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); };
  var t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry), dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweepF && dt > 0) dt -= 2 * Math.PI; else if (sweepF && dt < 0) dt += 2 * Math.PI;
  var n = Math.max(4, Math.ceil(Math.abs(dt) / (2 * Math.PI) * 144)), pts = [];
  for (var k = 1; k <= n; k++) {
    var t = t1 + dt * k / n, ex = rx * Math.cos(t), ey = ry * Math.sin(t);
    pts.push(k === n ? { x: x1, y: y1 } : { x: cp * ex - sp * ey + cx, y: sp * ex + cp * ey + cy });
  }
  return pts;
}

function ringArea(r) { var a = 0; for (var i = 0; i < r.length; i++) { var p = r[i], q = r[(i + 1) % r.length]; a += p.x * q.y - q.x * p.y; } return a / 2; }
function ringExtent(r) {
  var e = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  r.forEach(function(p) { e.minX = Math.min(e.minX, p.x); e.maxX = Math.max(e.maxX, p.x); e.minY = Math.min(e.minY, p.y); e.maxY = Math.max(e.maxY, p.y); });
  return e;
}
// The ring with points that bend it less than tol left out (Douglas-Peucker,
// from its two furthest-apart points), and repeats.
function simplify(ring, tol) {
  ring = ring.filter(function(p, i) { return !same(p, ring[(i + 1) % ring.length]); });
  if (ring.length < 4) return ring;
  var far = 0, best = 0;
  for (var i = 1; i < ring.length; i++) { var dd = Math.hypot(ring[i].x - ring[0].x, ring[i].y - ring[0].y); if (dd > best) { best = dd; far = i; } }
  var keep = new Array(ring.length).fill(false);
  keep[0] = keep[far] = true;
  // A stack, not recursion: a long outline's halves can be deep.
  var todo = [[0, far], [far, ring.length]];
  while (todo.length) {
    var ab = todo.pop(), a = ab[0], b = ab[1], p = ring[a], q = ring[b % ring.length], dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1e-12, worst = 0, at = -1;
    for (var k = a + 1; k < b; k++) { var r = ring[k], e = Math.abs((r.x - p.x) * dy - (r.y - p.y) * dx) / l; if (e > worst) { worst = e; at = k; } }
    if (worst > tol) { keep[at] = true; todo.push([a, at], [at, b]); }
  }
  return ring.filter(function(p, i) { return keep[i]; });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { svgOutline: svgOutline };
}
