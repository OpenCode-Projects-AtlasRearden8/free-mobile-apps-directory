#!/usr/bin/env node
/*
 * Test suite for the free-mobile-apps-directory static site.
 * Run: node scripts/test.js
 * (No npm dependencies. Uses Node's built-in http server and fetch.)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log('  ok    ' + name);
  } else {
    failed++;
    failures.push(name + (detail ? ' -- ' + detail : ''));
    console.log('  FAIL  ' + name + (detail ? ' -- ' + detail : ''));
  }
}

function section(title) {
  console.log('\n== ' + title + ' ==');
}

/* ---------- 1. Load AppLib in isolation ---------- */
const libSrc = fs.readFileSync(path.join(ROOT, 'assets/lib.js'), 'utf8');
const libCtx = { console, module: { exports: {} } };
vm.createContext(libCtx);
vm.runInContext(libSrc + '\n;module.exports;', libCtx, { filename: 'lib.js' });
const AppLib = libCtx.module.exports;
const { validateData, filterApps, sortApps, matchesFilters, isValidDate,
  isHttpsUrl, isOverdue, isDueSoon, uniqueLinks } = AppLib;

section('AppLib loaded');
check('exports validateData', typeof validateData === 'function');
check('exports filterApps', typeof filterApps === 'function');
check('exports sortApps', typeof sortApps === 'function');

/* ---------- 2. Pure-logic unit tests ---------- */
section('Unit tests: dates & URLs');
check('valid date', isValidDate('2026-10-22'));
check('bad month rejected', !isValidDate('2026-13-01'));
check('bad day rejected', !isValidDate('2026-02-30'));
check('non-date rejected', !isValidDate('yesterday'));
check('https url ok', isHttpsUrl('https://example.com/x'));
check('http url rejected', !isHttpsUrl('http://example.com'));
check('javascript: rejected', !isHttpsUrl('javascript:alert(1)'));
check('overdue true when past', isOverdue({ recheckOn: '2020-01-01' }, '2026-11-03'));
check('overdue false when future', !isOverdue({ recheckOn: '2099-01-01' }, '2026-11-03'));

section('Unit tests: filtering & sorting');
const fixture = [
  { id: 'a', name: 'Alpha', category: 'Note-takers', platforms: ['Android'], tags: ['offline'],
    freeTier: 'all', verifiedFreeOn: '2026-10-01', recheckOn: '2099-01-01', links: {} },
  { id: 'b', name: 'Beta', category: 'Chess trainers', platforms: ['iOS'], tags: ['chess'],
    freeTier: 'all', verifiedFreeOn: '2026-10-01', recheckOn: '2099-02-01', links: {} },
  { id: 'c', name: 'Gamma', category: 'Note-takers', platforms: ['Android', 'iOS'], tags: ['offline'],
    freeTier: 'all', verifiedFreeOn: '2026-10-01', recheckOn: '2099-01-15', links: {} }
];
check('filter by category', filterApps(fixture, { category: 'Note-takers' }).map(x => x.id).join() === 'a,c');
check('filter by platform', filterApps(fixture, { platform: 'iOS' }).map(x => x.id).join() === 'b,c');
check('filter by tag', filterApps(fixture, { tag: 'chess' }).map(x => x.id).join() === 'b');
check('filter by query (name)', filterApps(fixture, { query: 'alph' }).map(x => x.id).join() === 'a');
check('filter by query (freeTier)', filterApps(fixture, { query: 'ALL' }).length === 3);
check('combined filters match none safely', filterApps(fixture, { category: 'Chess trainers', tag: 'offline' }).length === 0);
check('sort by name', sortApps(fixture, 'name').map(x => x.id).join() === 'a,b,c');
check('sort by recheckOn (earliest first)', sortApps(fixture, 'recheckOn').map(x => x.id).join() === 'a,c,b');
check('unknown sort key falls back to name', sortApps(fixture, 'nope')[0].id === 'a');
check('dueSoon counts next 14 days', isDueSoon({ recheckOn: '2099-01-05' }, '2099-01-01'));
check('dueSoon ignores far future', !isDueSoon({ recheckOn: '2099-06-01' }, '2099-01-01'));

section('Unit tests: validation rejects bad cards');
check('empty object rejected', validateData({ schemaVersion: 1, apps: [{ id: 'x' }] }).length > 0);
check('dup ids rejected',
  validateData({ schemaVersion: 1, apps: [
    { id: 'x', category: 'Note-takers', platforms: ['Android'], tags: [], summary: 's', freeTier: 'f',
      limits: 'l', paid: 'p', ads: 'none', permissions: 'perm', privacyNote: 'pn',
      links: { site: 'https://e.com' }, verifiedFreeOn: '2026-01-01', recheckOn: '2027-01-01' },
    { id: 'x', category: 'Note-takers', platforms: ['Android'], tags: [], summary: 's', freeTier: 'f',
      limits: 'l', paid: 'p', ads: 'none', permissions: 'perm', privacyNote: 'pn',
      links: { site: 'https://e.com' }, verifiedFreeOn: '2026-01-01', recheckOn: '2027-01-01' }
  ] }).some(e => e.includes('duplicate id')));
