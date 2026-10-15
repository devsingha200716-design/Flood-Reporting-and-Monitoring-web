/* ==============================================================
   map.js — interactive Leaflet flood map with severity markers,
   popups, filters and area search.
   ============================================================== */
(function () {
  'use strict';
  if (!window.GFR) return;

  var qs = GFR.qs, qsa = GFR.qsa, esc = GFR.esc, norm = GFR.norm;
  var mapEl = qs('#flood-map');
  if (!mapEl) return;
  if (typeof L === 'undefined') {
    mapEl.classList.add('map-fallback');
    mapEl.innerHTML = '<p>⚠ The map library could not load. Check your internet connection and reload.</p>';
    return;
  }

  var SEVERITY = GFR.SEVERITY;
  var FloodStore = GFR.FloodStore;

  var state = { sev: 'all', area: 'all', q: '' };
  var markerById = {};
  var focusedId = null;
  try {
    var params = new URLSearchParams(location.search);
    focusedId = params.get('focus');
    if (params.get('area')) state.area = params.get('area');
  } catch (e) { /* ignore */ }

  var map = L.map('flood-map').setView([26.1445, 91.7362], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  var layer = L.layerGroup().addTo(map);
  setTimeout(function () { map.invalidateSize(); }, 250);

  function popupHTML(r) {
    var sev = SEVERITY[r.severity] || SEVERITY.moderate;
    var photo = r.photo ? '<img class="popup-photo" src="' + esc(r.photo) + '" alt="">' : '';
    var level = (r.waterLevel != null && r.waterLevel !== '')
      ? esc(String(r.waterLevel)) + ' ft' : 'not specified';
    var resolved = r.status === 'resolved'
      ? ' <span class="badge resolved">Resolved</span>' : '';
    return photo +
      '<div class="popup-head"><span class="badge ' + esc(r.severity) + '">' + sev.emoji + ' ' + sev.label + '</span>' + resolved + '</div>' +
      '<div class="popup-title">📍 ' + esc(r.area) + '</div>' +
      '<div class="popup-row"><strong>Water level:</strong> ' + level + '</div>' +
      '<div class="popup-row"><strong>Reported:</strong> ' + GFR.timeAgo(r.reportedAt) +
      '<div class="popup-sub">' + esc(GFR.fmtDateTime(r.reportedAt)) + '</div></div>' +
      (r.description ? '<p class="popup-desc">' + esc(r.description) + '</p>' : '') +
      '<div class="popup-meta">' +
      (r.lat != null ? r.lat.toFixed(4) + ', ' + r.lng.toFixed(4) : 'approximate location') +
      (r.exact === false ? ' · area centre' : '') + '</div>';
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
    layer.clearLayers();
    markerById = {};
    var all = FloodStore.all();
    var shown = all.filter(function (r) { return r.lat != null && r.lng != null && matches(r); });

    shown.forEach(function (r) {
      var sev = SEVERITY[r.severity] || SEVERITY.moderate;
      var m = L.circleMarker([r.lat, r.lng], {
        radius: 9, color: '#ffffff', weight: 3, fillColor: sev.color, fillOpacity: .95
      });
      m.bindPopup(popupHTML(r), { maxWidth: 260 });
      m.addTo(layer);
      markerById[r.id] = m;
    });

    GFR.setText('map-count', shown.length + ' of ' + all.length + ' reports shown');
    var emptyEl = qs('#map-empty');
    if (emptyEl) emptyEl.hidden = shown.length > 0;
    var clearX = qs('#map-clear');
    if (clearX) clearX.hidden = !(state.q || state.sev !== 'all' || state.area !== 'all');

    if (focusedId && markerById[focusedId]) {
      var fr = FloodStore.byId(focusedId);
      if (fr) {
        map.setView([fr.lat, fr.lng], 15);
        markerById[focusedId].openPopup();
      }
      focusedId = null;
    }
  }

  function zoomToFilter() {
    var ids = Object.keys(markerById);
    if (!ids.length) return;
    if (ids.length === 1) {
      var one = FloodStore.byId(ids[0]);
      if (one) map.setView([one.lat, one.lng], 14);
      return;
    }
    var bounds = L.latLngBounds(ids.map(function (id) {
      var r = FloodStore.byId(id);
      return [r.lat, r.lng];
    }));
    map.fitBounds(bounds.pad(0.2));
  }

  /* ---- Severity chips ---- */
  var sevFilters = qs('#map-sev-filters');
  if (sevFilters) {
    sevFilters.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip[data-sev]');
      if (!chip) return;
      state.sev = chip.getAttribute('data-sev');
      qsa('.chip', sevFilters).forEach(function (c) {
        c.classList.toggle('active', c === chip);
      });
      focusedId = null;
      render();
    });
  }

  /* ---- Area dropdown ---- */
  var areaSel = qs('#map-area');
  if (areaSel) {
    var areas = FloodStore.areas();
    areaSel.innerHTML = '<option value="all">All areas</option>' +
      areas.map(function (a) { return '<option value="' + esc(a) + '">' + esc(a) + '</option>'; }).join('');
    if (state.area !== 'all' && areas.indexOf(state.area) === -1) state.area = 'all';
    areaSel.value = state.area;
    areaSel.addEventListener('change', function () {
      state.area = areaSel.value;
      focusedId = null;
      render();
      zoomToFilter();
    });
  }

  /* ---- Text search ---- */
  var searchInput = qs('#map-search');
  function applySearch() {
    state.q = searchInput ? searchInput.value : '';
    focusedId = null;
    render();
    if (state.q) zoomToFilter();
  }
  if (searchInput) {
    searchInput.addEventListener('input', applySearch);
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); applySearch(); }
    });
  }
  var searchBtn = qs('#map-search-btn');
  if (searchBtn) searchBtn.addEventListener('click', applySearch);

  /* ---- Clear all filters ---- */
  var clearX = qs('#map-clear');
  if (clearX) clearX.addEventListener('click', function () {
    state = { sev: 'all', area: 'all', q: '' };
    if (searchInput) searchInput.value = '';
    if (areaSel) areaSel.value = 'all';
    qsa('.chip[data-sev]', sevFilters || document).forEach(function (c) {
      c.classList.toggle('active', c.getAttribute('data-sev') === 'all');
    });
    render();
    map.setView([26.1445, 91.7362], 12);
  });

  /* ---- "My location" tool ---- */
  var locateBtn = qs('#map-locate');
  if (locateBtn) {
    locateBtn.addEventListener('click', function () {
      if (!navigator.geolocation) return;
      locateBtn.disabled = true;
      navigator.geolocation.getCurrentPosition(function (pos) {
        locateBtn.disabled = false;
        var ll = [pos.coords.latitude, pos.coords.longitude];
        map.setView(ll, 14);
        L.circleMarker(ll, {
          radius: 8, color: '#fff', weight: 3, fillColor: '#0369a1', fillOpacity: 1
        }).bindPopup('📍 You are here').openPopup().addTo(map);
      }, function () {
        locateBtn.disabled = false;
        locateBtn.title = 'Location permission denied';
      }, { timeout: 10000 });
    });
  }

  render();
})();