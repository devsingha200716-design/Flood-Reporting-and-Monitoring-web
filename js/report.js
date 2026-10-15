/* ==============================================================
   report.js — flood reporting form: location tagging (GPS/map/
   area search), severity, photo upload, validation, submission.
   ============================================================== */
(function () {
  'use strict';
  if (!window.GFR) return;

  var qs = GFR.qs, esc = GFR.esc;
  var form = qs('#report-form');
  if (!form) return;

  var SEVERITY = GFR.SEVERITY;
  var FloodStore = GFR.FloodStore;

  var pin = { lat: null, lng: null, exact: false };
  var photoData = null;
  var picker = null;
  var marker = null;
  var locStatus = qs('#loc-status');
  var coordReadout = qs('#coord-readout');
  var areaInput = qs('#area-input');

  function setStatus(msg, isError) {
    if (locStatus) {
      locStatus.textContent = msg || '';
      locStatus.style.color = isError ? '#b91c1c' : '';
    }
  }

  function setInvalid(fieldId, invalid) {
    var el = qs('#' + fieldId);
    if (el) el.classList.toggle('invalid', !!invalid);
  }

  function updateReadout() {
    if (!coordReadout) return;
    if (pin.lat == null) {
      coordReadout.textContent = 'No location pinned yet';
    } else {
      coordReadout.textContent = '📍 Pinned: ' + pin.lat.toFixed(5) + ', ' + pin.lng.toFixed(5) +
        (pin.exact ? '  ✓ location confirmed' : '  (area centre — tap map for exact spot)');
    }
    var clearBtn = qs('#btn-clear-loc');
    if (clearBtn) clearBtn.hidden = pin.lat == null;
  }

  function setPin(lat, lng, opts) {
    opts = opts || {};
    pin.lat = lat;
    pin.lng = lng;
    pin.exact = opts.exact !== false;
    if (picker) {
      if (!marker) {
        marker = L.marker([lat, lng], { draggable: true }).addTo(picker);
        marker.on('dragend', function () {
          var ll = marker.getLatLng();
          pin.lat = ll.lat; pin.lng = ll.lng; pin.exact = true;
          updateReadout();
        });
      } else {
        marker.setLatLng([lat, lng]);
      }
      if (!opts.noPan) picker.setView([lat, lng], Math.max(picker.getZoom(), 14));
    }
    setInvalid('field-loc', false);
    updateReadout();
    /* Suggest the nearest known area if the user hasn't typed one */
    if (!opts.keepArea && areaInput && !areaInput.value.trim()) {
      var near = GFR.nearestArea(lat, lng);
      if (near) areaInput.value = near.name;
    }
  }

  function clearPin() {
    pin = { lat: null, lng: null, exact: false };
    if (marker && picker) { picker.removeLayer(marker); marker = null; }
    updateReadout();
    setStatus('');
  }

  /* ---------- Area datalist (search / select an area) ---------- */
  (function fillAreaList() {
    var dl = qs('#area-list');
    if (!dl) return;
    dl.innerHTML = GFR.GUWAHATI_AREAS.map(function (a) {
      return '<option value="' + esc(a.name) + '"></option>';
    }).join('');
  })();

  if (areaInput) {
    areaInput.addEventListener('change', function () {
      var known = GFR.findArea(areaInput.value);
      if (known) setPin(known.lat, known.lng, { exact: false, keepArea: true });
    });
  }

  /* ---------- Map picker ---------- */
  var pickEl = qs('#pick-map');
  if (pickEl && typeof L !== 'undefined') {
    picker = L.map('pick-map').setView([26.1445, 91.7362], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(picker);
    picker.on('click', function (e) {
      setPin(e.latlng.lat, e.latlng.lng, { exact: true, keepArea: true });
      setStatus('Location pinned ✓');
    });
    setTimeout(function () { picker.invalidateSize(); }, 250);
  } else if (pickEl) {
    pickEl.classList.add('map-fallback');
    pickEl.innerHTML = '<p>⚠ Map failed to load (internet required). Use the area field or GPS instead.</p>';
  }

  /* ---------- GPS ---------- */
  var gpsBtn = qs('#btn-gps');
  if (gpsBtn) {
    gpsBtn.addEventListener('click', function () {
      if (!navigator.geolocation) {
        setStatus('Geolocation is not supported by this browser.', true);
        return;
      }
      gpsBtn.disabled = true;
      setStatus('Getting your location…');
      navigator.geolocation.getCurrentPosition(function (pos) {
        gpsBtn.disabled = false;
        setPin(pos.coords.latitude, pos.coords.longitude, { exact: true });
        setStatus('📍 Using your GPS location (±' + Math.round(pos.coords.accuracy || 0) + ' m) ✓');
      }, function (err) {
        gpsBtn.disabled = false;
        var msg = err.code === 1
          ? 'Location permission denied. Allow it in browser settings, or tap the map instead.'
          : 'Could not get your location. Tap the map to pin the spot instead.';
        setStatus(msg, true);
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
  }

  var clearBtn = qs('#btn-clear-loc');
  if (clearBtn) clearBtn.addEventListener('click', clearPin);

  /* ---------- Photo upload (compressed client-side) ---------- */
  var photoInput = qs('#photo-input');
  var photoPreview = qs('#photo-preview');
  var photoImg = qs('#photo-img');

  function showPhoto(dataUrl) {
    photoData = dataUrl;
    if (photoImg) photoImg.src = dataUrl;
    if (photoPreview) photoPreview.hidden = false;
    var fileBtn = qs('#file-btn');
    if (fileBtn) fileBtn.hidden = true;
  }

  function resetPhoto() {
    photoData = null;
    if (photoInput) photoInput.value = '';
    if (photoPreview) photoPreview.hidden = true;
    if (photoImg) photoImg.removeAttribute('src');
    var fileBtn = qs('#file-btn');
    if (fileBtn) fileBtn.hidden = false;
  }

  function processFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { showFormError('Please choose an image file (JPG/PNG/WebP).'); return; }
    if (file.size > 15 * 1024 * 1024) { showFormError('Image too large (max 15 MB).'); return; }
    showFormError('');
    var reader = new FileReader();
    reader.onerror = function () { showFormError('Could not read that image.'); };
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        try {
          var maxW = 1024;
          var scale = Math.min(1, maxW / img.width);
          var w = Math.round(img.width * scale);
          var h = Math.round(img.height * scale);
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          showPhoto(canvas.toDataURL('image/jpeg', 0.72));
        } catch (err) {
          showPhoto(reader.result); /* fall back to original data URL */
        }
      };
      img.onerror = function () { showPhoto(reader.result); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  if (photoInput) photoInput.addEventListener('change', function () {
    processFile(photoInput.files && photoInput.files[0]);
  });
  var photoRemove = qs('#photo-remove');
  if (photoRemove) photoRemove.addEventListener('click', resetPhoto);

  /* ---------- Description counter ---------- */
  var descInput = qs('#desc-input');
  var descCount = qs('#desc-count');
  if (descInput && descCount) {
    descInput.addEventListener('input', function () {
      descCount.textContent = String(descInput.value.length);
    });
  }

  /* ---------- Date/time default ---------- */
  var dtInput = qs('#dt-input');
  function toLocalInputValue(d) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  if (dtInput) dtInput.value = toLocalInputValue(new Date());

  var formError = qs('#form-error');
  function showFormError(msg) {
    if (!formError) return;
    formError.textContent = msg || '';
    formError.hidden = !msg;
  }

  /* ---------- Validation & submit ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    showFormError('');
    ['field-area', 'field-loc', 'field-sev', 'field-dt'].forEach(function (id) { setInvalid(id, false); });

    var errors = [];
    var area = areaInput ? areaInput.value.trim() : '';
    if (!area) { setInvalid('field-area', true); errors.push('enter an area'); }

    /* Location: exact pin, or resolve to a known area centre */
    if (pin.lat == null && area) {
      var known = GFR.findArea(area);
      if (known) setPin(known.lat, known.lng, { exact: false, keepArea: true });
    }
    if (pin.lat == null) { setInvalid('field-loc', true); errors.push('pin the spot on the map or use GPS'); }

    var sevInput = form.querySelector('input[name="severity"]:checked');
    if (!sevInput) { setInvalid('field-sev', true); errors.push('choose a severity'); }

    if (dtInput && !dtInput.value) { setInvalid('field-dt', true); errors.push('set date & time'); }

    var waterInput = qs('#water-input');
    var water = null;
    if (waterInput && waterInput.value !== '') {
      water = Number(waterInput.value);
      var wField = waterInput.closest('.field');
      if (isNaN(water) || water < 0 || water > 100) {
        if (wField) wField.classList.add('invalid');
        errors.push('water level must be 0–100 ft');
      } else if (wField) {
        wField.classList.remove('invalid');
      }
    }

    if (errors.length) {
      showFormError('⚠ Please fix: ' + errors.join(', ') + '.');
      var firstBad = form.querySelector('.field.invalid');
      if (firstBad) firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!area) {
      var near = GFR.nearestArea(pin.lat, pin.lng);
      area = near ? near.name : 'Guwahati';
    }

    var report = {
      id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      area: area,
      address: area + ', Guwahati, Assam',
      lat: pin.lat,
      lng: pin.lng,
      exact: pin.exact,
      severity: sevInput.value,
      waterLevel: water,
      description: descInput ? descInput.value.trim() : '',
      photo: photoData,
      reportedAt: dtInput ? new Date(dtInput.value).toISOString() : new Date().toISOString(),
      status: 'active'
    };

    var res = FloodStore.add(report);
    if (!res.ok) {
      showFormError('⚠ Could not save — browser storage is full or blocked. Try removing the photo.');
      return;
    }

    /* Success screen */
    form.hidden = true;
    var stepsEl = qs('#form-steps');
    if (stepsEl) stepsEl.hidden = true;
    var panel = qs('#success-panel');
    if (panel) {
      var txt = qs('#success-text');
      if (txt) {
        txt.textContent = 'Your ' + report.severity + ' report from ' + report.area +
          ' is now on the flood map.' +
          (res.photoDropped ? ' (Photo was dropped: storage full.)' : '') +
          (res.memory ? ' (Storage unavailable — kept until you close this tab.)' : '');
      }
      var link = qs('#success-map-link');
      if (link) link.href = 'map.html?focus=' + encodeURIComponent(report.id);
      panel.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  /* Reset button */
  var resetBtn = qs('#btn-reset');
  if (resetBtn) resetBtn.addEventListener('click', function () {
    form.reset();
    clearPin();
    resetPhoto();
    if (dtInput) dtInput.value = toLocalInputValue(new Date());
    if (descCount) descCount.textContent = '0';
    showFormError('');
    ['field-area', 'field-loc', 'field-sev', 'field-dt'].forEach(function (id) { setInvalid(id, false); });
  });

  updateReadout();
})();