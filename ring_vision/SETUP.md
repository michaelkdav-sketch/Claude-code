# RingVision — Setup Guide (Mac mini)

## Prerequisites

- macOS 12+ (Monterey or newer recommended)
- Python 3.11+ (`brew install python@3.11`)
- Homebrew (`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`)

---

## 1. Clone / navigate to the project

```bash
cd path/to/ring_vision
```

---

## 2. Create a virtual environment

```bash
python3.11 -m venv .venv
source .venv/bin/activate
```

---

## 3. Install system dependencies

InsightFace and OpenCV need a few system libs:

```bash
brew install cmake libomp
```

---

## 4. Install Python dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

> **Note:** The first run downloads the InsightFace `buffalo_sc` model (~100 MB) automatically.

---

## 5. Configure your Ring account

```bash
cp .env.example .env
```

Edit `.env`:

```env
RING_USERNAME=your@email.com
RING_PASSWORD=yourpassword
POLL_INTERVAL=15
RECOGNITION_THRESHOLD=0.5
NOTIFICATION_URLS=
```

---

## 6. First run — 2FA setup

If your Ring account has **Two-Factor Authentication** enabled (default for most accounts), the first run will prompt you in the terminal:

```
Enter OTP code for 2FA:
```

After you enter the code once, the token is saved to `storage/ring_token.json` and reused automatically on future starts.

---

## 7. Start the app

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Open your browser: **http://localhost:8000**

---

## 8. Connect Ring devices

1. Go to **Settings** in the web UI
2. Verify connection status shows **Connected**
3. Your Ring doorbell(s) will appear with battery status

---

## 9. Add people to Gallery

1. Navigate to **Gallery**
2. Click **Add Person**, enter a name
3. Upload 2–5 clear face photos per person
4. Embeddings are generated automatically on upload

---

## 10. Set up notifications (optional)

RingVision uses [Apprise](https://github.com/caronc/apprise) for notifications.

### Telegram (easiest)
1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Get your chat ID from `@userinfobot`
3. Add to `.env`: `NOTIFICATION_URLS=tgram://BOTTOKEN/CHATID`

### Email (Gmail)
```
NOTIFICATION_URLS=mailto://youruser:yourpassword@gmail.com
```

### Twilio WhatsApp
```
NOTIFICATION_URLS=twilio://ACCOUNT_SID:AUTH_TOKEN@+1XXXXXXXXXX/+1XXXXXXXXXX?from=whatsapp
```

Multiple services (comma-separated):
```
NOTIFICATION_URLS=tgram://token/chatid, mailto://user:pass@gmail.com
```

---

## Run as a background service (launchd)

Create `~/Library/LaunchAgents/com.ringvision.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.ringvision</string>
  <key>ProgramArguments</key>
  <array>
    <string>/path/to/ring_vision/.venv/bin/uvicorn</string>
    <string>main:app</string>
    <string>--host</string>
    <string>0.0.0.0</string>
    <string>--port</string>
    <string>8000</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/path/to/ring_vision</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/ringvision.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/ringvision.err</string>
</dict>
</plist>
```

Load it:
```bash
launchctl load ~/Library/LaunchAgents/com.ringvision.plist
```

---

## Known Limitations

| Area | Limitation |
|------|-----------|
| **API** | Ring uses an unofficial reverse-engineered API — could break on Ring app updates |
| **Real-time** | Events are polled (default 15s delay), not pushed instantly |
| **Live stream** | Uses time-limited recording URLs; continuous RTSP stream not available via this API |
| **2FA** | Must enter OTP code manually on first run |
| **Rate limiting** | Ring may temporarily block IPs making frequent requests |
| **Token expiry** | Tokens expire ~90 days; re-authentication required |

---

## Next Steps / Improvements

1. **Add a Nest camera** alongside Ring for a reliable real-time event source
2. **WebSocket push** — replace HTMX polling with server-sent events for instant dashboard updates  
3. **Multi-device** — extend polling to cover multiple Ring cameras simultaneously
4. **Clip download** — automatically archive video clips locally for each event
5. **Mobile PWA** — add a manifest + service worker for home-screen installation
