/**
 * Carved Box: the plan of a two-part box, base and lid, carved side by
 * side out of one board. All lengths in mm.
 *
 * The box is round (Diameter), a rectangle (Length along X, Width along
 * Y, Corner Radius), a regular polygon (Sides, the size across the
 * Flats, Corner Radius; a flat side to the front), an oval (Length along
 * X, Width along Y), a heart (Length across its lobes, Width from its
 * point to the top, Corner Radius its point's; the point to the front) or
 * a drawing (outline: { pts, name }, box-drawing.cjs's points, stretched
 * to the Length along X and Width along Y, its outside corners rounded
 * the Corner Radius; the lid's mirrored, as it's turned over onto the
 * base). The base is the full thickness of the stock; the lid
 * is too, unless a Lid Height under it is set, when the lid's area is
 * faced down first. Each half's inside is pocketed from the top face,
 * leaving the Wall all round and the Floor (base) or Top (lid)
 * underneath; its outline is then cut free, with tabs. One half carries a
 * lip: its wall top is cut down by the Lip Height less the Clearance
 * outside a ring Lip Width thick, standing up round the opening. The
 * other half's opening is widened by the Lip Thickness plus the
 * Clearance, Lip Height deep, so the lip slides in, the Clearance short
 * of the bottom, and the halves meet on the shoulder outside it. The lid is turned over onto the base. Optional: magnet
 * holes facing each other where the halves meet, a finger notch in the
 * base's rim at the front, rounded floor corners (a ball or bowl bit) and
 * chamfered or rounded edges (a V-bit or roundover bit), both cut after
 * the outlines: the outside seam (each rim's outer edge), the lead-in (the
 * lip's outer edge, the opening's) and the pocket edges (the lip's inner
 * edge, the step's). A sloped lip (edges.slope, a V-bit): the lip's outer
 * side and the opening's wall cut at the V-bit's angle, the opening that
 * much narrower at its floor, so the lid centers itself as it closes.
 * A glued-on floor (bottom): the base is a ring, its inside cut through
 * (the middle held by tabs) instead of pocketed, glued onto a bottom cut
 * from its own board, a step round its edge leaving a plug that fits
 * inside the ring. An inset floor (bottom.style 'inset'): the ring's
 * inside is the lid's opening, cut through, and a rabbet round it from
 * the face that's up while it's cut; turned over, that face is the box's
 * underside and a flat panel is glued into the rabbet, out of sight. Its
 * top (the board's underside) isn't cut, so the lip is on the lid.
 * A drop-in lid (lidStyle 'drop', with a Stepped Glued-On Floor): a flat
 * panel cut from the Floor Board beside the bottom (Floor Only), in a
 * rabbet round the ring's top as deep as the panel, so it sits flush; a
 * finger notch is a scoop at the rabbet's edge, to lift it by.
 * A solid lid (lidStyle 'plug'): the lid isn't hollowed: its lip is left
 * solid, a plug that fits the base's opening, under a flat top.
 *
 * A cut: { op: 'pocket' (inside the outline moved t), op: 'ring' (between
 * the outline moved tIn and tOut), shape (its own, for a hole; else the
 * box's), dx, dy (from the half's middle), z0 (where it starts, <= 0),
 * depth, what }; the outline: { op: 'profile', t: 0, z0, depth, tabs }.
 * An edge: { op: 'edge', t (where the edge bit's axis goes), z0 (the
 * edge's top), depth (to the bit's tip), what }.
 */

// The settings a plan takes, with their defaults (mm). lidHeight,
// baseHeight: the box's outside, to the seam; null: as high as the board
// allows (see boardsOf). quick: a trial plan (Auto Sizes'), for its
// problems: the compartments' top edges left out. magnets, notch, edges: null for none. edges:
// { bit: 'v' (angle, degrees across the V; diameter) or 'round' (radius,
// tip: the diameter of its flat end), outside (the seam), inside (the
// lead-in: the lip's outer edge, the opening's), pocket (each pocket's
// top edge: the lip's inner edge, the step's in the other half): how far
// down each edge is cut, 0 for none; slope: a V-bit cuts the lip's
// side and the opening's wall sloped, in place of the lead-in }. magnets: { count, diameter,
// depth, bit, drill }: bit, a smaller bit's diameter for the holes, cut
// after a tool change (plan.magnets), or null for the box's bit; drill:
// it's a drill, which can't. corners: { diameter, radius }: a
// ball (radius half the diameter) or bowl bit rounding each pocket's
// floor corners. finish: the wood the roughing leaves on the walls (the
// pockets', the widened opening's, the lip's) for a finishing pass, 0 for
// none, and on the steps' floors (the opening's, the shoulder's), skimmed
// before the walls' laps; finishDir: 'conventional' (the wood on the bit's left, as the
// spindle turns clockwise) or 'climb' (on its right). A half lower than
// its board is faced down first. cut:
// 'both' halves side by side, or one, 'base' or 'lid', on its own board:
// the lid's lidStock thick (null: as the stock); grain: the lid's board
// is the base's resawn leaf, turned over as the lid turns over, so the
// lid is cut where the base is, mirrored, for the grain to run on across
// the seam. bottom: { board (its thickness; null: as the stock), step
// (how far down round the plug), oversize, style: 'plug' (glued on, the
// default) or 'inset' (a panel glued into a rabbet round the ring's
// underside: rabbet, its width; recess, how far the panel sits up inside
// it) }, or null for a base with its own floor; cut 'bottom': only the
// bottom, on its board. lidStyle: 'plug' for a solid lid (its lip a plug),
// else carved. compartments: { rows, cols, thickness, height (the
// dividers' from the floor; null: full), rowSizes, colSizes (a grid's
// rows front to back and columns left to right as shares, [1, 2, 1]:
// the middle twice as wide; null: equal); wedges: { layout: 'wedges',
// sections, angle, middle, thickness, height, sizes (each section's
// share, counterclockwise from the first divider) }; or null for one space.
// tray: a dish in the lid's top, the board's underside while the box is
// cut: { depth, rim (from the lid's outside edge; null: the Wall), pin
// (the dowel pins' diameter), rounded (its floor rounded with the corner
// bit), edge (how far down the Edge Bit takes the lid's top edge and the
// dish's, 0 for none) }, or null. With it, two pin holes on the line the
// board turns over on, end for end, and cut 'top' (Tray, Turned Over): the program for the
// board turned over (pin holes, then the dish), before the box.
var DEFAULTS = {
  shape: 'circle', diameter: 80, length: 120, width: 80, cornerRadius: 10, sides: 6, flats: 80, outline: null,
  stock: 19, lidHeight: null, baseHeight: null, cut: 'both', lidStock: null, grain: false, wall: 6, floor: 4, top: 4,
  lipOn: 'base', lipHeight: 4, lipWidth: 3, clearance: 0.2,
  gap: 12, layout: 'x', origin: 'front-left', margin: 5,
  bit: 3.175, through: 0.5, tabs: { count: 4, width: 6, height: 1.5 },
  magnets: null, notch: null, edges: null, corners: null, finish: 0, finishDir: 'conventional', bottom: null, lidStyle: null, compartments: null, tray: null
};

// What fits in an opening of S moved t that's cut from inside with a bit
// of radius r, the Clearance c smaller all round: { shape, t }. A heart's,
// oval's or drawing's opening is S moved t with its corners rounded to r,
// as the bit leaves them (S moved t - r, then out r): the part follows it,
// c inside, instead of being half the bit smaller all round. The others'
// corners are arcs already as round as the bit leaves them.
function partIn(S, t, r, c) {
  if (S.kind !== 'outline') return { shape: S, t: t - c };
  var segs = [];
  outlineLoops(S, t - r).forEach(function(l) { segs = segs.concat(l); });
  if (!segs.length) return { shape: S, t: t - c - r };
  return { shape: { kind: 'outline', segs: segs, key: (S.key || 'outline') + ':in' + t.toFixed(4) + ',' + r.toFixed(4), step: S.step }, t: r - c };
}

