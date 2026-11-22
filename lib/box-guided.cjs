// Guided Setup: a few questions about the box and the shop, turned into
// the dialog's settings (the keys a preset uses) and a recipe: the
// programs in order, then the assembly. Auto Sizes is always on, so the
// sizes are ones that fit the board and the bit. mm.

// What each kind of box starts from; the answers change it.
var GUIDE_KINDS = {
  ring: { name: 'Ring box', shape: 'circle', diameter: 50.8, look: 'carved', lid: 'lift', magnets: false, notch: true },
  trinket: { name: 'Trinket box', shape: 'circle', diameter: 76.2, look: 'carved', lid: 'lift', magnets: false, notch: true },
  keepsake: { name: 'Keepsake box', shape: 'rect', length: 152.4, width: 101.6, cornerRadius: 12.7, look: 'carved', lid: 'lift', magnets: true, notch: true },
  big: { name: 'Big box', shape: 'rect', length: 254, width: 177.8, cornerRadius: 19.05, look: 'plug', lid: 'lift', magnets: true, notch: false }
};

// The answers a kind starts with, for the questions after it.
function guidedDefaults(kind) {
  var k = GUIDE_KINDS[kind] || GUIDE_KINDS.trinket;
  return {
    kind: kind in GUIDE_KINDS ? kind : 'trinket', shape: k.shape, diameter: k.diameter || 76.2, length: k.length || 152.4, width: k.width || 101.6,
    sides: 6, flats: k.diameter || k.width || 101.6, cornerRadius: k.cornerRadius || null, stock: null,
    look: k.look, bottomBoard: 6.35, lid: k.lid, magnets: k.magnets, notch: k.notch, edges: 'none', corners: false
  };
}

// The settings for the answers, and what was left out and why.
function guidedSettings(answers) {
  var a = Object.assign(guidedDefaults(answers && answers.kind), answers || {});
  var said = [], inset = a.look === 'inset', glued = inset || a.look === 'plug';
  var v = {
    autoSizes: true, lipOwn: false, measure: 'outside', cut: 'both', grain: false, nestOn: false, tabsOn: true,
    height: null, lidHeight: null, shape: a.shape, lipOn: 'base', lidStyle: 'carved', slope: false, slopeHeight: null,
    botOn: glued, bottomStyle: inset ? 'inset' : 'plug', bottomBoard: glued ? (a.bottomBoard > 0 ? a.bottomBoard : 6.35) : null,
    bottomStep: 2, bottomOversize: inset ? 0 : 1.5, bottomRabbet: 4, bottomRecess: 0.5,
    magOn: !!a.magnets, notchOn: !!a.notch, notchCount: a.shape === 'oval' ? 2 : 1, notchAngle: 0,
    edgesOn: a.edges === 'v' || a.edges === 'round', edgeBit: a.edges === 'round' ? 'round' : 'v', cornersOn: !!a.corners
  };
  if (a.shape === 'circle') v.diameter = a.diameter;
  else if (a.shape === 'poly') { v.sides = a.sides; v.flats = a.flats; }
  else { v.length = a.length; v.width = a.width; }
  if (a.shape === 'rect' || a.shape === 'poly' || a.shape === 'heart') v.cornerRadius = a.cornerRadius > 0 ? a.cornerRadius : a.shape === 'poly' ? 6.35 : 12.7;
  v.cornerOwn = v.cornerRadius != null ? v.cornerRadius : null;
  if (a.stock > 0) v.stock = a.stock;
  if (v.magOn) { v.magDiameter = a.kind === 'big' ? 10 : 8; v.magDepth = 3.2; }
  // The lid.
  if (a.lid === 'plug') { v.lidStyle = 'plug'; v.lipOn = 'lid'; }
  else if (a.lid === 'slope') {
    if (inset) said.push('A self-centering (sloped) lip isn’t made with an inset bottom: the lid lifts off with a straight lip instead.');
    else { v.slope = true; v.edgesOn = true; v.edgeBit = 'v'; }
  }
  // An inset bottom: the base's rim is the board's underside while it's cut.
  if (inset) {
    v.lipOn = 'lid';
    if (v.magOn) { v.magOn = false; said.push('No magnets: with an inset bottom, the base’s rim is underneath while it’s cut.'); }
    if (v.notchOn) { v.notchOn = false; said.push('No finger notch: with an inset bottom, the base’s rim is underneath while it’s cut.'); }
  }
  if (glued && v.cornersOn) { v.cornersOn = false; said.push('No rounded floor corners: a glued-on bottom is flat, with no carved floor to round.'); }
  if (v.slope && v.edgeBit === 'round') v.edgeBit = 'v';
  return { v: v, said: said, answers: a };
}

