// The box's program, run through a small G-code simulator: where the
// bit's center goes, at what depth, against what must be left standing.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { boxPlan, testFitInput, autoSizes, BOX_DEFAULTS } = require('../lib/box-plan.cjs');
const { boxProgram, MAX_LINES } = require('../lib/box-gcode.cjs');
const { shapeDistance, shapeLoop, loopLength, loopPoint } = require('../lib/box-shape.cjs');

const FEEDS = { feed: 1500, plunge: 400, rpm: 18000, delay: 2, doc: 2, stepoverPct: 40, toolNumber: 0 };

const SAFE = 1000;
// The bit center's path, sampled every half mm or so: { x, y, z, rapid }
// (rapid: a G0 that moves sideways or goes down; a G0 straight up is a lift).
function simulate(gcode) {
  const pts = [];
  let x = 0, y = 0, z = 5;
  for (const raw of gcode.split('\n')) {
    const line = raw.split(';')[0].trim();
    if (!line || line[0] === '(') continue;
    // Up to the machine's safe height: far over the stock.
    if (/G53/.test(line)) { if (/Z/.test(line)) z = SAFE; continue; }
    const w = {};
    for (const m of line.matchAll(/([A-Z])(-?[\d.]+)/g)) w[m[1]] = +m[2];
    const g = w.G;
    const nx = w.X ?? x, ny = w.Y ?? y, nz = w.Z ?? z;
    if (g === 0 || g === 1) {
      const n = Math.max(1, Math.ceil(Math.hypot(nx - x, ny - y, nz - z) / 0.5));
      const rapid = g === 0 && (nx !== x || ny !== y || nz < z), sideways = g === 0 && (nx !== x || ny !== y);
      for (let k = 1; k <= n; k++) pts.push({ x: x + (nx - x) * k / n, y: y + (ny - y) * k / n, z: z + (nz - z) * k / n, rapid, sideways, g });
    } else if (g === 2 || g === 3) {
      const cx = x + w.I, cy = y + w.J, r = Math.hypot(x - cx, y - cy);
      let a0 = Math.atan2(y - cy, x - cx), a1 = Math.atan2(ny - cy, nx - cx);
      if (g === 3 && a1 <= a0 + 1e-9) a1 += 2 * Math.PI;
      if (g === 2 && a1 >= a0 - 1e-9) a1 -= 2 * Math.PI;
      const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / 0.5));
      for (let k = 1; k <= n; k++) {
        const a = a0 + (a1 - a0) * k / n;
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), z: z + (nz - z) * k / n, rapid: false, g });
      }
    }
    x = nx; y = ny; z = nz;
  }
  return pts;
}

// Is the bit's center at p allowed, near this half? (What must be left:
// the wall, the lip, the floor or top, the tabs, round magnet holes and
// the notch.) Distances: to the box's outline moved t, < 0 inside.
function allowed(plan, half, p) {
  const o = plan.o, rb = o.bit / 2, S = plan.shape;
  // eps: the program's coordinates are to 0.001 mm, arc centers too.
  const eps = 0.005;
  const top = half.name === 'lid' ? -plan.face : 0, d = top - p.z;
  const px = p.x - half.at.x, py = p.y - half.at.y;
  const at = (t) => shapeDistance(S, t, px, py);
  if (-p.z <= eps) return true;
  // A lid lower than the stock: its area faced down first.
  const facing = half.cuts.find((c) => /faced down/.test(c.what));
  if (facing && -p.z <= plan.face + eps && at(facing.t - rb) <= eps) return true;
  if (at(rb) >= -eps) return d <= half.outline.depth + eps;
  const withLip = (o.lipOn === 'lid') === (half.name === 'lid');
  const floor = half.height - (half.name === 'lid' ? o.top : o.floor), meet = withLip ? o.lipHeight : 0;
  // Rounded floor corners: the box's bit stays the radius off the wall
  // for that last bit of the pocket (the corner bit's to cut).
  const rc = o.corners ? o.corners.radius : 0;
  if (at(plan.tInside - rb) <= eps && d <= floor + eps && (d <= floor - rc + eps || at(plan.tInside - rc - rb) <= eps)) return true;
  if (withLip && at(plan.tLip + rb) >= -eps && d <= o.lipHeight + eps) return true;
  if (!withLip && at(plan.tRabbet - rb) <= eps && d <= plan.rabbetDepth + eps) return true;
  for (const m of plan.magnetAt) {
    if (Math.hypot(px - m.dx, py - m.dy) <= o.magnets.diameter / 2 - rb + eps && d <= meet + o.magnets.depth + eps) return true;
  }
  if (half.name === 'base' && plan.notch) {
    if (Math.hypot(px - plan.notch.dx, py - plan.notch.dy) <= plan.notch.shape.r - rb + eps && d <= meet + o.notch.depth + eps) return true;
  }
  return false;
}

