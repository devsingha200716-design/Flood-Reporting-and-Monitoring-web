# 🌊 Guwahati Flood Reporting System

A **mobile-first frontend prototype** for reporting and monitoring floods in
Guwahati, Assam. Citizens can quickly tag a flooded location, submit a report
with severity, water level, description and an optional photo — and see it
instantly on an interactive map.

> **Prototype status:** no backend. Reports are stored in the browser
> (`localStorage`) and seeded with demo data so every screen looks alive.

## ✨ Features

| Page | What it does |
|---|---|
| `index.html` — Home | Hero with prominent **Report Flood** button, live stats (total reports, active areas, high/critical areas), recent reports, how-it-works |
| `report.html` — Report | Quick form: area search (datalist of 25 Guwahati areas), **GPS**, **tap-to-pin map**, severity picker (🟢🟡🟠🔴), water level, description, photo upload (auto-compressed), date/time, validation + success screen |
| `map.html` — Flood Map | Leaflet + OpenStreetMap, colour-coded circle markers, rich popups (photo, severity, water level, description, report time), severity/area/text filters, legend, "my location", deep links `?focus=<id>` |
| `reports.html` — Reports | Card list with photo thumbnails, live **search**, severity chips, area filter, sort (newest/oldest/severity/water level), `?area=` / `?q=` URL support |
| `dashboard.html` — Admin | Total / active locations / high-risk / critical / resolved stats, severity breakdown bars, areas-at-risk list, recent reports |

**UX (mobile-first):** touch-friendly controls (≥48 px), 16 px inputs (no iOS
zoom), hamburger menu below 900 px, persistent floating **Report Flood** button,
no horizontal scrolling, graceful desktop layout, `prefers-reduced-motion`
support.

## 🚀 Run it

No build step. Either:

1. **Recommended:** run the bundled zero-dependency server and open the URL:
   ```
   node server.js        →  http://localhost:5500
   ```
   (custom port: `PORT=8080 node server.js`) — GPS/geolocation works on `localhost`, and restarting is one command.
2. Use VS Code **Live Server** on this folder.
3. **Double-click `index.html`** (works, but GPS/geolocation may be blocked on `file://`).

Internet is required for **map tiles + Leaflet CDN**; everything else works offline.

## 📁 File structure

```
flood-management/
├── index.html        # Home / dashboard
├── report.html       # Flood reporting form
├── map.html          # Interactive flood map
├── reports.html      # Report list + search/filters
├── dashboard.html    # Admin/monitoring dashboard
├── css/
│   └── style.css     # Mobile-first stylesheet
├── js/
│   ├── app.js        # Store, helpers, nav, home, list, dashboard
│   ├── report.js     # Form: location, photo, validation, submit
│   └── map.js        # Leaflet map, markers, popups, filters
├── images/
│   └── logo.svg      # App logo / favicon
└── README.md
```

## 💾 Data model (localStorage key `gfr_reports_v1`)

```json
{
  "id": "r_171234567890_ab12c",
  "area": "Beltola",
  "address": "Beltola, Guwahati, Assam",
  "lat": 26.1047, "lng": 91.7898, "exact": true,
  "severity": "high",            // low | moderate | high | critical
  "waterLevel": 2.5,             // feet (optional)
  "description": "Water up to knee level…",
  "photo": "data:image/jpeg;base64,…",   // optional, resized to ≤1024 px
  "reportedAt": "2026-10-07T09:30:00.000Z",
  "status": "active"             // active | resolved
}
```

- Seed data: 12 demo reports across Beltola, Dispur, Maligaon, Six Mile,
  Jalukbari, Ganeshguri, Amingaon, etc. (approximate coordinates).
- Storage quota protection: if `localStorage` is full, photos are dropped
  oldest-first automatically; if storage is blocked, data is kept in memory
  with a warning.

## 🗺 Severity levels

| Level | Marker | Meaning |
|---|---|---|
| Low | 🟢 green | Water on roads, passable |
| Moderate | 🟡 yellow | Knee-deep, traffic disrupted |
| High | 🟠 orange | Shops/homes affected, hard to pass |
| Critical | 🔴 red | Ground floors inundated, people at risk |

## 🔮 Future backend options

Ready to plug in **Firebase**, **Supabase**, or **Node.js + Express** for:
database storage, user accounts, photo storage, real-time reports, admin
authentication and notifications. Swap the `FloodStore` methods in
`js/app.js` (`all`, `add`, `areas`, `stats`) with API calls — the rest of the
app doesn't need to change.
