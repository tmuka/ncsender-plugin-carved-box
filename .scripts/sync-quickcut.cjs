// The code shared with QuickCut (siganberg/ncsender-plugin-quickcut, GPL-3.0),
// read from a QuickCut checkout (QUICKCUT_DIR, else ../ncsender-plugin-quickcut)
// at QUICKCUT_REF (else upstream/main, else origin/main): not its working
// files, which may be on another branch. `--check` fails when a copy here
// differs (tests/sync.test.cjs runs it when a checkout is there).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const qc = process.env.QUICKCUT_DIR || path.join(root, '..', 'ncsender-plugin-quickcut');
const FILES = ['lib/starting-feeds.cjs'];
if (!fs.existsSync(path.join(qc, '.git'))) { console.error('no QuickCut checkout at ' + qc); process.exit(2); }
const git = (args) => execFileSync('git', ['-C', qc].concat(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const ref = process.env.QUICKCUT_REF || ['upstream/main', 'origin/main'].find((r) => { try { git(['rev-parse', '--verify', r]); return true; } catch (e) { return false; } });
if (!ref) { console.error('no upstream/main or origin/main in ' + qc); process.exit(2); }
const stale = FILES.filter((f) => git(['show', ref + ':' + f]) !== fs.readFileSync(path.join(root, f), 'utf8'));
if (process.argv.includes('--check')) {
  if (stale.length) { console.error('differs from QuickCut ' + ref + ': ' + stale.join(', ') + ' (run npm run sync-quickcut)'); process.exit(1); }
  console.log('same as QuickCut ' + ref);
} else {
  FILES.forEach((f) => fs.writeFileSync(path.join(root, f), git(['show', ref + ':' + f])));
  console.log('copied ' + FILES.join(', ') + ' from QuickCut ' + ref);
}
