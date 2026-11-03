(function () {
  'use strict';

  var state = {
    apps: [],
    category: 'all',
    platform: 'all',
    tag: 'all',
    query: '',
    sort: 'name'
  };

  function el(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtCatList(items) {
    return items.map(esc).join(', ');
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function renderCard(app) {
    var overdue = !!(AppLib.isValidDate(app.recheckOn) && app.recheckOn < todayStr());
    var badge = overdue
      ? '<span class="badge badge-warn" title="Recheck date has passed - free tier may have changed">needs recheck</span>'
      : '';
    var links = Object.keys(app.links || {}).map(function (k) {
      return '<a href="' + esc(app.links[k]) + '" target="_blank" rel="noopener noreferrer">' +
        esc(k) + '</a>';
    }).join('<span class="dot">&#183;</span>');

    var tags = (app.tags || []).map(function (t) {
      return '<span class="chip">' + esc(t) + '</span>';
    }).join(' ');

    var platforms = (app.platforms || []).map(esc).join(' + ');
    var ww = (app.links && app.links.site) ? app.links.site.replace(/^https?:\/\//, '') : '';

    return '<article class="card" id="card-' + esc(app.id) + '">' +
      '<header><h2>' + esc(app.name) + ' ' + badge + '</h2>' +
      '<p class="meta">' + esc(platforms) + ' &#183; ' + esc(app.category) + (ww ? ' &#183; ' + esc(ww) : '') + '</p></header>' +
      '<p class="summary">' + esc(app.summary) + '</p>' +
      '<dl>' +
      '<dt>Free tier really includes</dt><dd>' + esc(app.freeTier) + '</dd>' +
      '<dt>Limits</dt><dd>' + esc(app.limits) + '</dd>' +
      '<dt>Paid tier</dt><dd>' + esc(app.paid) + '</dd>' +
      '<dt>Ads</dt><dd>' + esc(app.ads) + '</dd>' +
      '<dt>Permissions</dt><dd>' + esc(app.permissions) + '</dd>' +
      '<dt>Privacy note</dt><dd>' + esc(app.privacyNote) + '</dd>' +
      '</dl>' +
      '<footer><div class="tags">' + tags + '</div>' +
      '<div class="cardfoot"><span class="links">' + links + '</span>' +
      '<span class="dates">verified-free on <time datetime="' + esc(app.verifiedFreeOn) + '">' +
      esc(app.verifiedFreeOn) + '</time> &#183; recheck by <time datetime="' + esc(app.recheckOn) + '">' +
      esc(app.recheckOn) + '</time></span></div></footer>' +
      '</article>';
  }

  function apply() {
    var filtered = AppLib.filterApps(state.apps, {
      category: state.category,
      platform: state.platform,
      tag: state.tag,
      query: state.query
    });
    filtered = AppLib.sortApps(filtered, state.sort);
    var wrap = el('cards');
    if (!filtered.length) {
      wrap.innerHTML = '<p class="empty">No apps match those filters. Try clearing something.</p>';
    } else {
      wrap.innerHTML = filtered.map(renderCard).join('');
    }
    el('count').textContent = filtered.length + ' of ' + state.apps.length + ' apps';
  }

  function fillSelect(id, values, labelAll) {
    var sel = el(id);
    sel.innerHTML = '<option value="all">' + esc(labelAll) + '</option>' +
      values.map(function (v) {
        return '<option value="' + esc(v) + '">' + esc(v) + '</option>';
      }).join('');
  }

  function wire() {
    fillSelect('category', AppLib.CATEGORIES, 'All categories');
    fillSelect('platform', AppLib.PLATFORMS, 'All platforms');
    fillSelect('tag', AppLib.TAGS, 'All tags');

    ['category', 'platform', 'tag', 'sort'].forEach(function (id) {
      el(id).addEventListener('change', function (e) {
        state[id] = e.target.value;
        apply();
      });
    });
    el('query').addEventListener('input', function (e) {
      state.query = e.target.value.trim();
      apply();
    });
    el('clear').addEventListener('click', function () {
      state.category = 'all'; state.platform = 'all'; state.tag = 'all';
      state.query = ''; state.sort = 'name';
      el('category').value = 'all'; el('platform').value = 'all';
      el('tag').value = 'all'; el('sort').value = 'name';
      el('query').value = '';
      apply();
    });
  }

  function showFatal(message) {
    el('cards').innerHTML =
      '<p class="error">Could not load data/apps.json from this page.<br>' +
      'A static site that fetches JSON needs to be served over http (not opened with file://).<br>' +
      'Run <code>python3 -m http.server 8000</code> in this folder, then visit ' +
      '<code>http://localhost:8000</code>.</p>' +
      '<p class="error-detail">' + esc(message) + '</p>';
  }

  function boot(data) {
    state.apps = data.apps;
    var errors = AppLib.validateData(data);
    if (errors.length) {
      showFatal('Data problems: ' + errors.slice(0, 4).join('; '));
      return;
    }
    var overdue = state.apps.filter(function (a) { return AppLib.isOverdue(a); }).length;
    var soon = state.apps.filter(function (a) { return AppLib.isDueSoon(a); }).length;
    var banner = el('recheck-banner');
    if (overdue) {
      banner.textContent = overdue + ' card(s) past their recheck date - treat with care.';
      banner.hidden = false;
    } else if (soon) {
      banner.textContent = soon + ' card(s) due for a recheck within 14 days.';
      banner.hidden = false;
    }
    wire();
    apply();
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetch('data/apps.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' fetching data/apps.json');
        return r.json();
      })
      .then(boot)
      .catch(function (err) { showFatal(err && err.message ? err.message : String(err)); });
  });
})();