// The machine: 'atc' (a rack changer), 'manual' (ncSender asks for each
// bit), or 'none'.
// ctx: { v, plan, minutes, machine, fmt(mm) -> text with unit, bits: { box, edge, corner, mag }
// each { n, text } or null, edgesIn, cornersIn, magIn (in the box's
// program), stock: the stock text, problems: [] }.
function guidedRecipe(ctx) {
  var v = ctx.v, plan = ctx.plan, f = ctx.fmt, steps = [];
  if (ctx.problems && ctx.problems.length) return [{ title: 'Can’t be cut yet', text: ctx.problems[0] + '. Go back and change an answer, or fix it in the dialog after Apply.' }];
  var bit = function(b, fallback) { return b ? 'T' + b.n + ' (' + b.text + ')' : fallback; };
  var changes = [];
  if (ctx.magIn) changes.push(bit(ctx.bits.mag, 'the magnet bit') + ' for the magnet holes');
  if (ctx.edgesIn) changes.push(bit(ctx.bits.edge, 'the edge bit') + ' for the edges');
  if (ctx.cornersIn) changes.push(bit(ctx.bits.corner, 'the corner bit') + ' for the floor corners');
  var mins = ctx.minutes == null ? '' : ' About ' + (ctx.minutes < 1.5 ? '1 min' : Math.round(ctx.minutes) + ' min') + '.';
  var bottom = plan && plan.bottom, ownBottom = bottom && (bottom.own || v.bottomStyle === 'inset' || (v.bottomBoard > 0 && v.bottomBoard !== v.stock));
  var parts = bottom ? (ownBottom ? 'the ring and the lid' : 'the ring, the lid and the bottom') : 'the base and the lid';
  steps.push({ title: 'Board', text: ctx.stock || '' });
  var zero = v.origin === 'center' ? 'X0 Y0 in the middle of the pair' : 'X0 Y0 at the stock’s front-left corner';
  var main = 'Cut ' + parts + ': ' + zero + ', Z0 on the board’s top, ' + bit(ctx.bits.box, f(v.bit) + ' bit') + '.' + mins;
  if (changes.length) main += ctx.machine === 'atc' ? ' It changes to ' + changes.join(', then ') + ': have them in the rack.'
    : ' It stops for you to change to ' + changes.join(', then ') + (ctx.tls ? ', and measures each.' : '; re-zero Z on the board’s top after each.');
  steps.push({ title: 'Program 1', text: main });
  var n = 1, after = function(what, which) {
    n++;
    steps.push({ title: 'Program ' + n, text: which + ': put in ' + what + ', zero Z on the board’s top (leave X and Y), and run ' + which + '. Don’t move the board.' });
  };
  if (v.edgesOn && !ctx.edgesIn) after(v.edgeBit === 'round' ? 'the roundover bit' : 'the V-bit', 'Edges Only');
  if (v.cornersOn && !ctx.cornersIn) after('the ball or bowl bit', 'Corners Only');
  if (ownBottom) {
    n++;
    steps.push({ title: 'Program ' + n, text: 'Bottom Only, on the bottom board (' + f(bottom.height || v.bottomBoard) + ' thick, such as 1/4" plywood): the same zero, Z0 on its top.' });
  }
  var glue = [];
  glue.push('Cut the tabs and sand them flush.');
  if (bottom && v.bottomStyle === 'inset') glue.push('Turn the ring over and glue the panel into the rabbet underneath. Plywood can be glued all round; solid wood only along the middle of its long sides, so it can move.');
  else if (bottom) glue.push('Glue the ring onto the bottom, its plug inside the ring, then trim the bottom flush.');
  if (v.magOn) glue.push('Glue the magnets in with opposite poles up, so the lid pulls on.');
  if (v.lidStyle === 'plug') glue.push('The lid is a solid plug: it drops into the opening.');
  steps.push({ title: 'Assembly', text: glue.join(' ') });
  steps.push({ title: 'Test Fit first', text: 'Cut Test Fit in a scrap of the same board and try the lid, before the real board.' });
  return steps;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GUIDE_KINDS: GUIDE_KINDS, guidedDefaults: guidedDefaults, guidedSettings: guidedSettings, guidedRecipe: guidedRecipe };
}
