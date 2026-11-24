// The box's program, run through a small G-code simulator: where the
// bit's center goes, at what depth, against what must be left standing.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { boxPlan, testFitInput, autoSizes, fitOption, nestInputs, setPlan, outsideInput, BOX_DEFAULTS } = require('../lib/box-plan.cjs');
const { boxProgram, MAX_LINES } = require('../lib/box-gcode.cjs');
const { shapeDistance, shapeLoop, shapeLoops, loopLength, loopPoint } = require('../lib/box-shape.cjs');

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
function allowed(set, half, p) {
  // A nested set's half: its own box's plan.
  const plan = half.plan || set, o = plan.o, rb = o.bit / 2, S = half.shape || plan.shape;
  // eps: the program's coordinates are to 0.001 mm, arc centers too; an
  // outline's offsets (a heart's, an oval's) are straight lines kept to
  // 0.02 mm of the curve.
  const eps = S.kind === 'outline' ? 0.03 : 0.005;
  const face = plan.faces[half.name], top = -face, d = top - p.z;
  const px = p.x - half.at.x, py = p.y - half.at.y;
  const at = (t) => shapeDistance(S, t, px, py);
  if (-p.z <= eps) return true;
  // A lid lower than the stock: its area faced down first.
  const facing = half.cuts.find((c) => /faced down/.test(c.what));
  if (facing && -p.z <= face + eps && (facing.op === 'ring' ? at(facing.tIn + rb) >= -eps : at(facing.t - rb) <= eps)) return true;
  const inset = plan.bottom && plan.bottom.style === 'inset';
  // A drop-in lid's panel: only its outline, cut through.
  if (plan.drop && half.name === 'lid') return at(half.outline.t + rb) >= -eps && d <= half.outline.depth + eps;
  // A bottom's outline: an inset panel's in from the box's.
  if (at(rb + (half.name === 'bottom' ? (inset ? plan.bottom.part.t : plan.bottom.oversize) : 0)) >= -eps) return d <= half.outline.depth + eps;
  // An inset bottom's panel: nothing cut inside its outline.
  if (half.name === 'bottom' && inset) return false;
  // An inset bottom's ring: its middle cut through, the rabbet round it.
  if (inset && half.name === 'base') {
    const r = plan.bottom.rabbet;
    if (shapeDistance(plan.bottom.shape, r.tIn - rb, px, py) <= eps) return -p.z <= o.stock + o.through + eps;
    return d <= r.depth + eps && shapeDistance(plan.bottom.shape, r.tOut - rb, px, py) <= eps;
  }
  // A glued-on bottom: the step round its plug; a ring's middle, cut out
  // through from the stock's top.
  if (half.name === 'bottom') return -p.z <= plan.bottom.step + eps && (shapeDistance(plan.bottom.part.shape, plan.bottom.part.t + rb, px, py) >= -eps || clearOfPlug(plan, px, py, rb - 0.03));
  if (plan.bottom && half.name === 'base' && shapeDistance(plan.bottom.shape, plan.tInside - rb, px, py) <= eps) return -p.z <= o.stock + o.through + eps;
  const withLip = (o.lipOn === 'lid') === (half.name === 'lid');
  const floor = half.height - (half.name === 'lid' ? o.top : o.floor), meet = withLip ? plan.lipUp : 0;
  // Rounded floor corners: the box's bit stays the radius off the wall
  // for that last bit of the pocket (the corner bit's to cut).
  const rc = o.corners ? o.corners.radius : 0;
  // A plug lid: its inside left solid.
  const solid = o.lidStyle === 'plug' && half.name === 'lid';
  // Compartments: below the dividers' top, only inside a compartment.
  const comp = half.name === 'base' && plan.compartments;
  if (comp && at(plan.tInside - rb) <= eps && d > comp.top + eps)
    return d <= floor + eps && comp.cells.some((c) => shapeDistance(c.shape, -rb, px - c.dx, py - c.dy) <= eps);
  if (!solid && at(plan.tInside - rb) <= eps && d <= floor + eps && (d <= floor - rc + eps || at(plan.tInside - rc - rb) <= eps)) return true;
  if (withLip && at(plan.tLip + rb) >= -eps && d <= plan.lipUp + eps) return true;
  // The widened opening, by depth: a sloped lip's only to its floor's
  // width, a part slope's narrowing in steps.
  if (!withLip && (plan.openSteps || [{ d0: 0, d1: plan.rabbetDepth, t: plan.tRabbet }]).some((st) => d > st.d0 - eps && d <= st.d1 + eps && at(st.t - rb) <= eps)) return true;
  for (const m of half.magnetAt || plan.magnetAt) {
    if (Math.hypot(px - m.dx, py - m.dy) <= o.magnets.diameter / 2 - rb + eps && d <= meet + o.magnets.depth + eps) return true;
  }
  if (half.name === 'base') for (const n of plan.notches || []) {
    if (Math.hypot(px - n.dx, py - n.dy) <= n.shape.r - rb + eps && d <= (plan.drop ? plan.rabbetDepth : meet) + o.notch.depth + eps) return true;
  }
  return false;
}

// An outline's distances are only near at its corners: the plug's own
// edge, walked, outside it and the bit's radius off.
const plugEdges = new WeakMap();
function clearOfPlug(plan, x, y, r) {
  if (!plugEdges.has(plan)) {
    const loop = shapeLoop(plan.bottom.part.shape, plan.bottom.part.t), len = loopLength(loop), pts = [];
    for (let k = 0; k < 4000; k++) pts.push(loopPoint(loop, len * k / 4000));
    plugEdges.set(plan, pts);
  }
  return shapeDistance(plan.bottom.part.shape, plan.bottom.part.t, x, y) > 0 && plugEdges.get(plan).every((q) => Math.hypot(q.x - x, q.y - y) >= r);
}

function check(input, extra) {
  const plan = input.halves ? input : boxPlan(input);
  assert.deepEqual(plan.problems, [], JSON.stringify(input.halves ? input.o : input));
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
    // The half it's nearest (inside, or closest outside its outline).
    const near = (h) => shapeDistance(h.shape || h.plan.shape, 0, p.x - h.at.x, p.y - h.at.y);
    const half = plan.halves.reduce((a, b) => near(a) <= near(b) ? a : b);
    assert.ok(allowed(plan, half, p), half.name + ' cut where wood stays: ' + JSON.stringify(p) + ' ' + plan.o.shape + ' ' + plan.o.diameter + ' ' + JSON.stringify(half.at));
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
  said({ floor: 19 }, /Base Floor must be between/);
  said({ lipHeight: 16, top: 18.7 }, /Lip Height must be less/);
  said({ gap: 3 }, /Gap Between must be at least/);
  said({ tabs: { count: 30, width: 10, height: 2 } }, /Too many or too wide tabs/);
  assert.equal(BOX_DEFAULTS.lipOn, 'base');
});

