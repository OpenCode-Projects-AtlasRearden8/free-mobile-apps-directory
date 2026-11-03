(function (global) {
  'use strict';

  var CATEGORIES = [
    'Note-takers',
    'Scanners',
    'Sleep sounds',
    'Step counters',
    'Budgeting',
    'Chess trainers'
  ];

  var PLATFORMS = ['Android', 'iOS', 'Web'];
  var TAGS = [
    'open source',
    'offline',
    'no account required',
    'sync',
    'encryption',
    'budgeting',
    'chess',
    'free courses'
  ];

  var REQUIRED_FIELDS = [
    'id', 'name', 'category', 'platforms', 'summary', 'freeTier',
    'limits', 'paid', 'ads', 'permissions', 'privacyNote',
    'links', 'verifiedFreeOn', 'recheckOn', 'tags'
  ];

  function isValidDate(str) {
    if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    var d = new Date(str + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
  }

  function isHttpsUrl(url) {
    return typeof url === 'string' && /^https:\/\/[^\s]+$/.test(url);
  }

  // Validate the whole data file. Returns array of error strings (empty = clean).
  function validateData(data) {
    var errors = [];
    if (!data || Array.isArray(data) !== true && typeof data !== 'object') {
      return ['data must be an object'];
    }
    if (data.schemaVersion !== 1) {
      errors.push('schemaVersion must be 1');
    }
    if (!Array.isArray(data.apps)) {
      return ['apps must be an array'];
    }
    var seen = {};
    var today = todayStr();
    data.apps.forEach(function (app, i) {
      var where = 'app[' + i + ']' + (app && app.id ? ' (' + app.id + ')' : '');
      if (!app || typeof app !== 'object') {
        errors.push(where + ': not an object');
        return;
      }
      REQUIRED_FIELDS.forEach(function (f) {
        if (app[f] === undefined || app[f] === null || app[f] === '') {
          errors.push(where + ': missing field "' + f + '"');
        }
      });
      if (app.id && seen[app.id]) {
        errors.push(where + ': duplicate id "' + app.id + '"');
      }
      if (app.id) seen[app.id] = true;
      if (app.category && CATEGORIES.indexOf(app.category) === -1) {
        errors.push(where + ': unknown category "' + app.category + '"');
      }
      (app.platforms || []).forEach(function (p) {
        if (PLATFORMS.indexOf(p) === -1) {
          errors.push(where + ': unknown platform "' + p + '"');
        }
      });
      (app.tags || []).forEach(function (t) {
        if (TAGS.indexOf(t) === -1) {
          errors.push(where + ': unknown tag "' + t + '"');
        }
      });
      if (!isValidDate(app.verifiedFreeOn)) {
        errors.push(where + ': verifiedFreeOn is not a valid YYYY-MM-DD date');
      }
      if (!isValidDate(app.recheckOn)) {
        errors.push(where + ': recheckOn is not a valid YYYY-MM-DD date');
      }
      if (isValidDate(app.verifiedFreeOn) && isValidDate(app.recheckOn) &&
          app.recheckOn <= app.verifiedFreeOn) {
        errors.push(where + ': recheckOn must be after verifiedFreeOn');
      }
      var links = app.links || {};
      var linkNames = Object.keys(links);
      if (linkNames.length === 0) {
        errors.push(where + ': no links at all');
      }
      Object.keys(links).forEach(function (k) {
        if (!isHttpsUrl(links[k])) {
          errors.push(where + ': link "' + k + '" is not an https URL');
        }
      });
      if (typeof app.ads !== 'string' || app.ads.length < 5) {
        errors.push(where + ': "ads" must describe the ad situation');
      }
    });
    return errors;
  }

  // Nearest-date friendly helpers
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function isOverdue(app, today) {
    today = today || todayStr();
    return isValidDate(app.recheckOn) && app.recheckOn < today;
  }

  function isDueSoon(app, today, withinDays) {
    today = today || todayStr();
    withinDays = withinDays === undefined ? 14 : withinDays;
    if (!isValidDate(app.recheckOn)) return false;
    var soon = new Date(today + 'T00:00:00Z');
    soon.setUTCDate(soon.getUTCDate() + withinDays);
    var limited = soon.toISOString().slice(0, 10);
    return app.recheckOn >= today && app.recheckOn <= limited;
  }

  function matchesFilters(app, filters) {
    filters = filters || {};
    if (filters.category && filters.category !== 'all' && app.category !== filters.category) return false;
    if (filters.platform && filters.platform !== 'all' &&
        (app.platforms || []).indexOf(filters.platform) === -1) return false;
    if (filters.tag && filters.tag !== 'all' &&
        (app.tags || []).indexOf(filters.tag) === -1) return false;
    if (filters.query) {
      var q = String(filters.query).toLowerCase();
      var haystack = [app.name, app.summary, app.freeTier, app.limits, app.paid,
        app.permissions, app.privacyNote, app.category, (app.tags || []).join(' ')]
        .join(' ').toLowerCase();
      if (haystack.indexOf(q) === -1) return false;
    }
    return true;
  }

  function filterApps(apps, filters) {
    return (apps || []).filter(function (app) {
      return matchesFilters(app, filters);
    });
  }

  var SORT_KEYS = ['name', 'category', 'recheckOn', 'verifiedFreeOn'];

  function sortApps(apps, key) {
    if (SORT_KEYS.indexOf(key) === -1) key = 'name';
    var copy = (apps || []).slice();
    copy.sort(function (a, b) {
      var va = a[key] || '';
      var vb = b[key] || '';
      return va < vb ? -1 : va > vb ? 1 : 0;
    });
    return copy;
  }

  function uniqueLinks(data) {
    var out = [];
    var seen = {};
    (data && data.apps ? data.apps : []).forEach(function (app) {
      Object.keys(app.links || {}).forEach(function (k) {
        var url = app.links[k];
        if (!seen[url]) {
          seen[url] = true;
          out.push(url);
        }
      });
    });
    return out;
  }

  var api = {
    CATEGORIES: CATEGORIES,
    PLATFORMS: PLATFORMS,
    TAGS: TAGS,
    SORT_KEYS: SORT_KEYS,
    REQUIRED_FIELDS: REQUIRED_FIELDS,
    validateData: validateData,
    isValidDate: isValidDate,
    isHttpsUrl: isHttpsUrl,
    todayStr: todayStr,
    isOverdue: isOverdue,
    isDueSoon: isDueSoon,
    matchesFilters: matchesFilters,
    filterApps: filterApps,
    sortApps: sortApps,
    uniqueLinks: uniqueLinks
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.AppLib = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
