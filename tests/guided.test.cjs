// Guided Setup: every answer path gives a box that fits together.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { autoSizes, boxPlan, outsideInput } = require('../lib/box-plan.cjs');
const { guidedSettings, guidedRecipe, GUIDE_KINDS } = require('../lib/box-guided.cjs');

// The plan's input from the settings, as the dialog makes it (inputOf).
function inputOf(v, stock, bit) {
  return outsideInput({
    shape: v.shape, diameter: v.diameter, length: v.length, width: v.width, sides: v.sides, flats: v.flats, cornerRadius: v.cornerRadius, stock: v.stock || stock, bit,
    magnets: v.magOn ? { count: 4, diameter: v.magDiameter, depth: v.magDepth } : null,
    notch: v.notchOn ? { width: 16, depth: 4, count: v.notchCount, angle: 0 } : null,
    lipOn: v.lipOn, tabs: v.tabsOn ? { count: 4, width: 6, height: 1.5 } : null,
    edges: v.edgesOn ? { bit: v.edgeBit, angle: 60, diameter: 12.7, radius: 3.175, tip: 3.175, slope: v.slope } : null,
    corners: v.cornersOn ? { diameter: 6.35, radius: 3.175 } : null,
    bottom: v.botOn ? (v.bottomStyle === 'inset' ? { style: 'inset', board: v.bottomBoard, rabbet: v.bottomRabbet, recess: v.bottomRecess } : { board: v.bottomBoard, step: v.bottomStep, oversize: v.bottomOversize }) : null,
    lidStyle: v.lidStyle === 'carved' ? null : v.lidStyle,
    compartments: v.compOn ? { layout: v.compLayout, rows: v.compRows, cols: v.compCols, sections: v.compSections, angle: v.compAngle, middle: v.compMiddle, thickness: v.compThick, height: v.compHeight } : null
  });
}

test('guided setup: every kind, look, lid and finish gives a box with no problems', () => {
  let n = 0;
  for (const kind of Object.keys(GUIDE_KINDS)) for (const look of ['carved', 'inset', 'plug']) for (const lid of ['lift', 'plug', 'slope', 'panel'])
    for (const edges of ['none', 'v', 'round']) for (const corners of [false, true]) {
      if (lid === 'slope' && edges === 'round') continue;
      const g = guidedSettings({ kind, look, lid, edges, corners });
      const input = inputOf(g.v, 19, 3.175);
      const a = autoSizes(input, 'hardwood', false);
      assert.deepEqual(a.problems, [], JSON.stringify({ kind, look, lid, edges, corners }));
      delete a.problems;
      const plan = boxPlan(Object.assign({}, input, a));
      assert.deepEqual(plan.problems, [], JSON.stringify({ kind, look, lid, edges, corners }));
      n++;
    }
  assert.ok(n > 80);
  // The other shapes, and a thinner board and a bigger bit.
  for (const shape of ['poly', 'oval', 'heart']) for (const look of ['carved', 'inset', 'plug']) for (const [stock, bit] of [[19, 3.175], [12.7, 6.35]]) {
    const g = guidedSettings({ kind: 'keepsake', shape, look, length: 152.4, width: 120, flats: 101.6 });
    const input = inputOf(g.v, stock, bit), a = autoSizes(input, 'hardwood', true);
    assert.deepEqual(a.problems, [], JSON.stringify({ shape, look, stock, bit }));
  }
});

test('guided setup: what an inset bottom or a glued bottom leaves out, it says', () => {
  const g = guidedSettings({ kind: 'keepsake', look: 'inset', lid: 'slope', corners: true });
  assert.equal(g.v.magOn, false); assert.equal(g.v.notchOn, false); assert.equal(g.v.slope, false); assert.equal(g.v.cornersOn, false);
  assert.equal(g.v.lipOn, 'lid');
  assert.equal(g.said.length, 4);
  const p = guidedSettings({ kind: 'big', lid: 'plug' });
  assert.equal(p.v.lidStyle, 'plug'); assert.equal(p.v.lipOn, 'lid'); assert.equal(p.v.botOn, true);
  assert.equal(guidedSettings({ kind: 'ring' }).v.botOn, false);
  const d = guidedSettings({ kind: 'big', look: 'plug', lid: 'panel', magnets: true });
  assert.equal(d.v.lidStyle, 'drop'); assert.equal(d.v.magOn, false); assert.equal(d.v.lipOn, 'lid');
  assert.equal(guidedSettings({ kind: 'keepsake', look: 'carved', lid: 'panel' }).v.lidStyle, 'plug');
});

test('guided recipe: the programs by machine', () => {
  const f = (mm) => mm + ' mm';
  const g = guidedSettings({ kind: 'big', edges: 'v', corners: false });
  const plan = boxPlan(Object.assign(inputOf(g.v, 19, 6.35), autoSizes(inputOf(g.v, 19, 6.35), 'hardwood')));
  const base = { v: Object.assign({ bit: 6.35, stock: 19 }, g.v), plan, minutes: 42, fmt: f, bits: { box: { n: 1, text: '1/4" end mill' }, edge: { n: 7, text: '60° V-bit' } }, stock: 'Stock' };
  const atc = guidedRecipe(Object.assign({ machine: 'atc', edgesIn: true }, base));
  assert.match(atc[1].text, /changes to T7/);
  assert.ok(!atc.some((s) => /Edges Only/.test(s.text)));
  const none = guidedRecipe(Object.assign({ machine: 'none', edgesIn: false }, base));
  assert.ok(none.some((s) => /Edges Only/.test(s.text)));
  assert.ok(none.some((s) => /Floor Only/.test(s.text)));
  assert.ok(none.some((s) => /trim the floor flush/.test(s.text)));
  const bad = guidedRecipe(Object.assign({ problems: ['Wall too thick'] }, base));
  assert.equal(bad.length, 1);
});

test('guided setup: compartments for every kind and shape, and none with a glued-on floor', () => {
  for (const kind of Object.keys(GUIDE_KINDS)) for (const inside of ['two', 'grid', 'wedges']) for (const lid of ['lift', 'plug', 'slope']) for (const corners of [false, true]) {
    const g = guidedSettings({ kind, look: 'carved', inside, lid, corners });
    assert.equal(g.v.compOn, true);
    const input = inputOf(g.v, 19, 3.175), a = autoSizes(input, 'hardwood', false);
    delete a.problems;
    const plan = boxPlan(Object.assign({}, input, a));
    assert.deepEqual(plan.problems, [], JSON.stringify({ kind, inside, lid, corners }));
    assert.ok(plan.compartments.cells.length >= 2);
  }
  for (const shape of ['circle', 'poly', 'oval', 'heart']) for (const inside of ['two', 'grid', 'wedges']) {
    const g = guidedSettings({ kind: 'keepsake', shape, diameter: 101.6, length: 152.4, width: 120, flats: 101.6, look: 'carved', inside });
    const input = inputOf(g.v, 19, 3.175), a = autoSizes(input, 'hardwood', false);
    delete a.problems;
    assert.deepEqual(boxPlan(Object.assign({}, input, a)).problems, [], JSON.stringify({ shape, inside }));
  }
  const glued = guidedSettings({ kind: 'big', look: 'plug', inside: 'grid' });
  assert.equal(glued.v.compOn, false);
  assert.ok(glued.said.some((x) => /No compartments/.test(x)));
  assert.equal(guidedSettings({ kind: 'trinket', inside: 'two' }).v.compLayout, 'wedges');
  assert.equal(guidedSettings({ kind: 'keepsake', inside: 'two' }).v.compCols, 2);
});