function check(input, extra) {
  const plan = boxPlan(input);
  assert.deepEqual(plan.problems, [], JSON.stringify(input));
  const { gcode } = boxProgram(plan, Object.assign({}, FEEDS, extra || {}));
  for (const l of gcode.split('\n')) {
    assert.ok(l.length <= 79, l);
    assert.doesNotMatch(l, /[!?~]/, l);
    assert.match(l, /^[\x20-\x7e]*$/, l);
  }
  const pts = simulate(gcode);
  for (const p of pts) {
    assert.ok(!(p.rapid && p.z < -1e-6), 'a rapid below the stock top');
    if (p.rapid && p.z < SAFE) assert.ok(!p.sideways, 'a move sideways under safe height: ' + JSON.stringify(p));
    const half = plan.halves.reduce((a, b) => Math.hypot(p.x - a.at.x, p.y - a.at.y) <= Math.hypot(p.x - b.at.x, p.y - b.at.y) ? a : b);
    assert.ok(allowed(plan, half, p), half.name + ' cut where wood stays: ' + JSON.stringify(p));
  }
  return { plan, pts, gcode };
}

test('the default box is cut without touching what stays', () => { check({}); });

test('lip on either half, along X or Y, origin at the corner or the middle', () => {
  for (const lipOn of ['base', 'lid']) for (const layout of ['x', 'y']) for (const origin of ['front-left', 'center']) {
    check({ lipOn, layout, origin, diameter: 60, stock: 15, wall: 5, lipWidth: 2.5, lipHeight: 3, bit: 3.175 });
  }
  check({ diameter: 120, stock: 25, wall: 8, lipWidth: 4, bit: 6.35, gap: 20, tabs: null });
});

test('rectangles: long either way, square, a slot-like inside, rounded right out', () => {
  for (const lipOn of ['base', 'lid']) for (const layout of ['x', 'y']) {
    check({ shape: 'rect', lipOn, layout, length: 140, width: 70, cornerRadius: 8 });
    check({ shape: 'rect', lipOn, layout, length: 50, width: 110, cornerRadius: 12, origin: 'center' });
  }
  check({ shape: 'rect', length: 70, width: 70, cornerRadius: 6 });
  check({ shape: 'rect', length: 100, width: 20, cornerRadius: 6, wall: 6, lipWidth: 2, gap: 12 });
  check({ shape: 'rect', length: 80, width: 50, cornerRadius: 25 });
  check({ shape: 'rect', length: 120, width: 80, cornerRadius: 10, bit: 6.35, wall: 9, lipWidth: 3, gap: 20, tabs: null });
});

test('every floor is cleared all over, at any stepover', () => {
  for (const [input, stepoverPct] of [[{}, 40], [{ shape: 'rect', length: 110, width: 70, cornerRadius: 8 }, 40], [{ shape: 'rect', length: 60, width: 60, cornerRadius: 30 }, 40],
    [{}, 75], [{}, 90], [{ shape: 'rect', length: 60, width: 60, cornerRadius: 10 }, 90], [{ diameter: 50 }, 60]]) {
    const { plan, pts } = check(input, { stepoverPct });
    const rb = plan.o.bit / 2, S = plan.shape;
    for (const half of plan.halves) {
      const floor = (half.name === 'lid' ? plan.face : 0) + half.height - (half.name === 'lid' ? plan.o.top : plan.o.floor);
      const deep = pts.filter((p) => Math.abs(p.z + floor) < 1e-6 && shapeDistance(S, plan.tInside, p.x - half.at.x, p.y - half.at.y) < 0);
      for (let qx = -plan.halfX; qx <= plan.halfX; qx += 1) for (let qy = -plan.halfY; qy <= plan.halfY; qy += 1) {
        if (shapeDistance(S, plan.tInside, qx, qy) > -0.2) continue;
        const near = Math.min(...deep.map((p) => Math.hypot(p.x - half.at.x - qx, p.y - half.at.y - qy)));
        assert.ok(near <= rb + 0.3, half.name + ' floor left at ' + qx + ',' + qy + ' ' + JSON.stringify(input));
      }
    }
  }
});

