# Kwikset Lock Controller

A local web app to control your Kwikset smart lock via the [Seam API](https://docs.seam.co).

**Features:** live lock status · lock / unlock · create & delete guest access codes · recent lock events · basic auth · mobile-first dark UI

---

## Prerequisites

- Node.js 18+
- A [Seam account](https://console.seam.co) with your Kwikset lock connected

---

## Setup

### 1. Clone and install

```bash
cd kwikset-lock-controller
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in the values:

| Variable | Description |
|---|---|
| `SEAM_API_KEY` | Your Seam API key from [console.seam.co](https://console.seam.co) |
| `SEAM_DEVICE_ID` | *(Optional)* Device ID of your lock. If blank, the first lock in your workspace is used. |
| `AUTH_USERNAME` | Username for the basic-auth login prompt |
| `AUTH_PASSWORD` | Password for the basic-auth login prompt — **change this** |

**Finding your device ID** (optional but recommended if you have multiple locks):

```bash
# install the Seam CLI
npx seam devices list --api-key YOUR_KEY
```

Copy the `device_id` of your Kwikset lock into `SEAM_DEVICE_ID`.

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Your browser will prompt for the username and password you set in `.env.local`.

### 4. Production build (optional)

```bash
npm run build
npm start
```

---

## Security notes

- The app is protected by HTTP Basic Auth via Next.js middleware — set a strong `AUTH_PASSWORD`.
- `.env.local` is git-ignored and never committed.
- The server never exposes your `SEAM_API_KEY` to the browser; all Seam calls happen server-side in API routes.
- For remote access, put the app behind a reverse proxy with TLS (e.g. nginx + Let's Encrypt).

---

## Project structure

```
kwikset-lock-controller/
├── middleware.ts                  # HTTP Basic Auth (edge middleware)
├── src/
│   ├── lib/seam.ts                # Seam client singleton
│   └── app/
│       ├── page.tsx               # Main UI (client component)
│       ├── layout.tsx
│       └── api/
│           ├── lock/route.ts      # GET status · POST lock/unlock
│           ├── access-codes/
│           │   ├── route.ts       # GET list · POST create
│           │   └── [id]/route.ts  # DELETE
│           └── events/route.ts    # GET recent events
├── .env.local.example
└── README.md
```
