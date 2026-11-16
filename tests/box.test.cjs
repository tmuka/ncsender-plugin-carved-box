// The box's program, run through a small G-code simulator: where the
// bit's center goes, at what depth, against what must be left standing.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { boxPlan, testFitInput, BOX_DEFAULTS } = require('../lib/box-plan.cjs');
const { boxProgram } = require('../lib/box-gcode.cjs');

const FEEDS = { feed: 1500, plunge: 400, rpm: 18000, delay: 2, doc: 2, stepoverPct: 40, toolNumber: 0 };

// The bit center's path, sampled every half mm or so: { x, y, z, rapid }
// (rapid: a G0 that moves sideways or goes down; a G0 straight up is a lift).
function simulate(gcode) {
  const pts = [];
  let x = 0, y = 0, z = 5;
  for (const raw of gcode.split('\n')) {
    const line = raw.split(';')[0].trim();
    if (!line || line[0] === '(' || /G53/.test(line)) continue;
    const w = {};
    for (const m of line.matchAll(/([A-Z])(-?[\d.]+)/g)) w[m[1]] = +m[2];
    const g = w.G;
    const nx = w.X ?? x, ny = w.Y ?? y, nz = w.Z ?? z;
    if (g === 0 || g === 1) {
      const n = Math.max(1, Math.ceil(Math.hypot(nx - x, ny - y, nz - z) / 0.5));
      const rapid = g === 0 && (nx !== x || ny !== y || nz < z);
      for (let k = 1; k <= n; k++) pts.push({ x: x + (nx - x) * k / n, y: y + (ny - y) * k / n, z: z + (nz - z) * k / n, rapid });
    } else if (g === 2 || g === 3) {
      const cx = x + w.I, cy = y + w.J, r = Math.hypot(x - cx, y - cy);
      let a0 = Math.atan2(y - cy, x - cx), a1 = Math.atan2(ny - cy, nx - cx);
      if (g === 3 && a1 <= a0 + 1e-9) a1 += 2 * Math.PI;
      const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / 0.5));
      for (let k = 1; k <= n; k++) {
        const a = a0 + (a1 - a0) * k / n;
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), z: z + (nz - z) * k / n, rapid: false });
      }
    }
    x = nx; y = ny; z = nz;
  }
  return pts;
}

// Is the bit's center at p allowed, near this half? (What must be left:
// the wall, the lip, the floor or top, the tabs, round magnet holes and
// the notch.)
function allowed(plan, half, p) {
  const o = plan.o, rb = o.bit / 2;
  // eps: the program's coordinates are to 0.001 mm, arc centers too.
  const eps = 0.005;
  const top = half.name === 'lid' ? -plan.face : 0, d = top - p.z;
  const dist = Math.hypot(p.x - half.at.x, p.y - half.at.y);
  if (-p.z <= eps) return true;
  // A lid lower than the stock: its area faced down first.
  if (half.name === 'lid' && plan.face > 0 && -p.z <= plan.face + eps && dist <= plan.R + rb + eps) return true;
  if (dist >= plan.R + rb - eps) return d <= half.outline.depth + eps;
  const withLip = (o.lipOn === 'lid') === (half.name === 'lid');
  const floor = half.height - (half.name === 'lid' ? o.top : o.floor), meet = withLip ? o.lipHeight : 0;
  if (dist <= plan.Ri - rb + eps && d <= floor + eps) return true;
  if (withLip && dist >= plan.Ri + o.lipWidth + rb - eps && d <= o.lipHeight + eps) return true;
  if (!withLip && dist <= plan.rabbet - rb + eps && d <= plan.rabbetDepth + eps) return true;
  for (const m of plan.magnetAt) {
    if (Math.hypot(p.x - half.at.x - m.dx, p.y - half.at.y - m.dy) <= o.magnets.diameter / 2 - rb + eps && d <= meet + o.magnets.depth + eps) return true;
  }
  if (half.name === 'base' && plan.notch) {
    if (Math.hypot(p.x - half.at.x - plan.notch.dx, p.y - half.at.y - plan.notch.dy) <= plan.notch.r - rb + eps && d <= meet + o.notch.depth + eps) return true;
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

test('every floor and the shoulder are cleared all over', () => {
  const { plan, pts } = check({});
  const rb = plan.o.bit / 2;
  for (const half of plan.halves) {
    const floor = (half.name === 'lid' ? plan.face : 0) + half.height - (half.name === 'lid' ? plan.o.top : plan.o.floor);
    const deep = pts.filter((p) => Math.abs(p.z + floor) < 1e-6 && Math.hypot(p.x - half.at.x, p.y - half.at.y) < plan.Ri);
    for (let r = 0; r < plan.Ri - 0.2; r += 1) for (let a = 0; a < 2 * Math.PI; a += 0.3) {
      const q = { x: half.at.x + r * Math.cos(a), y: half.at.y + r * Math.sin(a) };
      const near = Math.min(...deep.map((p) => Math.hypot(p.x - q.x, p.y - q.y)));
      assert.ok(near <= rb + 0.3, half.name + ' floor left at r=' + r.toFixed(1));
    }
  }
});

test('the tabs stay standing, and the outline goes through', () => {
  const { plan, pts } = check({});
  const o = plan.o, rb = o.bit / 2, pr = plan.R + rb;
  for (const half of plan.halves) {
    const tabTop = half.outline.z0 - (half.outline.depth - o.tabs.height);
    const ring = pts.filter((p) => Math.abs(Math.hypot(p.x - half.at.x, p.y - half.at.y) - pr) < 1e-3);
    assert.ok(ring.some((p) => Math.abs(p.z - (half.outline.z0 - half.outline.depth)) < 1e-6), half.name + ' cut through');
    for (let k = 0; k < o.tabs.count; k++) {
      const c = Math.PI / 4 + 2 * Math.PI * k / o.tabs.count;
      const inTab = ring.filter((p) => {
        let a = Math.atan2(p.y - half.at.y, p.x - half.at.x) - c;
        a = Math.atan2(Math.sin(a), Math.cos(a));
        return Math.abs(a) * pr < o.tabs.width / 2;
      });
      assert.ok(inTab.length > 0 && inTab.every((p) => p.z >= tabTop - 1e-6), half.name + ' tab ' + k + ' cut away');
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
      magnets: { count: 3, diameter: 6.35, depth: 3.2 }, notch: { width: 12, depth: 4 } };
    const { plan, pts } = check(input);
    assert.equal(plan.closedHeight, 19 + 12 - 4);
    // Each magnet hole goes its full depth in both halves.
    for (const half of plan.halves) {
      const meet = (plan.o.lipOn === 'lid') === (half.name === 'lid') ? plan.o.lipHeight : 0;
      const bottom = (half.name === 'lid' ? -plan.face : 0) - meet - 3.2;
      for (const m of plan.magnetAt) {
        assert.ok(pts.some((p) => Math.abs(p.z - bottom) < 1e-6 && Math.hypot(p.x - half.at.x - m.dx, p.y - half.at.y - m.dy) < plan.o.magnets.diameter / 2), half.name + ' magnet hole too shallow');
      }
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
});