test('Base and Lid Height are the outside to the seam; a lip too high for the other half goes as deep as its inside, flat', () => {
  for (const lipOn of ['base', 'lid']) {
    const plan = boxPlan({ lipOn, stock: 19, baseHeight: 12, lidHeight: 10, lipHeight: 5, clearance: 0.3 });
    assert.deepEqual(plan.problems, []);
    assert.ok(Math.abs(plan.closedHeight - 22) < 1e-9 && plan.baseOut === 12 && plan.lidOut === 10);
    assert.ok(Math.abs((lipOn === 'lid' ? plan.lidHeight - 10 : plan.baseHeight - 12) - 4.7) < 1e-9);
    // As high as the board allows: the half with the lip less the lip.
    const full = boxPlan({ lipOn, stock: 19, lipHeight: 5, clearance: 0.3 });
    assert.ok(Math.abs(full[lipOn + 'Out'] - 14.3) < 1e-9 && full[(lipOn === 'lid' ? 'base' : 'lid') + 'Out'] === 19);
    assert.ok(boxPlan({ lipOn, stock: 19, [lipOn + 'Height']: 15, lipHeight: 5, clearance: 0.3 }).problems.some((p) => /Height can't be more than 14\.3 mm with this stock/.test(p)));
    // The opening as deep as the other half's inside (or within 1 mm of
    // it, raised): one flat inside, no step.
    const other = (lipOn === 'lid' ? 'base' : 'lid') + 'Height';
    for (const [lipHeight, say] of [[5, 'lowered'], [3.4, 'raised']]) {
      const low = boxPlan({ lipOn, stock: 19, [other]: 8, floor: 4, top: 4, lipHeight });
      assert.deepEqual(low.problems, []);
      assert.equal(low.rabbetDepth, 4);
      assert.ok(low.notes.some((n) => new RegExp('Lip Height ' + say + ' to 4 mm.*one flat inside').test(n)), low.notes.join(' '));
      const half = low.halves.find((h) => h.name === (lipOn === 'lid' ? 'base' : 'lid'));
      assert.deepEqual(half.cuts.filter((c) => /^inside/.test(c.what)).map((c) => [c.t, c.depth]), [[low.tRabbet, 4]]);
      check({ lipOn, stock: 19, [other]: 8, floor: 4, top: 4, lipHeight });
    }
    assert.equal(boxPlan({ lipOn, stock: 19, [other]: 8, floor: 4, top: 4, lipHeight: 2.9 }).rabbetDepth, 2.9);
  }
});

test('a lip as deep as the other half\'s inside: one flat inside, with coves, sloped lips, a glued-on bottom and edges', () => {
  const V = { bit: 'v', angle: 90, diameter: 12.7, vtip: 0.3, outside: 0.5, inside: 0.8, pocket: 0.5 };
  for (const lipOn of ['base', 'lid']) for (const extra of [{ corners: { diameter: 6.35, radius: 3.175 } }, { edges: V }, { edges: { ...V, angle: 60, slope: true, pocket: 0 }, lipWidth: 6, wall: 12 },
    { edges: { ...V, slope: true, slopeHeight: 2, pocket: 0 } }, { bottom: { board: 6.35, step: 2 } }, { shape: 'rect', length: 110, width: 80, cornerRadius: 12 }]) {
    const input = { lipOn, wall: 10, lipWidth: 4, stock: 19, [(lipOn === 'lid' ? 'base' : 'lid') + 'Height']: 10, floor: 4, top: 4, lipHeight: 9, ...extra };
    const { plan, gcode } = check(input);
    assert.ok(plan.notes.some((n) => /one flat inside/.test(n)), JSON.stringify(extra) + plan.notes.join(' '));
    assert.ok(!plan.notes.some((n) => /step's inner edge/.test(n)) && !plan.edges[plan.halves.find((h) => h.name !== (lipOn === 'lid' ? 'lid' : 'base')).name].some((e) => /step/.test(e.what)));
    if (extra.edges) checkEdges(plan, boxProgram(plan, Object.assign({}, FEEDS, { edges: { toolNumber: 3, feed: 1000, plunge: 300, rpm: 16000, doc: 2 } }), 'edges').gcode);
  }
});

test('sizes measured outside or inside, the Height closed with the Lid Height its share', () => {
  // Inside widths: round, rectangle and polygon two walls less; an oval's stays its outside.
  assert.equal(outsideInput({ measure: 'inside', diameter: 68, wall: 6 }).diameter, 80);
  const r = outsideInput({ measure: 'inside', shape: 'rect', length: 100, width: 60, wall: 5 });
  assert.ok(r.length === 110 && r.width === 70);
  assert.equal(outsideInput({ measure: 'inside', shape: 'poly', flats: 70, wall: 5 }).flats, 80);
  assert.equal(outsideInput({ measure: 'inside', shape: 'oval', length: 100, wall: 5 }).length, 100);
  const { gcode } = check(outsideInput({ measure: 'inside', diameter: 68, wall: 6 }));
  assert.match(gcode, /inside 68mm across/);
  for (const lipOn of ['base', 'lid']) for (const [extra, H] of [[{}, 26], [{ lidHeight: 12 }, 26], [{ bottom: { board: 6.35, step: 2 } }, 30], [{ lipHeight: 7, lidHeight: 12 }, 24]]) {
    // The Height, outside: the box closed.
    const out = boxPlan(outsideInput({ lipOn, height: H, ...extra }));
    assert.deepEqual(out.problems, [], JSON.stringify({ lipOn, ...extra }));
    assert.ok(Math.abs(out.closedHeight - H) < 1e-6, out.closedHeight);
    if (extra.lidHeight) assert.equal(out.lidOut, 12);
    // Inside: what it holds (the floor or bottom, and the top, less).
    const hIn = H - (extra.bottom ? 6.35 : 4) - 4, ins = boxPlan(outsideInput({ lipOn, measure: 'inside', height: hIn, ...extra }));
    assert.deepEqual(ins.problems, [], JSON.stringify({ lipOn, ...extra }));
    assert.ok(Math.abs(ins.insideHeight - hIn) < 1e-6 && Math.abs(ins.closedHeight - H) < 1e-6, ins.insideHeight);
  }
  const high = boxPlan(outsideInput({ height: 40, lidHeight: 10 })).problems;
  assert.ok(high.some((p) => /^Height can't be more than 25\.2 mm with this stock/.test(p)), high.join(' '));
  assert.ok(boxPlan(outsideInput({ height: 8, lidHeight: 10 })).problems.some((p) => /^Height too low for the Lid Height/.test(p)));
  // A test fit and a nested set don't take the Height.
  assert.deepEqual(boxPlan(testFitInput(outsideInput({ height: 8, lidHeight: 10 }))).problems, []);
});

test('a lid lower than the stock, magnets and a finger notch', () => {
  for (const lipOn of ['base', 'lid']) for (const layout of ['x', 'y']) {
    const input = { lipOn, layout, diameter: 90, stock: 19, lidHeight: 12, wall: 12, lipWidth: 3,
      magnets: { count: 4, diameter: 6.35, depth: 3.2 }, notch: { width: 12, depth: 4 } };
    for (const shape of [{}, { shape: 'rect', length: 130, width: 90, cornerRadius: 16 }]) {
    const { plan, pts } = check(Object.assign({}, input, shape, shape.shape ? { magnets: { count: 4, diameter: 6.35, depth: 3.2 } } : {}));
    // Base and Lid Height to the seam: the lip stands the Lip Height less
    // the Clearance above it, from the same board.
    const up = 4 - 0.2, baseOut = lipOn === 'lid' ? 19 : 19 - up;
    assert.ok(Math.abs(plan.closedHeight - (baseOut + 12)) < 1e-9 && Math.abs(plan.lidHeight - (lipOn === 'lid' ? 12 + up : 12)) < 1e-9);
    // Each magnet hole goes its full depth in both halves.
    for (const half of plan.halves) {
      const meet = (plan.o.lipOn === 'lid') === (half.name === 'lid') ? plan.lipUp : 0;
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
  said({ lidHeight: 6, top: 6 }, /Lid Top must be between/);
  said({ shape: 'rect', cornerRadius: 2 }, /Corner Radius must be at least/);
  said({ shape: 'rect', magnets: { count: 3, diameter: 6, depth: 3 }, wall: 12 }, /even number of magnets/);
  said({ shape: 'rect', width: 0 }, /Width and Length/);
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
    // An outline's loops are straight lines kept to 0.02 mm of its curve.
    const tol = (e) => e.shape.kind === 'outline' ? 0.03 : 0.005;
    const on = all.filter(({ h, e }) => Math.abs(shapeDistance(e.shape, e.t, p.x - h.at.x, p.y - h.at.y)) < tol(e) && p.z >= e.z0 - e.depth - 1e-6);
    // Above an edge's top, going down to it in the air.
    const above = all.some(({ h, e }) => Math.abs(shapeDistance(e.shape, e.t, p.x - h.at.x, p.y - h.at.y)) < tol(e) && p.z >= e.z0 - 1e-6);
    assert.ok(on.length || above, 'edge bit off its edges: ' + JSON.stringify(p) + ' ' + plan.o.lipOn + ' ' + plan.o.shape + ' ' + JSON.stringify(plan.o.edges));
    // Below an edge's top, the bit's bottom stays on the air side: a
    // V-bit's point on the edge (or out by its shift, as much deeper), a
    // roundover bit's flat end beside it.
    const ed = plan.o.edges, tipHalf = ((ed.bit === 'round' ? ed.tip : ed.vtip) || 0) / 2;
    for (const { h, e } of on) {
      if (p.z >= e.z0 - 1e-6) continue;
      const half = e.u * (e.t - e.at);
      assert.ok(half >= tipHalf - 1e-9 && Math.abs(e.depth - e.chamfer - (half - tipHalf) / Math.tan((ed.angle || 90) * Math.PI / 360)) < 1e-9 || ed.bit === 'round');
      const out = e.u * shapeDistance(e.shape, e.at, p.x - h.at.x, p.y - h.at.y);
      assert.ok(Math.abs(out - half) < tol(e) + 0.005, h.name + ' ' + e.what + ': bit ' + out.toFixed(3) + ' off the edge, not ' + half);
    }
  }
  for (const { h, e } of all) {
    const t = e.shape.kind === 'outline' ? 0.03 : 0.005;
    assert.ok(pts.some((p) => Math.abs(p.z - (e.z0 - e.depth)) < 1e-6 && Math.abs(shapeDistance(e.shape, e.t, p.x - h.at.x, p.y - h.at.y)) < t), h.name + ' ' + e.what + ' not cut');
  }
}

test('a small V-bit\'s seam beside a tall lip: up its cone, clear of the lip', () => {
  // A stout 2 1/4" box (as saved on the shop's machine): a 1/4" 90° V-bit,
  // the shoulder outside the lip as wide as its radius.
  const stout = { diameter: 57.15, stock: 21.016, wall: 6.35, floor: 4.762, top: 4.762, lipHeight: 9.525, lipWidth: 3.175, clearance: 0.254, gap: 15.083, margin: 4.762,
    bit: 6.35, layout: 'y', tabs: { count: 3, width: 9.525, height: 0.795 }, finish: 0.25, lidHeight: 12.7,
    edges: { bit: 'v', angle: 90, diameter: 6.35, vtip: 0.254, outside: 0.508, inside: 0.762, pocket: 0.508 } };
  for (const lipOn of ['base', 'lid']) {
    const plan = boxPlan({ ...stout, lipOn, lidHeight: lipOn === 'lid' ? 10 : 12.7 });
    assert.deepEqual(plan.problems, [], lipOn);
    const gcode = boxProgram(plan, Object.assign({}, FEEDS, { edges: { toolNumber: 3, feed: 1000, plunge: 300, rpm: 16000, doc: 2 } }), 'edges').gcode;
    checkEdges(plan, gcode);
    const half = plan.halves.find((h) => h.name === (lipOn === 'lid' ? 'lid' : 'base')), lipTop = -(plan.faces[half.name] || 0);
    const seam = plan.edges[half.name].find((e) => e.what === 'outside seam edge');
    const ed = plan.o.edges, tan = Math.tan(ed.angle * Math.PI / 360);
    for (const p of simulate(gcode).filter((q) => q.z < lipTop - 1e-6)) {
      const x = p.x - half.at.x, y = p.y - half.at.y;
      if (Math.abs(shapeDistance(seam.shape, seam.t, x, y)) > 0.01) continue;
      const r = Math.min(ed.vtip / 2 + (lipTop - p.z) * tan, ed.diameter / 2);
      assert.ok(shapeDistance(plan.shape, plan.tLip, x, y) >= r + 0.2, lipOn + ': the seam\'s bit reaches the lip');
    }
  }
});

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
          const reach = edges.bit === 'round' ? edges.tip + edges.radius : seam.u * (seam.t - seam.at) + Math.min((seam.depth - seam.z0) * Math.tan(edges.angle * Math.PI / 360), edges.diameter / 2);
          assert.ok((clearing.tOut ?? clearing.t) >= reach + 1 - 1e-9, h.name + ' waste not cleared for the seam');
        }
      }
    }
  }
});

test('a V-bit cuts its chamfers higher up its cone where there\'s room, not round a heart\'s corners', () => {
  const V = { bit: 'v', angle: 90, diameter: 12.7, vtip: 0.3, outside: 1, inside: 0.8, pocket: 0.6 };
  const shiftOf = (i) => boxPlan(i).edges.base.map((e) => e.u * (e.t - e.at) - 0.15);
  const round = shiftOf({ wall: 12, lipWidth: 5, bit: 6.35, gap: 20, edges: V });
  assert.ok(round.every((s) => s > 1.5), JSON.stringify(round));
  // The outline's slot is all the room an outside seam at the stock top has.
  const tight = boxPlan({ lipOn: 'lid', wall: 12, lipWidth: 5, bit: 3.175, gap: 20, edges: V }).edges.base.find((e) => /seam/.test(e.what));
  assert.ok(tight.t - tight.at > 0.5 && 2 * (tight.t - tight.at - 0.15) + 0.3 + 1 <= 3.175 - 0.3 + 1e-9);
  assert.ok(shiftOf({ shape: 'heart', length: 127, width: 120, cornerRadius: 12.7, wall: 12, lipWidth: 5, bit: 6.35, gap: 20, edges: V }).every((s) => Math.abs(s) < 1e-9));
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
  said({ wall: 10, edges: { ...V, outside: 0, inside: 1.5, pocket: 1.5 } }, /Lead-In and Inside Rim too big for the lip/);
  // The step's inner edge is down at the step: its bit must clear the opening's wall above.
  // (or it's left, with a note, and the lip's inner edge still cut).
  const left = boxPlan({ wall: 10, edges: { ...V, outside: 0, inside: 0, pocket: 0.5 } });
  assert.deepEqual(left.problems, []);
  assert.ok(left.notes.some((n) => /step's inner edge/.test(n)));
  assert.ok(!left.edges.lid.some((e) => /step/.test(e.what)) && left.edges.base.some((e) => /lip's inner edge/.test(e.what)));
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
      // A lead-in, and the outside seam just taken off.
      if (opts.edges && size >= 80) assert.ok(a.edges.outside >= 0 && a.edges.outside <= 0.51 && a.edges.inside > 0, 'lead-in left out, or a big seam: ' + JSON.stringify(input));
      // The lip half the wall (to the grid), and in wood at least 1/4" high where the box is deep enough.
      // With magnets, thinner when their holes need the room, down to 1/4".
      assert.ok(a.lipWidth <= a.wall / 2 + 1e-9 && (a.lipWidth > a.wall / 2 - 0.8 || (opts.magnets && a.lipWidth >= 6.35 - 1e-9)), 'lip width ' + a.lipWidth + ' of wall ' + a.wall);
      if (material !== 'acrylic' && Math.min(stock - a.floor, stock - a.top) >= 9.35) assert.ok(a.lipHeight >= 6.35 - 1e-9, 'lip height ' + a.lipHeight + ' ' + JSON.stringify(input));
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
      else walls.push([plan.tLip + rb, (p) => top - p.z <= plan.lipUp + eps, lipG, false]);
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

test('regular polygons: a flat side to the front, any side count, with everything on', () => {
  for (const sides of [3, 5, 6, 8]) for (const layout of ['x', 'y']) for (const lipOn of ['base', 'lid']) {
    const input = { shape: 'poly', sides, flats: sides === 3 ? 110 : 90, cornerRadius: 12, layout, lipOn, origin: sides === 5 ? 'center' : 'front-left',
      wall: 12, magnets: { count: 4, diameter: 6.35, depth: 3.2 }, notch: { width: 14, depth: 4 }, finish: 0.3 };
    const { plan } = check(input);
    // Turned over onto the base, the lid's magnets land on the base's.
    const flip = layout === 'y' ? (m) => ({ dx: m.dx, dy: -m.dy }) : (m) => ({ dx: -m.dx, dy: m.dy });
    for (const m of plan.magnetAt.map(flip)) assert.ok(plan.magnetAt.some((b) => Math.hypot(b.dx - m.dx, b.dy - m.dy) < 1e-6), sides + ' sides: magnets don\'t meet');
    // The outline the same turned over (the shape is symmetric across the flip).
    const S = plan.shape;
    for (let k = 0; k < 40; k++) {
      const p = loopPoint(shapeLoop(S, 0), loopLength(shapeLoop(S, 0)) * k / 40), q = flip({ dx: p.x, dy: p.y });
      assert.ok(Math.abs(shapeDistance(S, 0, q.dx, q.dy)) < 1e-6, sides + ' sides: not the same turned over');
    }
    // The notch at the middle of the front flat.
    assert.ok(Math.abs(shapeDistance(S, 0, plan.notch.dx, plan.notch.dy)) < 1e-6);
    assert.equal(layout === 'y' ? plan.notch.dy : plan.notch.dx, 0);
    // The stock fits the halves (an odd polygon reaches further one way).
    const st = plan.stock;
    for (const h of plan.halves) {
      assert.ok(h.at.x + plan.ext.minX - st.x0 >= plan.o.margin - 1e-9 && st.x0 + st.w - (h.at.x + plan.ext.maxX) >= plan.o.margin - 1e-9);
      assert.ok(h.at.y + plan.ext.minY - st.y0 >= plan.o.margin - 1e-9 && st.y0 + st.h - (h.at.y + plan.ext.maxY) >= plan.o.margin - 1e-9);
    }
  }
  // Floors cleared all over, and edges and corners on a hexagon.
  const hex = { shape: 'poly', sides: 6, flats: 90, cornerRadius: 10, wall: 10, corners: { diameter: 6.35, radius: 3.175 },
    edges: { bit: 'v', angle: 60, diameter: 12.7, vtip: 0.3, outside: 1, inside: 0.5, pocket: 0 } };
  const { plan, pts } = check(hex);
  const rb = plan.o.bit / 2;
  for (const half of plan.halves) {
    const floor = half.height - (half.name === 'lid' ? plan.o.top : plan.o.floor);
    const deep = pts.filter((p) => Math.abs(p.z + floor) < 1e-6);
    for (let qx = plan.ext.minX; qx <= plan.ext.maxX; qx += 1.5) for (let qy = plan.ext.minY; qy <= plan.ext.maxY; qy += 1.5) {
      if (shapeDistance(plan.shape, plan.tInside - 3.175, qx, qy) > -0.2) continue;
      let near = Infinity;
      for (const p of deep) near = Math.min(near, Math.hypot(p.x - half.at.x - qx, p.y - half.at.y - qy));
      assert.ok(near <= rb + 0.3, half.name + ' hexagon floor left at ' + qx + ',' + qy);
    }
  }
  const more = { toolNumber: 3, feed: 1000, plunge: 300, rpm: 16000, doc: 2 };
  checkEdges(plan, boxProgram(plan, Object.assign({}, FEEDS, { edges: more }), 'edges').gcode);
  const said = (o, re) => assert.ok(boxPlan(o).problems.some((p) => re.test(p)), JSON.stringify(o) + ' ' + boxPlan(o).problems);
  said({ shape: 'poly', sides: 2, flats: 80 }, /3 to 12 sides/);
  said({ shape: 'poly', sides: 6, flats: 80, cornerRadius: 1 }, /Corner Radius must be at least/);
});

test('ovals and hearts: cut without touching what stays, the heart\'s lobes cleared on their own', () => {
  const runs = [
    { shape: 'oval', length: 140, width: 80 },
    { shape: 'oval', length: 70, width: 110, layout: 'y', lipOn: 'lid', finish: 0.3 },
    { shape: 'heart', length: 100, width: 95, cornerRadius: 8 },
    { shape: 'heart', length: 100, width: 80, cornerRadius: 11, layout: 'y', lipOn: 'lid', finish: 0.3, magnets: { count: 4, diameter: 6.35, depth: 3.2 }, wall: 12 },
  ];
  for (const input of runs) {
    const { plan, pts } = check(input);
    const rb = plan.o.bit / 2, S = plan.shape;
    // Turned over across the line between the halves, the same outline.
    const flip = plan.o.layout === 'y' ? (p) => ({ x: p.x, y: -p.y }) : (p) => ({ x: -p.x, y: p.y });
    const out = shapeLoop(S, 0), len = loopLength(out);
    for (let k = 0; k < 60; k++) { const q = flip(loopPoint(out, len * k / 60)); assert.ok(Math.abs(shapeDistance(S, 0, q.x, q.y)) < 0.03, input.shape + ' not the same turned over'); }
    // Every floor cleared, the heart's lobes too.
    for (const half of plan.halves) {
      const floor = (half.name === 'lid' ? plan.face : 0) + half.height - (half.name === 'lid' ? plan.o.top : plan.o.floor);
      const deep = pts.filter((p) => Math.abs(p.z + floor) < 1e-6);
      for (let qx = plan.ext.minX; qx <= plan.ext.maxX; qx += 1.5) for (let qy = plan.ext.minY; qy <= plan.ext.maxY; qy += 1.5) {
        if (shapeDistance(S, plan.tInside - (plan.o.finish || 0), qx, qy) > -0.3) continue;
        let near = Infinity;
        for (const p of deep) { const d = Math.hypot(p.x - half.at.x - qx, p.y - half.at.y - qy); if (d < near) near = d; if (near <= rb) break; }
        assert.ok(near <= rb + 0.35, input.shape + ' ' + half.name + ' floor left at ' + qx.toFixed(1) + ',' + qy.toFixed(1) + ' (' + near.toFixed(2) + ')');
      }
    }
  }
  const said = (o, re) => assert.ok(boxPlan(o).problems.some((p) => re.test(p)), JSON.stringify(o) + ' ' + boxPlan(o).problems);
  said({ shape: 'heart', length: 100, width: 40, cornerRadius: 8 }, /needs at least 72.7 mm from point to top/);
  said({ shape: 'heart', length: 100, width: 95, cornerRadius: 1 }, /Corner Radius must be at least/);
});

test('an outline whose pocket comes apart: each piece cleared on its own, between lifts', () => {
  // Two 60 mm discs joined by a neck 30 mm wide: its pocket splits about
  // 15 mm in, leaving two discs' worth to clear.
  const a = Math.asin(15 / 30), x = 35 - 30 * Math.cos(a);
  const line = (x0, y0, x1, y1) => ({ type: 'line', x0, y0, x1, y1, len: Math.hypot(x1 - x0, y1 - y0) });
  const arc = (cx, cy, r, a0, a1) => ({ type: 'arc', cx, cy, r, a0, a1, len: r * (a1 - a0) });
  const dumbbell = { kind: 'outline', key: 'dumbbell', step: 0.2, cr: 30,
    segs: [line(-x, -15, x, -15), arc(35, 0, 30, -Math.PI + a, Math.PI - a), line(x, 15, -x, 15), arc(-35, 0, 30, a, 2 * Math.PI - a)] };
  const plan = boxPlan({ shape: 'oval', length: 130, width: 60 });
  assert.deepEqual(plan.problems, []);
  plan.shape = dumbbell;
  plan.halves.forEach((h) => { h.shape = dumbbell; });
  assert.equal(shapeLoops(dumbbell, plan.tInside).length, 1);
  assert.ok(shapeLoops(dumbbell, -20).length === 2, 'splits in two');
  const { gcode } = boxProgram(plan, FEEDS);
  const pts = simulate(gcode);
  for (const p of pts) {
    assert.ok(!(p.rapid && p.z < -1e-6), 'a rapid below the stock top');
    const half = plan.halves.reduce((m, n) => Math.hypot(p.x - m.at.x, p.y - m.at.y) <= Math.hypot(p.x - n.at.x, p.y - n.at.y) ? m : n);
    assert.ok(allowed(plan, half, p), half.name + ' cut where wood stays: ' + JSON.stringify(p) + ' ' + plan.o.shape + ' ' + plan.o.diameter + ' ' + JSON.stringify(half.at));
  }
  const rb = plan.o.bit / 2;
  for (const half of plan.halves) {
    const floor = half.height - (half.name === 'lid' ? plan.o.top : plan.o.floor);
    const deep = pts.filter((p) => Math.abs(p.z + floor) < 1e-6);
    for (let qx = -65; qx <= 65; qx += 1.5) for (let qy = -30; qy <= 30; qy += 1.5) {
      if (shapeDistance(dumbbell, plan.tInside, qx, qy) > -0.3) continue;
      let near = Infinity;
      for (const p of deep) { const d = Math.hypot(p.x - half.at.x - qx, p.y - half.at.y - qy); if (d < near) near = d; if (near <= rb) break; }
      assert.ok(near <= rb + 0.35, half.name + ' floor left at ' + qx + ',' + qy + ' (' + near.toFixed(2) + ')');
    }
  }
});

test('ovals and hearts: their ends and notch fit, big offsets, tiny pieces, Test Fit', () => {
  const said = (o, re) => assert.ok(boxPlan(o).problems.some((p) => re.test(p)), JSON.stringify(o) + ' ' + boxPlan(o).problems);
  // An oval's ends as tight as a corner: the lip has to fit there.
  said({ shape: 'oval', length: 150, width: 30 }, /ends are too tight/);
  // A heart's notch: the bit has to get into the lip's side of it.
  said({ shape: 'heart', length: 100, width: 95, cornerRadius: 12, bit: 9.5, wall: 7, lipWidth: 3, clearance: 0.1, gap: 30 }, /bit gets into the lip's side of the notch/);
  assert.deepEqual(boxPlan(testFitInput({ shape: 'heart', length: 100, width: 95, cornerRadius: 12, bit: 3.175, wall: 12 })).problems, []);
  // An outward offset past the grid's usual reach: the lid's facing is cut.
  const big = { shape: 'oval', length: 200, width: 160, lidHeight: 12, stock: 19, wall: 28, gap: 40, edges: { bit: 'round', radius: 24, tip: 2, outside: 1, inside: 0, pocket: 0 } };
  const bp = boxPlan(big);
  assert.deepEqual(bp.problems, []);
  const g = boxProgram(bp, FEEDS).gcode, face = g.slice(g.indexOf('(Lid: faced down'), g.indexOf('(', g.indexOf('(Lid: faced down') + 1));
  assert.ok((face.match(/^G1 /gm) || []).length > 50, 'the lid not faced');
  // A big heart: few lifts, every piece entered gently, floors cleared; at
  // a big stepover too (short pieces entered on a small circle).
  for (const stepoverPct of [40, 60]) {
    const input = { shape: 'heart', length: 150, width: 150, cornerRadius: 8 };
    const { plan, pts, gcode } = check(input, { stepoverPct });
    if (stepoverPct === 40) assert.ok((gcode.match(/^G53 G0 Z/gm) || []).length < 40, 'too many lifts');
    const rb = plan.o.bit / 2, S = plan.shape;
    for (const half of plan.halves) {
      const floor = half.height - (half.name === 'lid' ? plan.o.top : plan.o.floor);
      const deep = pts.filter((p) => Math.abs(p.z + floor) < 1e-6);
      for (let qx = plan.ext.minX; qx <= plan.ext.maxX; qx += 2) for (let qy = plan.ext.minY; qy <= plan.ext.maxY; qy += 2) {
        if (shapeDistance(S, plan.tInside, qx, qy) > -0.3) continue;
        let near = Infinity;
        for (const p of deep) { const d = Math.hypot(p.x - half.at.x - qx, p.y - half.at.y - qy); if (d < near) near = d; if (near <= rb) break; }
        assert.ok(near <= rb + 0.35, 'heart ' + half.name + ' floor left at ' + qx.toFixed(1) + ',' + qy.toFixed(1) + ' (' + stepoverPct + '%)');
      }
    }
  }
});

test('one half on its own board: the base or the lid, the lid from a thinner board, a lower base faced', () => {
  for (const shape of [{}, { shape: 'rect', length: 120, width: 80, cornerRadius: 10 }, { shape: 'heart', length: 100, width: 95, cornerRadius: 12, wall: 7, lipWidth: 3 }])
    for (const lipOn of ['base', 'lid']) for (const origin of ['front-left', 'center']) {
      const both = boxPlan(Object.assign({ lipOn, origin }, shape));
      for (const cut of ['base', 'lid']) {
        const input = Object.assign({ lipOn, origin, cut, lidStock: 12 }, shape);
        const { plan, gcode } = check(input);
        assert.deepEqual(plan.halves.map((h) => h.name), [cut]);
        assert.equal(plan.stock.thick, cut === 'lid' ? 12 : 19);
        // One half's board: a margin round its outline.
        assert.ok(Math.abs(plan.stock.w - (2 * both.halfX + 2 * both.margin)) < 1e-9 && Math.abs(plan.stock.h - (2 * both.halfY + 2 * both.margin)) < 1e-9);
        if (origin === 'front-left') assert.deepEqual(plan.halves[0].at, both.halves[0].at);
        if (cut === 'lid') assert.equal(plan.lidHeight, 12);
        assert.doesNotMatch(gcode, /faced down/);
        assert.match(gcode, new RegExp('Only the ' + cut));
      }
    }
  // The lid's height still from its own board: lower than it, faced down.
  check({ cut: 'lid', lidStock: 15, lidHeight: 12 });
  assert.ok(boxPlan({ cut: 'lid', lidStock: 10, lidHeight: 12 }).problems.some((p) => /Lid Height can't be more than 10 mm with this lid board/.test(p)));
  // A base lower than the stock, as a nested box's: faced down first.
  const { gcode } = check({ baseHeight: 15, lidHeight: 14 });
  assert.match(gcode, /Base: faced down to the base height/);
});

test('grain matched: the lid where the base is, mirrored, on the leaf turned over as the lid turns over', () => {
  for (const layout of ['x', 'y']) for (const shape of [{}, { shape: 'heart', length: 100, width: 95, cornerRadius: 12, wall: 7, lipWidth: 3 }, { shape: 'poly', sides: 5, flats: 90, cornerRadius: 8 }]) {
    const base = boxPlan(Object.assign({ layout, cut: 'base', grain: true }, shape)).halves[0].at;
    const { plan, gcode } = check(Object.assign({ layout, cut: 'lid', grain: true }, shape));
    const lid = plan.halves[0].at;
    if (layout === 'x') assert.ok(Math.abs(lid.x + base.x) < 1e-9 && Math.abs(lid.y - base.y) < 1e-9, JSON.stringify([base, lid]));
    else assert.ok(Math.abs(lid.y + base.y) < 1e-9 && Math.abs(lid.x - base.x) < 1e-9, JSON.stringify([base, lid]));
    // The lid's board: from that corner (a heart's outline is to 0.02 mm).
    assert.ok(layout === 'x' ? Math.abs(plan.stock.x0 + plan.stock.w) < 0.01 : Math.abs(plan.stock.y0 + plan.stock.h) < 0.01);
    assert.match(gcode, layout === 'x' ? /front-right corner/ : /back-left corner/);
    // The shape the same turned over that way, so the lid lands on the base.
    const S = plan.shape, lp = shapeLoop(S, 0), len = loopLength(lp);
    for (let k = 0; k < 60; k++) {
      const q = loopPoint(lp, len * k / 60);
      assert.ok(Math.abs(shapeDistance(S, 0, layout === 'x' ? -q.x : q.x, layout === 'x' ? q.y : -q.y)) < 0.05);
    }
  }
  // With the origin in the middle of each, the same place.
  assert.deepEqual(boxPlan({ cut: 'lid', grain: true, origin: 'center' }).halves[0].at, { x: 0, y: 0 });
});

test('a nested set: each box inside the one before, all on one board, cut without touching what stays', () => {
  const tune = (i) => autoSizes(i, 'softwood', false);
  for (const shape of [{ diameter: 130 }, { shape: 'rect', length: 160, width: 110, cornerRadius: 12 }, { shape: 'poly', sides: 6, flats: 120, cornerRadius: 8 },
    { shape: 'oval', length: 130, width: 90 }, { shape: 'heart', length: 120, width: 110, cornerRadius: 12 }])
    for (const layout of ['x', 'y']) {
      const input = Object.assign({ stock: 30, bit: 6.35, layout, tabs: { count: 4, width: 9, height: 2 } }, shape);
      const first = Object.assign({}, input, tune(input)); delete first.problems;
      const list = nestInputs(first, 3, 1.5, tune);
      assert.equal(list.length, 3, JSON.stringify(shape));
      const set = setPlan(list, 3);
      for (let i = 1; i < list.length; i++) {
        const outer = set.set[i - 1], inner = set.set[i], d = outer.o.wall + 1.5;
        // Its outline at least the gap inside the one before's inside, and under its lid.
        const lp = shapeLoop(inner.shape, 0), len = loopLength(lp);
        for (let k = 0; k < 90; k++) { const q = loopPoint(lp, len * k / 90); assert.ok(shapeDistance(outer.shape, -d, q.x, q.y) <= 0.02, 'box ' + (i + 1) + ' sticks out'); }
        assert.ok(inner.closedHeight <= outer.insideHeight - 1.5 + 1e-6);
      }
      // The halves apart: outlines at least the gap from each other.
      for (const a of set.halves) for (const b of set.halves) if (a !== b) {
        const lp = shapeLoop(a.plan.shape, 0), len = loopLength(lp);
        let near = Infinity;
        for (let k = 0; k < 90; k++) { const q = loopPoint(lp, len * k / 90); near = Math.min(near, shapeDistance(b.plan.shape, 0, q.x + a.at.x - b.at.x, q.y + a.at.y - b.at.y)); }
        assert.ok(near >= set.o.gap - 0.05, a.label + ' and ' + b.label + ' ' + near);
      }
      // On the stock, a margin round them.
      if (layout === 'x') check(set);
      assert.match(boxProgram(set, FEEDS).gcode, /\(Box 3: /);
    }
  // Too many: as many as fit, and said.
  const small = setPlan(nestInputs({ diameter: 60 }, 5, 1.5), 5);
  assert.ok(small.set.length < 5 && small.problems.some((p) => /boxes fit inside each other/.test(p)));
});

test('nested sets after the review: refitted after Auto Sizes, clear of floor corners, notch below a faced base, no Auto Sizes needed', () => {
  const fitsIn = (outer, inner, d) => {
    const lp = shapeLoop(inner.shape, 0), len = loopLength(lp);
    let worst = -Infinity;
    for (let k = 0; k < 400; k++) { const q = loopPoint(lp, len * k / 400); worst = Math.max(worst, shapeDistance(outer.shape, -d, q.x, q.y)); }
    return worst;
  };
  // A heart whose point Auto Sizes rounds more after it was fitted.
  for (const gap of [0.5, 1.5]) for (const sh of [{ length: 120, width: 150, cornerRadius: 4 }, { length: 150, width: 150, cornerRadius: 10 }]) {
    const tune = (i) => autoSizes(i, 'hardwood', false);
    const input = Object.assign({ shape: 'heart', layout: 'y', stock: 40, bit: 6.35 }, sh), first = Object.assign({}, input, tune(input));
    delete first.problems;
    const set = setPlan(nestInputs(first, 5, gap, tune), 5);
    for (let i = 1; i < set.set.length; i++) assert.ok(fitsIn(set.set[i - 1], set.set[i], set.set[i - 1].o.wall + gap) <= 0.02, 'box ' + (i + 1) + ' sticks out, gap ' + gap);
  }
  // Rounded floor corners: each box clear of the one before's coves.
  const corners = { diameter: 12.7, radius: 6.35 }, cs = setPlan(nestInputs({ diameter: 150, stock: 40, wall: 8, lipWidth: 4, corners }, 3, 1.5), 3);
  assert.deepEqual(cs.problems, []);
  for (let i = 1; i < 3; i++) assert.ok(fitsIn(cs.set[i - 1], cs.set[i], 8 + 1.5 + 6.35) <= 0.02);
  // The notch: from the faced-down top of a nested box's base.
  const ns = setPlan(nestInputs({ diameter: 160, stock: 40, wall: 14, lipWidth: 4, notch: { width: 16, depth: 4 } }, 3, 1.5), 3);
  for (const p of ns.set) {
    const n = p.halves.find((h) => h.name === 'base').cuts.find((c) => /notch/.test(c.what));
    assert.equal(n.z0, -p.faces.base);
  }
  check(ns);
  // Rectangles, polygons and hearts without Auto Sizes: their corners as round as their lips need.
  for (const sh of [{ shape: 'rect', length: 160, width: 110, cornerRadius: 10 }, { shape: 'poly', sides: 6, flats: 130, cornerRadius: 10 }, { shape: 'heart', length: 140, width: 130, cornerRadius: 12, wall: 7 }]) {
    const set = setPlan(nestInputs(Object.assign({ stock: 40 }, sh), 3, 1.5), 3);
    assert.deepEqual(set.problems, [], JSON.stringify(sh));
  }
  // Test Fit: both halves from one board, even when the box is cut a half at a time.
  const tf = boxPlan(testFitInput(boxPlan({ cut: 'lid', grain: true, lidStock: 12 }).o));
  assert.deepEqual(tf.halves.map((h) => h.name), ['base', 'lid']);
});

test('the finishing pass by material: conventional in wood, climb in plastics and aluminum', () => {
  const { finishFor } = require('../lib/box-plan.cjs');
  for (const m of ['mdf', 'softwood', 'hardwood', 'foam']) assert.equal(finishFor(m).dir, 'conventional');
  for (const m of ['hdpe', 'acrylic', 'polycarbonate', 'aluminum']) assert.equal(finishFor(m).dir, 'climb');
  for (const m of ['mdf', 'softwood', 'hardwood', 'foam', 'hdpe', 'acrylic', 'polycarbonate', 'aluminum']) assert.ok(finishFor(m).allow > 0 && finishFor(m).allow <= 1);
  assert.deepEqual(finishFor('unknown'), finishFor('softwood'));
  for (const m of ['hardwood', 'acrylic']) check({ finish: finishFor(m).allow, finishDir: finishFor(m).dir });
});

test('magnets: the lip thinner (down to 1/4") rather than the wall twice as thick', () => {
  for (const imperial of [false, true]) {
    const input = { shape: 'rect', length: 152.4, width: 101.6, cornerRadius: 12.7, stock: 31.5, bit: 6.35, magnets: { count: 4, diameter: 7, depth: 2 }, notch: { width: 16, depth: 4 } };
    const a = autoSizes(input, 'hardwood', imperial);
    assert.deepEqual(a.problems, []);
    assert.ok(a.lipWidth >= 6.35 - 1e-9 && a.lipWidth <= a.wall / 2 + 1e-9, JSON.stringify([a.lipWidth, a.wall]));
    assert.ok(a.wall < 16.5, 'wall ' + a.wall);
    const p = boxPlan(Object.assign({}, input, a));
    assert.ok(-p.tRabbet >= 7 + 1.6 - 1e-9);
  }
});

test('a nested set without Auto Sizes: the floor, top and lip lower with each box', () => {
  const set = setPlan(nestInputs({ diameter: 152.4, stock: 31.5, wall: 12.7, floor: 12.7, top: 6.35, lipHeight: 8.73, lipWidth: 4, lipOn: 'lid', bit: 6.35, gap: 15 }, 3, 1.5), 3);
  assert.deepEqual(set.problems, []);
  assert.ok(set.set[1].o.floor < 12.7 && set.set[2].o.lipHeight < set.set[1].o.lipHeight);
  check(set);
});

test('magnet holes narrower than the bit: said, without a thicker wall', () => {
  const input = { shape: 'rect', length: 152.4, width: 101.6, cornerRadius: 12.7, stock: 19.05, magnets: { count: 4, diameter: 5, depth: 3.2 }, notch: { width: 16, depth: 4 } };
  const small = autoSizes(Object.assign({}, input, { bit: 3.175 }), 'hardwood', true);
  assert.deepEqual(small.problems, []);
  const big = autoSizes(Object.assign({}, input, { bit: 6.35 }), 'hardwood', true);
  assert.equal(big.problems.length, 1);
  assert.match(big.problems[0], /Magnet holes must be wider than the bit: use a smaller bit/);
  assert.equal(big.wall, small.wall);
});

test('a Magnet Bit: the holes after a tool change, with the smaller bit', () => {
  const input = { shape: 'rect', length: 152.4, width: 101.6, cornerRadius: 12.7, stock: 19.05, wall: 14, lipWidth: 6.35, bit: 6.35, gap: 20,
    magnets: { count: 4, diameter: 5, depth: 3.2, bit: 3.175 } };
  assert.match(boxPlan(Object.assign({}, input, { magnets: { count: 4, diameter: 5, depth: 3.2 } })).problems.join(), /wider than the bit/);
  assert.match(boxPlan(Object.assign({}, input, { magnets: { count: 4, diameter: 3, depth: 3.2, bit: 3.175 } })).problems.join(), /wider than the Magnet Bit/);
  assert.match(boxPlan(Object.assign({}, input, { magnets: { count: 4, diameter: 5, depth: 3.2, bit: 3.175, drill: true } })).problems.join(), /is a drill/);
  const plan = boxPlan(input);
  assert.deepEqual(plan.problems, []);
  for (const h of plan.halves) {
    assert.ok(!h.cuts.some((c) => /magnet/.test(c.what)));
    assert.equal(plan.magnets[h.name].length, 4);
  }
  const { gcode } = boxProgram(plan, Object.assign({}, FEEDS, { toolNumber: 1, magnets: { toolNumber: 2, feed: 900, plunge: 300, rpm: 18000, delay: 2, doc: 1, stepoverPct: 40 } }));
  const at = gcode.indexOf('M6 T2');
  assert.ok(at > gcode.indexOf('M6 T1') && at > gcode.lastIndexOf('outline'), 'the magnet bit after the box');
  const box = simulate(gcode.slice(0, at)), mag = simulate(gcode.slice(at));
  const half = (p) => plan.halves.reduce((a, b) => Math.hypot(p.x - a.at.x, p.y - a.at.y) <= Math.hypot(p.x - b.at.x, p.y - b.at.y) ? a : b);
  for (const p of box) assert.ok(allowed(plan, half(p), p), 'box bit: ' + JSON.stringify(p));
  let reach = 0, deepest = 0;
  for (const p of mag) {
    if (p.z > -1e-6) continue;
    const h = half(p), meet = (input.lipOn || 'base') === h.name ? plan.lipUp : 0, d = plan.faces[h.name] - p.z;
    const r = Math.min(...plan.magnetAt.map((m) => Math.hypot(p.x - h.at.x - m.dx, p.y - h.at.y - m.dy)));
    assert.ok(r <= 2.5 - 3.175 / 2 + 0.005 && d <= meet + 3.2 + 0.005, 'magnet bit: ' + JSON.stringify(p));
    reach = Math.max(reach, r); deepest = Math.max(deepest, d - meet);
  }
  assert.ok(reach > 2.5 - 3.175 / 2 - 0.05 && deepest > 3.2 - 0.005, JSON.stringify([reach, deepest]));
});

test('review: a drill, a cut on its own board, a nested set that stops at the last box that can be made', () => {
  const input = { shape: 'circle', diameter: 100, stock: 19, bit: 6.35, magnets: { count: 4, diameter: 6, depth: 3, bit: 3.175 } };
  const mill = autoSizes(input, 'hardwood', false), drill = autoSizes(Object.assign({}, input, { magnets: Object.assign({}, input.magnets, { drill: true }) }), 'hardwood', false);
  assert.equal(drill.wall, mill.wall);
  assert.match(drill.problems.join(), /is a drill/);
  assert.equal(autoSizes(Object.assign({}, input, { stock: 12, magnets: { count: 4, diameter: 6, depth: 8 } }), 'hardwood', false).wall < 20, true);
  for (const cut of ['base', 'lid']) assert.ok(!boxPlan({ cut, gap: 8, bit: 6.35 }).problems.some((p) => /Gap/.test(p)), cut);
  assert.match(boxPlan({ gap: 8, bit: 6.35 }).problems.join(), /Gap Between/);
  const rect = { shape: 'rect', length: 140, width: 100, cornerRadius: 12, stock: 19, bit: 6.35, gap: 20, cut: 'both', magnets: { count: 4, diameter: 8, depth: 3 } };
  const tune = (i) => autoSizes(i, 'hardwood', false), first = Object.assign({}, rect, tune(rect));
  delete first.problems;
  const list = nestInputs(first, 3, 4, tune);
  for (const b of list.slice(1)) assert.deepEqual(boxPlan(b).problems, []);
  const set = setPlan(list, 3);
  if (list.length < 3) assert.match(set.problems[0], /^(Only \d+ boxes|No box) fits?/);
  else assert.deepEqual(set.problems, []);
});

test('the finishing pass reaches every wall: round, rectangle, polygon, oval and heart', () => {
  const shapes = [{ shape: 'circle', diameter: 80 }, { shape: 'rect', length: 120, width: 80, cornerRadius: 12 }, { shape: 'poly', sides: 6, flats: 90, cornerRadius: 8 },
    { shape: 'oval', length: 150, width: 100 }, { shape: 'heart', length: 127, width: 120, cornerRadius: 12.7 }];
  for (const sh of shapes) for (const lipOn of ['base', 'lid']) {
    const i = Object.assign({ stock: 25, bit: 3.175, finish: 0.3, lipOn }, sh), a = autoSizes(i, 'hardwood', false);
    delete a.problems;
    const { plan, pts } = check(Object.assign({}, i, a, { lipOn }));
    const rb = plan.o.bit / 2;
    for (const h of plan.halves) {
      const near = (p) => Math.hypot(p.x - h.at.x, p.y - h.at.y) < Math.max(plan.halfX, plan.halfY) + 5;
      const reach = (t, z) => pts.reduce((m, p) => {
        if (!near(p) || p.z >= z || p.rapid) return m;
        const d = shapeDistance(h.plan.shape, t, p.x - h.at.x, p.y - h.at.y);
        return d <= 0.01 && d > m ? d : m;
      }, -Infinity);
      const withLip = lipOn === h.name, top = -plan.faces[h.name];
      assert.ok(reach(plan.tInside - rb, top - plan.rabbetDepth - 1) > -0.02, sh.shape + ' ' + h.name + ' inside');
      if (!withLip) assert.ok(reach(plan.tRabbet - rb, top - 0.05) > -0.02, sh.shape + ' ' + h.name + ' opening');
    }
  }
});

test('finishing: the step floors roughed short, skimmed after all the roughing, then the walls\' laps', () => {
  for (const sh of [{ shape: 'circle', diameter: 80 }, { shape: 'heart', length: 127, width: 120, cornerRadius: 12.7 }]) {
    const i = Object.assign({ stock: 25, bit: 3.175, finish: 0.3 }, sh), a = autoSizes(i, 'hardwood', false);
    delete a.problems;
    const { plan, gcode } = check(Object.assign({}, i, a));
    const lines = gcode.split('\n'), at = (re) => lines.findIndex((l) => re.test(l));
    for (const h of plan.halves) {
      const H = h.label.charAt(0).toUpperCase() + h.label.slice(1), withLip = (plan.o.lipOn === h.name);
      const step = withLip ? 'shoulder round the lip' : 'opening widened for the lip';
      const rough = at(new RegExp('^\\(' + H + ': ' + step + '\\)')), skim = at(new RegExp('^\\(' + H + ': ' + step + ': its floor skimmed'));
      const lastRough = Math.max(...h.cuts.map((c) => at(new RegExp('^\\(' + H + ': ' + c.what + '\\)'))));
      const laps = h.cuts.filter((c) => c.finish).map((c) => at(new RegExp('^\\(' + H + ': ' + c.what + ': finishing lap')));
      assert.ok(rough >= 0 && skim > lastRough && laps.every((l) => l > skim), H + ' ' + JSON.stringify([rough, lastRough, skim, laps]));
      // The step's roughing stops the allowance over its floor; the skim reaches it.
      const floorZ = -plan.faces[h.name] - (withLip ? plan.lipUp : plan.rabbetDepth);
      const deepest = (from, to) => Math.min(...simulate(lines.slice(from, to).join('\n').replace(/^/, 'G0 Z5\n')).map((p) => p.z));
      assert.ok(Math.abs(deepest(rough + 1, rough + 1 + lines.slice(rough + 1).findIndex((l) => /^\(/.test(l))) - (floorZ + 0.3)) < 1e-3, H + ' rough floor');
      assert.ok(Math.abs(deepest(skim + 1, skim + 1 + lines.slice(skim + 1).findIndex((l) => /^\(/.test(l))) - floorZ) < 1e-3, H + ' skimmed floor');
    }
  }
});

test('drawings: an SVG file\'s outline read in mm, the biggest closed shape kept', () => {
  const { svgOutline } = require('../lib/box-drawing.cjs');
  const r = svgOutline('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297"><g transform="translate(10,20)"><rect width="100" height="60" rx="5"/></g><circle cx="5" cy="5" r="2"/><defs><rect width="999" height="999"/></defs></svg>');
  assert.deepEqual([r.size.w, r.size.h, r.sized, r.others], [100, 60, true, 1]);
  const inches = svgOutline('<svg width="4in" height="3in" viewBox="0 0 400 300"><polygon points="0,0 400,0 400,300 200,150 0,300"/><path d="M0 0 L10 10"/></svg>');
  assert.deepEqual([+inches.size.w.toFixed(3), +inches.size.h.toFixed(3), inches.open, inches.pts.length], [101.6, 76.2, 1, 10]);
  // Up the page is to the back: the notch at the top of the page is at +Y.
  assert.ok(inches.pts.some((v, i) => i % 2 === 1 && Math.abs(v) < 1e-6));
  const px = svgOutline('<svg><path d="M100,180 C 20,120 0,80 30,40 A40 40 0 0 1 100 60 a40,40 0 01 70-20 C200 80 180 120 100 180z"/></svg>');
  assert.equal(px.sized, false);
  assert.match(svgOutline('<svg><line x1="0" y1="0" x2="1" y2="1"/></svg>').problem, /no closed shape/);
  assert.match(svgOutline('<svg><path d="M0 0 L x"/></svg>').problem, /Couldn't read/);
  assert.match(svgOutline('not a drawing').problem, /No shapes/);
});

// A lopsided outline with an inside corner, as a drawing (+Y down the page).
const LOPSIDED = '<svg width="120mm" height="90mm" viewBox="0 0 120 90"><path d="M0 90 H120 V40 H70 L40 0 L0 20 Z"/></svg>';
test('drawings: cut without touching what stays, the lid mirrored to land on the base', () => {
  const { svgOutline } = require('../lib/box-drawing.cjs');
  const outline = { name: 'lopsided.svg', pts: svgOutline(LOPSIDED).pts };
  for (const [layout, lipOn] of [['x', 'base'], ['y', 'lid']]) {
    const input = { shape: 'custom', outline, length: 120, width: 90, layout, lipOn, stock: 25, finish: 0.3,
      magnets: { count: 5, diameter: 6.35, depth: 3.2 }, notch: { width: 14, depth: 4 } };
    const sizes = autoSizes(input, 'hardwood', false);
    assert.deepEqual(sizes.problems, []);
    const { plan, pts } = check(Object.assign({}, input, sizes));
    const [base, lid] = plan.halves, rb = plan.o.bit / 2;
    assert.ok(base.shape.inside && base.shape.cr >= plan.o.wall - plan.o.lipWidth - plan.o.clearance + rb - 1e-9);
    // Turned over across the line between the halves, the lid's outline and
    // magnet holes are the base's.
    const flip = layout === 'y' ? (p) => ({ x: p.x, y: -p.y }) : (p) => ({ x: -p.x, y: p.y });
    const out = shapeLoop(base.shape, 0), len = loopLength(out);
    for (let k = 0; k < 120; k++) { const q = flip(loopPoint(out, len * k / 120)); assert.ok(Math.abs(shapeDistance(lid.shape, 0, q.x, q.y)) < 0.03, 'the lid isn\'t the base turned over'); }
    assert.ok(Math.abs(shapeDistance(base.shape, 0, ...Object.values(flip(loopPoint(out, len / 3))))) > 1, 'the drawing is lopsided');
    for (const m of lid.magnetAt) { const q = flip({ x: m.dx, y: m.dy }); assert.ok(base.magnetAt.some((b) => Math.hypot(b.dx - q.x, b.dy - q.y) < 1e-6), 'magnets don\'t meet'); }
    // The notch on the outline at the front.
    assert.ok(Math.abs(shapeDistance(base.shape, 0, plan.notch.dx, plan.notch.dy)) < 0.05);
    // Every floor cleared, each half's own.
    for (const half of plan.halves) {
      const floor = (half.name === 'lid' ? plan.face : 0) + half.height - (half.name === 'lid' ? plan.o.top : plan.o.floor);
      const deep = pts.filter((p) => Math.abs(p.z + floor) < 1e-6);
      for (let qx = plan.ext.minX; qx <= plan.ext.maxX; qx += 1.5) for (let qy = plan.ext.minY; qy <= plan.ext.maxY; qy += 1.5) {
        if (shapeDistance(half.shape, plan.tInside - plan.o.finish, qx, qy) > -0.3) continue;
        let near = Infinity;
        for (const p of deep) { const d = Math.hypot(p.x - half.at.x - qx, p.y - half.at.y - qy); if (d < near) near = d; if (near <= rb) break; }
        assert.ok(near <= rb + 0.35, half.name + ' floor left at ' + qx.toFixed(1) + ',' + qy.toFixed(1) + ' (' + near.toFixed(2) + ')');
      }
    }
    assert.match(boxProgram(plan, FEEDS).gcode, /a drawing 120 x 90mm, corners/);
  }
});

test('drawings: what can\'t be cut is said; Test Fit and nested sets keep its proportions', () => {
  const { svgOutline } = require('../lib/box-drawing.cjs');
  const said = (o, re) => { const p = boxPlan(Object.assign({ shape: 'custom', length: 120, width: 90 }, o)).problems; assert.ok(p.some((x) => re.test(x)), p.join('; ')); };
  said({}, /Open a drawing/);
  said({ outline: { pts: [0, 0, 100, 0, 0, 100, 100, 100] }, cornerRadius: 12 }, /crosses itself/);
  // Two blobs on a 6 mm neck: rounding 8 mm parts them.
  const neck = svgOutline('<svg width="100mm" height="40mm" viewBox="0 0 100 40"><path d="M0 0 H45 V17 H55 V0 H100 V40 H55 V23 H45 V40 H0 Z"/></svg>');
  said({ outline: neck, length: 100, width: 40, cornerRadius: 8 }, /cuts the drawing apart/);
  said({ outline: { pts: svgOutline(LOPSIDED).pts }, wall: 6, lipWidth: 5, cornerRadius: 8 }, /inside corners/);
  const outline = { pts: svgOutline(LOPSIDED).pts };
  const input = Object.assign({ shape: 'custom', outline, length: 160, width: 120, stock: 30, bit: 6.35 });
  const tuned = Object.assign({}, input, autoSizes(input, 'hardwood', false));
  delete tuned.problems;
  const fit = testFitInput(tuned);
  assert.ok(Math.abs(fit.length / fit.width - 4 / 3) < 1e-9 && fit.length < 160);
  check(fit);
  const list = nestInputs(tuned, 2, 1.5, (i) => autoSizes(i, 'hardwood', false));
  assert.equal(list.length, 2);
  const set = setPlan(list, 2), [outer, inner] = set.set;
  const lp = shapeLoop(inner.shape, 0), len = loopLength(lp);
  // Set in it where its outline came from (shift from the outer's middle).
  const { x: sx, y: sy } = inner.o.shift;
  for (let k = 0; k < 200; k++) { const q = loopPoint(lp, len * k / 200); assert.ok(shapeDistance(outer.shape, -(outer.o.wall + 1.5), q.x + sx, q.y + sy) <= 0.03, 'box 2 sticks out'); }
  check(set);
});

test('drawings: a DXF file\'s outline, its arcs and joined pieces, in its units', () => {
  const { drawingOutline } = require('../lib/box-drawing.cjs');
  const dxf = (header, ents) => ['0', 'SECTION', '2', 'HEADER', ...header, '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES', ...ents, '0', 'ENDSEC', '0', 'EOF'].join('\n');
  const ent = (type, g) => ['0', type, ...g.flatMap(([c, v]) => [String(c), String(v)])];
  // 3 x 2 in, its right end a half circle (a bulge of 1): 4 x 2 in.
  const poly = drawingOutline(dxf(['9', '$INSUNITS', '70', '1'], ent('LWPOLYLINE', [[90, 4], [70, 1], [10, 0], [20, 0], [10, 3], [20, 0], [42, 1], [10, 3], [20, 2], [10, 0], [20, 2]])), 'a.dxf');
  assert.deepEqual([+poly.size.w.toFixed(3), +poly.size.h.toFixed(3), poly.sized], [101.6, 50.8, true]);
  // The same from lines and an arc, one line the other way round; a small circle left out.
  const parts = drawingOutline(dxf([], [...ent('LINE', [[10, 0], [20, 0], [11, 3], [21, 0]]), ...ent('ARC', [[10, 3], [20, 1], [40, 1], [50, 270], [51, 90]]),
    ...ent('LINE', [[10, 0], [20, 2], [11, 3], [21, 2]]), ...ent('LINE', [[10, 0], [20, 2], [11, 0], [21, 0]]), ...ent('CIRCLE', [[10, 50], [20, 50], [40, 0.2]])]), 'b.dxf');
  assert.deepEqual([+parts.size.w.toFixed(3), +parts.size.h.toFixed(3), parts.sized, parts.others], [4, 2, false, 1]);
  // As a box: the half circle's end is round, the other end square but for the Corner Radius.
  const plan = boxPlan(Object.assign({ shape: 'custom', outline: { pts: poly.pts }, length: 101.6, width: 50.8, stock: 20 }, (() => { const a = autoSizes({ shape: 'custom', outline: { pts: poly.pts }, length: 101.6, width: 50.8, stock: 20 }, 'mdf', false); delete a.problems; return a; })()));
  assert.deepEqual(plan.problems, []);
  assert.ok(Math.abs(shapeDistance(plan.shape, 0, 50.8, 0)) < 0.05 && Math.abs(shapeDistance(plan.shape, 0, 25.4, 25.4)) < 0.05);
  assert.match(drawingOutline(dxf([], ent('LINE', [[10, 0], [20, 0], [11, 3], [21, 0]])), 'e.dxf').problem, /no closed shape/);
  assert.match(drawingOutline('AutoCAD Binary DXF\r\n\x1a\x00', 'f.dxf').problem, /binary DXF/);
});

test('the opening is the Lip Height deep; the lip stands the Clearance lower, so the halves close on the shoulder', () => {
  for (const lipOn of ['base', 'lid']) {
    const { plan, pts } = check({ lipOn, lipHeight: 5, clearance: 0.3, wall: 10, gap: 14 });
    const withLip = plan.halves.find((h) => h.name === lipOn), without = plan.halves.find((h) => h.name !== lipOn);
    const opening = without.cuts.find((c) => /opening widened/.test(c.what)), shoulder = withLip.cuts.find((c) => /shoulder/.test(c.what));
    assert.equal(opening.depth, 5);
    assert.ok(Math.abs(shoulder.depth - 4.7) < 1e-9);
    // Cut that deep, no deeper.
    const deepest = (h, t) => Math.max(...pts.filter((p) => Math.abs(p.x - h.at.x) < 1e3 && shapeDistance(h.shape, t, p.x - h.at.x, p.y - h.at.y) > 0.1 && shapeDistance(h.shape, 0, p.x - h.at.x, p.y - h.at.y) < -0.1).map((p) => -p.z - plan.faces[h.name]));
    assert.ok(Math.abs(deepest(withLip, plan.tLip) - 4.7) < 1e-6, lipOn + " " + deepest(withLip, plan.tLip));
    assert.ok(Math.abs(plan.closedHeight - (plan.baseHeight + plan.lidHeight - 4.7)) < 1e-9);
  }
  assert.ok(boxPlan({ lipHeight: 0.6, clearance: 0.2 }).problems.some((p) => /at least 0.5 mm more than the Clearance/.test(p)));
});

test('review fixes: drawings from underneath, rounded drawings centered, holes on the rough shoulder, notch on a hollow front, lines joined fast', () => {
  const { drawingOutline, svgOutline } = require('../lib/box-drawing.cjs');
  const dxf = (ents) => ['0', 'SECTION', '2', 'ENTITIES', ...ents, '0', 'ENDSEC', '0', 'EOF'].join('\n');
  const ent = (type, g) => ['0', type, ...g.flatMap(([c, v]) => [String(c), String(v)])];
  // A 100 x 60 rounded rectangle, its arcs written from underneath (X the other way).
  const down = [[210, 0], [220, 0], [230, -1]], L = (x0, y0, x1, y1) => ent('LINE', [[10, x0], [20, y0], [11, x1], [21, y1]]);
  const arc = (cx, cy, a0, a1) => ent('ARC', [[10, -cx], [20, cy], [40, 10], [50, 180 - a1], [51, 180 - a0], ...down]);
  const rr = drawingOutline(dxf([...L(10, 0, 90, 0), ...arc(90, 10, 270, 360), ...L(100, 10, 100, 50), ...arc(90, 50, 0, 90), ...L(90, 60, 10, 60), ...arc(10, 50, 90, 180), ...L(0, 50, 0, 10), ...arc(10, 10, 180, 270)]), 'r.dxf');
  assert.deepEqual([+rr.size.w.toFixed(3), +rr.size.h.toFixed(3)], [100, 60]);
  // A closed polyline from underneath: mirrored back (its notch on the right, as drawn).
  const pl = drawingOutline(dxf(ent('LWPOLYLINE', [[90, 5], [70, 1], [10, 0], [20, 0], [10, -100], [20, 0], [10, -100], [20, 60], [10, -60], [20, 30], [10, 0], [20, 60], ...down])), 'p.dxf');
  const notchAt = pl.pts.findIndex((v, i) => i % 2 === 1 && Math.abs(v) < 1e-6);
  assert.ok(pl.pts[notchAt - 1] > 0, 'mirrored');
  // A right triangle rounded: still Length x Width about the middle, the lid on the stock.
  const tri = { shape: 'custom', outline: { pts: [0, 0, 100, 0, 0, 100] }, length: 150, width: 150, cornerRadius: 15, wall: 10, lipWidth: 3, gap: 12 };
  const tp = boxPlan(tri);
  assert.deepEqual(tp.problems, []);
  assert.ok(Math.abs(tp.ext.maxX - 75) < 0.05 && Math.abs(tp.ext.minX + 75) < 0.05 && Math.abs(tp.ext.minY + 75) < 0.05);
  for (const h of tp.halves) {
    const lp = shapeLoop(h.shape, plan0(tp) + tp.o.bit / 2);
    for (let k = 0; k < 200; k++) { const q = loopPoint(lp, loopLength(lp) * k / 200); assert.ok(q.x + h.at.x >= tp.stock.x0 - 1e-6 && q.x + h.at.x <= tp.stock.x0 + tp.stock.w + 1e-6, h.name + ' off the stock'); }
  }
  check(tri);
  // Magnet holes in the half with the lip start on the shoulder as roughed.
  const mp = boxPlan({ finish: 0.5, magnets: { count: 3, diameter: 6.35, depth: 3 }, wall: 12, lipWidth: 3, gap: 14 });
  const base = mp.halves[0], hole = base.cuts.find((c) => /magnet/.test(c.what)), sh = base.cuts.find((c) => /shoulder/.test(c.what));
  assert.ok(Math.abs(hole.z0 - (sh.z0 - (sh.depth - 0.5))) < 1e-9 && Math.abs(hole.z0 - hole.depth - (-mp.lipUp - 3)) < 1e-9);
  check(mp);
  // A U open to the front: the notch on its outline, in the hollow.
  const u = svgOutline('<svg width="160mm" height="120mm" viewBox="0 0 160 120"><path d="M0 0 H160 V120 H88 V50 H72 V120 H0 Z"/></svg>');
  const up = boxPlan({ shape: 'custom', outline: u, length: 160, width: 120, notch: { width: 12, depth: 3 }, cornerRadius: 6 });
  assert.ok(Math.abs(shapeDistance(up.shape, 0, up.notch.dx, up.notch.dy)) < 0.05, 'notch off the outline');
  // An SVG of loose lines, and 10,000 shuffled DXF lines, joined.
  assert.equal(svgOutline('<svg width="10mm" height="10mm" viewBox="0 0 10 10"><line x1="0" y1="0" x2="10" y2="0"/><line x1="10" y1="10" x2="10" y2="0"/><path d="M10 10 L0 10"/><line x1="0" y1="10" x2="0" y2="0"/></svg>').size.w, 10);
  const lines = [];
  for (let k = 0; k < 10000; k++) { const a = 2 * Math.PI * k / 10000, b = 2 * Math.PI * (k + 1) / 10000; lines.push(L(50 * Math.cos(a), 50 * Math.sin(a), 50 * Math.cos(b), 50 * Math.sin(b))); }
  for (let k = lines.length - 1; k > 0; k--) { const j = Math.floor(((k * 7919) % 10007) / 10007 * (k + 1)); [lines[k], lines[j]] = [lines[j], lines[k]]; }
  const t = Date.now(), big = drawingOutline(dxf(lines.flat()), 'c.dxf');
  assert.ok(Math.abs(big.size.w - 100) < 0.01 && Date.now() - t < 1500, 'joined in ' + (Date.now() - t) + ' ms');
});
function plan0() { return 0; }

test('a sloped lip: the V-bit slopes the lip and the opening alike, cutting nothing that stays', () => {
  const EF = { toolNumber: 5, feed: 1000, plunge: 300, rpm: 16000, delay: 2, doc: 1.5 };
  for (const lipOn of ['base', 'lid']) for (const shape of [{}, { shape: 'rect', length: 130, width: 90, cornerRadius: 16 }, { shape: 'heart', length: 120, width: 110, cornerRadius: 14 }]) {
    for (const edges of [{ bit: 'v', angle: 90, diameter: 12.7, vtip: 0.3, outside: 0, inside: 1.5, pocket: 0, slope: true }, { bit: 'v', angle: 60, diameter: 12.7, outside: 1, inside: 0, pocket: 0.5, slope: true }]) {
      const input = Object.assign({ lipOn, wall: 14, lipWidth: 8, lipHeight: 5, lidHeight: lipOn === 'lid' ? 16 - 4.8 : 16, finish: 0.3, edges }, shape);
      const { plan } = check(input);
      const slant = Math.tan(edges.angle * Math.PI / 360), tip = (edges.vtip || 0) / 2;
      assert.ok(Math.abs(plan.slope - slant) < 1e-12 && Math.abs(plan.tOpen - (plan.tRabbet - plan.rabbetDepth * slant)) < 1e-12);
      const lipHalf = lipOn, rabHalf = lipOn === 'lid' ? 'base' : 'lid';
      // No lead-in with a sloped lip: the slopes take its place.
      assert.ok(!plan.edges[lipHalf].some((e) => /lip's outer edge/.test(e.what)) && !plan.edges[rabHalf].some((e) => /opening edge/.test(e.what)));
      const lipE = plan.edges[lipHalf].find((e) => /sloped side/.test(e.what)), openE = plan.edges[rabHalf].find((e) => /sloped wall/.test(e.what));
      assert.ok(lipE && openE, 'both slopes');
      // Closed, the gap is the Clearance all the way down: the lip h above
      // its shoulder, the opening h below its rim.
      for (const h of [0, 1, 2.5, plan.lipUp]) {
        const lipAt = lipE.at - h * slant, openAt = openE.at + (openE.depth - h) * slant;
        assert.ok(Math.abs(openAt - lipAt - plan.o.clearance) < 1e-9, 'gap at ' + h);
      }
      const gcode = boxProgram(plan, Object.assign({}, FEEDS, { edges: EF }), 'edges').gcode;
      checkEdges(plan, gcode);
      // The V-bit's cone, its tip at each point, clear of what stays: the
      // lip inside its sloped face, the rim outside the opening's, and
      // nothing below the shoulder or the opening's floor.
      for (const p of simulate(gcode).filter((q) => q.z < 0)) {
        // The half it's on (its edges are inside its outline).
        const near = (h) => shapeDistance(h.shape || plan.shape, 0, p.x - h.at.x, p.y - h.at.y);
        for (const half of [plan.halves.reduce((a, b) => near(a) <= near(b) ? a : b)]) {
          const S = half.shape || plan.shape, px = p.x - half.at.x, py = p.y - half.at.y, top = -plan.faces[half.name];
          // An outline's loops are straight lines kept to 0.02 mm of its curve.
          const tol = S.kind === 'outline' ? 0.03 : 0.01;
          for (let z = 0; z <= 6.35 / slant; z += 0.25) {
            const lvl = p.z + z, r = Math.min(tip + z * slant, 6.35), d = top - lvl;
            if (d < -1e-9) break;
            // (The Inside Rim's bit chamfers the lip from inside: not this.)
            if (half.name === lipHalf && d <= plan.lipUp && shapeDistance(S, plan.tInside, px, py) > 0.05) assert.ok(shapeDistance(S, plan.tLip - (plan.lipUp - d) * slant, px, py) >= r - tol, 'into the lip: ' + JSON.stringify(p));
            // (The outside seam's bit chamfers the rim from outside: not this.)
            if (half.name === rabHalf && d <= plan.rabbetDepth && shapeDistance(S, plan.tRabbet, px, py) < -0.05) assert.ok(-shapeDistance(S, plan.tRabbet - d * slant, px, py) >= r - tol, 'into the rim: ' + JSON.stringify(p));
          }
        }
      }
    }
  }
});

test('a sloped lip that doesn\'t fit says why; Auto Sizes and Test Fit keep it', () => {
  const V = { bit: 'v', angle: 90, diameter: 12.7, outside: 0, inside: 0, pocket: 0, slope: true };
  const said = (input, re) => assert.ok(boxPlan(input).problems.some((p) => re.test(p)), JSON.stringify(boxPlan(input).problems));
  said({ wall: 10, lipWidth: 5, lipHeight: 6, edges: V }, /^Sloped lip: .*needs 1 mm more than the slant/);
  said({ wall: 16, lipWidth: 10, lipHeight: 8, edges: { ...V, diameter: 12.7 } }, /sloped lip needs one/);
  said({ shape: 'rect', length: 120, width: 80, cornerRadius: 4, wall: 12, lipWidth: 7, lipHeight: 5, edges: V }, /sloped lip's slant/);
  // A small V-bit: Auto Sizes lowers the lip to fit it, and says so.
  const small = autoSizes({ stock: 25.4, bit: 6.35, edges: { ...V, diameter: 6.35, vtip: 0.2 } }, 'hardwood', true);
  assert.ok(small.lipForBit && small.lipHeight < 3.2 && small.problems.length === 0, JSON.stringify(small));
  assert.ok(!autoSizes({ stock: 25.4, bit: 6.35, edges: { ...V, angle: 60, diameter: 25.4 } }, 'hardwood', true).lipForBit);
  // A roundover bit has no slope: the lip stays straight.
  assert.equal(boxPlan({ edges: { bit: 'round', radius: 2, tip: 3, outside: 0, inside: 0, slope: true } }).slope, 0);
  for (const shape of [{ diameter: 100 }, { shape: 'rect', length: 150, width: 90 }, { shape: 'oval', length: 160, width: 100 }]) for (const angle of [60, 90]) {
    const input = Object.assign({ stock: 25.4, bit: 6.35, edges: { ...V, angle, vtip: 0.2 } }, shape);
    const a = autoSizes(input, 'hardwood', true);
    assert.deepEqual(a.problems, [], JSON.stringify([input, a]));
    const plan = boxPlan(Object.assign({}, input, a));
    assert.ok(plan.slope > 0 && plan.o.lipWidth - (plan.lipUp + (a.edges.pocket || 0)) * plan.slope >= 1 - 1e-9);
    const tf = boxPlan(testFitInput(Object.assign({}, input, a)));
    assert.deepEqual(tf.problems, []);
    assert.ok(tf.slope > 0 && tf.halves.every((h) => tf.edges[h.name].length === 1), 'Test Fit keeps just the slopes');
  }
});

test('an option switched on that doesn\'t fit: only the sizes it needs change', () => {
  const box = { diameter: 57.15, stock: 19.05, wall: 6.35, lidHeight: 12.7, floor: 4.762, top: 4.762, lipHeight: 6.35, lipWidth: 2.794, clearance: 0.254, bit: 6.35, gap: 15 };
  const V = { bit: 'v', angle: 90, vtip: 0.254, diameter: 25.4, outside: 1, inside: 1.5, pocket: 1 };
  const cases = [
    { ...box, edges: { ...V, slope: true } },
    { ...box, edges: { ...V, outside: 2, pocket: 2 } },
    { ...box, wall: 12, lipWidth: 6, bit: 3.175, gap: 12, magnets: { count: 8, diameter: 6, depth: 3 } },
    { ...box, wall: 10, lipWidth: 4, notch: { width: 30, depth: 4 } },
    { ...box, shape: 'rect', length: 120, width: 80, cornerRadius: 2, edges: { ...V, angle: 60, slope: true } }
  ];
  for (const imperial of [false, true]) for (const input of cases) {
    assert.ok(boxPlan(input).problems.length, 'a case that needs fitting: ' + JSON.stringify(input));
    const r = fitOption(input, imperial);
    assert.deepEqual(r.problems, [], JSON.stringify([input, r]));
    // Never the box's size, wall, stock, bit or Lead-In under a sloped lip.
    for (const key of Object.keys(r.set)) assert.match(key, /^(lipHeight|lipWidth|cornerRadius|edges\.(outside|pocket|inside)|notch\.(width|depth)|magnets\.count)$/);
    if (input.edges && input.edges.slope) assert.ok(!('edges.inside' in r.set));
  }
  // A sloped lip on a thin wall: as thick as the wall leaves room, then lower.
  const r = fitOption(cases[0], false);
  assert.ok(r.set.lipWidth > box.lipWidth && box.wall - r.set.lipWidth - box.clearance >= 1 - 1e-9 && r.set.lipHeight < box.lipHeight, JSON.stringify(r.set));
  // Nothing to fit: nothing changed.
  assert.deepEqual(fitOption({}, false).set, {});
});

test('a sloped top: the lip straight below its Slope Height, the opening narrowed in steps to match', () => {
  const EF = { toolNumber: 5, feed: 1000, plunge: 300, rpm: 16000, delay: 2, doc: 1.5 };
  for (const lipOn of ['base', 'lid']) for (const shape of [{}, { shape: 'rect', length: 130, width: 90, cornerRadius: 16 }]) for (const angle of [60, 90]) {
    const edges = { bit: 'v', angle, diameter: 12.7, vtip: 0.2, outside: 0.5, inside: 1, pocket: 0, slope: true, slopeHeight: 2 };
    const input = Object.assign({ lipOn, wall: 12, lipWidth: 5, lipHeight: 6, clearance: 0.25, lidHeight: lipOn === 'lid' ? 16 - 5.75 : 16, finish: 0.3, edges }, shape);
    const { plan } = check(input);
    const slant = Math.tan(angle * Math.PI / 360), straight = plan.lipUp - 2;
    assert.equal(plan.slopeUp, 2);
    // The steps after the first only round the wall, not the whole inside again.
    const rings = plan.halves.flatMap((h) => h.cuts).filter((c) => /narrowed to the lip's slope/.test(c.what));
    assert.ok(rings.length && rings.every((c) => c.op === 'ring' && c.tOut - c.tIn >= plan.o.bit - 1e-9));
    // The V-bit only chamfers the lip's top; the opening's narrowing is the box bit's.
    const lipHalf = lipOn, rabHalf = lipOn === 'lid' ? 'base' : 'lid';
    assert.deepEqual(plan.edges[lipHalf].map((e) => e.what).filter((w) => /lip's|opening/.test(w)), ["lip's sloped top"]);
    assert.ok(!plan.edges[rabHalf].some((e) => /sloped|opening edge/.test(e.what)));
    // Straight down to where the lip's slope starts (closed), then never
    // closer to the lip than the Clearance, and within a step of it.
    const steps = plan.openSteps;
    assert.ok(Math.abs(steps[0].d1 - straight) < 1e-9 && steps[0].t === plan.tRabbet && Math.abs(steps.at(-1).d1 - plan.rabbetDepth) < 1e-9);
    for (const st of steps.slice(1)) for (const d of [st.d0, (st.d0 + st.d1) / 2, st.d1]) {
      const lip = plan.tLip - Math.max(0, d - straight) * slant, gap = st.t - lip;
      assert.ok(gap >= plan.o.clearance - 1e-9 && gap <= plan.o.clearance + 0.25 * slant + 1e-9, 'gap ' + gap + ' at ' + d);
    }
    checkEdges(plan, boxProgram(plan, Object.assign({}, FEEDS, { edges: EF }), 'edges').gcode);
  }
  // Too short a slope, or (with a V-bit too narrow) said; empty: the whole lip.
  assert.ok(boxPlan({ wall: 12, lipWidth: 5, lipHeight: 6, edges: { bit: 'v', angle: 90, diameter: 12.7, outside: 0, inside: 0, pocket: 0, slope: true, slopeHeight: 0.3 } }).problems.some((p) => /Slope Height/.test(p)));
  assert.equal(boxPlan({ wall: 12, lipWidth: 8, lipHeight: 5, edges: { bit: 'v', angle: 90, diameter: 12.7, outside: 0, inside: 0, pocket: 0, slope: true } }).slopeUp, 5 - 0.2);
  // Fitting a part slope too wide for the lip: the lip thicker, then the slope lower.
  const r = fitOption({ wall: 8, lipWidth: 3, lipHeight: 8, gap: 12, edges: { bit: 'v', angle: 90, diameter: 16, outside: 0, inside: 0, pocket: 0, slope: true, slopeHeight: 7 } }, false);
  assert.deepEqual(r.problems, []);
  assert.ok(r.set.lipWidth > 3 && r.set['edges.slopeHeight'] < 7 && !('lipHeight' in r.set), JSON.stringify(r.set));
});

test('finger notches: a count of them evenly round from a start angle, cut without touching what stays', () => {
  for (const shape of [{}, { shape: 'rect', length: 140, width: 90, cornerRadius: 12 }, { shape: 'oval', length: 150, width: 100 }]) for (const layout of ['x', 'y']) {
    for (const [count, angle] of [[1, 0], [2, 0], [2, 90], [3, 30], [4, 45]]) {
      const input = Object.assign({ wall: 12, layout, notch: { width: 14, depth: 4, count, angle } }, shape);
      const { plan, gcode } = check(input);
      assert.equal(plan.notches.length, count);
      assert.equal((gcode.match(/Base: finger notch/g) || []).length, count);
      const S = plan.shape;
      for (const n of plan.notches) assert.ok(Math.abs(shapeDistance(S, 0, n.dx, n.dy)) < 0.05, 'notch off the outline');
      // The first: the front turned angle degrees counterclockwise.
      const front = layout === 'y' ? Math.PI : -Math.PI / 2, a = Math.atan2(plan.notches[0].dy, plan.notches[0].dx);
      if (S.kind === 'circle') assert.ok(Math.abs(Math.atan2(Math.sin(a - front - angle * Math.PI / 180), Math.cos(a - front - angle * Math.PI / 180))) < 1e-6);
      // Two: opposite each other.
      if (count === 2) assert.ok(Math.hypot(plan.notches[0].dx + plan.notches[1].dx, plan.notches[0].dy + plan.notches[1].dy) < 0.05);
    }
  }
  assert.ok(boxPlan({ wall: 12, notch: { width: 14, depth: 4, count: 5 } }).problems.some((p) => /count must be 1 to 4/.test(p)));
  // Fitted round the magnets: turned so they miss them.
  const mag = { wall: 12, magnets: { count: 4, diameter: 6, depth: 3 } };
  assert.deepEqual(boxPlan({ ...mag, notch: { width: 12, depth: 3, count: 2, angle: 0 } }).problems, []);
  assert.ok(boxPlan({ ...mag, notch: { width: 12, depth: 3, count: 2, angle: 45 } }).problems.some((p) => /runs into a magnet hole/.test(p)));
  // Auto Sizes: a magnet count that misses two notches, not a thicker wall.
  for (const diameter of [60, 76.2]) {
    const a = autoSizes({ diameter, stock: 25.4, bit: 3.175, magnets: { count: 3, diameter: 6.35, depth: 3 }, notch: { width: 16, depth: 4, count: 2, angle: 0 } }, 'walnut', false);
    assert.deepEqual(a.problems, []);
    assert.ok(a.wall < 16 && a.magnets.count % 2 === 0, JSON.stringify(a));
  }
  // Switched on with Auto Sizes off: the magnets turned, not the notch narrowed.
  const two = { ...mag, magnets: { ...mag.magnets, count: 3 }, notch: { width: 14, depth: 3, count: 2, angle: 0 } };
  assert.deepEqual(fitOption(two, false).set, { 'magnets.count': 2 });
  // What was wrong before it was switched on is left as it was.
  const before = boxPlan({ ...two, notch: null }).problems.concat(['The finger notch runs into a magnet hole: use fewer magnets, a narrower notch, or turn the notches']);
  assert.deepEqual(fitOption(two, false, before).set, {});
  // Turned toward the lid: no further into the Gap than 1 mm short of it.
  const wide = { diameter: 100, wall: 18, lipWidth: 4, gap: 12, notch: { width: 26, depth: 3, count: 1 } };
  assert.ok(boxPlan({ ...wide, notch: { ...wide.notch, angle: 90 } }).problems.some((p) => /across the Gap/.test(p)));
  assert.deepEqual(boxPlan({ ...wide, notch: { ...wide.notch, angle: 270 } }).problems, []);
  assert.ok(boxPlan({ ...wide, layout: 'y', notch: { ...wide.notch, angle: 270 } }).problems.some((p) => /across the Gap/.test(p)));
  // Too deep: said, its width left as it is.
  assert.ok(!('notch.width' in fitOption({ diameter: 100, wall: 10, lipWidth: 3, stock: 12, floor: 4, notch: { width: 12, depth: 9 } }, false).set));
});

test('a glued-on bottom: the base a ring cut through, the bottom stepped round a plug that fits inside it', () => {
  const shapes = [{}, { shape: 'rect', length: 160, width: 110, cornerRadius: 12 }, { shape: 'rect', length: 140, width: 90, cornerRadius: 30 },
    { shape: 'poly', sides: 6, flats: 110, cornerRadius: 12 }, { shape: 'oval', length: 150, width: 100 }, { shape: 'heart', length: 140, width: 130, cornerRadius: 12 }];
  for (const shape of shapes) for (const lipOn of ['base', 'lid']) for (const layout of ['x', 'y']) {
    const input = Object.assign({ lipOn, layout, wall: 14, lipWidth: 4, finish: lipOn === 'lid' ? 0.3 : 0, bottom: { board: null, step: 2 }, magnets: { count: 4, diameter: 6.35, depth: 3 }, notch: { width: 12, depth: 4, count: 2 } }, shape);
    const { plan, pts, gcode } = check(input);
    assert.deepEqual(plan.halves.map((h) => h.name), ['base', 'lid', 'bottom']);
    const base = plan.halves[0], bottom = plan.halves[2], rb = plan.o.bit / 2;
    // No pocket left in the ring: its inside is a cut through, with tabs.
    assert.ok(!base.cuts.some((c) => c.op === 'pocket' && c.t <= plan.tInside + 1e-9 && !c.shape));
    const through = base.cuts.find((c) => c.op === 'profile');
    assert.ok(through && through.side === 'in' && through.tabs);
    assert.ok(pts.some((p) => Math.abs(p.z + plan.o.stock + plan.o.through) < 1e-6 && shapeDistance(plan.bottom.shape, plan.tInside - rb, p.x - base.at.x, p.y - base.at.y) > -0.05 && shapeDistance(plan.bottom.shape, plan.tInside - rb, p.x - base.at.x, p.y - base.at.y) < 0.05), 'the ring\'s inside goes through');
    // The plug: every point of it inside the hole the bit cuts (its path
    // round, the bit's radius out), the Clearance in from it.
    const plug = shapeLoop(plan.bottom.part.shape, plan.bottom.part.t), len = loopLength(plug);
    const cutPath = shapeLoop(through.shape, through.t - rb), cutLen = loopLength(cutPath), along = [];
    for (let k = 0; k < 2000; k++) along.push(loopPoint(cutPath, cutLen * k / 2000));
    for (const sg of cutPath) along.push(sg.type === 'line' ? { x: sg.x0, y: sg.y0 } : { x: sg.cx + sg.r * Math.cos(sg.a0), y: sg.cy + sg.r * Math.sin(sg.a0) });
    for (let k = 0; k < 200; k++) {
      const q = loopPoint(plug, len * k / 200);
      assert.ok(shapeDistance(through.shape, through.t, q.x, q.y) < 0, 'plug outside the ring\'s inside at ' + JSON.stringify(q));
      // All round it, the Clearance out: cut away (inside the bit's path,
      // or in the bit's reach of it).
      const c = plan.o.clearance - 0.03;
      for (let j = 0; j < 12; j++) {
        const x = q.x + c * Math.cos(j * Math.PI / 6), y = q.y + c * Math.sin(j * Math.PI / 6);
        assert.ok(shapeDistance(through.shape, through.t - rb, x, y) < 0 || along.some((a) => Math.hypot(a.x - x, a.y - y) <= rb + 1e-6),
          'plug less than the Clearance from the ring at ' + JSON.stringify(q) + ' ' + JSON.stringify(shape));
      }
    }
    // The ring's middle is cut free last, after its floors and laps.
    const lines = gcode.split('\n'), freed = lines.findIndex((l) => /Ring: inside cut through/.test(l));
    assert.ok(freed > 0 && !lines.slice(freed).some((l) => /Ring: .*(skimmed|finishing lap)/.test(l)), 'a skim or lap after the ring\'s middle is free');
    // The step is cut all round, out to the outline, at its depth.
    const stepPts = pts.filter((p) => Math.abs(p.z + 2) < 1e-6);
    for (let k = 0; k < 60; k++) {
      const q = loopPoint(shapeLoop(plan.shape, -0.3), loopLength(shapeLoop(plan.shape, -0.3)) * k / 60);
      assert.ok(stepPts.some((p) => Math.hypot(p.x - bottom.at.x - q.x, p.y - bottom.at.y - q.y) <= rb + 0.05), 'the step left standing near the outline');
    }
    assert.ok(Math.abs(plan.closedHeight - (19 + 19 - plan.lipUp + 19 - 2)) < 1e-9);
  }
  // Its own board: cut with Bottom Only; the rest without it.
  const own = { shape: 'rect', length: 200, width: 140, cornerRadius: 16, bit: 6.35, wall: 12, gap: 20, bottom: { board: 6.35, step: 2 } };
  assert.deepEqual(check(own).plan.halves.map((h) => h.name), ['base', 'lid']);
  const only = check({ ...own, cut: 'bottom' });
  assert.deepEqual(only.plan.halves.map((h) => h.name), ['bottom']);
  assert.equal(only.plan.stock.thick, 6.35);
  // Much quicker than pocketing the base.
  const minutes = (i) => boxProgram(boxPlan(i), FEEDS).minutes;
  const withBottom = minutes(own) + minutes({ ...own, cut: 'bottom' });
  assert.ok(withBottom < 0.8 * minutes({ ...own, bottom: null }), withBottom + ' vs ' + minutes({ ...own, bottom: null }));
  // Bottom Only isn't on the Lid Board (left from Lid Only).
  const leftover = boxPlan({ ...own, cut: 'bottom', lidStock: 3 });
  assert.deepEqual(leftover.problems, []);
  assert.ok(Math.abs(leftover.closedHeight - boxPlan(own).closedHeight) < 1e-9);
  // What doesn't fit says why.
  const said = (i, re) => assert.ok(boxPlan(i).problems.some((p) => re.test(p)), JSON.stringify(boxPlan(i).problems));
  said({ bottom: { board: 3, step: 2 } }, /Locating Step/);
  said({ cut: 'bottom' }, /Floor Only needs/);
  said({ bottom: { board: 6, step: 2 }, tabs: { count: 4, width: 6, height: 4.5 } }, /Tabs/);
  said({ bottom: { board: 60, step: 45 } }, /Locating Step must be at least 1 mm less/);
  said({ diameter: 60, wall: 20, lipWidth: 4, tabs: { count: 6, width: 6, height: 1.5 }, bottom: { step: 2 } }, /tabs for the ring's inside/);
  // No tabs: a note, and the middle still cut through.
  const loose = check({ tabs: null, bottom: { step: 2 } }).plan;
  assert.ok(loose.notes.some((n) => /comes loose/.test(n)));
  // A drawing, with an inside corner.
  const { svgOutline } = require('../lib/box-drawing.cjs');
  check({ shape: 'custom', outline: { name: 'lopsided.svg', pts: svgOutline(LOPSIDED).pts }, length: 120, width: 90, stock: 25, wall: 12, lipWidth: 4, bottom: { step: 2 } });
  // Oversize: the bottom's outline further out, its step out to it, the
  // stock longer by twice it; on its own board too.
  for (const layout of ['x', 'y']) for (const shape of [{}, { shape: 'heart', length: 140, width: 130, cornerRadius: 12 }]) {
    const plain = boxPlan({ ...shape, layout, bottom: { step: 2 } }), over = check({ ...shape, layout, bottom: { step: 2, oversize: 2 } });
    const bot = over.plan.halves[2], rbO = over.plan.o.bit / 2;
    assert.equal(bot.outline.t, 2);
    assert.ok(Math.abs((layout === 'x' ? over.plan.stock.w - plain.stock.w : over.plan.stock.h - plain.stock.h) - 4) < 1e-6);
    const at2 = over.pts.filter((p) => Math.abs(p.z + 2) < 1e-6).map((p) => shapeDistance(over.plan.shape, 0, p.x - bot.at.x, p.y - bot.at.y));
    assert.ok(Math.max(...at2) >= 2 + rbO - 0.05, 'the step out to the oversize outline');
  }
  const overOnly = check({ ...own, cut: 'bottom', bottom: { board: 6.35, step: 2, oversize: 3 } }).plan;
  assert.ok(Math.abs(overOnly.stock.w - only.plan.stock.w - 6) < 1e-6);
  said({ bottom: { step: 2, oversize: 12 } }, /Oversize/);
  // A faced base: round the ring only. With the lip on the lid and a bit
  // wider than the opening's step, the facing goes in as far as the
  // step does, so the step isn't plunged into the unfaced middle.
  // (Base Height from the bottom's underside: a ring h high.)
  const ring = (h, step, up) => h + 19 - step - (up || 0);
  check({ baseHeight: ring(15, 2, 3.8), bottom: { step: 2 } });
  const faced = check({ shape: 'rect', length: 300, width: 200, cornerRadius: 12, bit: 6.35, wall: 12, lipWidth: 4, lipOn: 'lid', gap: 20, baseHeight: ring(15, 3), bottom: { step: 3 } }).plan;
  assert.equal(faced.baseHeight, 15);
  const fc = faced.halves[0].cuts, face = fc.find((c) => /faced down/.test(c.what));
  assert.ok(fc.filter((c) => c.op === 'ring' && /opening/.test(c.what)).every((c) => face.tIn <= c.tIn + 1e-9));
  check({ diameter: 200, bit: 3.175, wall: 10, lipWidth: 2, lipOn: 'lid', baseHeight: ring(14, 2), bottom: { step: 2 } });
  // A part slope's steps all go in as far: no slivers under the earlier ones.
  const sloped = boxPlan({ diameter: 200, bit: 3.175, wall: 12, lipWidth: 5, lipHeight: 6, lipOn: 'lid', baseHeight: ring(15, 2), bottom: { step: 2 },
    edges: { bit: 'v', angle: 90, diameter: 12.7, outside: 0, inside: 0, pocket: 0, slope: true, slopeHeight: 3 } });
  assert.equal(new Set(sloped.halves[0].cuts.filter((c) => c.op === 'ring').map((c) => c.tIn)).size, 1);
  check(sloped);
});

const inset0 = { lipOn: 'lid', wall: 12, lipWidth: 3, stock: 25.4, bottom: { board: 6.35, step: 2, style: 'inset', rabbet: 4, recess: 0.5 } };
test('an inset bottom: the ring\'s inside the opening, cut through, a rabbet round it for a panel glued in from below', () => {
  const shapes = [{}, { shape: 'rect', length: 160, width: 110, cornerRadius: 14 }, { shape: 'poly', sides: 6, flats: 110, cornerRadius: 14 },
    { shape: 'oval', length: 150, width: 100 }, { shape: 'heart', length: 150, width: 140, cornerRadius: 14 }];
  for (const shape of shapes) for (const layout of ['x', 'y']) for (const lidStyle of [null, 'plug']) {
    const input = Object.assign({ lipOn: 'lid', layout, lidStyle, wall: 12, lipWidth: 3, stock: 25.4, finish: 0.3, bottom: { board: 6.35, step: 2, style: 'inset', rabbet: 4, recess: 0.5 } }, shape);
    const { plan, pts, gcode } = check(input);
    // The panel is its own board: the ring and the lid here, the panel with Bottom Only.
    assert.deepEqual(plan.halves.map((h) => h.name), ['base', 'lid']);
    const base = plan.halves[0], rb = plan.o.bit / 2, r = plan.bottom.rabbet;
    assert.ok(Math.abs(r.tIn - plan.tRabbet) < 1e-9 && Math.abs(r.tOut - r.tIn - 4) < 1e-9 && Math.abs(r.depth - 6.85) < 1e-9);
    // The rabbet is cut all round, at its depth, out to its edge.
    const rab = pts.filter((p) => Math.abs(p.z + r.depth) < 1e-6 && Math.abs(shapeDistance(plan.bottom.shape, r.tOut - rb, p.x - base.at.x, p.y - base.at.y)) < 0.05);
    const ring = shapeLoop(plan.bottom.shape, r.tOut - rb), rl = loopLength(ring);
    for (let k = 0; k < 40; k++) {
      const q = loopPoint(ring, rl * k / 40);
      assert.ok(rab.some((p) => Math.hypot(p.x - base.at.x - q.x, p.y - base.at.y - q.y) <= 1), 'the rabbet\'s edge cut near ' + JSON.stringify(q) + ' ' + JSON.stringify(shape));
    }
    // The inside goes through, last, held by tabs.
    const through = base.cuts[base.cuts.length - 1];
    assert.ok(through.op === 'profile' && through.side === 'in' && Math.abs(through.t - plan.tRabbet) < 1e-9 && through.tabs);
    assert.ok(pts.some((p) => Math.abs(p.z + plan.o.stock + plan.o.through) < 1e-6 && Math.abs(shapeDistance(plan.bottom.shape, r.tIn - rb, p.x - base.at.x, p.y - base.at.y)) < 0.05));
    // The panel fits the rabbet: inside it, the Clearance in all round.
    const panel = shapeLoop(plan.bottom.part.shape, plan.bottom.part.t), pl = loopLength(panel);
    for (let k = 0; k < 120; k++) {
      const q = loopPoint(panel, pl * k / 120);
      assert.ok(shapeDistance(plan.bottom.shape, r.tOut, q.x, q.y) <= -plan.o.clearance + 0.03, 'the panel outside the rabbet at ' + JSON.stringify(q));
    }
    // A plug lid: nothing cut inside its lip, so the plug is solid.
    const lid = plan.halves[1];
    if (lidStyle === 'plug') assert.ok(!lid.cuts.some((c) => c.op === 'pocket' && !c.shape), 'a pocket in a plug lid');
    // The lip reaches no further than the panel.
    assert.ok(plan.lipUp < plan.baseHeight - r.depth);
    assert.match(gcode, /Inset floor: a panel/);
  }
  // A drawing: the ring is turned over too, so both halves are cut from
  // the mirrored drawing and land as drawn, matching.
  const ell = { shape: 'custom', outline: { pts: [0, 0, 100, 0, 100, 40, 40, 40, 40, 100, 0, 100] }, length: 150, width: 150, cornerRadius: 16, wall: 12, lipWidth: 3, stock: 25.4, lipOn: 'lid', gap: 14 };
  for (const layout of ['x', 'y']) {
    const p = check({ ...ell, layout, bottom: { board: 6.35, step: 2, style: 'inset', rabbet: 4, recess: 0.5 } }).plan;
    const carved = boxPlan({ ...ell, layout });
    assert.deepEqual(p.halves[0].shape, p.halves[1].shape);
    assert.deepEqual(p.halves[0].shape, carved.halves[1].shape, 'the ring cut as the carved lid is, mirrored');
  }
  assert.ok(boxPlan({ ...inset0, grain: true, cut: 'base' }).problems.some((q) => /Grain Match isn't for an Inset Floor/.test(q)));
  // The panel on its own board, with Bottom Only: only its outline.
  const only = check({ lipOn: 'lid', wall: 12, lipWidth: 3, stock: 25.4, bottom: { board: 6.35, step: 2, style: 'inset', rabbet: 4, recess: 0.5 }, cut: 'bottom' });
  assert.deepEqual(only.plan.halves.map((h) => h.name), ['bottom']);
  assert.deepEqual(only.plan.halves[0].cuts, []);
  assert.ok(Math.abs(only.plan.halves[0].outline.t - only.plan.bottom.part.t) < 1e-9);
});

test('an inset bottom says what it can\'t do: the lip on the base, magnets, notches, a sloped lip, a thin wall, a deep lip', () => {
  const inset = { stock: 25.4, wall: 12, lipWidth: 3, lipOn: 'lid', bottom: { board: 6.35, step: 2, style: 'inset', rabbet: 4, recess: 0.5 } };
  const said = (extra, re) => assert.ok(boxPlan({ ...inset, ...extra }).problems.some((p) => re.test(p)), JSON.stringify(extra) + ' ' + JSON.stringify(boxPlan({ ...inset, ...extra }).problems));
  said({ lipOn: 'base' }, /Inset Floor needs the lip on the lid/);
  said({ magnets: { count: 4, diameter: 6.35, depth: 3 } }, /Magnets go in the ring/);
  said({ notch: { width: 14, depth: 4, count: 2 } }, /Finger notches go in the ring/);
  said({ edges: { bit: 'v', angle: 90, diameter: 12.7, vtip: 0.2, outside: 0, inside: 0, pocket: 0, slope: true } }, /Sloped Lip isn/);
  said({ wall: 8 }, /Rabbet Width/);
  said({ lipHeight: 20 }, /Lip Height too deep for the ring/);
  said({ bottom: { ...inset.bottom, board: null } }, /set the Floor Board/);
  // Edges on the ring: left, with a note; the lid's still cut.
  const e = boxPlan({ ...inset, edges: { bit: 'v', angle: 90, diameter: 12.7, vtip: 0.2, outside: 0.5, inside: 1, pocket: 0.5 } });
  assert.deepEqual(e.problems, []);
  assert.ok(e.notes.some((n) => /ring's edges are left/.test(n)) && !e.edges.base.length && e.edges.lid.length);
  // Auto Sizes fits the wall to the rabbet.
  const a = autoSizes({ shape: 'rect', length: 160, width: 110, cornerRadius: 14, stock: 25.4, lipOn: 'lid', bit: 6.35, bottom: inset.bottom }, 'hardwood', false);
  assert.deepEqual(a.problems, []);
  // The closed box's height: the ring and the lid; nothing under the ring.
  const p = boxPlan({ ...inset });
  assert.ok(Math.abs(p.closedHeight - (25.4 + 25.4 - p.lipUp)) < 1e-9 && Math.abs(p.insideHeight - (25.4 - 6.85 + 25.4 - 4 - p.lipUp)) < 1e-9);
});

test('a plug lid: solid, its lip a plug under a flat top; with the lip on the lid only', () => {
  const p = check({ lipOn: 'lid', lidStyle: 'plug', stock: 19, lidStock: 9, cut: 'lid', lipHeight: 5 }).plan;
  assert.deepEqual(p.halves[0].cuts.map((c) => c.what), ['shoulder round the lip']);
  assert.ok(boxPlan({ lipOn: 'base', lidStyle: 'plug' }).problems.some((q) => /Solid Lid needs the lip on the lid/.test(q)));
  assert.ok(boxPlan({ lipOn: 'lid', lidStyle: 'plug', cut: 'lid', lidStock: 5, lipHeight: 4 }).problems.some((q) => /at least 2 mm thicker than the plug/.test(q)));
  // No floor corners or inner lip edge on a solid lid.
  const c = boxPlan({ lipOn: 'lid', lidStyle: 'plug', wall: 10, corners: { diameter: 6.35, radius: 3.175 }, edges: { bit: 'v', angle: 90, diameter: 12.7, vtip: 0.2, outside: 0.5, inside: 1, pocket: 0.5 } });
  assert.deepEqual(c.problems, []);
  assert.ok(!c.corners.lid.length && !c.edges.lid.some((e) => e.u < 0));
  // A deep lip isn't raised to the base's floor (the plug would fill it): said instead.
  const deep = boxPlan({ lipOn: 'lid', lidStyle: 'plug', stock: 19, lipHeight: 16.5, bottom: { board: 6.35, step: 2 } });
  assert.ok(Math.abs(deep.o.lipHeight - 16.5) < 1e-9 && deep.problems.some((q) => /the plug would fill the base/.test(q)), deep.problems.join('; '));
  // Its inside height: the base's, less the plug in it.
  const q = boxPlan({ lipOn: 'lid', lidStyle: 'plug' });
  assert.ok(Math.abs(q.insideHeight - (19 - 4 - q.lipUp)) < 1e-9);
});

test('a drop-in lid: a panel from the Bottom Board flush in a rabbet round the ring\'s top, a notch to lift it', () => {
  const base = { shape: 'rect', length: 200, width: 120, cornerRadius: 12, stock: 19, bit: 6.35, wall: 10, lipWidth: 4, lipOn: 'lid', lidStyle: 'drop', gap: 20,
    bottom: { board: 6.35, step: 2, oversize: 1.5 }, notch: { width: 20, depth: 5 } };
  for (const shape of [{}, { shape: 'circle', diameter: 120 }, { shape: 'oval' }, { shape: 'heart', length: 160, width: 150, cornerRadius: 20 }, { shape: 'poly', sides: 6, flats: 120, cornerRadius: 10 }])
    for (const layout of ['x', 'y']) for (const origin of ['front-left', 'center']) for (const cut of ['both', 'bottom']) {
      const { plan } = check(Object.assign({}, base, shape, { layout, origin, cut }));
      assert.equal(plan.lidStyle, 'drop');
      if (cut === 'both') assert.deepEqual(plan.halves.map((h) => h.name), ['base']);
      else {
        assert.deepEqual(plan.halves.map((h) => h.name).sort(), ['bottom', 'lid']);
        // Both on the board, from the bottom's board.
        assert.equal(plan.stock.thick, 6.35);
        for (const h of plan.halves) assert.ok(h.at.x - plan.stock.x0 > 0 && h.at.y - plan.stock.y0 > 0 && plan.stock.x0 + plan.stock.w - h.at.x > 0 && plan.stock.y0 + plan.stock.h - h.at.y > 0, h.name + ' off the board');
      }
      // Flush: the rabbet as deep as the panel; the panel the Clearance inside it.
      assert.equal(plan.rabbetDepth, 6.35);
      assert.ok(Math.abs(plan.drop.t - plan.tRabbet + o(plan).clearance) < 1e-9 || plan.shape.kind === 'outline');
      assert.ok(Math.abs(plan.closedHeight - (19 + 6.35 - 2)) < 1e-9 && Math.abs(plan.insideHeight - (19 - 2 - 6.35)) < 1e-9);
    }
  // Edges: on the ring only; the panel square.
  const ed = check(Object.assign({}, base, { edges: { bit: 'v', angle: 90, diameter: 12.7, outside: 0.5, inside: 0.5, pocket: 0 } })).plan;
  assert.equal(ed.edges.lid.length, 0);
  assert.ok(ed.edges.base.length >= 2);
  // What it isn't for.
  const said = (x) => boxPlan(Object.assign({}, base, x)).problems.join(' | ');
  assert.match(said({ bottom: { style: 'inset', board: 6.35, rabbet: 3 } }), /Drop-In Lid needs a Glued-On Floor of the Stepped kind/);
  assert.match(said({ bottom: null }), /Drop-In Lid needs a Glued-On Floor/);
  assert.match(said({ bottom: { board: null, step: 2 } }), /cut from the Floor Board/);
  assert.match(said({ magnets: { count: 4, diameter: 8, depth: 3 } }), /Magnets aren.t for a Drop-In Lid/);
  assert.match(said({ lipOn: 'base' }), /needs the lip on the lid/);
  assert.match(said({ cut: 'lid' }), /cut with Floor and Lid/);
  assert.match(said({ wall: 6, lipWidth: 3 }), /fingertip beside the panel/);
  // Measured inside, with a Height: the inside that high.
  const p = boxPlan(outsideInput(Object.assign({}, base, { measure: 'inside', height: 8, notch: null })));
  assert.deepEqual(p.problems, []);
  assert.ok(Math.abs(p.insideHeight - 8) < 1e-9, p.insideHeight);
  // Auto Sizes fits it.
  const a = autoSizes(Object.assign({}, base, { wall: null, lipWidth: null }), 'hardwood');
  assert.deepEqual(a.problems, []);
});
function o(plan) { return plan.o; }

test('a heart\'s, oval\'s or drawing\'s plug and panels follow the ring as cut: the Clearance along the walls, not half the bit more', () => {
  const pts = [-60, -70, 60, -70, 75, 40, 40, 40, 40, 70, -40, 70, -40, 40, -75, 40];
  const shapes = [{ shape: 'heart', length: 160, width: 150, cornerRadius: 20 }, { shape: 'oval', length: 200, width: 100 },
    { shape: 'custom', outline: { pts, w: 150, h: 140, sized: true }, length: 150, width: 140, cornerRadius: 12 }];
  for (const sh of shapes) for (const kind of ['plug', 'inset', 'drop']) {
    const input = Object.assign({ stock: 19, bit: 6.35, wall: 12, lipWidth: 4, gap: 20, lipOn: kind === 'plug' ? 'base' : 'lid', clearance: 0.4,
      bottom: kind === 'inset' ? { style: 'inset', board: 6.35, rabbet: 4 } : { board: 6.35, step: 2 }, lidStyle: kind === 'drop' ? 'drop' : null, tabs: null }, sh);
    const plan = boxPlan(input);
    assert.deepEqual(plan.problems, [], JSON.stringify({ sh: sh.shape, kind }));
    const rb = 3.175;
    // The opening it goes in, and the part, as cut.
    const part = kind === 'drop' ? plan.drop.part : plan.bottom.part;
    const tOpen = kind === 'plug' ? plan.tInside : kind === 'inset' ? plan.bottom.rabbet.tOut : plan.tRabbet;
    const path = shapeLoop(plan.bottom.shape, tOpen - rb), pl = loopLength(path), along = [];
    for (let k = 0; k < 3000; k++) along.push(loopPoint(path, pl * k / 3000));
    const loop = shapeLoop(part.shape, part.t), len = loopLength(loop), gaps = [];
    for (let k = 0; k < 300; k++) {
      const q = loopPoint(loop, len * k / 300);
      // The part's edge is between the bit's path and the wall it cut, rb out from the path.
      gaps.push(rb - Math.min(...along.map((a) => Math.hypot(a.x - q.x, a.y - q.y))));
    }
    gaps.sort((a, b) => a - b);
    assert.ok(gaps[0] >= 0.4 - 0.05, sh.shape + ' ' + kind + ': closest ' + gaps[0]);
    // Along the walls, the Clearance (was half the bit more all round).
    assert.ok(gaps[150] <= 0.4 + 0.1, sh.shape + ' ' + kind + ': typical gap ' + gaps[150]);
  }
});

test('compartments: the dividers stay standing, every compartment\'s floor is cleared', () => {
  const rect = { shape: 'rect', length: 150, width: 100, cornerRadius: 10 };
  for (const lipOn of ['base', 'lid']) for (const [rows, cols, height] of [[2, 3, null], [1, 2, null], [3, 1, 8], [2, 2, null]]) for (const extra of [{}, { finish: 0.3 }, { layout: 'y', origin: 'center' }]) {
    const input = Object.assign({}, rect, extra, { lipOn, compartments: { rows, cols, thickness: 6, height } });
    const { plan, pts } = check(input);
    const comp = plan.compartments, base = plan.halves.find((h) => h.name === 'base'), rb = plan.o.bit / 2;
    assert.equal(comp.cells.length, rows * cols);
    assert.equal(comp.height, height || base.height - plan.o.floor - (lipOn === 'lid' ? plan.rabbetDepth : 0));
    // Each compartment's floor, cleared all over.
    const floorZ = -(base.height - plan.o.floor);
    const deep = pts.filter((p) => Math.abs(p.z - floorZ) < 1e-6);
    for (const c of comp.cells) for (let qx = -c.shape.hx + 0.5; qx <= c.shape.hx - 0.5; qx += 1.5) for (let qy = -c.shape.hy + 0.5; qy <= c.shape.hy - 0.5; qy += 1.5) {
      if (shapeDistance(c.shape, 0, qx, qy) > -0.3) continue;
      const x = base.at.x + c.dx + qx, y = base.at.y + c.dy + qy;
      assert.ok(deep.some((p) => Math.hypot(p.x - x, p.y - y) <= rb + 0.3), 'compartment floor left at ' + qx + ',' + qy + ' ' + JSON.stringify(input));
    }
    // The dividers' middle line: nothing below their top.
    const top = -comp.top;
    for (const p of pts) {
      const px = p.x - base.at.x, py = p.y - base.at.y;
      if (shapeDistance(plan.shape, plan.tInside, px, py) > 0) continue;
      const inDivider = comp.cells.every((c) => shapeDistance(c.shape, 0, px - c.dx, py - c.dy) > rb + 0.05);
      if (inDivider) assert.ok(p.z >= top - 1e-6, 'divider cut at ' + JSON.stringify(p));
    }
  }
});

test('compartments: what doesn\'t fit says why', () => {
  const rect = { shape: 'rect', length: 150, width: 100, cornerRadius: 10 };
  const said = (o, re) => assert.ok(boxPlan(o).problems.some((p) => re.test(p)), JSON.stringify(o) + ' ' + boxPlan(o).problems);
  said(Object.assign({}, rect, { compartments: { rows: 1, cols: 12, thickness: 10 } }), /the bit needs at least/);
  said(Object.assign({}, rect, { compartments: { rows: 2, cols: 2, thickness: 0.5 } }), /Divider Thickness must be at least 1 mm/);
  said(Object.assign({}, rect, { compartments: { rows: 2, cols: 2, thickness: 6, height: 40 } }), /Divider Height can be at most/);
  said(Object.assign({}, rect, { bottom: { board: 6.35, step: 2, oversize: 1.5 }, compartments: { rows: 2, cols: 2, thickness: 6 } }), /need the base's own floor/);
  said({ compartments: { rows: 2, cols: 2, thickness: 6 } }, /only a rectangle/);
  said(Object.assign({}, rect, { corners: { diameter: 6.35, radius: 3.175 }, compartments: { rows: 2, cols: 2, thickness: 6 } }), /rounded floor corners/);
  assert.equal(boxPlan(Object.assign({}, rect, { compartments: { rows: 1, cols: 1, thickness: 6 } })).compartments, null);
  // An Inside Rim chamfer: full dividers stop below it.
  const ed = boxPlan(Object.assign({}, rect, { edges: { bit: 'v', angle: 90, diameter: 12.7, outside: 0, inside: 0, pocket: 1 }, compartments: { rows: 1, cols: 2, thickness: 6 } }));
  assert.deepEqual(ed.problems, []);
  assert.equal(ed.compartments.top, 1);
});
