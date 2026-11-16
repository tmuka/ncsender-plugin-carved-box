// The code copied from QuickCut matches it, when a QuickCut checkout is
// beside this one (not in CI).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');

test('the copies of QuickCut code match QuickCut', (t) => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', '.scripts', 'sync-quickcut.cjs'), '--check'], { encoding: 'utf8' });
  if (r.status === 2) return t.skip('no QuickCut checkout here');
  assert.equal(r.status, 0, r.stderr);
});
