# Smart Home Dashboard

A local web app to control your **Kwikset Halo lock** (via Seam) and **Roborock Curv 2 Flow vacuum** (via Home Assistant) from a single mobile-first interface.

**Features:** lock / unlock · guest access codes with time bounds · lock event history · vacuum start / pause / dock · live status polling · HTTP Basic Auth · dark mobile-first UI

---

## Prerequisites

- Node.js 18+
- A [Seam account](https://console.seam.co) with your Kwikset lock connected
- A running [Home Assistant](https://www.home-assistant.io) instance with the Roborock integration set up

---

## Setup

### 1. Install

```bash
cd kwikset-lock-controller
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in all values (see table below).

### 3. Run

```bash
npm run dev        # development
npm run build && npm start   # production
```

Open [http://localhost:3000](http://localhost:3000) — your browser will prompt for the username and password you configured.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `SEAM_API_KEY` | Yes | From [console.seam.co](https://console.seam.co) → Settings → API Keys |
| `SEAM_DEVICE_ID` | No | Targets a specific lock; defaults to first lock in workspace |
| `HOME_ASSISTANT_URL` | Yes | Base URL of your HA instance, e.g. `http://homeassistant.local:8123` |
| `HOME_ASSISTANT_TOKEN` | Yes | Long-lived access token (see below) |
| `ROBOROCK_ENTITY_ID` | Yes | HA entity ID, e.g. `vacuum.roborock_curv_2` |
| `AUTH_USERNAME` | Yes | Basic Auth username |
| `AUTH_PASSWORD` | Yes | Basic Auth password — set something strong |

---

## Seam setup (Kwikset lock)

1. Create a free account at [console.seam.co](https://console.seam.co)
2. Go to **Devices → Connect a device** and link your Kwikset account
3. Copy your API key from **Settings → API Keys** into `SEAM_API_KEY`
4. Optionally find your lock's device ID:
   ```bash
   npx seam devices list --api-key YOUR_KEY
   ```
   Paste the `device_id` into `SEAM_DEVICE_ID` if you have more than one lock.

---

## Home Assistant setup (Roborock vacuum)

### 1. Install the Roborock integration

In Home Assistant: **Settings → Devices & Services → Add Integration → Roborock**

Sign in with your Roborock account. Home Assistant will discover your Curv 2 Flow and create a `vacuum.*` entity.

### 2. Find the entity ID

Go to **Settings → Devices & Services → Roborock → your device → Entities**.  
Look for the entity with domain `vacuum` — it will look like `vacuum.roborock_curv_2_flow` or similar.  
Copy that into `ROBOROCK_ENTITY_ID`.

You can also find it at **Developer Tools → States** — filter by `vacuum.`.

### 3. Create a long-lived access token

1. In HA, click your username (bottom-left) → **Profile**
2. Scroll to **Security → Long-Lived Access Tokens**
3. Click **Create Token**, give it a name (e.g. "Smart Home Dashboard"), copy the token
4. Paste it into `HOME_ASSISTANT_TOKEN`

> The token is shown only once — save it immediately.

### 4. Ensure HA is reachable from your Mac

The app talks to Home Assistant's REST API. If you're running both on the same network, `http://homeassistant.local:8123` usually works. If not, use the local IP address (e.g. `http://192.168.1.50:8123`).

To verify connectivity:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://homeassistant.local:8123/api/states/vacuum.your_entity_id
```
You should see a JSON response with the vacuum's current state.

---

## Security notes

- HTTP Basic Auth is enforced by Next.js edge middleware on every route.
- **Neither** `SEAM_API_KEY` nor `HOME_ASSISTANT_TOKEN` is ever sent to the browser — all API calls happen server-side.
- `.env.local` is git-ignored.
- For access outside your home network, put the app behind a reverse proxy with TLS (e.g. Caddy or nginx + Let's Encrypt).

---

## Project structure

```
kwikset-lock-controller/
├── middleware.ts                       # HTTP Basic Auth (edge)
├── src/
│   ├── lib/
│   │   ├── seam.ts                     # Seam client (Kwikset)
│   │   └── homeAssistant.ts            # HA REST client (Roborock)
│   └── app/
│       ├── page.tsx                    # Unified dashboard UI
│       ├── layout.tsx
│       └── api/
│           ├── lock/route.ts           # GET status · POST lock/unlock
│           ├── access-codes/
│           │   ├── route.ts            # GET list · POST create
│           │   └── [id]/route.ts       # DELETE
│           ├── events/route.ts         # GET lock events
│           └── roborock/
│               ├── status/route.ts     # GET vacuum state
│               ├── start/route.ts      # POST vacuum/start
│               ├── pause/route.ts      # POST vacuum/pause
│               └── dock/route.ts       # POST vacuum/return_to_base
├── .env.local.example
└── README.md
```