test('the tabs stay standing, and the outline goes through', () => {
  for (const input of [{}, { shape: 'rect', length: 120, width: 60, cornerRadius: 6, tabs: { count: 6, width: 6, height: 1.5 } },
    { diameter: 150, tabs: { count: 8, width: 6, height: 1.5 } }, { diameter: 150, tabs: { count: 12, width: 6, height: 0.5 } }]) {
    const { plan, pts } = check(input);
    const o = plan.o, rb = o.bit / 2, loop = shapeLoop(plan.shape, rb), len = loopLength(loop);
    for (const half of plan.halves) {
      // Height from the half's bottom.
      const tabTop = half.outline.z0 - half.height + o.tabs.height;
      const ring = pts.filter((p) => Math.abs(shapeDistance(plan.shape, rb, p.x - half.at.x, p.y - half.at.y)) < 1e-3);
      assert.ok(ring.some((p) => Math.abs(p.z - (half.outline.z0 - half.outline.depth)) < 1e-6), half.name + ' cut through');
      for (let k = 0; k < o.tabs.count; k++) {
        const c = loopPoint(loop, len * (k + 0.5) / o.tabs.count);
        const inTab = ring.filter((p) => Math.hypot(p.x - half.at.x - c.x, p.y - half.at.y - c.y) < o.tabs.width / 2 - 0.05);
        assert.ok(inTab.length > 0 && inTab.every((p) => p.z >= tabTop - 1e-6), half.name + ' tab ' + k + ' cut away');
      }
    }
  }
});

test('numbers that make no box say why', () => {
  const said = (o, re) => assert.ok(boxPlan(o).problems.some((p) => re.test(p)), JSON.stringify(o) + ' ' + boxPlan(o).problems);
  said({ wall: 45 }, /inside must be wider than the bit/);
  said({ wall: 3, lipWidth: 2.5 }, /Wall must be at least 1 mm more/);
  said({ floor: 19 }, /Floor must be between/);
  said({ lipHeight: 16 }, /Lip Height must be less/);
  said({ gap: 3 }, /Gap must be at least/);
  said({ tabs: { count: 30, width: 10, height: 2 } }, /Too many or too wide tabs/);
  assert.equal(BOX_DEFAULTS.lipOn, 'base');
});

test('a lid lower than the stock, magnets and a finger notch', () => {
  for (const lipOn of ['base', 'lid']) for (const layout of ['x', 'y']) {
    const input = { lipOn, layout, diameter: 90, stock: 19, lidHeight: 12, wall: 12, lipWidth: 3,
      magnets: { count: 4, diameter: 6.35, depth: 3.2 }, notch: { width: 12, depth: 4 } };
    for (const shape of [{}, { shape: 'rect', length: 130, width: 90, cornerRadius: 16 }]) {
    const { plan, pts } = check(Object.assign({}, input, shape, shape.shape ? { magnets: { count: 4, diameter: 6.35, depth: 3.2 } } : {}));
    assert.equal(plan.closedHeight, 19 + 12 - 4);
    // Each magnet hole goes its full depth in both halves.
    for (const half of plan.halves) {
      const meet = (plan.o.lipOn === 'lid') === (half.name === 'lid') ? plan.o.lipHeight : 0;
      const bottom = (half.name === 'lid' ? -plan.face : 0) - meet - 3.2;
      for (const m of plan.magnetAt) {
        assert.ok(pts.some((p) => Math.abs(p.z - bottom) < 1e-6 && Math.hypot(p.x - half.at.x - m.dx, p.y - half.at.y - m.dy) < plan.o.magnets.diameter / 2), half.name + ' magnet hole too shallow');
      }
    }
    // Turned over onto the base (mirrored across the line between them),
    // the lid's magnets land on the base's.
    const flip = layout === 'y' ? (m) => ({ dx: m.dx, dy: -m.dy }) : (m) => ({ dx: -m.dx, dy: m.dy });
    for (const m of plan.magnetAt.map(flip)) assert.ok(plan.magnetAt.some((b) => Math.hypot(b.dx - m.dx, b.dy - m.dy) < 1e-6), 'magnets don\'t meet');
    }
  }
});