function boxPlan(input) {
  var o = Object.assign({}, DEFAULTS, input || {});
  var problems = [], notes = [];
  var need = function(ok, msg) { if (!ok) problems.push(msg); };
  var rect = o.shape === 'rect', poly = o.shape === 'poly', oval = o.shape === 'oval', heart = o.shape === 'heart', custom = o.shape === 'custom';
  var cornered = rect || poly || heart || custom, rb = o.bit / 2, w = o.wall, T = o.stock, fin0 = o.finish > 0 ? o.finish : 0;
  // A polygon with a flat side to the front (-Y; along Y, -X), so it's the
  // same turned over across the line between the halves.
  var n = Math.round(o.sides), S = shapeOf(o);
  // A drawing's lid: its mirror image, as it's turned over onto the base
  // (the others are the same either way).
  var mirror = custom ? (o.layout === 'y' ? 'y' : 'x') : null, SL = custom && S ? shapeOf(o, mirror) : S;
  // An inset floor's ring is turned over too: it's cut from the mirrored
  // drawing as well, so both halves land as drawn (and match).
  if (custom && SL && o.bottom && o.bottom.style === 'inset') { S = SL; mirror = null; }
  // A drawing that crosses itself: said, before anything else about it.
  var crossAt = custom && o.outline && o.outline.pts ? selfCrossing(o.outline.pts) : null;
  if (crossAt) problems.push('The drawing\'s outline crosses itself (near ' + crossAt.x.toFixed(1) + ', ' + crossAt.y.toFixed(1) + ' mm from the middle of the file\'s outline): fix it in the drawing');
  // A heart too short for its width (no point under its lobes): said, and
  // a stand-in so the rest still adds up.
  if (!S || !SL) {
    var lobe = (o.length || 0) / 2 / 1.72;
    if (!crossAt) problems.push(heart ? 'A heart ' + +(+o.length || 0).toFixed(1) + ' mm across needs at least ' + +(2.5 * lobe + 0.05).toFixed(1) + ' mm from point to top, and a point radius under ' + +(lobe - 0.05).toFixed(1) + ' mm'
      : custom ? (o.outline && o.outline.pts ? 'The Corner Radius rounds the drawing away: make it smaller' : 'Open a drawing (an SVG or DXF file) for the custom shape') : 'Give the oval a Width and Length');
    S = SL = { kind: 'circle', r: Math.max(1, (o.length || 2) / 2) };
  }
  var SH = { base: S, lid: SL };
  var outlineAt0 = (rect || oval || heart || custom ? o.length > 0 && o.width > 0 : poly ? o.flats > 0 && n >= 3 && n <= 12 : o.diameter > 0) ? shapeLoop(S, 0) : null;
  // How far the outline reaches each way from the middle (an odd polygon's
  // not the same up as down).
  var ext = outlineAt0 ? loopExtent(outlineAt0) : { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  var halfX = (ext.maxX - ext.minX) / 2, halfY = (ext.maxY - ext.minY) / 2, deep = shapeDeepest(S);
  // Each half's board, and its height: the board's, or lower, its area
  // faced down first.
  var B = boardsOf(o), baseH = B.baseH, lidH = B.lidH;
  if (B.lipFlush) {
    notes.push('Lip Height ' + (B.lip < o.lipHeight ? 'lowered' : 'raised') + ' to ' + +B.lip.toFixed(2) + ' mm, so the opening reaches the ' + (o.lipOn === 'lid' ? (o.bottom ? 'floor\'s plug' : 'base\'s floor') : 'lid\'s top') + ': one flat inside, no step.');
    o.lipHeight = B.lip;
  }
  var faces = { base: Math.max(0, T - baseH), lid: Math.max(0, B.lid - lidH), bottom: 0 }, face = faces.lid;
  var lipOnLid = o.lipOn === 'lid';
  // The outline moved in to the inside, the widened opening, the lip's outside.
  var tInside = -w, tRabbet = -(w - o.lipWidth - o.clearance), tLip = -(w - o.lipWidth);
  // The opening's as deep as the Lip Height; the lip stands the Clearance
  // lower (its shoulder cut that much less), so it doesn't touch the
  // bottom of the opening and the halves still meet on the shoulder.
  var rabbetDepth = o.lipHeight, lipUp = o.lipHeight - o.clearance;
  // A drop-in lid: a flat panel from the Floor Board in a rabbet round
  // the ring's top, as deep as the panel, so it sits flush; the Lip
  // Thickness is how far it laps onto the ledge, less the Clearance.
  var drop = o.lidStyle === 'drop';
  if (drop) { rabbetDepth = lipUp = B.bottom; o.lipHeight = B.bottom; }
  // A sloped lip: the opening as much narrower at its floor as the lip is
  // at its top, at the V-bit's slant, so the gap stays the Clearance.
  // A Slope Height under the lip's: only its top that far is sloped, the
  // rest straight, to grip; the opening narrows to match only below as
  // deep, in steps of the box's bit (a V-bit there would cut into the
  // straight wall above). slopeUp: how far up the lip is sloped; slopeD:
  // how far up the opening is, from its floor.
  var slope = !!(o.edges && o.edges.slope && o.edges.bit !== 'round'), slant = slope ? Math.tan((o.edges.angle || 90) * Math.PI / 360) : 0;
  var slopeH = slope && o.edges.slopeHeight > 0 ? o.edges.slopeHeight : 0, part = slope && slopeH > 0 && slopeH < lipUp - 1e-9;
  var slopeUp = part ? slopeH : lipUp, slopeD = slope ? (part ? slopeH + o.clearance : rabbetDepth) : 0;
  var tOpen = tRabbet - slopeD * slant, slantSay = slope ? ', plus the sloped lip\'s slant (' + (slopeD * slant).toFixed(2) + ' mm)' : '';
  // The opening's wall by depth: [{ d0, d1, t }], straight, then (a part
  // slope) steps of at most 0.25 mm, each as wide as the slope at its top
  // (so no step stands into the gap).
  var openSteps = [{ d0: 0, d1: rabbetDepth, t: slope && !part ? tOpen : tRabbet }];
  if (part) {
    var straightD = rabbetDepth - slopeD, nStep = Math.ceil(slopeD / 0.25 - 1e-9), dStep = slopeD / nStep;
    openSteps = [{ d0: 0, d1: straightD, t: tRabbet }];
    for (var si = 0; si < nStep; si++) openSteps.push({ d0: straightD + si * dStep, d1: straightD + (si + 1) * dStep, t: tRabbet - si * dStep * slant });
  }
  // A glued-on floor: the base a ring, no floor of its own.
  var bot = o.bottom || null, botH = B.bottom, botStep = bot ? bot.step : 0, botOv = bot && bot.oversize > 0 ? bot.oversize : 0;
  // An inset floor: a rabbet rabW wide round the ring's inside (the lid's
  // opening), rabD deep from the face that's up while it's cut: the panel
  // and the Recess it sits up in it. The inside starts that far up.
  // A solid lid: no inside pocket, its lip left solid.
  var inset = !!(bot && bot.style === 'inset'), plugLid = o.lidStyle === 'plug';
  var rabW = inset && bot.rabbet > 0 ? bot.rabbet : 0, recess = inset && bot.recess > 0 ? bot.recess : 0, rabD = inset ? botH + recess : 0, tR2 = tRabbet + rabW;
  if (inset) { botStep = rabD; botOv = 0; }
  var height = { base: baseH, lid: lidH }, under = { base: bot ? 0 : o.floor, lid: o.top };
  var lipHalf = lipOnLid ? 'lid' : 'base', rabbetHalf = lipOnLid ? 'base' : 'lid';
  // The opening as deep as the inside: one flat pocket, no step.
  var flush = !inset && !plugLid && !drop && Math.abs(rabbetDepth - (height[rabbetHalf] - under[rabbetHalf] - (bot && rabbetHalf === 'base' ? botStep : 0))) < 1e-6;

  if (rect || oval || heart || custom) need(o.length > 0 && o.width > 0, 'Width and Length must be more than 0');
  // A drawing: one piece, not crossing itself; its inside corners as the
  // heart's notch.
  if (custom && S.kind === 'outline') {
    need(!(S.pieces > 1) && !(SL.pieces > 1), 'The Corner Radius cuts the drawing apart at a narrow neck: make the Corner Radius smaller, or the drawing wider there');
    if (S.inside) need(w - o.lipWidth - fin0 >= rb - 1e-9, 'Wall must be at least Lip Thickness + half the bit for this drawing, so the bit gets into the lip\'s side of its inside corners');
  }
  if (poly) need(o.flats > 0 && o.sides >= 3 && o.sides <= 12 && o.sides === Math.round(o.sides), 'A polygon needs 3 to 12 sides and a size across the flats');
  // An oval's ends are its corners: the lip's must fit the opening's there,
  // as a rectangle's.
  if (oval && S.kind === 'outline') need(S.cr + tOpen >= rb - 1e-9, 'The oval\'s ends are too tight for the lip: make it wider, or the Wall thinner (its ends\' radius must be at least Wall \u2212 Lip Thickness \u2212 Clearance + half the bit' + slantSay + ')');
  // A heart's notch is a corner the other way: the shoulder bit must get
  // into the lip's side of it.
  if (heart && S.kind === 'outline') need(w - o.lipWidth - fin0 >= rb - 1e-9, 'Wall must be at least Lip Thickness + half the bit for a heart, so the bit gets into the lip\'s side of the notch');
  if (cornered && S.kind !== 'circle') {
    need((o.cornerRadius || 0) >= 0, 'Corner Radius can\'t be negative');
    // Under this, the bit leaves the opening's corners rounder than the
    // lip's, and the lip binds there.
    need(S.cr + tOpen >= rb - 1e-9, 'Corner Radius must be at least Wall \u2212 Lip Thickness \u2212 Clearance + half the bit' + slantSay + ', so the lip\'s corners fit the opening');
  } else if (!(rect || oval || heart || custom || poly)) need(o.diameter > 0, 'Diameter must be more than 0');
  need(T > 0, 'Stock Thickness must be more than 0');
  need(lidH <= B.lid + 1e-9, 'Lid Height can\'t be more than ' + down2(B.lid - lidH + B.lidOut) + ' mm with this ' + (B.sep ? 'lid board' : 'stock'));
  // (Given as the Height: the most it can be.)
  need(baseH <= T + 1e-9, o.height > 0 ? 'Height can\'t be more than ' + down2(T - baseH + B.baseOut + B.lidOut - (o.measure === 'inside' ? heightCaps(o) : 0)) + ' mm with this stock'
    : 'Base Height can\'t be more than ' + down2(T - baseH + B.baseOut) + ' mm with this stock');
  need(!o.baseLow, 'Height too low for the Lid Height (' + down2(o.lidHeight) + ' mm): the base needs more than its ' + (bot ? 'Floor Board' : 'floor') + '; raise the Height or lower the Lid Height');
  if (B.sep) need(B.lid > 0, 'Lid Board must be more than 0');
  need(o.bit >= 0.8, 'Bit Diameter must be at least 0.8 mm: check it\'s in the right units');
  need(w > 0, 'Wall must be more than 0');
  if (!bot) need(o.floor > 0 && o.floor < baseH, 'Base Floor must be between 0 and the stock thickness');
  else if (inset) {
    need(lipOnLid, 'An Inset Floor needs the lip on the lid: the ring\'s top is the board\'s underside while it\'s cut, so nothing is cut there');
    need(bot.board > 0, 'Inset Floor: set the Floor Board to the panel\'s thickness, such as 1/4" plywood');
    need(botH > 0 && rabW > 0, 'Rabbet Width must be more than 0');
    need(!(bot.recess < 0 || bot.recess > 5), 'Recess must be between 0 and 5 mm');
    need(-tR2 >= 2, 'Wall must be at least Lip Thickness + Clearance + Rabbet Width + 2 mm, for the ring outside the inset floor\'s rabbet');
    need(lipUp < baseH - rabD - 0.5, 'Lip Height too deep for the ring: the lid\'s lip would reach the inset floor (the ring\'s height less the Floor Board and the Recess)');
    need(!(o.magnets && o.magnets.count > 0), 'Magnets go in the ring\'s rim, which is the board\'s underside while an Inset Floor\'s ring is cut: turn them off, or use a Stepped floor');
    need(!(o.notch && o.notch.width > 0), 'Finger notches go in the ring\'s rim, which is the board\'s underside while an Inset Floor\'s ring is cut: turn them off, or use a Stepped floor');
    need(!slope, 'A Sloped Lip isn\'t for an Inset Floor: the ring\'s opening would be sloped from its underside');
    need(!o.grain, 'Grain Match isn\'t for an Inset Floor: the ring is turned over, so its seam is the board\'s underside and the grain can\'t run on across it');
  } else {
    need(botH > 0, 'Floor Board must be more than 0');
    need(botStep > 0 && botStep <= botH - 2, 'Locating Step must be more than 0, and leave at least 2 mm of the Floor Board under it');
    need(botStep <= baseH - 1, 'Locating Step must be at least 1 mm less than the ring\'s height');
    need(!(bot.oversize < 0 || bot.oversize > 10), 'Oversize must be between 0 and 10 mm');
  }
  if (o.cut === 'bottom') need(!!bot, 'Floor Only needs the Glued-On Floor');
  if (drop) {
    need(lipOnLid, 'A Drop-In Lid needs the lip on the lid: the panel is the lip, sitting in the ring\'s rabbet');
    need(!!bot && !inset, 'A Drop-In Lid needs a Glued-On Floor of the Stepped kind: the panel is cut with the floor, and the ring can only be cut from its top (an Inset Floor needs its rabbet underneath)');
    need(!bot || B.bottomOwn, 'A Drop-In Lid is cut from the Floor Board, beside the floor: set it to a thin board, such as 1/4" plywood');
    need(!bot || baseH - botStep - rabbetDepth >= 2, 'Drop-In Lid: the ring is too low for the floor\'s Locating Step and the panel (the Floor Board) with 2 mm of wall between: use a thinner Floor Board or a lower Locating Step');
    need(o.cut !== 'lid', 'A Drop-In Lid is cut with Floor and Lid, beside the floor');
    need(!(o.magnets && o.magnets.count > 0), 'Magnets aren\'t for a Drop-In Lid: the panel sits inside the rim, not on it');
    need(!slope, 'A Sloped Lip isn\'t for a Drop-In Lid: its panel\'s edge is square');
    need(!o.grain, 'Grain Match isn\'t for a Drop-In Lid: the lid is a panel from the Floor Board');
  }
  if (plugLid) {
    need(lipOnLid, 'A Solid Lid needs the lip on the lid: the plug is the lip, left solid');
    need(lidH - lipUp >= 2, 'Solid Lid: the lid must be at least 2 mm thicker than the plug (the Lip Height less the Clearance)');
    // The plug goes into the base's inside: room left under it.
    need(baseH - under.base - botStep - lipUp >= 2, 'Solid Lid: the plug would fill the base: make the Lip Height lower, so at least 2 mm of the inside is left under it');
  } else if (!drop) need(o.top > 0 && o.top < lidH, 'Lid Top must be between 0 and the lid height');
  // A Lid Tray: the dish in the lid's top, from the board's underside.
  var tr = o.tray && o.tray.depth > 0 ? o.tray : null, trayRim = tr ? (tr.rim > 0 ? tr.rim : w) : 0, trayPin = tr ? (tr.pin > 0 ? tr.pin : 6.35) : 0;
  var trayWood = tr ? (plugLid ? lidH : o.top) - tr.depth : 0;
  if (o.tray && !(o.tray.depth > 0)) need(false, 'Lid Tray: give its Tray Depth');
  if (o.cut === 'top') need(!!tr, 'Cut Tray (Turned Over) needs the Lid Tray on');
  if (tr) {
    need(!drop, 'A Lid Tray isn\'t for a Drop-In Lid: the lid is a panel from the Floor Board');
    need(!B.sep, 'A Lid Tray needs both halves on one board: Cut Both, Side by Side, after Tray (Turned Over)');
    need(!o.grain, 'A Lid Tray isn\'t for Grain Match: the lid is on its own board');
    need(!inset, 'A Lid Tray isn\'t for an Inset Floor: its ring is turned over too');
    need(!(tr.rim < 0), 'Tray Rim can\'t be negative');
    if (!drop) need(trayWood >= 3 - 1e-9, 'Lid Tray: ' + (plugLid ? 'the lid' : 'the Lid Top') + ' must be at least 3 mm more than the Tray Depth, for the wood under the dish (it\'s ' + Math.max(0, trayWood).toFixed(2) + ' mm): make the Tray Depth less' + (plugLid ? '' : ', or the Lid Top thicker'));
    need(trayRim >= 3, 'Tray Rim must be at least 3 mm');
    need(o.bit <= trayPin + 1e-9, 'Lid Tray: the bit must be no wider than the Pin Diameter, to bore the pin holes');
    need(trayPin <= 20, 'Pin Diameter must be 20 mm or less');
  }
  need(o.lipHeight > 0, 'Lip Height must be more than 0');
  need(!(o.lipHeight > 0) || lipUp > 0.5, 'Lip Height must be at least 0.5 mm more than the Clearance');
  need(o.lipWidth > 0, 'Lip Thickness must be more than 0');
  need(o.clearance >= 0, 'Clearance can\'t be negative');
  need(deep - w > rb + (o.finish > 0 ? o.finish : 0), 'Wall too thick for the size: the inside must be wider than the bit');
  // A heart's inside in one piece where the walls are (deeper, its pocket
  // can come apart into the lobes, and is cut a piece at a time).
  if (S.kind === 'outline') need(shapeLoops(S, tInside).length <= 1 && shapeLoops(S, tInside - rb).length <= 1, 'Wall too thick for the shape: its inside comes apart in two');
  need(w - o.lipWidth - o.clearance >= 1, 'Wall must be at least 1 mm more than Lip Thickness + Clearance, for the wall outside the lip');
  if (!plugLid && !drop) need(lipUp < height[lipHalf] - under[lipHalf], 'Lip Height must be less than the inside depth of the half with the lip');
  if (!inset) need(flush || rabbetDepth < height[rabbetHalf] - under[rabbetHalf], 'Lip Height must be less than the inside depth of the half without the lip');
  need(o.margin >= 0, 'Edge Margin can\'t be negative');
  var fin = o.finish > 0 ? o.finish : 0;
  need(!(o.finish < 0 || o.finish > 1), 'Finish Allowance must be between 0 and 1 mm');
  if (!B.sep || (drop && o.cut === 'bottom')) need(o.gap >= 2 * o.bit + 1, 'Gap Between must be at least 2 bit diameters + 1 mm, so the outlines don\'t meet');
  // The ring's inside, a rectangle's or polygon's corners as round as the
  // bit leaves them (the plug's the same, the Clearance smaller).
  // (An inset floor's ring: its inside is the opening, the rabbet round it.)
  var tRing = inset ? tRabbet : tInside;
  var SA = cornered && S.kind !== 'outline' && S.cr < rb - tRing ? Object.assign({}, S, { cr: Math.max(S.cr, rb - tRing) }) : S;
  var outlineLoop = shapeLoop(S, rb), round = outlineLoop ? loopLength(outlineLoop) : 0;
  if (o.tabs) {
    need(o.tabs.height > 0 && o.tabs.width > 0 && o.tabs.count >= 1 && o.tabs.height < Math.min(baseH - under.base, drop ? Infinity : plugLid ? lidH - lipUp : lidH - o.top, bot ? (inset ? botH : botH - botStep) : Infinity),
      'Tabs: give a count, a width and a height less than the halves' + (inset ? ' and the Floor Board' : bot ? ' and the Floor Board less the Locating Step' : ''));
    // Each tab, with the bit's width either side, well inside its own
    // share of the way round (it sits in the middle of it).
    var each = o.tabs.width + o.bit;
    need(o.tabs.count * each < 0.6 * round, 'Too many or too wide tabs for the outline');
    // The ring's inside is held by tabs too, round a shorter loop.
    var inLoop = bot ? shapeLoop(SA, tRing - rb) : null;
    if (inLoop) need(o.tabs.count * each < 0.6 * loopLength(inLoop), 'Too many or too wide tabs for the ring\'s inside');
  } else if (bot) notes.push('With no Holding Tabs, the ring\'s middle comes loose when its inside is cut through: hold it down.');
  if ((!bot && o.floor < 2) || (!plugLid && !drop && o.top < 2)) notes.push('A floor or top under 2 mm can flex or crack.');
  if (o.clearance < 0.1) notes.push('Under 0.1 mm of clearance, the lid may bind once the wood moves.');

  // Where the halves meet, from each half's top: the shoulder round a lip,
  // or the rim of the other.
  var meet = { base: 0, lid: 0 };
  meet[lipHalf] = lipUp;

  // Magnets: holes on the line midway across the wall the halves meet on
  // (outside the widened opening), the same in both halves.
  var magnetAt = [];
  if (o.magnets && o.magnets.count > 0) {
    var mr = o.magnets.diameter / 2, band = -tRabbet, magBit = o.magnets.bit > 0 ? o.magnets.bit : o.bit;
    if (o.magnets.bit > 0) need(!o.magnets.drill, 'The Magnet Bit is a drill: pick an end mill smaller than the holes');
    if (o.magnets.bit > 0) need(o.magnets.diameter > magBit + 0.2, 'Magnet holes must be wider than the Magnet Bit');
    else need(o.magnets.diameter > o.bit + 0.2, 'Magnet holes must be wider than the bit: use a smaller bit (1/8" for 5 mm magnets), a Magnet Bit, or bigger magnets');
    need(band / 2 - mr >= 0.8, 'Magnet holes too wide for the wall: they need Wall ≥ Lip Thickness + Clearance + magnet + 1.6 mm');
    need(o.magnets.depth > 0, 'Magnet hole depth must be more than 0');
    need(o.magnets.count >= 1 && o.magnets.count === Math.round(o.magnets.count), 'Magnets: the count must be a whole number, 1 or more');
    // An even count on a rectangle: the lid's land on the base's turned
    // over either way.
    if (rect) need(o.magnets.count % 2 === 0, 'A rectangular box needs an even number of magnets, so they line up when the lid is turned over');
    ['base', 'lid'].forEach(function(h) { need(meet[h] + o.magnets.depth <= height[h] - 1, 'Magnet holes too deep for the ' + h); });
    // Spaced evenly from the front (where a notch goes), half a space off
    // it: turned over between the halves, the lid's land on the base's.
    var mid = shapeLoop(S, tRabbet / 2), alongY = o.layout === 'y';
    if (mid) {
      var L = loopLength(mid), front = loopAt(mid, alongY ? Math.PI : -Math.PI / 2) || 0;
      for (var k = 0; k < o.magnets.count; k++) {
        var p = loopPoint(mid, (front + (k + 0.5) * L / o.magnets.count) % L);
        magnetAt.push({ dx: p.x, dy: p.y });
      }
      var closest = Infinity;
      magnetAt.forEach(function(p, i) { if (magnetAt.length > 1) { var q = magnetAt[(i + 1) % magnetAt.length]; closest = Math.min(closest, Math.hypot(p.dx - q.dx, p.dy - q.dy)); } });
      need(closest >= o.magnets.diameter + 1, 'Too many magnets for the way round: their holes run together');
    }
  }
  // The dish over the lid's magnet holes (from its other face): 2 mm of
  // wood between.
  if (tr && magnetAt.length && trayRim < -tRabbet / 2 + o.magnets.diameter / 2 + 1)
    need(height.lid - meet.lid - o.magnets.depth - tr.depth >= 2 - 1e-9, 'Lid Tray: the dish comes within 2 mm of the lid\'s magnet holes: make the Tray Rim wider, the Tray Depth less, or the holes shallower');
  // The dish: wider than the bit, a mm to spare.
  if (tr) need(shapeDeepest(SL) - trayRim > rb + 0.5, 'Lid Tray: the dish is too small for the bit: make the Tray Rim narrower');
  // Finger notches: round scoops centered on the base's outline, count
  // of them evenly round (2: opposite, so a tight lid lifts straight up
  // instead of tipping), the first at the front (-Y; along Y, -X, a side
  // the halves don't share) turned angle degrees counterclockwise seen
  // from above; as deep as asked below where the halves meet, biting no
  // further than the rim (outside any lip or widened opening).
  var notchCut = null, notchCuts = [];
  if (o.notch && o.notch.width > 0) {
    var rn = o.notch.width / 2, rim = lipOnLid ? -tRabbet : -tLip;
    need(rn > rb + 0.1, 'Finger notch must be wider than the bit');
    if (!drop) need(rn <= rim - 0.8, 'Finger notch too wide for the wall outside the ' + (lipOnLid ? 'opening' : 'lip'));
    // A drop-in lid's: a scoop at the rabbet's edge, below the panel, as
    // far out as leaves 2 mm of wall, so a fingertip goes in beside the
    // panel and under it.
    var tNotch = drop ? Math.min(tRabbet, -2 - rn) : 0;
    if (drop) need(tNotch + rn >= tLip + 2 - 1e-9, 'Finger notch: a Drop-In Lid\'s needs Wall \u2212 Lip Thickness of at least 4 mm, for a fingertip beside the panel');
    var nTop = drop ? rabbetDepth : meet.base, nLoop = drop ? shapeLoop(S, tNotch) : outlineAt0;
    need(o.notch.depth > 0 && nTop + o.notch.depth <= baseH - (bot ? (drop ? botStep + 1 : 1) : o.floor), 'Finger notch depth must be more than 0 and above the floor');
    var nCount = o.notch.count > 0 ? o.notch.count : 1, a0 = (o.notch.angle || 0) * Math.PI / 180, magHit = false, nHit = false, gapHit = false;
    need(nCount === Math.round(nCount) && nCount <= 4, 'Finger notches: the count must be 1 to 4');
    nCount = Math.max(1, Math.min(4, Math.round(nCount)));
    for (var ni = 0; ni < nCount; ni++) {
      var na = a0 + ni * 2 * Math.PI / nCount, at;
      // Straight to the front: the middle of the front (a drawing's
      // nearest point to it, as below).
      if (Math.abs(Math.sin(na)) < 1e-9 && Math.cos(na) > 0) {
        at = o.layout === 'y' ? { x: ext.minX, y: 0 } : { x: 0, y: ext.minY };
        if (custom && outlineAt0) at = loopPoint(outlineAt0, loopNearest(outlineAt0, at.x, at.y));
        if (drop && nLoop) at = loopPoint(nLoop, loopNearest(nLoop, at.x, at.y));
      } else {
        // Where the line out from the middle that way leaves the box's
        // extent; then the nearest point of the outline to it (a
        // drawing's can be in a hollow).
        var fx = o.layout === 'y' ? -1 : 0, fy = o.layout === 'y' ? 0 : -1;
        var ux = fx * Math.cos(na) - fy * Math.sin(na), uy = fx * Math.sin(na) + fy * Math.cos(na);
        var reach = Math.min(Math.abs(ux) > 1e-9 ? (ux > 0 ? ext.maxX : -ext.minX) / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-9 ? (uy > 0 ? ext.maxY : -ext.minY) / Math.abs(uy) : Infinity);
        at = { x: ux * reach, y: uy * reach };
        if (nLoop) at = loopPoint(nLoop, loopNearest(nLoop, at.x, at.y));
      }
      // Past the side facing the lid (+X; along Y, +Y), into the Gap: no further than 1 mm short of it.
      var across = o.layout === 'y' ? at.y + rn - ext.maxY : at.x + rn - ext.maxX;
      if (!B.sep && !drop && across > o.gap - 1 && !gapHit) {
        gapHit = true;
        problems.push('A finger notch reaches across the Gap into the lid: a wider Gap, a narrower notch, or turn the notches');
      }
      // (Each said once, however many notches it is.)
      if (magnetAt.some(function(m) { return Math.hypot(m.dx - at.x, m.dy - at.y) < rn + o.magnets.diameter / 2 + 1; }) && !magHit) {
        magHit = true;
        problems.push('The finger notch runs into a magnet hole: use fewer magnets, a narrower notch, or turn the notches');
      }
      if (notchCuts.some(function(q) { return Math.hypot(q.dx - at.x, q.dy - at.y) < 2 * rn + 2; }) && !nHit) {
        nHit = true;
        problems.push('The finger notches run together: use fewer, or narrower');
      }
      // From the stock's top: past the outline, the shoulder round a lip
      // doesn't reach.
      notchCuts.push({ op: 'pocket', shape: { kind: 'circle', r: rn }, t: 0, dx: at.x, dy: at.y, z0: -faces.base, depth: nTop + o.notch.depth, what: 'finger notch' + (nCount > 1 ? ' ' + (ni + 1) : '') });
    }
    notchCut = notchCuts[0];
  }

  // Chamfered or rounded edges: per half, its edges (u: which side the
  // wood is, 1 inside the loop, -1 outside it), how much of the top each
  // takes, and where the bit goes: a V-bit's axis on the edge, its tip at
  // the depth; a roundover bit's half its tip out on the air side, its
  // flat end at the depth. reachOut: how far past the outline the edge
  // bit reaches, for the waste round a seam below the stock top to be
  // cleared that far first.
  var edgeAt = { base: [], lid: [], bottom: [] }, ed = o.edges, reachOut = { base: 0, lid: 0, bottom: 0 };
  if (ed && (ed.outside > 0 || ed.inside > 0 || ed.pocket > 0 || slope)) {
    // tip: the flat end's diameter (a V-bit's is small, not a point).
    var vbit = ed.bit !== 'round', tan = Math.tan((ed.angle || 90) * Math.PI / 360), R = ed.radius, tip = (vbit ? ed.vtip : ed.tip) || 0;
    if (vbit) {
      need(ed.angle >= 20 && ed.angle <= 150, 'Edges: the V-bit\'s angle must be between 20 and 150 degrees');
      need(ed.diameter > 0, 'Edges: give the V-bit\'s diameter');
    } else need(R > 0 && tip >= 0, 'Edges: give the roundover bit\'s radius, and its tip diameter (0 or more)');
    need(!(ed.outside < 0 || ed.inside < 0 || ed.pocket < 0), 'Edges: sizes can\'t be negative');
    if (!vbit && R > 0) need(!(ed.outside > R + 1e-9 || ed.inside > R + 1e-9 || ed.pocket > R + 1e-9), 'Edges: a roundover can\'t go deeper than the bit\'s radius');
    var width = function(d) { return !(d > 0) ? 0 : vbit ? d * tan : R - Math.sqrt(Math.max(0, R * R - d * d)); };
    // A sloped lip takes the lead-in's place: the lip's side all the way
    // down to the shoulder, the opening's wall to its floor. eIn: what's
    // off the lip's top; eRim: off the rim round the opening.
    var lead = slope ? 0 : ed.inside;
    var eOut = width(ed.outside), eIn = slope ? width(slopeUp) : width(lead), eRim = slope ? 0 : eIn, ePk = width(ed.pocket);
    var eMax = Math.max(eOut, eIn, ePk, slope && !part ? width(rabbetDepth) : 0);
    if (vbit) need(eMax + tip / 2 <= ed.diameter / 2 + 1e-9, 'Edges: the V-bit is too small: the ' + (slope && eMax > Math.max(eOut, ePk) ? 'sloped lip' : 'widest edge') + ' needs one ' + (2 * eMax + tip).toFixed(2) + ' mm across' + (slope && eMax > Math.max(eOut, ePk) ? ', or a lower Lip Height' : ''));
    need(tip >= 0 && (!vbit || tip < ed.diameter), 'Edges: the tip diameter must be 0 or more, and less than the bit\'s');
    // An inside pocket's corners are at least the bit's radius: an edge
    // there follows them.
    var shapeFor = function(h, t) { return cornered ? Object.assign({}, SH[h], { cr: Math.max(SH[h].cr, rb - t) }) : SH[h]; };
    // A V-bit higher up its cone (its edge faster there, cleaner in soft
    // wood): its axis further out into the air by s, its tip s / tan
    // deeper, the chamfer the same; as far as the air side has room, up to
    // the cone's middle. A slope's tip stays at its foot.
    // The bit's reach past the edge into the air, at zTop, with its axis
    // out by s (its tip down to z0 - d - s / tan).
    var reachAt = function(s, z0, d, zTop) { return tip / 2 + s + Math.min(tip / 2 + s + (zTop - z0 + d) * tan, ed.diameter / 2); };
    // A ring's middle (a glued-on floor's), held by tabs in the slot cut
    // round it, stands at the stock top: an inside edge's bit stays out of it.
    var ringIn = function(h, t, u) { return bot && h === 'base' && u < 0; };
    var shiftFor = function(h, t, u, z0, d, what) {
      // A heart's or drawing's corners, an oval's tight ends: the box bit
      // leaves them rounder than the loops the edge follows, and a cone
      // further out would cut into what it leaves. A ring's inside: the
      // slot round its middle is all the room.
      if (!vbit || /slope/.test(what) || (S.kind === 'outline' && !oval) || ringIn(h, t, u)) return 0;
      if (u < 0 && oval && S.cr + t < rb - 1e-9) return 0;
      var w = width(d), s = ed.diameter / 4 - tip / 2 - w, top = -faces[h];
      // The tip m above what's below it; the bit's far side within r of
      // the edge at zTop (at the edge's top, unless what's higher is nearer).
      var over = function(floorZ, m) { s = Math.min(s, (z0 - d - floorZ - m) * tan); };
      var fit = function(r, zTop) {
        var A = tip / 2 + (zTop - z0 + d) * tan;
        s = Math.min(s, Math.max((r - tip / 2 - A) / 2, r - tip / 2 - ed.diameter / 2));
      };
      if (what === 'outside seam edge') {
        over(top - height[h] + (o.tabs ? o.tabs.height : 0), 0.5);
        // Below it, only the outline's slot; down at a shoulder or a faced
        // top, the waste round it is cleared as far as the bit reaches, the
        // Gap allowing.
        fit(2 * rb - 0.3, z0);
        if (z0 < -1e-9 && !B.sep) s = Math.min(s, (o.gap - o.bit - 1 - (tip / 2 + Math.min(tip / 2 + (-z0 + d) * tan, ed.diameter / 2))) / 2);
      } else if (what === 'lip\'s outer edge') {
        // The shoulder's floor below; out past the outline, the stock top
        // (round a faced half too, cleared only so far).
        over(z0 - lipUp, 0.2);
        fit(-tLip + 2 * rb - 0.3, 0);
      } else if (what === 'opening edge') over(z0 - rabbetDepth, 0.2);
      else {
        over(top - (height[h] - under[h]) + (o.corners ? o.corners.radius : 0), 0.5);
        fit(2 * (deep + tInside) - 1, z0);
      }
      // Inside, round corners at least the box bit's: the bit's axis still
      // goes round them.
      if (u < 0) s = Math.min(s, rb - tip / 2 - 0.2);
      return s > 0.05 ? Math.floor(s * 100) / 100 : 0;
    };
    var insetSaid = false;
    var add = function(h, t, u, z0, d, what) {
      if (!(d > 0)) return;
      // An inset floor's ring: its top is the board's underside as it's cut.
      if (inset && h === 'base') {
        if (!insetSaid) notes.push('Inset Floor: the ring\'s edges are left as they are, as its top is the board\'s underside while it\'s cut.');
        insetSaid = true;
        return;
      }
      // A drop-in lid's panel is square-edged.
      if (drop && h === 'lid') return;
      // A solid lid has no inside: the lip has no inner edge.
      if (plugLid && h === 'lid' && u < 0) return;
      if (ringIn(h, t, u) && (vbit ? reachAt(0, z0, d, 0) : tip + R) > t - tInside + 2 * rb - 0.3) {
        notes.push('Glued-On Floor: the ring\'s ' + what + ' is left as it is, as the edge bit would reach its middle, held only by tabs.');
        return;
      }
      // air: how far it goes down before it touches (to the program's
      // 0.001 mm, the shift from it).
      var air = Math.floor(shiftFor(h, t, u, z0, d, what) / tan * 1000) / 1000, s = air * tan;
      edgeAt[h].push({ op: 'edge', shape: u < 0 ? shapeFor(h, t) : SH[h], t: t + u * (tip / 2 + s), u: u, at: t, z0: z0, depth: d + air, air: air, chamfer: d, width: width(d), what: what });
    };
    var tops = { base: -faces.base, lid: -faces.lid };
    add(rabbetHalf, 0, 1, tops[rabbetHalf], ed.outside, 'outside seam edge');
    add(lipHalf, 0, 1, tops[lipHalf] - lipUp, ed.outside, 'outside seam edge');
    add(rabbetHalf, tRabbet, -1, tops[rabbetHalf], lead, 'opening edge');
    add(lipHalf, tLip, 1, tops[lipHalf], lead, 'lip\'s outer edge');
    // The V-bit's tip at the foot of each slope: the opening's floor, the shoulder.
    if (slope && !part) {
      add(rabbetHalf, tOpen, -1, tops[rabbetHalf], rabbetDepth, 'opening\'s sloped wall');
      add(lipHalf, tLip, 1, tops[lipHalf], lipUp, 'lip\'s sloped side');
    } else if (part) add(lipHalf, tLip, 1, tops[lipHalf], slopeUp, 'lip\'s sloped top');
    add(lipHalf, tInside, -1, tops[lipHalf], ed.pocket, 'lip\'s inner edge');
    // The step the lip sits on, in the other half: its inner edge is down
    // at the step, the widened opening's wall above it (a sloped one
    // leans away as the V-bit's cone does). Where the bit would reach that
    // wall, or the step's too narrow, it's left: a note says so.
    var stepW = tOpen - tInside, upStep = rabbetDepth + ed.pocket;
    var stepFits = !flush && ePk <= stepW - 0.3 && (vbit ? (slope && !part ? ePk : Math.min(upStep * tan, ed.diameter / 2) - slopeD * tan) : R) <= stepW - 0.3;
    if (stepFits) add(rabbetHalf, tInside, -1, tops[rabbetHalf] - rabbetDepth, ed.pocket, 'step\'s inner edge');
    else if (ed.pocket > 0 && !flush && !inset) notes.push('Inside Rim: the step\'s inner edge in the ' + rabbetHalf + ' is left as it is, as the edge bit would cut the opening\'s wall above it. A narrower V-bit, a wider Lip Thickness or a lower Lip Height lets it be cut.');
    // What each edge leaves: the rim between the outline and the widened
    // opening, the shoulder outside the lip, the lip itself.
    need(eOut + eRim <= -tRabbet - 0.5, 'Edges too big for the rim round the widened opening: make them smaller, or the wall thicker');
    if (part) need(slopeH >= 0.5, 'Slope Height must be at least 0.5 mm, or empty for the whole lip');
    if (slope) need(eIn + ePk <= o.lipWidth - 1, 'Sloped lip: at the V-bit\'s ' + +(+ed.angle).toFixed(1) + '\u00b0, the lip slants in ' + (eIn + ePk).toFixed(2) + ' mm' + (ePk > 0 ? ' (with the Inside Rim)' : '') +
      ', and the lip is ' + (+o.lipWidth).toFixed(2) + ' mm thick: it needs 1 mm more than the slant. Make the Lip Thickness ' + (eIn + ePk + 1).toFixed(2) + ' mm or more, the Lip Height lower, or use a V-bit with a narrower angle');
    else need(eIn + ePk <= o.lipWidth - 0.3, 'Lead-In and Inside Rim too big for the lip: they take ' + (eIn + ePk).toFixed(2) + ' mm of it');
    // The lip's inner edge at its top; the step's down at the opening's
    // floor (when it's cut), each 1 mm above its half's inside.
    if (ed.pocket > 0) need(!(!drop && ed.pocket >= height[lipHalf] - under[lipHalf] - 1) && !(stepFits && ed.pocket >= height[rabbetHalf] - under[rabbetHalf] - rabbetDepth - 1), 'Inside Rim too deep for the inside');
    // The seam on the half with the lip is down at the shoulder: the bit,
    // as high as the lip, must clear it (a V-bit's cone at the lip's top,
    // no wider than the bit, in from its axis out in the air; a roundover
    // bit's head).
    if (ed.outside > 0 && !drop) {
      var eS = edgeAt[lipHalf].filter(function(x) { return x.what === 'outside seam edge'; })[0];
      var inward = vbit ? Math.min(tip / 2 + (lipUp + (eS ? eS.depth : ed.outside)) * tan, ed.diameter / 2) - (eS ? eS.u * (eS.t - eS.at) : tip / 2) : R;
      need(inward <= -tLip - 0.3, 'The outside seam\'s bit would cut into the lip: make the seam smaller, the Wall thicker, the Lip Height lower, or use a narrower V-bit');
      ['base', 'lid'].forEach(function(h) {
        var e = edgeAt[h].filter(function(x) { return x.what === 'outside seam edge'; })[0], high = e ? -e.z0 + e.depth : 0;
        // From the edge: the bit's axis half the tip out, its widest at that height.
        if (e && -e.z0 > 1e-9) reachOut[h] = vbit ? e.u * (e.t - e.at) + Math.min(tip / 2 + high * tan, ed.diameter / 2) : tip + R;
      });
    }
    // The bit's tip stays above what's below the edges inside: the
    // shoulder by the lip, the widened opening's floor.
    need(!(lead >= lipUp - 0.2) && !(lead > rabbetDepth - 0.2), 'Lead-In edges must be less deep than the Lip Height');
    need(!(ed.outside >= (drop ? baseH - botStep - rabbetDepth + lipUp : Math.min(baseH, lidH)) - lipUp - (o.tabs ? o.tabs.height : 0) - 1), 'Outside seam edge too deep for the halves');
    // An inside edge's bit fits across the inside.
    var reach = vbit ? tip + Math.max(eIn, ePk, slope && !part ? width(rabbetDepth) : 0) : tip + R;
    if (lead > 0 || ed.pocket > 0 || slope) need(deep + tInside > reach + 0.5, 'Edges: the inside is too small for the edge bit');
    // Beside the finger notch and the magnet holes.
    if (notchCut) {
      need(!(ed.outside > o.notch.depth - 0.3), 'The outside seam must be less deep than the finger notch');
      if (lipOnLid && !drop) need(notchCut.shape.r <= -tRabbet - eRim - 0.8, 'Finger notch too wide for the rim left by the opening\'s edge');
    }
    if (magnetAt.length) need(Math.max(eOut, eRim) + o.magnets.diameter / 2 <= -tRabbet / 2 - 0.5, 'Edges too big beside the magnet holes');
    // Clearing that far round the seam stays clear of the other half.
    if (!B.sep && !drop) need(Math.max(reachOut.base, reachOut.lid) + 1 <= o.gap - o.bit, 'The outside seam\'s bit reaches too far for the Gap: make the Gap wider');
  }

  // Rounded floor corners: the box's bit stops the corner's radius short
  // of the wall for that last bit of each pocket; a ball or bowl bit then
  // goes round the wall down to the floor, its side on the wall, its
  // rounded end leaving the cove.
  var cornerAt = { base: [], lid: [], bottom: [] }, cn = o.corners, rc = 0;
  if (cn && (cn.radius > 0 || cn.diameter > 0)) {
    rc = cn.radius;
    need(cn.diameter > 0 && rc > 0 && 2 * rc <= cn.diameter + 1e-9, 'Corners: give the bit\'s diameter, and its corner radius (half the diameter for a ball bit)');
    need(deep + tInside > cn.diameter / 2 + 0.5, 'Corners: the inside is too small for the corner bit');
    need(deep + tInside - rc > rb + 0.1, 'Corners: the inside is too small for the box\'s bit to clear the floor inside the rounded corners');
    // (A ring has no floor to round.)
    // (Nor a flat inside as wide as the opening: no wall under the lip.)
    (bot ? ['lid'] : ['base', 'lid']).filter(function(h) { return !(flush && h === rabbetHalf) && !((plugLid || drop) && h === 'lid'); }).forEach(function(h) {
      var depth = height[h] - under[h] - (h === rabbetHalf ? rabbetDepth : 0);
      // In the half without the lip, the wall between its floor and the
      // step the lip sits on.
      need(rc <= depth - 0.5, 'Corners: the radius is too big for the ' + h + '\'s inside: ' + (h === rabbetHalf ? 'the wall between its ' + (h === 'lid' ? 'top' : 'floor') + ' and the step the lip sits on is ' : 'its wall is ') +
        +Math.max(0, depth).toFixed(2) + ' mm high, and the cove needs its radius + 0.5 mm. Make the Cove Radius smaller, ' + (h === 'lid' ? 'the Lid Top thinner or the Lid Height taller' : 'the Base Floor thinner') + (h === rabbetHalf ? ', or the Lip Height lower' : ''));
      var floorZ = -faces[h] - (height[h] - under[h]);
      cornerAt[h].push({ op: 'corner', shape: cornered ? Object.assign({}, SH[h], { cr: Math.max(SH[h].cr, rb - tInside) }) : SH[h],
        t: tInside - cn.diameter / 2, z0: floorZ + rc, depth: rc, what: 'floor corners rounded' });
    });
  }

  // Compartments: dividers left standing in the base's inside, its
  // pocket down to their top, then each compartment its own pocket down
  // to the floor. Full: up to where the lid reaches down (the opening's
  // floor, with the lip on the lid), below any Inside Rim chamfer.
  // A grid (Rows x Columns) or wedges (Sections from the middle, the
  // first divider to the back turned Angle degrees counterclockwise, a
  // round Middle compartment if asked). A rectangle's grid: exact rounded
  // rectangles; the rest: the inside cut by the dividers' lines.
  var comp = null, cp = o.compartments;
  var cWedge = !!cp && (cp.layout ? cp.layout === 'wedges' : !rect);
  if (cp && (cWedge ? cp.sections >= 2 : cp.rows * cp.cols > 1)) {
    var cThick = cp.thickness, cDepth = baseH - under.base, cMinW = o.bit + 1 + 2 * fin0;
    var cFull = (rabbetHalf === 'base' ? rabbetDepth : 0) + (ed && ed.pocket > 0 ? ed.pocket : 0);
    var cTop = cp.height > 0 ? cDepth - cp.height : cFull, cells = [], cSize = null;
    need(!bot, 'Compartments need the base\'s own floor: with a Glued-On Floor the ring\'s inside is cut through, so the dividers would come loose');
    need(cThick >= 1, 'Compartments: Divider Thickness must be at least 1 mm');
    need(cp.height == null || cp.height > 0, 'Compartments: Divider Height must be more than 0, or empty for full height');
    if (cp.height > 0) need(cTop >= cFull - 1e-9, 'Compartments: Divider Height can be at most ' + down2(cDepth - cFull) + ' mm (' + (rabbetHalf === 'base' ? 'under the lid\'s lip' : 'the base\'s inside') + (ed && ed.pocket > 0 ? ', below the Inside Rim' : '') + ')');
    need(cDepth - cTop >= 1, 'Compartments: no room for dividers: ' + (rabbetHalf === 'base' ? 'the lid\'s lip reaches the base\'s floor; make the Lip Height lower' : 'the base\'s inside is too shallow'));
    // Sizes as shares, one for each (null: equal).
    var cShares = function(list, n, what, many) {
      if (list == null) return null;
      var ok = Array.isArray(list) && list.every(function(x) { return typeof x === 'number' && x > 0 && isFinite(x); });
      need(ok, 'Compartments: ' + what + ' must be numbers more than 0, such as 1 2 1');
      need(!ok || list.length === n, 'Compartments: ' + what + ' has ' + (ok ? list.length : 0) + (ok && list.length === 1 ? ' number' : ' numbers') + ', and there ' + (n === 1 ? 'is 1 ' + many.replace(/s$/, '') : 'are ' + n + ' ' + many) + ': give one for each, or leave it empty for equal');
      return ok && list.length === n ? list : null;
    };
    var cIn = shapeLoop(S, tInside), cExt = cIn ? loopExtent(cIn) : { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    if (!cWedge) {
      var cRows = cp.rows, cCols = cp.cols;
      need(cRows >= 1 && cCols >= 1 && cRows <= 12 && cCols <= 12 && cRows === Math.round(cRows) && cCols === Math.round(cCols), 'Compartments: Rows and Columns must be whole numbers from 1 to 12');
      // Each column's width and row's depth: its share of the room left
      // by the dividers (equal without sizes), and where each starts.
      var cSpans = function(room, n, list) {
        var sum = list ? list.reduce(function(a, b) { return a + b; }, 0) : n;
        return Array.from({ length: n }, function(_, i) { return room * (list ? list[i] : 1) / sum; });
      };
      var cStarts = function(lo, spans) { var at = lo, out = []; spans.forEach(function(w) { out.push(at); at += w + cThick; }); return out; };
      var cWs = cSpans(cExt.maxX - cExt.minX - (cCols - 1) * cThick, cCols, cShares(cp.colSizes, cCols, 'Column Sizes', 'Columns'));
      var cHs = cSpans(cExt.maxY - cExt.minY - (cRows - 1) * cThick, cRows, cShares(cp.rowSizes, cRows, 'Row Sizes', 'Rows'));
      var cXs = cStarts(cExt.minX, cWs), cYs = cStarts(cExt.minY, cHs);
      var cW = Math.min.apply(null, cWs), cH = Math.min.apply(null, cHs);
      cSize = { w: cW, h: cH, ws: cWs, hs: cHs, xs: cXs, ys: cYs };
      var cEven = function(l) { return l.every(function(x) { return Math.abs(x - l[0]) < 1e-6; }); };
      need(Math.min(cW, cH) >= cMinW, 'Compartments: ' + (cEven(cWs) && cEven(cHs) ? 'each is ' + down2(cW) + ' x ' + down2(cH) + ' mm' : 'the smallest is ' + down2(cW) + ' mm wide' + (cH < cW ? ' or ' + down2(cH) + ' mm deep' : '')) + ', and the bit needs at least ' + down2(cMinW) + ' mm: fewer Rows or Columns, thinner dividers' + (cp.rowSizes || cp.colSizes ? ', or sizes closer to equal' : ''));
      if (rect) {
        // Its corners as round as the inside's (its corner in the box's
        // corner follows the inside's).
        // (Only the corner compartments: the middle ones' corners are square to the dividers.)
        var cCr = Math.max(0, S.cr + tInside);
        need(Math.min(cWs[0], cWs[cCols - 1], cHs[0], cHs[cRows - 1]) >= 2 * cCr - 1e-9, 'Compartments: ' + (cEven(cWs) && cEven(cHs) ? 'each is' : 'a corner one is') + ' narrower than the inside\'s corners are round (' + down2(2 * cCr) + ' mm): fewer Rows or Columns, or a smaller Corner Radius');
        for (var cr0 = 0; cr0 < cRows; cr0++) for (var cc0 = 0; cc0 < cCols; cc0++)
          cells.push({ dx: cXs[cc0] + cWs[cc0] / 2, dy: cYs[cr0] + cHs[cr0] / 2, shape: { kind: 'rect', hx: cWs[cc0] / 2, hy: cHs[cr0] / 2, cr: Math.min(cCr, cWs[cc0] / 2, cHs[cr0] / 2) } });
      } else if (cMinW <= Math.min(cW, cH)) for (var gr = 0; gr < cRows; gr++) for (var gc = 0; gc < cCols; gc++) {
        var gx0 = cXs[gc], gy0 = cYs[gr], planes = [];
        if (gc > 0) planes.push({ nx: -1, ny: 0, c: -gx0 });
        if (gc < cCols - 1) planes.push({ nx: 1, ny: 0, c: gx0 + cWs[gc] });
        if (gr > 0) planes.push({ nx: 0, ny: -1, c: -gy0 });
        if (gr < cRows - 1) planes.push({ nx: 0, ny: 1, c: gy0 + cHs[gr] });
        cells.push({ dx: 0, dy: 0, shape: cellShape(S, tInside, planes, 0, 'grid' + gr + ',' + gc) });
      }
    } else {
      var cN = cp.sections, cMid = cp.middle > 0 ? cp.middle / 2 : 0, cA0 = Math.PI / 2 + (cp.angle || 0) * Math.PI / 180;
      need(cN >= 2 && cN <= 12 && cN === Math.round(cN), 'Compartments: Sections must be a whole number from 2 to 12');
      if (cMid > 0) {
        need(cMid >= cMinW / 2, 'Compartments: the Middle compartment must be at least ' + down2(cMinW) + ' mm across, for the bit');
        need(shapeDistance(S, tInside, 0, 0) <= -(cMid + cThick + cMinW), 'Compartments: the Middle compartment is too big for the inside: it needs its dividers and room for the bit round it');
      }
      // Each section's angle, its share of the way round, counterclockwise
      // from the first divider; where each divider points.
      var cOk = cN >= 2 && cN <= 12 && cN === Math.round(cN), cL = cOk ? cShares(cp.sizes, cN, 'Section Sizes', 'Sections') : null;
      var cSum = cL ? cL.reduce(function(a, b) { return a + b; }, 0) : cN, cAs = [], cDirs = [cA0];
      if (cOk) for (var wi = 0; wi < cN; wi++) { cAs.push(2 * Math.PI * (cL ? cL[wi] : 1) / cSum); cDirs.push(cDirs[wi] + cAs[wi]); }
      if (cOk) for (var wk = 0; wk < cN; wk++) {
        var wa = cDirs[wk], wb = cDirs[wk + 1];
        var wd = { x: Math.cos(wa), y: Math.sin(wa) }, we = { x: Math.cos(wb), y: Math.sin(wb) };
        var p1 = { nx: wd.y, ny: -wd.x, c: -cThick / 2 }, p2 = { nx: -we.y, ny: we.x, c: -cThick / 2 };
        // More than half way round: either side of the two dividers.
        cells.push({ dx: 0, dy: 0, shape: cellShape(S, tInside, cAs[wk] > Math.PI + 1e-9 ? [{ any: [p1, p2] }] : [p1, p2], cMid > 0 ? cMid + cThick : 0, 'wedge' + wk + '/' + cN) });
      }
      if (cMid > 0) cells.push({ dx: 0, dy: 0, shape: { kind: 'circle', r: cMid }, middle: true });
      cSize = { angle: 360 / cN, angles: cAs.map(function(a) { return a * 180 / Math.PI; }), dirs: cDirs.slice(0, -1), middle: cMid * 2 };
    }
    // Each compartment: room for the bit (and its finishing pass).
    var cSmall = cells.filter(function(c) { return c.shape.kind === 'outline' && !(c.shape.deep >= cMinW / 2); }).length;
    need(!cSmall, 'Compartments: ' + (cSmall === 1 ? 'one is' : cSmall + ' are') + ' too narrow for the bit (it needs ' + down2(cMinW) + ' mm across): fewer ' + (cWedge ? 'Sections' : 'Rows or Columns') + ', thinner dividers' + (cWedge && cMid > 0 ? ', a smaller Middle' : '') + ((cWedge ? cp.sizes : cp.rowSizes || cp.colSizes) ? ', or sizes closer to equal' : ''));
    // The dividers' middle lines, for a picture: across a grid, out from
    // the middle (or the Middle's ring) for wedges.
    var cLines = [], cRing = 0, cFar = 2 * Math.max(cExt.maxX - cExt.minX, cExt.maxY - cExt.minY);
    if (!cWedge) {
      for (var lc = 1; lc < cp.cols; lc++) { var lx = cSize.xs[lc] - cThick / 2; cLines.push({ x0: lx, y0: cExt.minY - 1, x1: lx, y1: cExt.maxY + 1 }); }
      for (var lr = 1; lr < cp.rows; lr++) { var ly = cSize.ys[lr] - cThick / 2; cLines.push({ x0: cExt.minX - 1, y0: ly, x1: cExt.maxX + 1, y1: ly }); }
    } else {
      cRing = cMid > 0 ? cMid + cThick / 2 : 0;
      for (var lk = 0; lk < cSize.dirs.length; lk++) { var la = cSize.dirs[lk]; cLines.push({ x0: cRing * Math.cos(la), y0: cRing * Math.sin(la), x1: cFar * Math.cos(la), y1: cFar * Math.sin(la) }); }
    }
    comp = { layout: cWedge ? 'wedges' : 'grid', thickness: cThick, top: cTop, height: cDepth - cTop, full: cFull, cells: cells, size: cSize, lines: cLines, ring: cRing };
    // The Inside Rim on the dividers: each compartment's top edge (as the
    // box's bit cuts it), only where the edge bit stays clear of the box's
    // wall rising above them: out and back along each such stretch, or
    // all round one that's clear of the wall (a Middle's).
    if (ed && ed.pocket > 0 && vbit !== undefined && !bot) {
      var dD = ed.pocket, dTop = -faces.base - comp.top;
      var axisReach = vbit ? Math.min(tip / 2 + (comp.top + dD) * tan, ed.diameter / 2) : tip / 2 + R;
      need(2 * width(dD) + 0.5 <= cThick, 'Inside Rim too big for the dividers: it takes ' + (2 * width(dD)).toFixed(2) + ' mm off their top, and they\'re ' + down2(cThick) + ' mm thick');
      need(dD <= comp.height - 1, 'Inside Rim too deep for the dividers');
      var chords = function(segs) {
        var out = [];
        segs.forEach(function(sg) {
          if (sg.type === 'line') { out.push(sg); return; }
          var k = Math.max(1, Math.ceil(sg.len / 0.1));
          for (var j = 0; j < k; j++) {
            var a0 = sg.a0 + (sg.a1 - sg.a0) * j / k, a1 = sg.a0 + (sg.a1 - sg.a0) * (j + 1) / k;
            var x0 = sg.cx + sg.r * Math.cos(a0), y0 = sg.cy + sg.r * Math.sin(a0), x1 = sg.cx + sg.r * Math.cos(a1), y1 = sg.cy + sg.r * Math.sin(a1);
            out.push({ type: 'line', x0: x0, y0: y0, x1: x1, y1: y1, len: Math.hypot(x1 - x0, y1 - y0) });
          }
        });
        return out;
      };
      // (Not for a trial plan, as Auto Sizes makes: only its problems count.)
      if (!o.quick) cells.forEach(function(c, i) {
        // The edge as cut: a rectangle's corners as round as the bit;
        // an outline's, the bit's path round it, out by its radius.
        var es = c.shape, at = 0;
        if (es.kind === 'rect') es = Object.assign({}, es, { cr: Math.max(es.cr, rb) });
        else if (es.kind === 'outline') {
          var cs = [];
          outlineLoops(es, -rb).forEach(function(l) { cs = cs.concat(l); });
          if (!cs.length) return;
          es = { kind: 'outline', segs: cs, key: es.key + ':cut', step: es.step, pad: 10 };
          at = rb;
        }
        var et = at - tip / 2, loop = shapeLoop(es, et);
        if (!loop) return;
        var L = loopLength(loop), n = Math.max(8, Math.ceil(L / 0.25)), keep = [];
        for (var k = 0; k < n; k++) { var q = loopPoint(loop, L * k / n); keep.push(shapeDistance(S, tInside, q.x + c.dx, q.y + c.dy) <= -(axisReach + 0.3)); }
        var push = function(lp, what) {
          edgeAt.base.push({ op: 'edge', shape: es, t: et, u: -1, at: at, dx: c.dx, dy: c.dy, loop: lp, z0: dTop, depth: dD, air: 0, chamfer: dD, width: width(dD), what: what });
        };
        var name = 'compartment ' + (i + 1) + '\'s top edge';
        if (keep.every(Boolean)) { push(loop, name); return; }
        // Each stretch clear of the wall: from a point that isn't.
        var k0 = keep.indexOf(false), runs = [], cur = null;
        for (var m = 1; m <= n; m++) {
          var idx = (k0 + m) % n;
          if (keep[idx]) { if (!cur) cur = { a: k0 + m, b: k0 + m }; else cur.b = k0 + m; }
          else if (cur) { runs.push(cur); cur = null; }
        }
        if (cur) runs.push(cur);
        runs.forEach(function(r) {
          var s0 = r.a * L / n, s1 = r.b * L / n;
          if (s1 - s0 < 1) return;
          var part = s1 <= L ? loopPart(loop, s0, s1) : s0 >= L ? loopPart(loop, s0 - L, s1 - L) : loopPart(loop, s0, L).concat(loopPart(loop, 0, s1 - L));
          var fw = chords(part), back = fw.slice().reverse().map(function(sg) { return { type: 'line', x0: sg.x1, y0: sg.y1, x1: sg.x0, y1: sg.y0, len: sg.len }; });
          push(fw.concat(back), name);
        });
      });
    }
    // Rounded floor corners: round each compartment's floor, not the
    // inside's (its corner bit's loop in each, as the box's bit leaves it).
    if (rc > 0) {
      need(rc <= comp.height - 0.5, 'Corners: the radius is too big for the dividers: they\'re ' + down2(comp.height) + ' mm high, and the cove needs its radius + 0.5 mm. Make the Cove Radius smaller, or the dividers taller');
      var cDeep = function(c) { var k = c.shape; return k.kind === 'outline' ? k.deep : k.kind === 'circle' ? k.r : Math.min(k.hx, k.hy); };
      var cTight = cells.filter(function(c) { return !(cDeep(c) > cn.diameter / 2 + 0.5 && cDeep(c) - rc > rb + 0.1); }).length;
      need(!cTight, 'Corners: ' + (cTight === 1 ? 'a compartment is' : cTight + ' compartments are') + ' too small for the corner bit, or for the box\'s bit to clear the floor inside the rounded corners');
      var cFloorZ = -faces.base - cDepth;
      cornerAt.base = cells.map(function(c, i) {
        return { op: 'corner', shape: c.shape.kind === 'rect' ? Object.assign({}, c.shape, { cr: Math.max(c.shape.cr, rb) }) : c.shape, t: -cn.diameter / 2, dx: c.dx, dy: c.dy,
          z0: cFloorZ + rc, depth: rc, what: 'floor corners rounded, compartment ' + (i + 1) };
      });
    }
  }
  // A compartment: the inside (S moved t) cut by the dividers' lines
  // (planes: n.p <= c inside, n a unit normal) and out of the middle
  // (radius hole). An outline with its own distance: exact inside where
  // the bit goes (its offsets in are the pieces' offsets in, cut alike).
  // deep: how far in its middle is, from a 1 mm sampling.
  function cellShape(S0, t, planes, hole, name) {
    // An outline's distance off its grid (the inside's contour is too).
    var g0 = S0.kind === 'outline' ? S0 : null;
    var sdf = function(x, y) {
      var d = g0 ? gridDistance(g0, x, y) - t : shapeDistance(S0, t, x, y);
      for (var i = 0; i < planes.length; i++) {
        var pl = planes[i], pa = pl.any;
        d = Math.max(d, pa ? Math.min(pa[0].nx * x + pa[0].ny * y - pa[0].c, pa[1].nx * x + pa[1].ny * y - pa[1].c) : pl.nx * x + pl.ny * y - pl.c);
      }
      return hole > 0 ? Math.max(d, hole - Math.hypot(x, y)) : d;
    };
    var e = cExt, bx = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }, lo = Infinity, at = null;
    for (var x = e.minX; x <= e.maxX + 1e-9; x += 1) for (var y = e.minY; y <= e.maxY + 1e-9; y += 1) {
      var v = sdf(x, y);
      if (v < lo) { lo = v; at = [x, y]; }
      if (v <= 1) { bx.minX = Math.min(bx.minX, x - 1); bx.maxX = Math.max(bx.maxX, x + 1); bx.minY = Math.min(bx.minY, y - 1); bx.maxY = Math.max(bx.maxY, y + 1); }
    }
    if (!(bx.maxX > bx.minX)) bx = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
    // Its deepest point, finer round the best of those.
    if (at) for (var fx = -1; fx <= 1 + 1e-9; fx += 0.1) for (var fy = -1; fy <= 1 + 1e-9; fy += 0.1) lo = Math.min(lo, sdf(at[0] + fx, at[1] + fy));
    return { kind: 'outline', sdf: sdf, box: bx, deep: -lo, cr: 0, pad: 10, step: gridStep(Math.max(e.maxX - e.minX, e.maxY - e.minY)),
      key: 'comp:' + (S0.key || JSON.stringify(S0)) + ':' + t.toFixed(4) + ':' + name + ':' + JSON.stringify(planes) + ':' + hole.toFixed(4) };
  }

  // Where the halves go: side by side along X (base first) or Y (base in front).
  // The margin is from the stock's edges to the cuts' outsides: the
  // outline's whole width, or the waste cleared round a seam.
  // One half on its own board: where the base would be on its own.
  var m = o.margin + Math.max(o.bit, reachOut.base + 1, reachOut.lid + 1), base = { x: 0, y: 0 };
  // The lid's reach each way: a drawing's mirrored (not always about the middle).
  var extL = mirror === 'x' ? { minX: -ext.maxX, maxX: -ext.minX, minY: ext.minY, maxY: ext.maxY }
    : mirror === 'y' ? { minX: ext.minX, maxX: ext.maxX, minY: -ext.maxY, maxY: -ext.minY } : ext;
  var lid = B.sep ? { x: 0, y: 0 } : o.layout === 'y' ? { x: 0, y: ext.maxY - extL.minY + o.gap } : { x: ext.maxX - extL.minX + o.gap, y: 0 };
  // A glued-on floor on the same board: past the lid, the Gap from it.
  var onBoard = bot && !B.sep && !B.bottomOwn;
  // Oversize: its outline that much further out all round.
  // An inset floor's panel: the rabbet's outline the Clearance smaller
  // (a heart's or drawing's half the bit more, as the plug), only cut out;
  // its own reach, in from the box's.
  var panelT = tR2 - o.clearance, panel = inset ? partIn(SA, tR2, rb, o.clearance) : null;
  var panelLoop = inset ? shapeLoop(panel.shape, panel.t) : null;
  var extB = panelLoop ? loopExtent(panelLoop) : { minX: ext.minX - botOv, maxX: ext.maxX + botOv, minY: ext.minY - botOv, maxY: ext.maxY + botOv };
  // A drop-in lid's panel: the rabbet's outline the Clearance smaller (a
  // heart's or drawing's half the bit more), beside the bottom on its board.
  var dropT = tLip, dropPart = drop ? partIn(S, tRabbet, rb, o.clearance) : null;
  var extP = drop ? loopExtent(shapeLoop(dropPart.shape, dropPart.t) || outlineAt0 || shapeLoop(S, 0)) : null;
  var bottomAt = B.sep || !onBoard ? { x: 0, y: 0 } : o.layout === 'y' ? { x: 0, y: lid.y + extL.maxY + o.gap - extB.minY } : { x: lid.x + extL.maxX + o.gap - extB.minX, y: 0 };
  // Both halves' reach from the base's middle (one on its own board: its own).
  var dropAt = drop ? (o.layout === 'y' ? { x: 0, y: extB.maxY + o.gap - extP.minY } : { x: extB.maxX + o.gap - extP.minX, y: 0 }) : null;
  var all = drop ? (o.cut === 'bottom' ? { minX: Math.min(extB.minX, dropAt.x + extP.minX), maxX: Math.max(extB.maxX, dropAt.x + extP.maxX), minY: Math.min(extB.minY, dropAt.y + extP.minY), maxY: Math.max(extB.maxY, dropAt.y + extP.maxY) } : ext)
    : B.sep ? (o.cut === 'lid' ? extL : o.cut === 'bottom' ? extB : ext) : { minX: Math.min(ext.minX, lid.x + extL.minX, onBoard ? bottomAt.x + extB.minX : Infinity),
    maxX: Math.max(ext.maxX, lid.x + extL.maxX, onBoard ? bottomAt.x + extB.maxX : -Infinity),
    minY: Math.min(ext.minY, lid.y + extL.minY, onBoard ? bottomAt.y + extB.minY : Infinity), maxY: Math.max(ext.maxY, lid.y + extL.maxY, onBoard ? bottomAt.y + extB.maxY : -Infinity) };
  // A Lid Tray: two pin holes on the line the board turns over on, end
  // for end (the line between the halves, as the lid turns over onto the
  // base), past the parts across it, clear of the outlines' slots; the
  // board that much bigger. Turned over, the lid's top is where the
  // lid's mirrored about that line, the box's own shape.
  var pins = null, pinLine = 0;
  if (tr) {
    var pinOff = Math.max(o.bit, reachOut.base + 1, reachOut.lid + 1) + 3 + trayPin / 2;
    if (o.layout === 'y') {
      pinLine = (all.minY + all.maxY) / 2;
      pins = [{ x: all.minX - pinOff, y: pinLine }, { x: all.maxX + pinOff, y: pinLine }];
      all = Object.assign({}, all, { minX: all.minX - pinOff - trayPin / 2, maxX: all.maxX + pinOff + trayPin / 2 });
    } else {
      pinLine = (all.minX + all.maxX) / 2;
      pins = [{ x: pinLine, y: all.minY - pinOff }, { x: pinLine, y: all.maxY + pinOff }];
      all = Object.assign({}, all, { minY: all.minY - pinOff - trayPin / 2, maxY: all.maxY + pinOff + trayPin / 2 });
    }
  }
  var stockW = all.maxX - all.minX + 2 * m, stockH = all.maxY - all.minY + 2 * m;
  // Origin: the stock's front-left corner, or the middle of the pair.
  var shift = o.origin === 'center' ? { x: -(all.minX + all.maxX) / 2, y: -(all.minY + all.maxY) / 2 } : { x: m - all.minX, y: m - all.minY };
  base = { x: base.x + shift.x, y: base.y + shift.y };
  lid = { x: lid.x + shift.x, y: lid.y + shift.y };
  bottomAt = { x: bottomAt.x + shift.x, y: bottomAt.y + shift.y };
  if (drop) dropAt = { x: dropAt.x + shift.x, y: dropAt.y + shift.y };
  if (pins) {
    pins = pins.map(function(p) { return { x: p.x + shift.x, y: p.y + shift.y }; });
    pinLine += o.layout === 'y' ? shift.y : shift.x;
  }
  // Grain matched: the lid's leaf turned over as the lid turns over onto
  // the base (side to side; along Y, front to back), so its corner that
  // was the front-left is now the front-right (back-left): the lid there,
  // as far from it as the base is from the front-left.
  var mirrored = B.sep && o.grain && o.cut === 'lid' && o.origin !== 'center';
  if (mirrored) lid = o.layout === 'y' ? { x: lid.x, y: -lid.y } : { x: -lid.x, y: lid.y };
  var originSay = o.origin === 'center' ? (drop && o.cut === 'bottom' ? 'the middle of the floor and the lid' : drop && !B.sep ? 'the middle of the ring' : B.sep ? 'the middle of the ' + (o.cut === 'bottom' ? 'floor' : o.cut === 'base' && bot ? 'ring' : o.cut) : onBoard ? 'the middle of the three' : 'the middle of the pair')
    : mirrored ? (o.layout === 'y' ? 'the leaf\'s back-left corner (was its front-left)' : 'the leaf\'s front-right corner (was its front-left)')
    : 'the stock\'s front-left corner';

  // With a Magnet Bit: its holes after the box, as the corners'.
  var magnetCuts = { base: [], lid: [], bottom: [] };
  // A mirrored lid's holes, mirrored, to land on the base's.
  function magnetsOf(name) {
    if (name === 'base' || !mirror) return magnetAt;
    return magnetAt.map(function(p) { return mirror === 'y' ? { dx: p.dx, dy: -p.dy } : { dx: -p.dx, dy: p.dy }; });
  }
  function inside(name) {
    var z0 = -faces[name], cuts = [], ring = bot && name === 'base';
    // An inset floor's ring: faced down if it's lower, the rabbet round
    // its inside, then the inside (the lid's opening) cut through.
    if (ring && inset) {
      var wasteI = Math.max(2 * rb, reachOut[name] + 1);
      if (faces[name] > 1e-9) cuts.push({ op: 'ring', shape: SA, tIn: tRabbet - 2 * rb, tOut: wasteI, dx: 0, dy: 0, z0: 0, depth: faces[name], what: 'faced down to the base height' });
      cuts.push({ op: 'ring', shape: SA, tIn: tRabbet - 2 * rb, tOut: tR2, finishOut: fin, floor: fin, dx: 0, dy: 0, z0: z0, depth: rabD, what: 'rabbet for the inset floor' });
      cuts.push({ op: 'profile', side: 'in', shape: SA, t: tRabbet, dx: 0, dy: 0, z0: 0, depth: T + o.through, tabs: o.tabs, finish: fin, last: true,
        what: 'inside (the lid\'s opening) cut through' + (o.tabs ? ', the middle held by tabs' : '') });
      return cuts;
    }
    // A ring's facing and opening steps all in to the same loop, the
    // innermost any step reaches (its middle is never pocketed down).
    var ringIn = !ring ? tInside : name !== rabbetHalf ? tInside
      : openSteps.reduce(function(m, st) { return Math.min(m, st.t - 2 * rb); }, tInside);
    var waste = Math.max(2 * rb, reachOut[name] + 1);
    // A ring's middle is cut out: only round it (its wall and out).
    if (faces[name] > 1e-9) cuts.push(ring ? { op: 'ring', tIn: ringIn, tOut: waste, dx: 0, dy: 0, z0: 0, depth: faces[name], what: 'faced down to the ' + name + ' height' }
      : { op: 'pocket', t: waste, dx: 0, dy: 0, z0: 0, depth: faces[name], what: 'faced down to the ' + name + ' height' });
    if (name === rabbetHalf) openSteps.forEach(function(st, i) {
      // A part slope's steps: no finishing lap (the lip's slope doesn't touch them), the floor skimmed under the last.
      var last = i === openSteps.length - 1;
      if (i === 0 && ring) cuts.push({ op: 'ring', tIn: ringIn, tOut: st.t, finishOut: fin, dx: 0, dy: 0, z0: z0 - st.d0, depth: st.d1 - st.d0, floor: last ? fin : 0,
        what: 'opening widened for the lip' + (slope && !part ? ' (its floor\'s width; the V-bit slopes its wall)' : '') });
      else if (i === 0 && flush && last) cuts.push({ op: 'pocket', t: st.t, dx: 0, dy: 0, z0: z0, depth: st.d1, finish: fin, what: 'inside, as wide as the opening for the lip' });
      else if (i === 0) cuts.push({ op: 'pocket', t: st.t, dx: 0, dy: 0, z0: z0 - st.d0, depth: st.d1 - st.d0, finish: fin, floor: last ? fin : 0, floorFrom: tInside,
        what: 'opening widened for the lip' + (slope && !part ? ' (its floor\'s width; the V-bit slopes its wall)' : '') });
      // The next only round the wall: the inside's own pocket clears the
      // middle (a bit wide at least, past the inside's wall into it).
      else cuts.push({ op: 'ring', tIn: ring ? ringIn : Math.min(tInside, st.t - 2 * rb), tOut: st.t, dx: 0, dy: 0, z0: z0 - st.d0, depth: st.d1 - st.d0, floor: last ? fin : 0,
        what: 'opening narrowed to the lip\'s slope, step ' + i });
    });
    // (A ring's inside is cut through last.)
    // A flat inside's the opening's pocket (a part slope's steps only go
    // round its wall: its middle cleared here, no coves without a wall).
    var inDepth = height[name] - under[name], flat = flush && name === rabbetHalf;
    // Under the opening widened for the lip, the inside starts at its
    // (rough) floor: above it, the opening's pocket has cleared it already.
    var st0 = openSteps[0], pre = name === rabbetHalf && !flat && !ring ? st0.d1 - (openSteps.length === 1 && fin > 0 && st0.d1 > fin + 1e-9 ? fin : 0) : 0;
    if (!ring && !(flat && openSteps.length === 1) && !(plugLid && name === 'lid')) {
      if (comp && name === 'base') {
        // Each compartment: its floor short of the corners for the last
        // of it, with rounded floor corners.
        if (comp.top - pre > 1e-9) cuts.push({ op: 'pocket', t: tInside, dx: 0, dy: 0, z0: z0 - pre, depth: comp.top - pre, finish: fin, what: 'inside, down to the dividers\' top' });
        comp.cells.forEach(function(c, i) {
          var cd = inDepth - comp.top - rc;
          cuts.push({ op: 'pocket', shape: c.shape, t: 0, dx: c.dx, dy: c.dy, z0: z0 - comp.top, depth: cd, finish: fin, what: 'compartment ' + (i + 1) });
          if (rc > 0) cuts.push({ op: 'pocket', shape: c.shape, t: -rc, dx: c.dx, dy: c.dy, z0: z0 - comp.top - cd, depth: rc, what: 'compartment ' + (i + 1) + ', its floor short of the corners' });
        });
      } else if (rc > 0 && !flat) {
        cuts.push({ op: 'pocket', t: tInside, dx: 0, dy: 0, z0: z0 - pre, depth: inDepth - rc - pre, finish: fin, what: 'inside' });
        cuts.push({ op: 'pocket', t: tInside - rc, dx: 0, dy: 0, z0: z0 - (inDepth - rc), depth: rc, what: 'inside, its floor short of the corners' });
      } else cuts.push({ op: 'pocket', t: tInside, dx: 0, dy: 0, z0: z0 - (flat ? 0 : pre), depth: inDepth - (flat ? 0 : pre), finish: fin, what: 'inside' });
    }
    // The shoulder: the wall top outside the lip, down by the Lip Height
    // less the Clearance,
    // out past the outline into the waste.
    if (name === lipHalf) cuts.push({ op: 'ring', tIn: tLip, tOut: waste, finish: fin, floor: fin, dx: 0, dy: 0, z0: z0, depth: lipUp, what: 'shoulder round the lip' });
    // The shoulder's floor is roughed short until it's skimmed (after the
    // holes): they start on the rough floor, not in wood.
    var under0 = name === lipHalf ? fin : 0;
    magnetsOf(name).forEach(function(p, i) {
      (o.magnets.bit > 0 ? magnetCuts[name] : cuts).push({ op: 'pocket', shape: { kind: 'circle', r: o.magnets.diameter / 2 }, t: 0, dx: p.dx, dy: p.dy, z0: z0 - meet[name] + under0, depth: o.magnets.depth + under0, what: 'magnet hole ' + (i + 1) });
    });
    if (name === 'base') notchCuts.forEach(function(c) { cuts.push(c); });
    // Last, the ring's inside cut through from the stock's top, the middle
    // held by tabs.
    if (ring) cuts.push({ op: 'profile', side: 'in', shape: SA, t: tInside, dx: 0, dy: 0, z0: 0, depth: T + o.through, tabs: o.tabs, finish: fin, last: true,
      what: 'inside cut through' + (o.tabs ? ', the middle held by tabs' : '') });
    return cuts;
  }
  // The bottom: a step round its edge, down to where the ring sits,
  // leaving a plug the Clearance inside the ring (a heart's or drawing's,
  // or an oval's with tight ends, half the bit more, to clear the corners
  // the bit rounds); its own corners as the ring's, then out past the
  // outline (and its Oversize, trimmed flush with the ring once it's
  // glued) into the waste.
  var plugT = tInside - o.clearance, plug = partIn(SA, tInside, rb, o.clearance);
  function bottomCuts() {
    if (inset) return [];
    var waste = botOv + 2 * rb;
    if (plug.shape === S) return [{ op: 'ring', tIn: plug.t, tOut: waste, finish: fin, floor: fin, dx: 0, dy: 0, z0: 0, depth: botStep, what: 'step round the plug' }];
    // (The plug's own shape: 2 bits past it, as far as the ring's inside and more.)
    return [{ op: 'ring', shape: plug.shape, tIn: plug.t, tOut: plug.shape === SA ? tInside + 2 * rb : plug.t + o.clearance + 2 * rb, finish: fin, floor: fin, dx: 0, dy: 0, z0: 0, depth: botStep, what: 'step round the plug' },
      { op: 'ring', tIn: tInside + rb, tOut: waste, floor: fin, dx: 0, dy: 0, z0: 0, depth: botStep, what: 'step out past the outline' }];
  }
  var halves = [
    { name: 'base', label: bot ? 'ring' : 'base', at: base, height: baseH, cuts: inside('base'), shape: S, magnetAt: magnetsOf('base'),
      outline: { op: 'profile', t: 0, z0: -faces.base, depth: baseH + o.through, tabs: o.tabs, what: 'outline' } },
    drop ? { name: 'lid', label: 'drop-in lid', at: dropAt, height: botH, cuts: [], shape: dropPart.shape, magnetAt: [],
      outline: { op: 'profile', t: dropPart.t, z0: 0, depth: botH + o.through, tabs: o.tabs, what: 'panel\'s outline' } }
    : { name: 'lid', label: 'lid', at: lid, height: lidH, cuts: inside('lid'), shape: SL, magnetAt: magnetsOf('lid'),
      outline: { op: 'profile', t: 0, z0: -faces.lid, depth: lidH + o.through, tabs: o.tabs, what: 'outline' } }
  ].concat(bot ? [{ name: 'bottom', label: inset ? 'inset floor' : 'floor', at: B.sep ? base : bottomAt, height: botH, cuts: bottomCuts(), shape: inset ? panel.shape : S, magnetAt: [],
      outline: { op: 'profile', t: inset ? panel.t : botOv, z0: 0, depth: botH + o.through, tabs: o.tabs, what: inset ? 'panel\'s outline' : botOv ? 'outline, oversize' : 'outline' } }] : [])
    .filter(function(h) {
      // A drop-in lid's panel: with the bottom, on its board.
      if (drop && h.name === 'lid') return o.cut === 'bottom';
      return B.sep ? h.name === o.cut : h.name !== 'bottom' || onBoard;
    });
  // The tray's program: the board turned over end for end onto the pins, the lid's
  // top up where the lid's mirrored about the pin line. The pin holes
  // bored through into the spoilboard, then the dish (its floor short of
  // the corners for a ball or bowl bit to round), then the Edge Bit round
  // the lid's top edge (in the waste the outline's cut in later) and the
  // dish's. Nothing's cut out: the box's program does that, after.
  edgeAt.top = []; cornerAt.top = []; magnetCuts.top = [];
  var trayAt = null;
  if (tr && pins) {
    trayAt = o.layout === 'y' ? { x: lid.x, y: 2 * pinLine - lid.y } : { x: 2 * pinLine - lid.x, y: lid.y };
    var tc = [], trc = tr.rounded && o.corners && o.corners.radius > 0 ? o.corners.radius : 0;
    if (tr.rounded && !trc) notes.push('Lid Tray: a rounded floor needs Floor Corners on, for its bit.');
    if (trc) need(trc <= tr.depth - 0.5, 'Lid Tray: the corner bit\'s radius is too big for the Tray Depth: it needs the radius + 0.5 mm');
    if (trc) need(shapeDeepest(S) - trayRim > o.corners.diameter / 2 + 0.5, 'Lid Tray: the dish is too small for the corner bit');
    pins.forEach(function(p, i) {
      tc.push({ op: 'pocket', shape: { kind: 'circle', r: trayPin / 2 }, t: 0, dx: p.x - trayAt.x, dy: p.y - trayAt.y, z0: 0, depth: T + 3, what: 'pin hole ' + (i + 1) + ', through and 3 mm into the spoilboard' });
    });
    tc.push({ op: 'pocket', t: -trayRim, dx: 0, dy: 0, z0: 0, depth: tr.depth - trc, finish: fin, what: 'tray' });
    if (trc) {
      tc.push({ op: 'pocket', t: -trayRim - trc, dx: 0, dy: 0, z0: -(tr.depth - trc), depth: trc, what: 'tray, its floor short of the corners' });
      cornerAt.top.push({ op: 'corner', shape: cornered ? Object.assign({}, S, { cr: Math.max(S.cr, rb + trayRim) }) : S, t: -trayRim - o.corners.diameter / 2, z0: -tr.depth + trc, depth: trc, what: 'tray\'s floor corners rounded' });
    }
    var te = o.edges, td = tr.edge > 0 ? tr.edge : 0;
    if (td && !te) notes.push('Lid Tray: its edges need Edges on, for the Edge Bit.');
    if (td && te) {
      var tv = te.bit !== 'round', tTip = (tv ? te.vtip : te.tip) || 0, tTan = Math.tan((te.angle || 90) * Math.PI / 360);
      var tW = tv ? td * tTan : te.radius - Math.sqrt(Math.max(0, te.radius * te.radius - td * td));
      if (!tv) need(td <= te.radius + 1e-9, 'Lid Tray: a roundover can\'t go deeper than the bit\'s radius');
      if (tv) need(tW + tTip / 2 <= te.diameter / 2 + 1e-9, 'Lid Tray: the V-bit is too small for its edges');
      need(td < tr.depth - 0.2, 'Lid Tray: its edges must be less deep than the Tray Depth');
      need(2 * tW <= trayRim - 0.5, 'Lid Tray: its edges are too big for the Tray Rim');
      edgeAt.top.push({ op: 'edge', shape: S, t: tTip / 2, u: 1, at: 0, z0: 0, depth: td, air: 0, chamfer: td, width: tW, what: 'lid\'s top edge' });
      edgeAt.top.push({ op: 'edge', shape: cornered ? Object.assign({}, S, { cr: Math.max(S.cr, rb + trayRim) }) : S, t: -trayRim - tTip / 2, u: -1, at: -trayRim, z0: 0, depth: td, air: 0, chamfer: td, width: tW, what: 'tray\'s edge' });
    }
    if (o.cut === 'top') halves = [{ name: 'top', label: 'lid top', at: trayAt, height: T, cuts: tc, shape: S, magnetAt: [], outline: null }];
  }
  // (Floor Only without a bottom: nothing to cut, said.)
  var one = halves[0] || { name: 'base', at: base };
  var plan = {
    o: o, problems: problems, notes: notes, shape: S, mirror: mirror, halfX: halfX, halfY: halfY, ext: ext, margin: m,
    tInside: tInside, tRabbet: tRabbet, tLip: tLip, tOpen: tOpen, slope: slope ? slant : 0, slopeUp: slope ? slopeUp : 0, slopeD: slopeD, openSteps: openSteps, rabbetDepth: rabbetDepth, lipUp: lipUp, lidHeight: lidH, baseHeight: baseH, face: face, faces: faces,
    tray: tr ? { depth: tr.depth, rim: trayRim, pin: trayPin, wood: trayWood, at: trayAt, pins: pins, line: pinLine, along: o.layout === 'y' ? 'y' : 'x' } : null,
    halves: halves, compartments: comp, magnetAt: magnetAt, magnets: magnetCuts, notch: notchCut, notches: notchCuts, edges: edgeAt, corners: cornerAt, boards: B, originSay: originSay,
    // The stock needed: its size and front-left corner.
    // (A drop-in lid's board: the bottom and the panel, about the bottom.)
    stock: drop && o.cut === 'bottom' ? { w: stockW, h: stockH, x0: shift.x + all.minX - m, y0: shift.y + all.minY - m, thick: botH }
      : B.sep ? { w: stockW, h: stockH, x0: one.at.x + all.minX - m, y0: one.at.y + all.minY - m, thick: one.name === 'lid' ? B.lid : one.name === 'bottom' ? botH : T }
      : { w: stockW, h: stockH, x0: shift.x + all.minX - m, y0: shift.y + all.minY - m, thick: T },
    // A glued-on floor: the plug, how far it's in from the outline, the
    // step, where the ring sits on it (from its underside).
    // An inset floor: the panel's (t) in from the outline, the rabbet
    // (from the ring's inside, tIn, out to tOut, depth deep) it's glued in.
    // (part: the plug's or panel's outline as cut, its own shape and offset.)
    bottom: bot ? { style: inset ? 'inset' : 'plug', t: inset ? panelT : plugT, shape: SA, part: inset ? panel : plug, step: botStep, height: botH, up: inset ? recess : botH - botStep, own: !!B.bottomOwn, oversize: botOv,
      rabbet: inset ? { tIn: tRabbet, tOut: tR2, depth: rabD, width: rabW } : null, recess: recess } : null,
    lidStyle: drop ? 'drop' : plugLid ? 'plug' : 'carved', drop: drop ? { t: dropT, height: botH, part: dropPart } : null,
    // Each half's outside, to the seam; closed, the two.
    baseOut: B.baseOut, lidOut: drop ? 0 : B.lidOut, closedHeight: B.baseOut + (drop ? 0 : B.lidOut),
    insideHeight: drop ? baseH - botStep - rabbetDepth : (baseH - under.base - botStep) + (plugLid ? 0 : lidH - o.top) - lipUp
  };
  // Each half knows its box (a nested set's halves come from several).
  halves.forEach(function(h) { Object.defineProperty(h, 'plan', { value: plan }); });
  return plan;
}

// The box's outline: its shape, or null for a heart, oval or drawing that
// can't be; mirror: a drawing turned over ('x' or 'y'), for the lid.
function shapeOf(o, mirror) {
  var n = Math.round(o.sides), polyRot = (o.layout === 'y' ? Math.PI : -Math.PI / 2) - Math.PI / n;
  return o.shape === 'rect' ? { kind: 'rect', hx: o.length / 2, hy: o.width / 2, cr: Math.max(0, Math.min(o.cornerRadius || 0, o.length / 2, o.width / 2)) }
    : o.shape === 'poly' ? { kind: 'poly', n: n, a: o.flats / 2, cr: Math.max(0, Math.min(o.cornerRadius || 0, o.flats / 2)), rot: polyRot }
    : o.shape === 'oval' ? ovalShape(o.length, o.width)
    : o.shape === 'heart' ? heartShape(o.length, o.width, o.cornerRadius, o.layout === 'y')
    : o.shape === 'custom' ? customShape(o.outline && o.outline.pts, o.length, o.width, o.cornerRadius, mirror, o.outline && o.outline.exact)
    : { kind: 'circle', r: o.diameter / 2 };
}

// The boards: the base's is the stock; the lid's too, unless it's cut on
// its own (lidStock). A glued-on floor's board: its own (cut with Bottom
// Only when it isn't as thick as the stock), or the stock.
// Base Height and Lid Height: the box's outside, from its bottom or top
// to the seam (the base's from the bottom board's underside), or null for
// as high as the board allows. Each half's own height (baseH, lidH): that,
// the half with the lip the lip higher, the ring the bottom less its step
// lower. A Lip Height deeper than, or within 1 mm of, the inside of the
// half its opening's cut in is made as deep as it (lip): no step there.
function boardsOf(o) {
  var sep = o.cut === 'base' || o.cut === 'lid' || o.cut === 'bottom', T = o.stock, lid = (o.cut === 'base' || o.cut === 'lid') && o.lidStock > 0 ? o.lidStock : T;
  // (An inset floor's panel is inside the ring: nothing under it.)
  var inset = !!(o.bottom && o.bottom.style === 'inset');
  var bot = o.bottom ? (o.bottom.board > 0 ? o.bottom.board : T) : 0, botX = o.bottom && !inset ? bot - o.bottom.step : 0, onLid = o.lipOn === 'lid';
  var openH = onLid ? (o.baseHeight > 0 ? o.baseHeight - botX : T) : (o.lidHeight > 0 ? o.lidHeight : lid);
  var room = openH - (onLid ? (o.bottom ? o.bottom.step : o.floor) : o.top), lip = o.lipHeight;
  // (An inset floor's ring has no step to meet: the lip stops short of the panel.)
  // (Nor a solid lid's: raised to the floor, the plug would fill the base.)
  if (!inset && o.lidStyle !== 'plug' && o.lidStyle !== 'drop' && lip > room - 1 && lip !== room && room - o.clearance > 0.5) lip = room;
  var up = lip - o.clearance;
  // A drop-in lid: the ring alone, the panel flush in its top.
  if (o.lidStyle === 'drop') {
    var ringH = o.baseHeight > 0 ? o.baseHeight - botX : T;
    return { sep: sep, base: T, lid: lid, baseH: ringH, lidH: bot, lip: lip, lipFlush: false, baseOut: ringH + botX, lidOut: 0,
      bottom: bot, bottomOwn: !!o.bottom && Math.abs(bot - T) > 1e-6 };
  }
  var baseH = o.baseHeight > 0 ? o.baseHeight - botX + (onLid ? 0 : up) : T, lidH = o.lidHeight > 0 ? o.lidHeight + (onLid ? up : 0) : lid;
  return { sep: sep, base: T, lid: lid, baseH: baseH, lidH: lidH, lip: lip, lipFlush: lip !== o.lipHeight,
    baseOut: baseH + botX - (onLid ? 0 : up), lidOut: lidH - (onLid ? up : 0),
    bottom: bot, bottomOwn: !!o.bottom && Math.abs(bot - T) > 1e-6 };
}

// The floor (or a glued-on floor's board) and the top: what's between
// the box's inside height and its outside.
function down2(v) { return Math.floor(v * 100 + 1e-6) / 100; }
// Under the inside: the floor, a Floor Board (an inset one's and its
// Recess too). Over it: the top, or a solid lid's whole height.
function capsUnder(o) {
  var b = o.bottom;
  return b ? (b.board > 0 ? b.board : o.stock) + (b.style === 'inset' && b.recess > 0 ? b.recess : 0) : o.floor;
}
function capsOver(o) {
  if (o.lidStyle === 'drop') return o.bottom ? (o.bottom.board > 0 ? o.bottom.board : o.stock) : 0;
  if (o.lidStyle !== 'plug') return o.top;
  var lid = (o.cut === 'base' || o.cut === 'lid') && o.lidStock > 0 ? o.lidStock : o.stock;
  return o.lidHeight > 0 ? o.lidHeight + o.lipHeight - o.clearance : lid;
}
function heightCaps(o) { return capsUnder(o) + capsOver(o); }

// The settings as a plan takes them, from the box's sizes as given.
// measure 'inside': a round, rectangular or polygon box's sizes are its
// inside (the outside two walls more), and the height its inside (the
// floor and top more). height: the box closed, its base what the Lid
// Height leaves of it (baseLow: nothing left), or null for as high as
// the boards allow.
function outsideInput(input) {
  var o = Object.assign({}, DEFAULTS, input || {}), inside = o.measure === 'inside';
  if (inside && /^(circle|rect|poly)$/.test(o.shape)) ['diameter', 'length', 'width', 'flats'].forEach(function(k) { if (o[k] > 0) o[k] += 2 * o.wall; });
  o.baseLow = false;
  if (o.height > 0) {
    // A Lid Height left empty: as high as its board allows with the lip
    // as set (a lip lowered for a low base doesn't raise it).
    if (!(o.lidHeight > 0)) o.lidHeight = boardsOf(Object.assign({}, o, { baseHeight: null })).lidOut;
    o.baseHeight = o.height + (inside ? heightCaps(o) : 0) - o.lidHeight;
    // Nothing left of the base above its floor (or the Floor Board).
    o.baseLow = !(o.baseHeight > capsUnder(o));
  }
  return o;
}

// A small box with the same fit, only as deep inside as the lip needs:
// cut it first to try the Clearance, both halves from one board. No
// magnets, notch, edges (but a sloped lip) or faced lid. A
// rectangle keeps its corner radius (where a lip fits worst).
function testFitInput(input) {
  var o = Object.assign({}, DEFAULTS, input || {});
  var half = o.wall + Math.max(10, 2 * o.bit), deep = o.lipHeight + 2, B = boardsOf(o);
  // A heart's point under its lobes' radius (about half / 1.72).
  if (o.shape === 'heart') half = Math.max(half, ((o.cornerRadius || 0) + 1) * 1.72);
  var cr = Math.min(o.cornerRadius || 0, half), custom = o.shape === 'custom';
  // A drawing in its own proportions, its narrower way 2 hf.
  var k = custom && o.length > 0 && o.width > 0 ? 1 / Math.min(o.length, o.width) : 0;
  var fit = function(hf) {
    return Object.assign({}, o, {
      diameter: 2 * hf, length: k ? 2 * hf * o.length * k : 2 * hf, width: k ? 2 * hf * o.width * k : 2 * hf, flats: 2 * hf, cornerRadius: cr,
      lidHeight: null, baseHeight: null, height: null, baseLow: false, magnets: null, notch: null, corners: null, cut: 'both', grain: false, bottom: null, lidStyle: null, tray: null,
      edges: o.edges && o.edges.slope ? Object.assign({}, o.edges, { outside: 0, inside: 0, pocket: 0 }) : null,
      floor: Math.max(1, B.base - deep), top: Math.max(1, B.base - deep)
    });
  };
  // A heart or drawing big enough for its inside to stay in one piece at
  // the walls, and a drawing for its corners not to cut it apart.
  for (var j = 0; j < 12 && (o.shape === 'heart' || custom) && boxPlan(Object.assign(fit(half), { quick: true })).problems.some(function(p) { return /comes apart|cuts the drawing apart|rounds the drawing away/.test(p); }); j++) half *= 1.1;
  return fit(half);
}

// A nested set: count boxes, each inside the one before with gap all
// round it and over it, its halves faced down to fit, in the same
// proportion as the first's. tune(input): what to change for each box
// (Auto Sizes), or none. Stops at the last that fits.
// A problem other sizes can fix, as Auto Sizes does.
function fixable(q) {
  return !/must be wider than the (Magnet )?[Bb]it|^The Magnet Bit is a drill|^Magnet holes too deep|^Magnet hole depth|^Magnets: the count|even number of magnets/.test(q);
}
function nestInputs(input, count, gap, tune) {
  var list = [Object.assign({}, DEFAULTS, input || {}, { cut: 'both', baseHeight: null, height: null, baseLow: false, tray: null })];
  var cm = function(v) { return Math.floor(v * 100 + 1e-6) / 100; };
  for (var i = 1; i < count; i++) {
    // Clear of the wall, the gap, and any rounded floor corners (so it sits
    // on the flat of the floor, under the flat of the top).
    var prev = list[i - 1], pp = boxPlan(prev), rc = prev.corners ? prev.corners.radius || 0 : 0;
    var at = limitOf(pp.shape, prev.wall + gap + rc), next = at && shrunk(prev, prev.wall + gap + rc, at);
    if (!next) break;
    // Its halves (a lip counted in its half) as the one before's, set as
    // their outside to the seam.
    var room = pp.insideHeight - gap, r = pp.baseHeight / (pp.baseHeight + pp.lidHeight), fits = true;
    var heights = function() {
      var up = next.lipHeight - next.clearance, X = room + up, onLid = next.lipOn === 'lid';
      next.baseHeight = cm(X * r - (onLid ? 0 : up)); next.lidHeight = cm(X * (1 - r) - (onLid ? up : 0));
    };
    // Its own sizes can round its corners or point more: fitted again.
    var size = function() { return [next.diameter, next.length, next.width, next.flats].join(); };
    for (var k = 0; k < 2 && fits; k++) {
      heights();
      if (tune) { var a = tune(next); delete a.problems; Object.assign(next, a); }
      var was = size();
      fits = fitIn(next, at);
      if (!tune || size() === was) break;
    }
    heights();
    // Without Auto Sizes, the floor, top and lip as much lower as the box.
    if (!tune) {
      var k = (next.baseHeight + next.lidHeight + next.lipHeight - next.clearance) / (pp.baseHeight + pp.lidHeight);
      next.floor = cm(prev.floor * k); next.top = cm(prev.top * k); next.lipHeight = cm(prev.lipHeight * k);
      heights();
    }
    var nb = boardsOf(next);
    if (!fits || !(nb.baseH > next.floor + 1 && nb.lidH > next.top + 1)) break;
    // One that can't be made: the set stops at the one before.
    if (boxPlan(next).problems.some(fixable)) break;
    list.push(next);
  }
  return list;
}
// Where a box must stay inside another (outline outer): that outline d
// in, every mm or so; null when there's no inside left.
function limitOf(outer, d) {
  var limit = shapeLoop(outer, -d);
  if (!limit) return null;
  var len = loopLength(limit), at = [];
  for (var j = 0, m = Math.max(180, Math.ceil(len)); j < m; j++) at.push(loopPoint(limit, len * j / m));
  return at;
}
// A box d smaller all round than o, its corners or point no tighter than
// its lip needs, fitted inside the limit at; null when nothing's left.
function shrunk(o, d, at) {
  var n = Object.assign({}, o);
  // A drawing's: its outline moved in d (a smaller copy needn't fit past
  // an inside corner) and a little (its offsets are kept to 0.02 mm or
  // so), about the middle of its own extent, that far (shift) from the
  // one before's.
  if (o.shape === 'custom') {
    var lp = o.outline && shapeLoop(shapeOf(o), -d - 0.05);
    if (!lp) return null;
    var e = loopExtent(lp), cx = (e.minX + e.maxX) / 2, cy = (e.minY + e.maxY) / 2, pts = [];
    lp.forEach(function(sg) { pts.push(+(sg.x0 - cx).toFixed(3), +(sg.y0 - cy).toFixed(3)); });
    // Exact: rounded as it is, not stretched back out to its extent.
    n.outline = Object.assign({}, o.outline, { pts: pts, exact: true });
    n.length = e.maxX - e.minX; n.width = e.maxY - e.minY; n.shift = { x: cx, y: cy };
  } else if (o.shape === 'rect' || o.shape === 'oval' || o.shape === 'heart') { n.length = o.length - 2 * d; n.width = o.width - 2 * d; }
  else if (o.shape === 'poly') n.flats = o.flats - 2 * d;
  else n.diameter = o.diameter - 2 * d;
  if (o.shape !== 'circle' && o.shape !== 'oval') n.cornerRadius = Math.max((o.cornerRadius || 0) - d, n.wall - n.lipWidth - n.clearance + n.bit / 2);
  return fitIn(n, at) ? n : null;
}
// Smaller (its corners as they are) by as much as it sticks out past the
// limit at, and a little, till it doesn't: false when it can't.
function fitIn(n, at) {
  var long = n.shape === 'rect' || n.shape === 'oval' || n.shape === 'heart' || n.shape === 'custom';
  for (var k = 0; k < 12; k++) {
    var small = long ? Math.min(n.length, n.width) : n.shape === 'poly' ? n.flats : n.diameter;
    var S = small > 0 && shapeOf(n);
    if (!S) return false;
    var out = -Infinity, sx = n.shift ? n.shift.x : 0, sy = n.shift ? n.shift.y : 0;
    at.forEach(function(q) { out = Math.max(out, -shapeDistance(S, 0, q.x - sx, q.y - sy)); });
    if (out <= 0.01) return true;
    var f = 1 - 2 * (out + 0.05) / small;
    if (long) { n.length *= f; n.width *= f; } else if (n.shape === 'poly') n.flats *= f; else n.diameter *= f;
  }
  return false;
}
// A nested set's plan: each box's halves side by side as one box's, the
// boxes one after another the other way, the biggest at the front (along
// Y: the left), gap between; one program, the insides first, then the
// outlines. wanted: how many were asked for.
function setPlan(inputs, wanted) {
  var plans = inputs.map(function(x) { return boxPlan(Object.assign({}, x, { origin: 'front-left' })); }), first = plans[0], o = Object.assign({}, first.o, { origin: inputs[0].origin });
  var problems = [], notes = first.notes.slice();
  plans.forEach(function(p, i) { p.problems.forEach(function(x) { problems.push(i ? 'Box ' + (i + 1) + ': ' + x : x); }); });
  if (wanted > plans.length && !first.problems.length) problems.push((plans.length > 1 ? 'Only ' + plans.length + ' boxes fit' : 'No box fits') + ' inside each other: box ' + (plans.length + 1) + ' would be too small or too low inside box ' + plans.length + '. Use fewer boxes, a smaller Nest Gap, or a bigger or deeper box');
  var gap = Math.max.apply(null, plans.map(function(p) { return p.o.gap; })), rows = o.layout !== 'y', at = 0, W = 0, halves = [];
  plans.forEach(function(p, i) {
    if (i) at += gap - p.margin;
    p.halves.forEach(function(h) {
      h.at = rows ? { x: h.at.x, y: h.at.y + at } : { x: h.at.x + at, y: h.at.y };
      h.label = 'box ' + (i + 1) + ' ' + h.name;
      halves.push(h);
    });
    W = Math.max(W, rows ? p.stock.w : p.stock.h);
    at += (rows ? p.stock.h : p.stock.w) - p.margin;
  });
  at += plans[plans.length - 1].margin;
  var sw = rows ? W : at, sh = rows ? at : W, c = o.origin === 'center' ? { x: -sw / 2, y: -sh / 2 } : { x: 0, y: 0 };
  halves.forEach(function(h) { h.at = { x: h.at.x + c.x, y: h.at.y + c.y }; });
  return Object.assign({}, first, {
    o: o, problems: problems, notes: notes, halves: halves, set: plans,
    stock: { w: sw, h: sh, x0: c.x, y0: c.y, thick: o.stock },
    originSay: o.origin === 'center' ? 'the middle of the set' : 'the stock\'s front-left corner'
  });
}

// Sizes that suit a box of this size, stock, bit and material, for a
// first try: the wall, floor and top, the lip and its clearance, the gap
// and margin, the tabs, and (when they're on) the notch, the magnet count
// and the edges; a rectangle's corners as round as the lip needs. Made to
// fit each other: when they don't, the notch and edges are made smaller
// or the wall thicker until they do. input: the plan's settings (shape,
// size, stock, lidHeight, bit, and magnets, notch, edges when on);
// material: QuickCut's key (mdf, softwood, hardwood, hdpe, ...);
// imperial: sizes on a 1/32" grid (under a mm, 0.005") instead of 0.5 mm
// (0.05 mm). Returns the settings it sets (mm), and problems left when
// nothing fits.
var WOOD = { mdf: true, softwood: true, hardwood: true };
// The finishing pass by material: what the roughing leaves on the walls
// (mm) and the way round. Conventional left the cleaner walls in pine and
// is gentler on wood fibres; climb shears plastics and aluminum cleaner,
// with less rubbing and melting.
var FINISH = {
  mdf: { allow: 0.3, dir: 'conventional' }, softwood: { allow: 0.3, dir: 'conventional' }, hardwood: { allow: 0.25, dir: 'conventional' },
  hdpe: { allow: 0.3, dir: 'climb' }, acrylic: { allow: 0.2, dir: 'climb' }, polycarbonate: { allow: 0.2, dir: 'climb' },
  aluminum: { allow: 0.15, dir: 'climb' }, foam: { allow: 0.5, dir: 'conventional' }
};
function finishFor(material) { return FINISH[material] || FINISH.softwood; }
// In wood, 0.015" (tried in pine: a lid that slides on, not loose).
var CLEARANCE = { mdf: 0.381, softwood: 0.381, hardwood: 0.381, hdpe: 0.15, acrylic: 0.1, polycarbonate: 0.1, aluminum: 0.05, foam: 0.2 };
// The lip's thickness for a wall: half of it (down to the grid), the rest
// outside it. With magnets, as thin as leaves their holes room outside it,
// down to 1/4" (then the wall must grow), so the wall needn't be twice what
// they need. An inset floor's ring is only the rim outside the opening: a
// thinner lip leaves it room for the rabbet (3 mm outside it), down to
// 3 mm. A sloped lip as thick as its slant at the V-bit's angle, and 1 mm
// more at its top. Auto Sizes uses it, and the dialog's Lip Thickness
// follows it until one is typed.
function lipWidthFor(input, imperial) {
  var o = Object.assign({}, DEFAULTS, input || {});
  var grid = function(v) { return imperial ? (v < 1 ? 0.127 : 25.4 / 32) : (v < 1 ? 0.05 : 0.5); };
  var down = function(v) { return Math.floor(v / grid(v) + 1e-9) * grid(v); };
  var upHalf = function(v) { var g = grid(v); return Math.ceil(v / g - 1e-9) * g; };
  var w = Math.max(grid(1), down(o.wall / 2));
  if (o.bottom && o.bottom.style === 'inset') w = Math.max(Math.min(3, w), Math.min(w, down(o.wall - o.clearance - (o.bottom.rabbet > 0 ? o.bottom.rabbet : 0) - 3)));
  // A drop-in lid's notch: a fingertip's room (4 mm) outside the panel.
  if (o.lidStyle === 'drop' && o.notch) w = Math.max(grid(1), Math.min(w, down(o.wall - 4)));
  if (o.magnets) w = Math.min(w, Math.max(6.35, down(o.wall - o.clearance - o.magnets.diameter - 1.6 - 0.05)));
  var ed = o.edges;
  if (ed && ed.slope && ed.bit !== 'round') {
    var slant = Math.tan((ed.angle || 90) * Math.PI / 360);
    w = Math.max(w, upHalf(Math.min(o.lipHeight - o.clearance, ed.slopeHeight > 0 ? ed.slopeHeight : Infinity) * slant + (ed.pocket || 0) * slant + 1.05));
  }
  return w;
}

function autoSizes(input, material, imperial) {
  var o = Object.assign({}, DEFAULTS, input || {});
  var rect = o.shape === 'rect', poly = o.shape === 'poly', long = rect || o.shape === 'oval' || o.shape === 'heart' || o.shape === 'custom';
  var small = long ? Math.min(o.length, o.width) : poly ? o.flats : o.diameter;
  // Each half as high as set (not counting a lip), or its board.
  var B = boardsOf(o), T = o.baseHeight > 0 ? B.baseOut - (o.bottom && o.bottom.style !== 'inset' ? B.bottom - o.bottom.step : 0) : B.base, lidH = o.lidHeight > 0 ? B.lidOut : B.lid, b = o.bit;
  // To the grid: the nearest step, or (up) the next one.
  var grid = function(v) { return imperial ? (v < 1 ? 0.127 : 25.4 / 32) : (v < 1 ? 0.05 : 0.5); };
  var half = function(v) { var g = grid(v); return Math.max(g, Math.round(v / g) * g); };
  var upHalf = function(v) { var g = grid(v); return Math.ceil(v / g - 1e-9) * g; };
  var clamp = function(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var a = { clearance: half(CLEARANCE[material] != null ? CLEARANCE[material] : 0.381) };
  a.floor = half(clamp(T * 0.2, 2, 6));
  a.top = half(clamp(lidH * 0.2, 2, 6));
  // A Lid Tray: 3 mm of wood under its dish.
  // (When the lid has room for it and an inside: else the plan says the
  // dish is too deep.)
  var trayTop = o.tray && o.tray.depth > 0 && o.lidStyle !== 'plug' ? upHalf(o.tray.depth + 3) : 0;
  if (trayTop > a.top && trayTop <= lidH - 4) a.top = trayTop;
  // In wood, at least 6 mm (1/4"), so the lip and the wall outside it
  // are each about 3 mm: thinner splits along the grain.
  a.wall = half(clamp(small * 0.08, WOOD[material] ? 6 : 4, 15));
  // An inset floor's ring: its inside above the panel; a solid lid: no
  // inside of its own, the base's alone.
  var ins = o.bottom && o.bottom.style === 'inset';
  var under0 = ins ? (o.bottom.board > 0 ? o.bottom.board : T) + (o.bottom.recess > 0 ? o.bottom.recess : 0) : a.floor;
  var depth = o.lidStyle === 'plug' ? Math.min(T - under0, lidH - 2) : Math.min(T - under0, lidH - a.top);
  // In wood, a lip at least 1/4" high (when the box is deep enough), so
  // the lid sits firmly.
  var minLip = Math.min(WOOD[material] ? 6.35 : 2, Math.max(2, depth - 3));
  a.lipHeight = half(clamp(depth * 0.35, minLip, Math.max(minLip, Math.min(12.7, depth - 3))));
  a.margin = half(5);
  a.gap = upHalf(Math.max(8, 2 * b + 2));
  var round = rect ? 2 * (o.length + o.width) : long ? Math.PI * (o.length + o.width) / 2 : poly ? o.sides * o.flats * Math.tan(Math.PI / o.sides) : Math.PI * o.diameter;
  if (o.tabs) a.tabs = { count: clamp(Math.round(round / 90), 3, 8), width: half(Math.max(5, 1.5 * b)), height: half(clamp(T * 0.08, 1, 3)) };
  if (o.magnets) a.magnets = Object.assign({}, o.magnets, { count: rect ? 4 : clamp(Math.round(round / 80), 3, 6) });
  // A notch in the base below the lip (when it's on the base), above the floor.
  var notchRoom = T - a.floor - (o.lipOn === 'lid' ? 0 : a.lipHeight - a.clearance) - 0.5;
  if (o.notch) a.notch = Object.assign({}, o.notch, { width: half(clamp(small * 0.18, 10, 20)), depth: Math.min(half(clamp(a.lipHeight, 3, 6)), Math.max(grid(1), Math.floor(notchRoom / grid(notchRoom)) * grid(notchRoom))) });
  // Edges: a lead-in for the lid to find its way on, the rims' edges
  // just taken off (fuzz-free).
  if (o.edges) a.edges = Object.assign({}, o.edges, { outside: half(0.508), inside: half(o.edges.bit === 'round' ? Math.min(o.edges.radius || 1.5, 1.5) : 1.5), pocket: half(0.508) });
  var slope = !!(o.edges && o.edges.slope && o.edges.bit !== 'round'), slant = slope ? Math.tan((o.edges.angle || 90) * Math.PI / 360) : 0;
  // Edges get room from a lower lip and a wall up to a sixth of the size
  // or 2 mm more than it was (in wood, the wall first and the lip not
  // under 1/4"); then they're made smaller. A notch narrower, to 12 mm.
  var plan, edgeWall = null, magCount0 = 0;
  var smaller = function(d) { return d > 0.3 ? half(d * 0.7) : 0; };
  for (var k = 0; k < 80; k++) {
    // The lip: half the wall, or as magnets, an inset floor or a sloped lip need.
    a.lipWidth = lipWidthFor(Object.assign({}, o, a), imperial);
    if (rect || poly || o.shape === 'heart' || o.shape === 'custom') a.cornerRadius = Math.max(o.cornerRadius || 0, upHalf(a.wall - a.lipWidth - a.clearance + b / 2 + a.lipHeight * slant));
    // A heart's point under its lobes' radius.
    if (o.shape === 'heart') a.cornerRadius = Math.min(a.cornerRadius, Math.max(o.cornerRadius || 0, (o.length || 0) / 2 / 1.72 - 1));
    plan = boxPlan(Object.assign({}, o, a, { quick: true }));
    if (!plan.problems.length) break;
    // What the sizes can't fix (a hole narrower than the bit, a drill, a
    // hole too deep) is left to say: the rest still fit.
    var p = plan.problems.filter(fixable)[0], ed = a.edges;
    if (!p) break;
    // A V-bit too small for the sloped lip: a lower lip.
    if (slope && /sloped lip needs/.test(p)) {
      // (A Slope Height of your own is yours to change.)
      if (a.lipHeight - grid(3) < 2 || ed.slopeHeight > 0) break;
      a.lipHeight = half(a.lipHeight - grid(3));
      // Said on the page: the lip's as tall as the V-bit allows.
      a.lipForBit = true;
    } else if (ed && /[Ee]dge|seam|Inside Rim/.test(p) && !/Gap/.test(p) && (ed.outside > 0 || ed.inside > 0 || ed.pocket > 0)) {
      var seam = /seam/.test(p), lead = /Lead-In/.test(p), pk = /Inside Rim/.test(p), any = !seam && !lead && !pk;
      if (edgeWall === null) edgeWall = Math.max(half(small / 6), a.wall + 2);
      var lower = (seam || pk) && a.lipHeight - grid(3) >= minLip - 1e-9;
      if (lower && !(WOOD[material] && a.wall < edgeWall)) a.lipHeight = half(a.lipHeight - grid(3));
      else if (a.wall < edgeWall) a.wall = half(a.wall + grid(3));
      else {
        if (seam || any) ed.outside = smaller(ed.outside);
        if (lead || any) ed.inside = smaller(ed.inside);
        if (pk || any) ed.pocket = smaller(ed.pocket);
      }
    } else if (a.notch && /notch/.test(p) && !/magnet|run together|depth/.test(p) && a.notch.width > 12) a.notch.width = half(a.notch.width - 2 * grid(3));
    // A magnet count that misses the notches: the nearest that does.
    else if (a.magnets && /runs into a magnet hole/.test(p)) {
      var c0 = magCount0 || (magCount0 = a.magnets.count), step = rect ? 2 : 1, tried = a.magnets.count;
      var next = [1, -1, 2, -2, 3, -3].map(function(d) { return c0 + d * step; }).filter(function(c) { return c >= 2 && c <= 6; });
      var at = next.indexOf(tried) + 1;
      if (at >= next.length) break;
      a.magnets.count = next[at];
    }
    else if (/Gap/.test(p)) a.gap = half(a.gap + 2 * grid(3));
    else if (/ends are too tight/.test(p) && a.wall > 3) a.wall = half(a.wall - grid(3));
    // Only what a thicker wall fixes; anything else is the box's own to say.
    else if (/Magnet holes too wide|Too many magnets|notch too wide|Wall must be at least|Corner Radius must|^Sloped lip/.test(p) && a.wall < small / 2 - b - 2) {
      a.wall = half(a.wall + grid(3));
      // Magnets too wide: straight to the first wall they fit in (the lip
      // follows it), not a plan for each step on the way.
      if (/Magnet holes too wide for the wall/.test(p)) {
        var fits = function() { return a.wall - lipWidthFor(Object.assign({}, o, a), imperial) - a.clearance >= a.magnets.diameter + 1.6 - 1e-9; };
        while (!fits() && a.wall < small / 2 - b - 2) a.wall = half(a.wall + grid(3));
      }
    }
    else break;
  }
  a.problems = plan.problems;
  return a;
}

// With Auto Sizes off, an option just switched on that doesn't fit: only
// the sizes it needs changed (never the box's size, wall, stock or bit),
// a step at a time until its problems go. A sloped lip: the lip thicker
// as far as the wall leaves room, then lower; edges and the notch
// smaller; fewer magnets, or the lip thinner beside them; a rectangle's
// corners rounder. Returns { set: { key: mm } (keys as 'lipHeight',
// 'edges.pocket'), problems left }.
function fitOption(input, imperial, before) {
  var o = JSON.parse(JSON.stringify(Object.assign({}, DEFAULTS, input || {})));
  if (input && input.outline) o.outline = input.outline;
  var grid = function(v) { return imperial ? (v < 1 ? 0.127 : 25.4 / 32) : (v < 1 ? 0.05 : 0.5); };
  var half = function(v) { var g = grid(v); return Math.max(g, Math.round(v / g) * g); };
  var upHalf = function(v) { var g = grid(v); return Math.ceil(v / g - 1e-9) * g; };
  var down = function(v) { return Math.floor(v / grid(v) + 1e-9) * grid(v); };
  var smaller = function(d) { return d > 0.3 ? half(d * 0.7) : 0; };
  var ed = o.edges, slope = !!(ed && ed.slope && ed.bit !== 'round'), slant = slope ? Math.tan((ed.angle || 90) * Math.PI / 360) : 0;
  var set = {}, put = function(key, v) {
    var at = key.split('.');
    if (at.length > 1) o[at[0]][at[1]] = v; else o[key] = v;
    set[key] = v;
  };
  var lower = function() {
    var to = half(o.lipHeight - grid(3));
    if (to - o.clearance < 1.5) return false;
    put('lipHeight', to);
    return true;
  };
  // A notch down to a bit wider than the bit; its depth isn't what's in the way.
  var narrower = function() {
    var least = Math.max(8, upHalf(o.bit + 1));
    if (!(o.notch.width > least + 1e-9)) return false;
    put('notch.width', Math.max(least, half(o.notch.width - 2 * grid(3))));
    return true;
  };
  var shrink = function(key) { var at = key.split('.'), d = o[at[0]][at[1]]; if (!(d > 0)) return false; put(key, smaller(d)); return true; };
  var plan;
  for (var k = 0; k < 80; k++) {
    plan = boxPlan(Object.assign({}, o, { quick: true }));
    // The first problem one of these changes fixes (the rest are left to say).
    if (!plan.problems.filter(function(p) { return fixable(p) && (before || []).indexOf(p) < 0; }).some(fix)) break;
  }
  function fix(p) {
    var ok = false;
    if (/^Sloped lip:/.test(p)) {
      // Thicker, leaving the rim outside it 1 mm (and the magnets' room).
      var room = down(o.wall - o.clearance - 1 - (o.magnets ? o.magnets.diameter + 0.6 : 0));
      var partly = ed.slopeHeight > 0 && ed.slopeHeight < o.lipHeight - o.clearance;
      var want = upHalf((partly ? ed.slopeHeight : o.lipHeight - o.clearance) * slant + (ed.pocket || 0) * slant + 1.05);
      if (o.lipWidth < Math.min(room, want) - 1e-9) { put('lipWidth', Math.min(room, want)); ok = true; }
      else if (ed.pocket > 0) ok = shrink('edges.pocket');
      else if (partly && ed.slopeHeight > 0.5 + 1e-9) { put('edges.slopeHeight', Math.max(0.5, half(ed.slopeHeight - grid(3)))); ok = true; }
      else ok = lower();
    } else if (/sloped lip needs/.test(p)) {
      if (ed.slopeHeight > 0.5 + 1e-9 && ed.slopeHeight < o.lipHeight - o.clearance) { put('edges.slopeHeight', Math.max(0.5, half(ed.slopeHeight - grid(3)))); ok = true; }
      else ok = lower();
    }
    else if (/Corner Radius must be at least/.test(p) && (o.shape === 'rect' || o.shape === 'poly' || o.shape === 'heart' || o.shape === 'custom')) {
      var need = o.wall - o.lipWidth - o.clearance + o.bit / 2 + (slope ? o.lipHeight * slant : 0);
      if (o.cornerRadius < need - 1e-9) { put('cornerRadius', upHalf(need)); ok = true; } else ok = slope && lower();
    } else if (/ends are too tight/.test(p)) ok = slope && lower();
    else if (ed && /Inside Rim/.test(p)) ok = shrink('edges.pocket');
    else if (ed && /seam/.test(p)) ok = shrink('edges.outside');
    else if (ed && /Lead-In/.test(p)) ok = shrink('edges.inside');
    // (A sloped lip has no lead-in: its size is left as it is.)
    else if (ed && /^Edges/.test(p)) ok = ['edges.outside', 'edges.inside', 'edges.pocket'].filter(function(key) { return !(slope && key === 'edges.inside'); }).sort(function(a, b) { return (o.edges[b.slice(6)] || 0) - (o.edges[a.slice(6)] || 0); }).some(shrink);
    else if (o.notch && /notch/.test(p) && !/magnet|depth/.test(p)) ok = narrower();
    else if (o.magnets && /Magnet holes too wide|Wall must be at least .*magnet/i.test(p)) {
      var thin = down(o.wall - o.clearance - o.magnets.diameter - 1.6 - 0.05);
      if (thin >= 2 && thin < o.lipWidth - 1e-9) { put('lipWidth', thin); ok = true; }
    }
    if (!ok && o.magnets && /Too many magnets|runs into a magnet hole/.test(p)) {
      var fewer = o.magnets.count - (o.shape === 'rect' ? 2 : 1);
      if (fewer >= 2) { put('magnets.count', fewer); ok = true; }
    }
    if (!ok && o.notch && /runs into a magnet hole/.test(p)) ok = narrower();
    return ok;
  }
  return { set: set, problems: plan.problems };
}

if (typeof module !== 'undefined' && module.exports) {
  var shapeLib = require('./box-shape.cjs');
  var shapeLoop = shapeLib.shapeLoop, shapeDeepest = shapeLib.shapeDeepest, loopLength = shapeLib.loopLength, loopPoint = shapeLib.loopPoint;
  var loopAt = shapeLib.loopAt, loopPart = shapeLib.loopPart, loopNearest = shapeLib.loopNearest, loopExtent = shapeLib.loopExtent, shapeLoops = shapeLib.shapeLoops, shapeDistance = shapeLib.shapeDistance;
  var outlineLib = require('./box-outline.cjs'), heartShape = outlineLib.heartShape, ovalShape = outlineLib.ovalShape;
  var customShape = outlineLib.customShape, selfCrossing = outlineLib.selfCrossing, outlineLoops = outlineLib.outlineLoops, gridStep = outlineLib.gridStep, gridDistance = outlineLib.gridDistance;
  module.exports = { lipWidthFor: lipWidthFor, boxPlan: boxPlan, boardsOf: boardsOf, outsideInput: outsideInput, heightCaps: heightCaps, testFitInput: testFitInput, autoSizes: autoSizes, fitOption: fitOption, nestInputs: nestInputs, setPlan: setPlan, finishFor: finishFor, BOX_DEFAULTS: DEFAULTS };
}