check('http links rejected',
  validateData({ schemaVersion: 1, apps: [{ id: 'x', category: 'Note-takers', platforms: ['Android'],
    tags: [], summary: 's', freeTier: 'f', limits: 'l', paid: 'p', ads: 'none', permissions: 'perm',
    privacyNote: 'pn', links: { site: 'http://e.com' }, verifiedFreeOn: '2026-01-01', recheckOn: '2027-01-01' }] })
    .some(e => e.includes('not an https URL')));
check('recheck before verified rejected',
  validateData({ schemaVersion: 1, apps: [{ id: 'x', category: 'Note-takers', platforms: ['Android'],
    tags: [], summary: 's', freeTier: 'f', limits: 'l', paid: 'p', ads: 'none', permissions: 'perm',
    privacyNote: 'pn', links: { site: 'https://e.com' }, verifiedFreeOn: '2026-01-01', recheckOn: '2025-01-01' }] })
    .some(e => e.includes('recheckOn must be after')));

/* ---------- 3. Validate the real data file ---------- */
section('Real data file (data/apps.json)');
const dataPath = path.join(ROOT, 'data', 'apps.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const dataErrors = validateData(data);
check('data/apps.json validates clean', dataErrors.length === 0, dataErrors.slice(0, 3).join(' | '));
check('has a good number of cards', data.apps.length >= 18, 'count=' + data.apps.length);
const cats = new Set(data.apps.map(a => a.category));
['Note-takers', 'Scanners', 'Sleep sounds', 'Step counters', 'Budgeting', 'Chess trainers']
  .forEach(c => check('category present: ' + c, cats.has(c)));

/* ---------- 4. Editorial / policy checks (no ads placement, no personal data) ---------- */
section('Policy checks');
const policyFiles = ['index.html', 'data/apps.json', 'assets/app.js', 'assets/lib.js']
  .map(f => ({ f, t: fs.readFileSync(path.join(ROOT, f), 'utf8') }));
check('no email addresses in site files', !policyFiles.some(x =>
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(x.t)),
  policyFiles.filter(x => /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(x.t)).map(x => x.f).join(','));
check('all card links are https', uniqueLinks(data).every(u => u.startsWith('https://')));
check('no affiliate tag params in links',
  !uniqueLinks(data).some(u => /[?&](tag=|aff=|affiliate|ref=)/i.test(u)));
check('all card links are unique', uniqueLinks(data).length === new Set(uniqueLinks(data)).size);

/* ---------- 5. Site files sanity ---------- */
section('Site files');
check('index.html exists', fs.existsSync(path.join(ROOT, 'index.html')));
check('LICENSE exists with exact copyright line',
  fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8')
    .includes('Copyright (c) 2026 Asdale Dynamics, LLC'));
check('README credits Asdale Dynamics, LLC',
  fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8').includes('Asdale Dynamics, LLC'));
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
['assets/style.css', 'assets/lib.js', 'assets/app.js', 'data/apps.json'].forEach(ref =>
  check('index.html references ' + ref, indexHtml.includes(ref)));
['assets/style.css', 'assets/lib.js', 'assets/app.js'].forEach(f =>
  check('referenced file exists: ' + f, fs.existsSync(path.join(ROOT, f))));

/* ---------- 6. Serve and fetch: the page actually loads ---------- */
section('Served-site smoke test');
(async () => {
function serve() {
  return new Promise((resolve, reject) => {
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
      '.json': 'application/json' };
    const server = http.createServer((req, res) => {
      const url = req.url.split('?')[0];
      const rel = url === '/' ? 'index.html' : decodeURIComponent(url.slice(1));
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}
const server = await serve();
const port = server.address().port;
function get(p) {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:' + port + p, res => {
      let body = '';
      res.on('data', d => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}
try {
  const home = await get('/');
  check('GET / returns 200', home.status === 200);
  check('GET / is html', (home.headers['content-type'] || '').includes('text/html'));
  check('home renders title', home.body.includes('Free Forever'));
  for (const asset of ['/assets/style.css', '/assets/lib.js', '/assets/app.js', '/data/apps.json']) {
    const r = await get(asset);
    check('GET ' + asset + ' returns 200', r.status === 200, 'status=' + r.status);
  }
  const j = JSON.parse((await get('/data/apps.json')).body);
  check('served apps.json parses', Array.isArray(j.apps) && j.apps.length === data.apps.length);
  check('unknown path 404s', (await get('/nope.html')).status === 404);
} finally {
  server.close();
}

/* ---------- 7. Live link test (the "link tests" promise) ---------- */
section('Live link tests (every external URL)');
const links = uniqueLinks(data);
let bad = [];
for (const url of links) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (linkcheck; +free-mobile-apps-directory)' },
      signal: AbortSignal.timeout(15000)
    });
    const ok = res.status < 400;
    console.log((ok ? '  ok    ' : '  FAIL  ') + res.status + '  ' + url);
    if (!ok) bad.push(url + ' -> ' + res.status);
  } catch (e) {
    console.log('  FAIL  ERR   ' + url + '  (' + e.message + ')');
    bad.push(url + ' -> ' + e.message);
  }
}
check('all ' + links.length + ' external links reachable', bad.length === 0,
  'failing: ' + bad.slice(0, 3).join('; '));

/* ---------- Summary ---------- */
console.log('\n================================');
console.log('Passed: ' + passed + '   Failed: ' + failed);
if (failed) {
  console.log('Failures:');
  failures.forEach(f => console.log(' - ' + f));
  process.exit(1);
}
console.log('ALL TESTS PASS');
})();
