# AirWatch SD — Local Aircraft Tracker

A personal aircraft tracking dashboard for San Diego. Shows live nearby aircraft on a map, flags likely military contacts, and keeps a local history of overhead sightings.

## Quick Start

```bash
cd aircraft-tracker
cp .env.local.example .env.local   # edit if your home coords differ
npm install
npm run dev
```

Open **http://localhost:3000**.

## Configuration

Edit `.env.local`:

```
HOME_LAT=32.7157           # your latitude
HOME_LON=-117.1611          # your longitude
HOME_RADIUS_MILES=25        # search radius
POLL_INTERVAL_SECS=10       # how often to fetch (min 5)
HISTORY_DAYS=7              # days of history to retain
```

No API keys required. Data comes from [adsb.lol](https://adsb.lol) (free, no auth).

## File Structure

```
src/
  lib/
    providers/
      types.ts          Domain types + AircraftProvider interface
      adsb-lol.ts       adsb.lol data provider (active)
      opensky.ts        OpenSky stub (extend to add)
    db/
      index.ts          SQLite singleton (better-sqlite3)
      schema.ts         Table definitions
      queries.ts        All DB read/write functions
    geo.ts              Haversine, bearing, compass helpers
    military.ts         Heuristic classifier (scoring + reasons)
    poller.ts           On-demand fetch orchestration + cache
  app/
    page.tsx            Live dashboard (map + aircraft list)
    aircraft/[hex]/     Aircraft detail view
    history/            Overhead sightings gallery
    api/
      aircraft/         GET /api/aircraft — live nearby aircraft
      aircraft/[hex]/   GET /api/aircraft/:hex — single aircraft
      history/          GET /api/history — overhead events
      status/           GET /api/status — poller status
  components/
    Map.tsx             Leaflet map (dark Carto tiles, custom icons)
    AircraftCard.tsx    Card with metrics + military badge
    AircraftList.tsx    Filterable, sortable list with search
    MilitaryBadge.tsx   Color-coded classification badge
    StatsBanner.tsx     Count breakdown header
    StatusBar.tsx       Live/stale indicator + last-fetch time
```

## Adding a Data Provider

Implement the `AircraftProvider` interface from `src/lib/providers/types.ts`:

```typescript
export class MyProvider implements AircraftProvider {
  readonly name = 'myprovider'

  async fetchNearby(lat: number, lon: number, radiusNm: number): Promise<AircraftFeed> {
    // fetch, normalize, return
  }
}
```

Then swap it in `src/lib/poller.ts`:

```typescript
const provider = new MyProvider()
```

Planned providers: FlightAware AeroAPI, OpenSky Network, local dump1090/readsb receiver feed.

## Military Classification

Scoring system (0–100+) based on:

| Signal | Points |
|--------|--------|
| `mil=1` flag in ADS-B data | +60 |
| ICAO hex in US military range (AE0000–AFFFFF) | +40 |
| Known military callsign prefix (NAVY, RCH, etc.) | +35 |
| Military aircraft type (E-2, P-8, F-35, etc.) | +25 |
| Military callsign pattern (alpha + digits) | +15 |
| Operating near military base (<5 nm) | +10 |
| Squawk 7777 (military intercept) | +15 |

Labels:
- **Likely Military** ≥ 70
- **Maybe Military** 50–69
- **Unknown** 25–49
- **Likely Civilian** < 25

Classification is heuristic and transparent — the detail view shows every reason an aircraft was scored.

## Data Storage

SQLite database at `./data/aircraft.db` (auto-created).

- `aircraft_snapshots` — every aircraft seen during a poll cycle
- `overhead_events` — deduplicated "visits" (aircraft within radius)
- `poll_state` — last fetch time and error state

History is auto-pruned after `HISTORY_DAYS` days.

## Architecture

**On-demand polling**: the frontend (SWR, 10s interval) hits `/api/aircraft`, which fetches fresh data from adsb.lol if the cache is stale. No background daemon needed — history accumulates while the dashboard is open.

**Provider abstraction**: all data sources implement `AircraftProvider`. The poller holds a single provider instance; swapping providers requires one line change.

**SQLite persistence**: `better-sqlite3` (synchronous) runs on the Next.js server. Fast enough for personal use, zero configuration.

## Recommended v2 Improvements

1. **Local receiver feed** — Connect a RTL-SDR + dump1090/readsb for true real-time data and coverage independent of internet
2. **Background daemon** — Continuous polling even when browser is closed (Node.js worker or system service)
3. **Push notifications** — Browser notifications for new military contacts or specific callsigns
4. **Track playback** — Animate historical tracks on the map
5. **Aircraft photo lookup** — Integrate Planespotters.net photo API by hex
6. **Favorites** — Pin interesting hexes to a watched list with persistent alerts
7. **ADS-B Exchange / FlightAware** — Add premium provider for richer metadata
8. **Export** — CSV/JSON export of history for analysis
9. **Aircraft database** — Local lookup for operator, home base, special mission flags
10. **Mobile view** — Responsive layout for quick phone checks