test('the test fit: a small box with the same fit', () => {
  const plan = boxPlan(testFitInput({}));
  assert.deepEqual(plan.problems, []);
  assert.ok(plan.o.diameter < 50);
  assert.ok(plan.rabbetDepth < plan.o.stock - plan.o.top);
  const { gcode } = check(testFitInput({ lipOn: 'lid', bit: 6.35, gap: 20 }), { label: 'Test fit' });
  assert.match(gcode, /^\(Test fit: a base and a lid/m);
});

test('magnets and a notch that don\'t fit say why', () => {
  const said = (o, re) => assert.ok(boxPlan(o).problems.some((p) => re.test(p)), JSON.stringify(o) + ' ' + boxPlan(o).problems);
  said({ magnets: { count: 4, diameter: 8, depth: 3 } }, /Magnet holes too wide/);
  said({ wall: 14, magnets: { count: 4, diameter: 3, depth: 3 } }, /wider than the bit/);
  said({ notch: { width: 30, depth: 3 } }, /Finger notch too wide/);
  said({ lidHeight: 25 }, /Lid Height can't be more/);
  said({ lidHeight: 6, top: 6 }, /Top must be between/);
  said({ shape: 'rect', cornerRadius: 2 }, /Corner Radius must be at least/);
  said({ shape: 'rect', magnets: { count: 3, diameter: 6, depth: 3 }, wall: 12 }, /even number of magnets/);
  said({ shape: 'rect', width: 0 }, /Length and Width/);
  said({ wall: 12, magnets: { count: 12, diameter: 6.35, depth: 3 }, notch: { width: 16, depth: 3 } }, /runs into a magnet hole/);
});

// The edge bit's path: on each edge's loop, never deeper than the edge,
// rapids above the stock.
function checkEdges(plan, gcode) {
  for (const l of gcode.split('\n')) {
    assert.ok(l.length <= 79, l);
    assert.doesNotMatch(l, /[!?~]/, l);
  }
  const pts = simulate(gcode).filter((p) => p.z < 0);
  const all = plan.halves.flatMap((h) => plan.edges[h.name].map((e) => ({ h, e })));
  for (const p of pts) {
    assert.ok(!p.rapid, 'a rapid below the stock top');
    const on = all.filter(({ h, e }) => Math.abs(shapeDistance(e.shape, e.t, p.x - h.at.x, p.y - h.at.y)) < 0.005 && p.z >= e.z0 - e.depth - 1e-6);
    // Above an edge's top, going down to it in the air.
    const above = all.some(({ h, e }) => Math.abs(shapeDistance(e.shape, e.t, p.x - h.at.x, p.y - h.at.y)) < 0.005 && p.z >= e.z0 - 1e-6);
    assert.ok(on.length || above, 'edge bit off its edges: ' + JSON.stringify(p));
    // Below an edge's top, the bit's bottom stays on the air side: a
    // V-bit's point on the edge, a roundover bit's flat end beside it.
    const ed = plan.o.edges, half = ((ed.bit === 'round' ? ed.tip : ed.vtip) || 0) / 2;
    for (const { h, e } of on) {
      if (p.z >= e.z0 - 1e-6) continue;
      const out = e.u * shapeDistance(e.shape, e.at, p.x - h.at.x, p.y - h.at.y);
      assert.ok(Math.abs(out - half) < 0.01, h.name + ' ' + e.what + ': bit ' + out.toFixed(3) + ' off the edge, not ' + half);
    }
  }
  for (const { h, e } of all) {
    assert.ok(pts.some((p) => Math.abs(p.z - (e.z0 - e.depth)) < 1e-6 && Math.abs(shapeDistance(e.shape, e.t, p.x - h.at.x, p.y - h.at.y)) < 0.005), h.name + ' ' + e.what + ' not cut');
  }
}

test('chamfered and rounded edges, cut last after a tool change, or on their own', () => {
  const EF = { toolNumber: 7, feed: 1200, plunge: 300, rpm: 16000, delay: 2, doc: 2 };
  for (const lipOn of ['base', 'lid']) for (const shape of [{}, { shape: 'rect', length: 120, width: 80, cornerRadius: 12 }]) {
    for (const edges of [{ bit: 'v', angle: 90, diameter: 12.7, outside: 1.5, inside: 0.8 }, { bit: 'round', radius: 3.175, tip: 3, outside: 3, inside: 1 }, { bit: 'v', angle: 60, diameter: 6.35, outside: 2, inside: 0 }]) {
      const input = Object.assign({ lipOn, wall: 10, lidHeight: 15, edges }, shape);
      const plan = boxPlan(input);
      assert.deepEqual(plan.problems, [], JSON.stringify(input));
      const all = boxProgram(plan, Object.assign({}, FEEDS, { edges: EF })).gcode;
      const at = all.indexOf('M6 T7');
      assert.ok(at > 0 && /M3 S16000/.test(all.slice(at)), 'no change to the edge bit');
      // The box part is as without edges; the edges part keeps to its edges.
      assert.equal(all.slice(0, all.indexOf('(Edges')), boxProgram(plan, FEEDS).gcode.slice(0, all.indexOf('(Edges')));
      checkEdges(plan, all.slice(at));
      const own = boxProgram(plan, Object.assign({}, FEEDS, { edges: EF }), 'edges').gcode;
      assert.match(own, /^M6 T7/m);
      assert.doesNotMatch(boxProgram(plan, Object.assign({}, FEEDS, { edges: { ...EF, toolNumber: 0 } }), 'edges').gcode, /M6/);
      assert.match(own, /M3 S16000/);
      checkEdges(plan, own);
      assert.doesNotMatch(boxProgram(plan, FEEDS).gcode, /edge bit|M6 T7/);
      // The waste round a seam below the stock top is cleared as far as
      // the edge bit reaches (the simulator holds the box part to it).
      for (const h of plan.halves) {
        const seam = plan.edges[h.name].find((e) => e.what === 'outside seam edge');
        const clearing = h.cuts.find((c) => /shoulder|faced/.test(c.what));
        if (seam && seam.z0 < 0) {
          const reach = edges.bit === 'round' ? edges.tip + edges.radius : Math.min((seam.depth - seam.z0) * Math.tan(edges.angle * Math.PI / 360), edges.diameter / 2);
          assert.ok((clearing.tOut ?? clearing.t) >= reach + 1 - 1e-9, h.name + ' waste not cleared for the seam');
        }
      }
    }
  }
});

test('pocket edges: the lip\'s inner edge and the step\'s, on either half', () => {
  for (const lipOn of ['base', 'lid']) for (const shape of [{}, { shape: 'rect', length: 130, width: 90, cornerRadius: 14 }]) {
    for (const edges of [{ bit: 'v', angle: 60, diameter: 6.35, outside: 0, inside: 0.5, pocket: 0.8 }, { bit: 'round', radius: 1.5, tip: 3, outside: 0, inside: 0, pocket: 1 }]) {
      const input = Object.assign({ lipOn, wall: 12, lipWidth: 5, lidHeight: 15, edges }, shape);
      const plan = boxPlan(input);
      assert.deepEqual(plan.problems, [], JSON.stringify(input));
      const step = plan.edges[lipOn === 'lid' ? 'base' : 'lid'].find((e) => /step/.test(e.what));
      assert.ok(step && Math.abs(step.z0 - ((lipOn === 'lid' ? 0 : -plan.face) - plan.rabbetDepth)) < 1e-9, 'step edge at the step');
      checkEdges(plan, boxProgram(plan, Object.assign({}, FEEDS, { edges: { toolNumber: 3, feed: 1000, plunge: 300, rpm: 16000, doc: 2 } }), 'edges').gcode);
    }
  }
});

test('edges that don\'t fit say why', () => {
  const said = (o, re) => assert.ok(boxPlan(o).problems.some((p) => re.test(p)), JSON.stringify(o) + ' ' + boxPlan(o).problems);
  const V = { bit: 'v', angle: 90, diameter: 12.7 };
  said({ edges: { ...V, outside: 3, inside: 0 } }, /rim round the widened opening/);
  said({ wall: 10, edges: { ...V, outside: 0, inside: 1.5, pocket: 1.5 } }, /Lead-In and Pocket Edge too big for the lip/);
  // The step's inner edge is down at the step: its bit must clear the opening's wall above.
  said({ wall: 10, edges: { ...V, outside: 0, inside: 0, pocket: 0.5 } }, /cut into the widened opening's wall/);
  said({ edges: { bit: 'round', radius: 2, tip: 3, outside: 3, inside: 0 } }, /deeper than the bit's radius/);
  said({ edges: { ...V, angle: 10, outside: 1, inside: 0 } }, /angle must be between/);
  said({ wall: 10, lipHeight: 2, edges: { bit: 'v', angle: 60, diameter: 12.7, outside: 0, inside: 1.9 } }, /Lead-In edges must be less deep/);
  // On the half with the lip, the seam's bit, as high as the lip, mustn't reach it.
  said({ edges: { ...V, outside: 1.5, inside: 0.5 } }, /would cut into the lip/);
  said({ edges: { bit: 'round', radius: 3.175, tip: 3.175, outside: 1.5, inside: 0 } }, /would cut into the lip/);
  said({ wall: 10, edges: { ...V, diameter: 2, outside: 1.5, inside: 0 } }, /V-bit is too small/);
  said({ wall: 10, notch: { width: 12, depth: 2 }, edges: { ...V, outside: 2.5, inside: 0 } }, /less deep than the finger notch/);
  said({ wall: 12, magnets: { count: 4, diameter: 6.35, depth: 3 }, edges: { ...V, outside: 2, inside: 0 } }, /beside the magnet holes/);
  assert.deepEqual(boxPlan({ edges: { ...V, outside: 0, inside: 0 } }).problems, []);
});

test('a bit or a depth of cut far too small: said, not a program too big to load', () => {
  assert.ok(boxPlan({ bit: 0.25 }).problems.some((p) => /at least 0.8 mm/.test(p)));
  const plan = boxPlan({ bit: 0.8, diameter: 150 });
  assert.deepEqual(plan.problems, []);
  assert.throws(() => boxProgram(plan, Object.assign({}, FEEDS, { doc: 0.05, stepoverPct: 10 })), /over 300,000 lines/);
  assert.ok(boxProgram(boxPlan({}), FEEDS).gcode.split('\n').length < MAX_LINES / 20);
});

test('Auto Sizes: a box that fits together for any size, stock, bit and material', () => {
  const OPTS = { plain: {}, magnets: { magnets: { count: 4, diameter: 8, depth: 3.2 } }, notch: { notch: { width: 16, depth: 4 } },
    v: { edges: { bit: 'v', angle: 90, diameter: 12.7 } }, round: { edges: { bit: 'round', radius: 3.175, tip: 3.175 } },
    all: { magnets: { count: 4, diameter: 8, depth: 3.2 }, notch: { width: 16, depth: 4 }, edges: { bit: 'v', angle: 60, diameter: 12.7 } } };
  for (const shape of ['circle', 'rect']) for (const size of [40, 80, 200]) for (const stock of [12, 19, 38]) for (const bit of [3.175, 6.35])
    for (const material of ['mdf', 'hardwood', 'acrylic']) for (const opts of Object.values(OPTS)) for (const imperial of [false, true]) {
      const input = Object.assign({ shape, diameter: size, length: size * 1.5, width: size, cornerRadius: 3, stock, bit }, opts);
      const a = autoSizes(input, material, imperial);
      // On an inch machine, the wall on a 1/32" grid.
      if (imperial) assert.ok(Math.abs(a.wall * 32 / 25.4 - Math.round(a.wall * 32 / 25.4)) < 1e-9, 'wall ' + a.wall);
      if (size >= 80) assert.deepEqual(a.problems, [], JSON.stringify(input));
      if (opts.edges && size >= 80) assert.ok(a.edges.outside > 0 && a.edges.inside > 0, 'edges left out: ' + JSON.stringify(input));
    }
  // A few cut through the simulator.
  for (const input of [{ diameter: 80, stock: 19, bit: 3.175 }, { shape: 'rect', length: 150, width: 90, cornerRadius: 2, stock: 25, bit: 6.35, notch: { width: 16, depth: 4 } }]) {
    const a = autoSizes(input, 'softwood');
    delete a.problems;
    check(Object.assign({}, input, a));
  }
  assert.equal(autoSizes({}, 'acrylic').clearance, 0.1);
});

test('rounded floor corners: a ball or bowl bit after the box, or on its own', () => {
  const CF = { toolNumber: 8, feed: 1200, plunge: 300, rpm: 16000, doc: 1.5 }, EF = { toolNumber: 7, feed: 1200, plunge: 300, rpm: 16000, doc: 2 };
  for (const lipOn of ['base', 'lid']) for (const shape of [{}, { shape: 'rect', length: 130, width: 90, cornerRadius: 12 }]) {
    for (const corners of [{ diameter: 6.35, radius: 3.175 }, { diameter: 12.7, radius: 3.175 }]) {
      const input = Object.assign({ lipOn, wall: 10, lidHeight: 15, corners, edges: { bit: 'v', angle: 90, diameter: 12.7, outside: 1, inside: 0.5, pocket: 0 } }, shape);
      const { plan, gcode: box } = check(input);
      // The box's own bit leaves the coves (check holds it), the corner bit cuts them.
      const all = boxProgram(plan, Object.assign({}, FEEDS, { corners: CF, edges: EF })).gcode;
      const c = all.indexOf('M6 T8'), e = all.indexOf('M6 T7');
      assert.ok(c > 0 && e > c, 'corner bit, then edge bit');
      assert.equal(all.slice(0, all.indexOf('(Floor corners')), box.slice(0, box.indexOf('(Floor corners')));
      for (const g of [all.slice(c, e), boxProgram(plan, Object.assign({}, FEEDS, { corners: CF }), 'corners').gcode]) {
        const pts = simulate(g).filter((p) => p.z < 0);
        for (const p of pts) {
          assert.ok(!p.rapid, 'rapid below the top');
          const ok = plan.halves.some((h) => plan.corners[h.name].some((k) => Math.abs(shapeDistance(k.shape, k.t, p.x - h.at.x, p.y - h.at.y)) < 0.005 && p.z >= k.z0 - k.depth - 1e-6));
          assert.ok(ok, 'corner bit off its loop or below the floor: ' + JSON.stringify(p));
        }
        for (const h of plan.halves) for (const k of plan.corners[h.name]) {
          assert.ok(pts.some((p) => Math.abs(p.z - (k.z0 - k.depth)) < 1e-6 && Math.abs(shapeDistance(k.shape, k.t, p.x - h.at.x, p.y - h.at.y)) < 0.005), h.name + ' corners not down to the floor');
          // Its side on the wall, its end on the floor.
          assert.ok(Math.abs(k.t + corners.diameter / 2 - plan.tInside) < 1e-9);
        }
      }
      assert.match(boxProgram(plan, Object.assign({}, FEEDS, { corners: CF }), 'corners').gcode, /^M6 T8/m);
    }
  }
  const said = (o, re) => assert.ok(boxPlan(o).problems.some((p) => re.test(p)), JSON.stringify(o) + ' ' + boxPlan(o).problems);
  said({ corners: { diameter: 6, radius: 4 } }, /half the diameter for a ball/);
  said({ corners: { diameter: 80, radius: 3 } }, /inside is too small for the corner bit/);
  said({ stock: 12, corners: { diameter: 12.7, radius: 6.35 } }, /radius is too big for the/);
});

test('the margin is from the stock\'s edges to the outsides of the cuts', () => {
  for (const input of [{}, { bit: 6.35, gap: 20, margin: 3, origin: 'center' }, { shape: 'rect', length: 120, width: 80, cornerRadius: 12, layout: 'y', margin: 0 },
    { lipOn: 'lid', wall: 10, lidHeight: 15, margin: 4, edges: { bit: 'v', angle: 90, diameter: 12.7, outside: 1, inside: 0, pocket: 0 } }]) {
    const { plan, pts } = check(input);
    const rb = plan.o.bit / 2, st = plan.stock, m = plan.o.margin, cut = pts.filter((p) => p.z < -1e-6);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of cut) { minX = Math.min(minX, p.x - rb); maxX = Math.max(maxX, p.x + rb); minY = Math.min(minY, p.y - rb); maxY = Math.max(maxY, p.y + rb); }
    for (const [got, want] of [[minX - st.x0, m], [st.x0 + st.w - maxX, m], [minY - st.y0, m], [st.y0 + st.h - maxY, m]]) {
      assert.ok(got >= want - 0.01, 'margin ' + got.toFixed(3) + ' under ' + want + ' ' + JSON.stringify(input));
    }
    // Snug: the outline's outside on the margin.
    assert.ok(Math.abs(minX - st.x0 - m) < 0.01 || Math.abs(minY - st.y0 - m) < 0.01 || plan.edges.base.length, 'more stock than the margin');
  }
});

test('the finishing pass: roughing leaves the allowance, a lap cleans each wall, conventional or climb', () => {
  for (const lipOn of ['base', 'lid']) for (const shape of [{}, { shape: 'rect', length: 120, width: 80, cornerRadius: 10 }]) for (const extra of [{}, { corners: { diameter: 6.35, radius: 3.175 } }, { lidHeight: 14, finishDir: 'climb' }, { finishDir: 'climb' }]) {
    const input = Object.assign({ lipOn, finish: 0.3 }, shape, extra);
    // Spindle clockwise: conventional has the wood on the bit's left
    // (clockwise, G2, round a pocket's wall; G3 round the lip's), climb on its right.
    const climb = input.finishDir === 'climb', pocketG = climb ? 3 : 2, lipG = climb ? 2 : 3;
    const { plan, pts } = check(input);
    const rb = plan.o.bit / 2, fin = 0.3, eps = 0.005;
    for (const h of plan.halves) {
      const withLip = (lipOn === 'lid') === (h.name === 'lid'), top = h.name === 'lid' ? -plan.face : 0;
      const near = pts.filter((p) => p.z < top - 1e-6 && Math.hypot(p.x - h.at.x, p.y - h.at.y) < Math.max(plan.halfX, plan.halfY) * 1.5);
      const at = (p, t) => shapeDistance(plan.shape, t, p.x - h.at.x, p.y - h.at.y);
      const walls = [[plan.tInside - rb, (p) => withLip || top - p.z > plan.rabbetDepth + eps, pocketG, true]];
      if (!withLip) walls.push([plan.tRabbet - rb, (p) => top - p.z <= plan.rabbetDepth + eps, pocketG, true]);
      else walls.push([plan.tLip + rb, (p) => top - p.z <= plan.o.lipHeight + eps, lipG, false]);
      for (const [t, here, finishG, inward] of walls) {
        // Between the allowance and the wall: only the finishing laps (and their lead-ins).
        const between = near.filter((p) => here(p) && (inward ? at(p, t) > -fin + eps && at(p, t) < eps : at(p, t) < fin - eps && at(p, t) > -eps));
        // Roughing (G3) only outside the allowance; with a G3 finish, only on the wall itself.
        assert.ok(between.every((p) => p.g === finishG || p.g === 1 || Math.abs(at(p, t)) < eps), h.name + ' roughed into the allowance at ' + t.toFixed(2) + ': ' + JSON.stringify(between.find((p) => p.g !== finishG && p.g !== 1)));
        assert.ok(between.some((p) => p.g === finishG && Math.abs(at(p, t)) < eps), h.name + ' wall at ' + t.toFixed(2) + ' not finished (G' + finishG + ')');
      }
    }
  }
  assert.ok(boxPlan({ finish: 2 }).problems.some((p) => /Finish Allowance/.test(p)));
});

test('every move sideways is at the machine\'s safe height, after a tool change too', () => {
  const plan = boxPlan({ corners: { diameter: 6.35, radius: 3.175 }, edges: { bit: 'v', angle: 60, diameter: 12.7, vtip: 0.3, outside: 0, inside: 0.5, pocket: 0 }, lipOn: 'lid', wall: 10, finish: 0.3 });
  assert.deepEqual(plan.problems, []);
  const more = { toolNumber: 3, feed: 1000, plunge: 300, rpm: 16000, doc: 2 };
  for (const [f, only] of [[{ ...FEEDS, safeZ: -5 }], [{ ...FEEDS, toolNumber: 2, corners: more, edges: { ...more, toolNumber: 4 } }], [{ ...FEEDS, safeZ: -12.5, edges: more }, 'edges'], [{ ...FEEDS, corners: more }, 'corners']]) {
    const g = boxProgram(plan, f, only).gcode, lines = g.split('\n').map((l) => l.split(';')[0].trim()).filter((l) => l && l[0] !== '(');
    let atSafe = false;
    for (const l of lines) {
      if (/^G53 G0 Z/.test(l)) { atSafe = true; assert.equal(l, 'G53 G0 Z' + (f.safeZ != null ? f.safeZ.toFixed(3) : '0')); continue; }
      if (/^G0 /.test(l) && /[XY]/.test(l)) assert.ok(atSafe, 'sideways under safe height: ' + l);
      if (/Z/.test(l) || /^M6/.test(l)) atSafe = false;
    }
    // After each tool change: units, absolute and safe height again.
    const m6 = lines.findIndex((l) => /^M6/.test(l));
    if (m6 >= 0) { assert.match(lines[m6 + 1], /G21 G90/); assert.match(lines[m6 + 2], /^G53 G0 Z/); }
    simulate(g).forEach((p) => assert.ok(!(p.sideways && p.z < SAFE), 'sideways move under safe height'));
  }
});

test('a V-bit\'s flat tip counts in how far it reaches: the stock and the other half stay clear', () => {
  for (const [tip, angle] of [[3, 90], [8, 60], [0.3, 90]]) {
    const edges = { bit: 'v', angle, diameter: 12.7, vtip: tip, outside: 1, inside: 0, pocket: 0 };
    // A lowered lid with the lip on it: its seam far below the top, the
    // waste round it cleared; no margin; the Gap at the least it takes.
    let input = { lipOn: 'lid', lidHeight: 14, wall: 12, lipWidth: 3, margin: 0, edges }, gap = 12;
    while (boxPlan({ ...input, gap }).problems.some((p) => /Gap/.test(p))) gap += 0.25;
    input = { ...input, gap };
    const plan = boxPlan(input);
    assert.deepEqual(plan.problems, [], JSON.stringify(input));
    const g = boxProgram(plan, Object.assign({}, FEEDS, { edges: { toolNumber: 3, feed: 1000, plunge: 300, rpm: 16000, doc: 2 } })).gcode;
    const tan = Math.tan(angle * Math.PI / 360), st = plan.stock;
    // Each edge pass: the bit at its widest up to the stock top (its flat
    // tip, the cone, no wider than the bit) inside the stock and off the
    // other half's outline cut.
    for (const p of simulate(g.slice(g.indexOf('M6 T3'))).filter((q) => q.z < 0)) {
      const own = plan.halves.reduce((m, n) => Math.hypot(p.x - m.at.x, p.y - m.at.y) <= Math.hypot(p.x - n.at.x, p.y - n.at.y) ? m : n);
      const other = plan.halves.find((h) => h !== own);
      const e = plan.edges[own.name].find((x) => Math.abs(shapeDistance(x.shape, x.t, p.x - own.at.x, p.y - own.at.y)) < 0.01);
      if (!e) continue;
      const r = Math.min(tip / 2 + (0 - p.z) * tan, 12.7 / 2);
      assert.ok(p.x - r >= st.x0 - 0.01 && p.x + r <= st.x0 + st.w + 0.01 && p.y - r >= st.y0 - 0.01 && p.y + r <= st.y0 + st.h + 0.01, 'edge bit past the stock (tip ' + tip + ')');
      assert.ok(shapeDistance(plan.shape, plan.o.bit, p.x - other.at.x, p.y - other.at.y) >= r - 0.01, own.name + '\'s edge bit into the ' + other.name + ' (tip ' + tip + ')');
    }
  }
});
