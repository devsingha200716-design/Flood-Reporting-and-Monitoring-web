/* ==============================================================
   Guwahati Flood Reporting System — app.js
   Shared logic: data store (localStorage), helpers, navigation,
   home page, report list + search/filter, monitoring dashboard.
   ============================================================== */
(function () {
  'use strict';

  /* ---------- Severity configuration ---------- */
  var SEVERITY = {
    low:      { label: 'Low',      emoji: '🟢', color: '#16a34a', rank: 1 },
    moderate: { label: 'Moderate', emoji: '🟡', color: '#eab308', rank: 2 },
    high:     { label: 'High',     emoji: '🟠', color: '#f97316', rank: 3 },
    critical: { label: 'Critical', emoji: '🔴', color: '#ef4444', rank: 4 }
  };

  /* ---------- Guwahati areas (approx. coordinates) ---------- */
  var GUWAHATI_AREAS = [
    { name: 'Beltola',           lat: 26.1047, lng: 91.7898 },
    { name: 'Dispur',            lat: 26.1433, lng: 91.7898 },
    { name: 'Maligaon',          lat: 26.1697, lng: 91.7244 },
    { name: 'Six Mile',          lat: 26.1534, lng: 91.7678 },
    { name: 'Jalukbari',         lat: 26.1477, lng: 91.6839 },
    { name: 'Ganeshguri',        lat: 26.1377, lng: 91.7469 },
    { name: 'Bhangagarh',        lat: 26.1367, lng: 91.7496 },
    { name: 'Paltan Bazar',      lat: 26.1419, lng: 91.7362 },
    { name: 'Panbazar',          lat: 26.1547, lng: 91.7413 },
    { name: 'Ulubari',           lat: 26.1477, lng: 91.7397 },
    { name: 'Lachit Nagar',      lat: 26.1317, lng: 91.7419 },
    { name: 'Zoo Road',          lat: 26.1473, lng: 91.7697 },
    { name: 'R.G. Baruah Road',  lat: 26.1515, lng: 91.7630 },
    { name: 'Bamunimaidan',      lat: 26.1575, lng: 91.7486 },
    { name: 'Adabari',           lat: 26.1667, lng: 91.6997 },
    { name: 'Amingaon',          lat: 26.1907, lng: 91.6628 },
    { name: 'Narengi',           lat: 26.1773, lng: 91.7697 },
    { name: 'Hengrabari',        lat: 26.1489, lng: 91.7767 },
    { name: 'Khanapara',         lat: 26.1035, lng: 91.7864 },
    { name: 'Basistha',          lat: 26.1111, lng: 91.7861 },
    { name: 'Sonapur',           lat: 26.1913, lng: 91.9774 },
    { name: 'North Guwahati',    lat: 26.1931, lng: 91.6939 },
    { name: 'Bharalumukh',       lat: 26.1630, lng: 91.7317 },
    { name: 'Latasil',           lat: 26.1406, lng: 91.7447 },
    { name: 'Maniram Dewan Road',lat: 26.1469, lng: 91.7477 }
  ];

  /* ---------- Small helpers ---------- */
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function norm(value) { return String(value == null ? '' : value).trim().toLowerCase(); }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function timeAgo(iso) {
    var seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    var minutes = seconds / 60;
    if (minutes < 60) return Math.floor(minutes) + ' min ago';
    var hours = minutes / 60;
    if (hours < 24) return Math.floor(hours) + ' hr ago';
    var days = hours / 24;
    if (days < 7) return Math.floor(days) + (days < 2 ? ' day ago' : ' days ago');
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtDateTime(iso) {
    try {
      return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (e) { return String(iso); }
  }

  function findArea(name) {
    var key = norm(name);
    for (var i = 0; i < GUWAHATI_AREAS.length; i++) {
      if (norm(GUWAHATI_AREAS[i].name) === key) return GUWAHATI_AREAS[i];
    }
    return null;
  }

  function nearestArea(lat, lng) {
    var best = null, bestDist = Infinity;
    GUWAHATI_AREAS.forEach(function (area) {
      var dy = (area.lat - lat) * 111;
      var dx = (area.lng - lng) * 111 * Math.cos(lat * Math.PI / 180);
      var d = dx * dx + dy * dy; /* km² */
      if (d < bestDist) { bestDist = d; best = area; }
    });
    return bestDist <= 36 ? best : null; /* within ~6 km */
  }

  /* Built-in demo "photo" (SVG data-URI) so thumbnails work offline */
  function demoPhoto(title, top, bottom) {
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + top + '"/><stop offset="1" stop-color="' + bottom + '"/>' +
      '</linearGradient></defs>' +
      '<rect width="480" height="320" fill="url(#g)"/>' +
      '<path d="M0 190 C 60 172, 120 208, 180 190 S 300 172, 360 190 S 455 208, 480 194 L480 320 L0 320 Z" fill="rgba(3,78,124,.55)"/>' +
      '<path d="M0 236 C 70 216, 130 256, 200 236 S 320 216, 390 236 S 458 256, 480 244 L480 320 L0 320 Z" fill="rgba(2,55,95,.62)"/>' +
      '<text x="24" y="54" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="#ffffff" opacity=".95">' + title + '</text>' +
      '<text x="24" y="86" font-family="Arial, sans-serif" font-size="17" fill="#e0f2fe" opacity=".9">Flood photo · Guwahati</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ---------- Seed data (demo reports) ---------- */
  var SEED_SPECS = [
    ['Beltola', 'high', 2.5, 'Water up to knee level near Beltola Bazar. Two-wheelers stalling, several small shops shut.', 2,
      { photo: demoPhoto('Beltola Bazar', '#7dd3fc', '#0369a1') }],
    ['Dispur', 'moderate', 1, 'Logging near the Secretariat gate after overnight rain. Traffic moving slowly.', 5, {}],
    ['Maligaon', 'critical', 4, 'Ground floors of riverside houses inundated near Maligaon char; families shifted upstairs.', 1,
      { photo: demoPhoto('Maligaon Char', '#fca5a5', '#b91c1c') }],
    ['Six Mile', 'moderate', 1.5, 'Six Mile underpass filled with water; vehicles taking the service lane.', 8, {}],
    ['Jalukbari', 'low', 0.5, 'Drain overflow near the flyover; footpath waterlogged but passable.', 26, {}],
    ['Ganeshguri', 'high', 2, 'Water entered shops near Ganeshguri Hozikona; local drainage blocked.', 3,
      { photo: demoPhoto('Ganeshguri', '#fdba74', '#c2410c') }],
    ['Amingaon', 'critical', 3.5, 'Low-lying areas near Amingaon ghat flooded after sudden release; relief camp open.', 13, {}],
    ['Paltan Bazar', 'moderate', 1, 'Market lanes waterlogged after the evening shower; vendors wading.', 30, { status: 'resolved' }],
    ['Zoo Road', 'moderate', 1.2, 'Stagnant water near the railway overbridge approach; two-wheelers struggling.', 7, {}],
    ['Ulubari', 'high', 2.8, 'Canal overflow onto the main road; cars crossing in first gear.', 16, {}],
    ['Sonapur', 'high', 2.2, 'Rental colony roads inaccessible; water still rising in the evening.', 49, {}],
    ['Khanapara', 'low', 0.4, 'Minor drain overflow near the bus stop, cleared by volunteers.', 52, { status: 'resolved' }]
  ];

  function buildSeed() {
    return SEED_SPECS.map(function (sp, i) {
      var area = findArea(sp[0]) || { lat: 26.1445, lng: 91.7362 };
      var opts = sp[5] || {};
      return {
        id: 'seed-' + (i + 1),
        area: sp[0],
        address: sp[0] + ', Guwahati, Assam',
        lat: opts.lat != null ? opts.lat : area.lat,
        lng: opts.lng != null ? opts.lng : area.lng,
        exact: true,
        severity: sp[1],
        waterLevel: sp[2],
        description: sp[3],
        photo: opts.photo || null,
        reportedAt: new Date(Date.now() - sp[4] * 3600000).toISOString(),
        status: opts.status || 'active'
      };
    }).sort(function (a, b) { return new Date(b.reportedAt) - new Date(a.reportedAt); });
  }

  /* ---------- Storage ---------- */
  var STORE_KEY = 'gfr_reports_v1';
  var memoryStore = null;
  var lsOK = (function () {
    try { localStorage.setItem('__gfr_t', '1'); localStorage.removeItem('__gfr_t'); return true; }
    catch (e) { return false; }
  })();

  function tryWrite(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; }
  }

  /* Persist; on quota errors progressively drop photos (newest first). */
  function persist(list) {
    if (!lsOK) return { ok: true, memory: true, photoDropped: false };
    if (tryWrite(list)) return { ok: true, memory: false, photoDropped: false };
    var order = list.slice();
    for (var i = 0; i < order.length; i++) {
      if (order[i].photo) {
        order[i].photo = null;
        if (tryWrite(list)) return { ok: true, memory: false, photoDropped: true };
      }
    }
    return { ok: false, memory: false, photoDropped: true };
  }

  function loadReports() {
    if (memoryStore) return memoryStore;
    if (lsOK) {
      try {
        var raw = localStorage.getItem(STORE_KEY);
        if (raw) {
          var list = JSON.parse(raw);
          if (Array.isArray(list)) { memoryStore = list; return memoryStore; }
        }
      } catch (e) { console.warn('[GFR] storage read failed:', e); }
    }
    memoryStore = buildSeed();
    if (lsOK) tryWrite(memoryStore);
    return memoryStore;
  }

  /* ---------- Public store ---------- */
  var FloodStore = {
    storageAvailable: lsOK,

    all: function () { return loadReports(); },

    byId: function (id) {
      var list = loadReports();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },

    /* Returns { ok, memory, photoDropped } */
    add: function (report) {
      var list = loadReports();
      list.unshift(report);
      var res = persist(list);
      if (res.ok && res.photoDropped) report.photo = null;
      if (!res.ok) list.shift(); /* roll back */
      return res;
    },

    areas: function () {
      var seen = {}, list = loadReports();
      list.forEach(function (r) { if (r.area) seen[norm(r.area)] = String(r.area).trim(); });
      return Object.keys(seen).map(function (k) { return seen[k]; })
        .sort(function (a, b) { return a.localeCompare(b); });
    },

    stats: function () {
      var list = loadReports();
      var active = list.filter(function (r) { return r.status !== 'resolved'; });
      var areas = {}, hcAreas = {};
      active.forEach(function (r) {
        if (!r.area) return;
        areas[norm(r.area)] = true;
        if (r.severity === 'high' || r.severity === 'critical') hcAreas[norm(r.area)] = true;
      });
      var recent = list.slice().sort(function (a, b) {
        return new Date(b.reportedAt) - new Date(a.reportedAt);
      }).slice(0, 5);
      return {
        total: list.length,
        activeReports: active.length,
        activeAreas: Object.keys(areas).length,
        highCriticalAreas: Object.keys(hcAreas).length,
        high: active.filter(function (r) { return r.severity === 'high'; }).length,
        critical: active.filter(function (r) { return r.severity === 'critical'; }).length,
        resolved: list.length - active.length,
        recent: recent
      };
    }
  };

  /* Expose for other scripts (map.js / report.js) */
  window.GFR = {
    SEVERITY: SEVERITY,
    GUWAHATI_AREAS: GUWAHATI_AREAS,
    FloodStore: FloodStore,
    qs: qs, qsa: qsa, esc: esc, norm: norm, setText: setText,
    timeAgo: timeAgo, fmtDateTime: fmtDateTime,
    findArea: findArea, nearestArea: nearestArea
  };

  /* ---------- Report card renderer (shared) ---------- */
  function reportCardHTML(r) {
    var sev = SEVERITY[r.severity] || SEVERITY.moderate;
    var thumb = r.photo
      ? '<img src="' + esc(r.photo) + '" alt="Flood photo from ' + esc(r.area) + '" loading="lazy">'
      : '<span class="rc-emoji" aria-hidden="true">' + sev.emoji + '</span>';
    var level = (r.waterLevel != null && r.waterLevel !== '')
      ? '<span title="Water level">💧 ' + esc(String(r.waterLevel)) + ' ft</span>'
      : '';
    var resolved = r.status === 'resolved' ? '<span class="badge resolved">Resolved</span>' : '';
    var coords = (r.lat != null && r.lng != null)
      ? '<span title="Coordinates">📍 ' + r.lat.toFixed(3) + ', ' + r.lng.toFixed(3) + '</span>'
      : '';
    return '' +
      '<article class="report-card" role="link" tabindex="0" data-id="' + esc(r.id) + '" ' +
      'data-href="map.html?focus=' + encodeURIComponent(r.id) + '" ' +
      'aria-label="View ' + esc(r.area) + ' report on map">' +
        '<div class="rc-thumb">' + thumb + '</div>' +
        '<div class="rc-body">' +
          '<div class="rc-top">' +
            '<h3>📍 ' + esc(r.area) + '</h3>' +
            '<span class="badge ' + esc(r.severity) + '">' + sev.emoji + ' ' + sev.label + '</span>' +
          '</div>' +
          '<div class="rc-meta">' +
            '<span title="' + esc(fmtDateTime(r.reportedAt)) + '">🕐 ' + timeAgo(r.reportedAt) + '</span>' +
            level + coords + resolved +
          '</div>' +
          (r.description ? '<p class="rc-desc">' + esc(r.description) + '</p>' : '') +
        '</div>' +
      '</article>';
  }

  function sortByTimeDesc(list) {
    return list.slice().sort(function (a, b) {
      return new Date(b.reportedAt) - new Date(a.reportedAt);
    });
  }

  /* ---------- Navigation (hamburger + active link) ---------- */
  function initNav() {
    var toggle = qs('#nav-toggle');
    var nav = qs('#site-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      });
      document.addEventListener('click', function (e) {
        if (nav.classList.contains('open') && !nav.contains(e.target) && e.target !== toggle) {
          nav.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && nav.classList.contains('open')) {
          nav.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.focus();
        }
      });
      qsa('#site-nav a').forEach(function (a) {
        a.addEventListener('click', function () { nav.classList.remove('open'); });
      });
    }
    /* Highlight current page */
    var page = document.body.getAttribute('data-page') || '';
    qsa('.site-nav a[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === page) a.classList.add('active');
    });
  }

  /* ---------- Floating Report button (all pages except the form) ---------- */
  function injectFab() {
    if ((document.body.getAttribute('data-page') || '') === 'report') return;
    if (qs('.fab')) return;
    var a = document.createElement('a');
    a.className = 'fab';
    a.href = 'report.html';
    a.innerHTML = '⚠ <span>Report Flood</span>';
    document.body.appendChild(a);
  }

  /* ---------- Card click / keyboard → map ---------- */
  function initCardLinks() {
    document.addEventListener('click', function (e) {
      var card = e.target.closest ? e.target.closest('.report-card[data-href]') : null;
      if (card) location.href = card.getAttribute('data-href');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = e.target.closest ? e.target.closest('.report-card[data-href]') : null;
      if (card) { e.preventDefault(); location.href = card.getAttribute('data-href'); }
    });
  }

  /* ---------- Home page ---------- */
  function initHome() {
    if (!qs('#home-stats')) return;
    var st = FloodStore.stats();
    setText('stat-total', st.total);
    setText('stat-areas', st.activeAreas);
    setText('stat-hc', st.highCriticalAreas);
    setText('stat-critical', st.critical);

    var listEl = qs('#recent-list');
    var emptyEl = qs('#recent-empty');
    if (listEl) {
      if (st.recent.length) {
        listEl.innerHTML = sortByTimeDesc(st.recent).map(reportCardHTML).join('');
        if (emptyEl) emptyEl.hidden = true;
      } else if (emptyEl) {
        emptyEl.hidden = false;
      }
    }
  }

  /* ---------- Reports page: search + filters ---------- */
  function initReportsPage() {
    var listEl = qs('#reports-list');
    if (!listEl) return;
    var searchInput = qs('#reports-search');
    var areaSel = qs('#reports-area');
    var sortSel = qs('#reports-sort');
    var countEl = qs('#reports-count');
    var emptyEl = qs('#reports-empty');
    var clearBtn = qs('#reports-clear');
    var chipBox = qs('#rep-sev-filters');

    var state = { q: '', sev: 'all', area: 'all', sort: 'new' };

    /* Support links like reports.html?area=Beltola or ?q=water */
    try {
      var params = new URLSearchParams(location.search);
      if (params.get('area')) state.area = params.get('area');
      if (params.get('q')) { state.q = params.get('q'); if (searchInput) searchInput.value = state.q; }
    } catch (e) { /* URLSearchParams unsupported — ignore */ }

    function fillAreaOptions() {
      if (!areaSel) return;
      var areas = FloodStore.areas();
      areaSel.innerHTML = '<option value="all">All areas</option>' +
        areas.map(function (a) { return '<option value="' + esc(a) + '">' + esc(a) + '</option>'; }).join('');
      if (state.area !== 'all' && areas.indexOf(state.area) === -1) state.area = 'all';
      areaSel.value = state.area;
    }

    function matches(r) {
      if (state.sev !== 'all' && r.severity !== state.sev) return false;
      if (state.area !== 'all' && norm(r.area) !== norm(state.area)) return false;
      if (state.q) {
        var hay = norm(r.area + ' ' + (r.address || '') + ' ' + (r.description || ''));
        if (hay.indexOf(norm(state.q)) === -1) return false;
      }
      return true;
    }

    function render() {
      var all = FloodStore.all();
      var filtered = all.filter(matches);
      if (state.sort === 'new') filtered = sortByTimeDesc(filtered);
      else if (state.sort === 'old') filtered = filtered.slice().sort(function (a, b) {
        return new Date(a.reportedAt) - new Date(b.reportedAt);
      });
      else if (state.sort === 'sev') filtered = filtered.slice().sort(function (a, b) {
        var ra = (SEVERITY[a.severity] || SEVERITY.low).rank;
        var rb = (SEVERITY[b.severity] || SEVERITY.low).rank;
        return rb - ra || new Date(b.reportedAt) - new Date(a.reportedAt);
      });
      else if (state.sort === 'water') filtered = filtered.slice().sort(function (a, b) {
        return (Number(b.waterLevel) || 0) - (Number(a.waterLevel) || 0);
      });

      listEl.innerHTML = filtered.map(reportCardHTML).join('');
      if (countEl) countEl.textContent = 'Showing ' + filtered.length + ' of ' + all.length + ' reports';
      if (emptyEl) emptyEl.hidden = filtered.length > 0;
      var dirty = state.q || state.sev !== 'all' || state.area !== 'all' || state.sort !== 'new';
      if (clearBtn) clearBtn.hidden = !dirty;
      if (chipBox) {
        GFR.qsa('.chip', chipBox).forEach(function (c) {
          c.classList.toggle('active', c.getAttribute('data-sev') === state.sev);
        });
      }
    }

    if (chipBox) {
      chipBox.addEventListener('click', function (e) {
        var chip = e.target.closest('.chip[data-sev]');
        if (!chip) return;
        state.sev = chip.getAttribute('data-sev');
        render();
      });
    }
    if (searchInput) searchInput.addEventListener('input', function () { state.q = searchInput.value; render(); });
    if (areaSel) areaSel.addEventListener('change', function () { state.area = areaSel.value; render(); });
    if (sortSel) sortSel.addEventListener('change', function () { state.sort = sortSel.value; render(); });
    if (clearBtn) clearBtn.addEventListener('click', function () {
      state = { q: '', sev: 'all', area: 'all', sort: 'new' };
      if (searchInput) searchInput.value = '';
      if (areaSel) areaSel.value = 'all';
      if (sortSel) sortSel.value = 'new';
      render();
    });

    fillAreaOptions();
    render();
  }

  /* ---------- Admin / monitoring dashboard ---------- */
  function initDashboard() {
    var totalEl = qs('#dash-total');
    if (!totalEl) return;
    var st = FloodStore.stats();
    var all = FloodStore.all();

    setText('dash-total', st.total);
    setText('dash-locations', st.activeAreas);
    setText('dash-high', st.high);
    setText('dash-critical', st.critical);
    setText('dash-resolved', st.resolved);

    /* Severity breakdown bars */
    var barsEl = qs('#severity-bars');
    if (barsEl) {
      var counts = { low: 0, moderate: 0, high: 0, critical: 0 };
      all.forEach(function (r) { if (counts[r.severity] != null) counts[r.severity]++; });
      var max = Math.max(1, counts.low, counts.moderate, counts.high, counts.critical);
      barsEl.innerHTML = ['low', 'moderate', 'high', 'critical'].map(function (k) {
        var pct = Math.round((counts[k] / max) * 100);
        return '<div class="bar-row">' +
          '<span class="bar-label">' + SEVERITY[k].emoji + ' ' + SEVERITY[k].label + '</span>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + SEVERITY[k].color + '"></div></div>' +
          '<span class="bar-val">' + counts[k] + '</span>' +
          '</div>';
      }).join('');
    }

    /* Areas at risk */
    var riskEl = qs('#dash-risk');
    if (riskEl) {
      var byArea = {};
      all.filter(function (r) { return r.status !== 'resolved' && r.area; }).forEach(function (r) {
        var key = norm(r.area);
        if (!byArea[key]) byArea[key] = { name: r.area, count: 0, rank: 0 };
        byArea[key].count++;
        var rank = (SEVERITY[r.severity] || SEVERITY.low).rank;
        if (rank > byArea[key].rank) byArea[key].rank = rank;
      });
      var risks = Object.keys(byArea).map(function (k) { return byArea[k]; }).sort(function (a, b) {
        return b.rank - a.rank || b.count - a.count;
      }).slice(0, 7);
      if (!risks.length) {
        riskEl.innerHTML = '<li class="muted">No active flood areas right now.</li>';
      } else {
        riskEl.innerHTML = risks.map(function (a) {
          var key = Object.keys(SEVERITY).filter(function (k) { return SEVERITY[k].rank === a.rank; })[0];
          var sev = SEVERITY[key] || SEVERITY.low;
          return '<li>' +
            '<span class="ra-name">📍 ' + esc(a.name) + ' <span class="ra-count">· ' + a.count + ' report' + (a.count > 1 ? 's' : '') + '</span></span>' +
            '<span class="badge ' + key + '">' + sev.emoji + ' ' + sev.label + '</span>' +
            '</li>';
        }).join('');
      }
    }

    /* Recent reports */
    var recentEl = qs('#dash-recent');
    if (recentEl) {
      var recent = sortByTimeDesc(all).slice(0, 6);
      recentEl.innerHTML = recent.length
        ? recent.map(reportCardHTML).join('')
        : '<div class="empty-state"><span class="es-icon">💧</span><strong>No reports yet</strong></div>';
    }
  }

  /* ---------- Boot ---------- */
  initNav();
  injectFab();
  initCardLinks();
  initHome();
  initReportsPage();
  initDashboard();
})();
